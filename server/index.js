require("dotenv").config(); // MUST be first line

const { CohereClient } = require("cohere-ai");

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

//---------------------------------------------------------------------------------------------------------------

const { query } = require("./db");

const supabaseAuth = require("./middleware/temp_supabase");

const progressRoutes = require("./routes/progress");

const generateRoutes = require("./routes/generate");

console.log("DB URL:", process.env.DATABASE_URL);
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing");
  process.exit(1);
}

const express = require("express");
const cors = require("cors");

const Groq = require("groq-sdk");

const axios = require("axios");
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

// Timeout: 3 minutes
app.use((req, res, next) => {
  res.setTimeout(180000, () => {
    if (!res.headersSent) {
      console.log("Request has timed out.");
      res.status(408).send("Request has timed out");
    }
  });
  next();
});

app.use((req, res, next) => {
  console.log("➡️", req.method, req.url);
  next();
});

let notifications = [];

app.get("/health", async (req, res) => {
  try {
    await pool.query("select 1");
    res.json({ status: "ok", db: "connected" });
  } catch (e) {
    res.status(500).json({ error: "Database not connected" });
  }
});

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- KESTRA TRIGGER HELPER ---
// --- KESTRA TRIGGER HELPER ---
// --- KESTRA TRIGGER HELPER ---
// --- KESTRA TRIGGER HELPER ---
const triggerKestraTutor = async (unit, score, mistakes = []) => {
  try {
    const kestraUrl =
      "http://localhost:8080/api/v1/executions/webhook/looplingo.prod/looplingo_ai_tutor_v2/looplingo_secret_key";

    console.log("KESRA URL BEING USED:", kestraUrl);

    const response = await axios.post(kestraUrl, {
      user: "affi",
      unit,
      score,
      mistakes,
    });

    console.log("✅ Triggered Kestra:", response.data);
  } catch (error) {
    console.error("❌ KESTRA ERROR");

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else {
      console.error("Message:", error.message);
    }
  }
};

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- GENERATE ROUTE ---
app.post("/api/generate", async (req, res) => {
  // 1. Get variables (including difficulty)
  const {
    language,
    section,
    unit,
    vocabulary,
    grammar,
    type = "all",
    difficulty = 1,
  } = req.body;

  // 2. Calculate Word Count for Essays (Adaptive Difficulty)
  const wordCount = 60 + (difficulty - 1) * 30; // Level 1=60, Level 2=90...

  console.log(
    `Generating: ${language} | Type: ${type} | Level: ${difficulty} (~${wordCount} words)`
  );

  // 3. Vocabulary Constraints
  let vocabConstraint = "";
  if (vocabulary && vocabulary.length > 0) {
    const vocabList = vocabulary.join(", ");
    vocabConstraint = `
      STRICT VOCABULARY CONSTRAINT:
      You must ONLY use words from: [ ${vocabList} ] (plus basic connectors).
      EXCEPTION: You may use the INFINITIVE form of verbs (e.g., 'manger') inside parentheses.
    `;
  } else {
    vocabConstraint = "Use CEFR A1 beginner vocabulary.";
  }

  // 4. Logic Selection
  let requirementText = "";

  if (type === "all") {
    // 21 Questions (3 of each type) is safer for rate limits than 30
    requirementText = `
      Generate a JSON array with EXACTLY 21 exercises in this specific order:
      1. 3 questions of type "fill-in-the-blank".
      2. 3 questions of type "complete-the-sentence".
      3. 3 questions of type "translate".
      4. 3 questions of type "match-pairs".
      5. 3 questions of type "missing-verb".
      6. 3 questions of type "choose-article".
      7. 3 questions of type "gender-engagement-drill".
      
      TOTAL: 21 exercises.
    `;
  } else if (type === "listening-story") {
    requirementText = `
      Generate ONE object with type "listening-story".
      It must contain a "script" (Medium-Length Paragraph, 80-120 words, natural flow) based on the unit topic.
      It must contain a "questions" array (5 multiple-choice questions in ${language} about the script but 
      CRITICAL : in  bracket write the same question in ENGLISH too

      -EACH story must be DIFFERENT but the theme MUST BE SAME
      -the paragraph must be logical and not vulgar
      -it MUST contain 4 options with one CORRECT answer

      ABSOLUTE RULES:
        - NO self-introduction chains.
        - NO textbook narration.
        - NO literal translation from English.
        - NO repeating the same subject at sentence start.
        - MUST sound like spoken language.
        - MUST sound logical and must help in learning

    `;
  } else if (type === "essay-challenge") {
    // ✨ ADAPTIVE ESSAY LOGIC
    requirementText = `
      Generate ONE object with type "essay-challenge".
      
      INSTRUCTIONS:
      1. Write a cohesive, natural paragraph in English (approx ${wordCount} words).
      2. Style: Diary Entry, Email, or Story snippet.
      3. Topic: Must relate to '${unit}', but be creative.
      4. Difficulty: This is Level ${difficulty}. Increase sentence complexity as level goes up.
      
      OUTPUT:
      - "topic": Creative title.
      - "english_text": The English paragraph.
      - "french_reference": The ideal translation in ${language}.
    `;
  } else if (type === "match-pairs") {
    requirementText = `Generate exactly 5 questions of type "match-pairs".`;
  } else {
    requirementText = `Generate exactly 5 questions of type "${type}".`;
  }

  const prompt = `
  Role: Strict Language Curriculum Designer.
  Language: ${language}.
  Level: ${section}.
  Unit: ${unit}.
  
  ${vocabConstraint}
  GRAMMAR FOCUS: "${grammar || "General grammar for this level"}"
  
  TASK INSTRUCTIONS:
  ${requirementText}
  
  DIVERSITY RULES:
  1. NO REPEATS.
  2. VARY SUBJECTS / PERSONS / PARTICLES according to the language.
  3. ANSWER DISTRIBUTION: Ensure correct answers vary.
  4. ENSURE ANSWERS ARE DIFFERENT (Change the subject / form / structure).
  
  CRITICAL JSON RULES:
  1. Return ONLY raw JSON. No markdown.
  2. "options" ARRAY IS MANDATORY (unless explicitly excluded).
  3. "answer" MUST MATCH EXACTLY one of the options.
  
  IMPORTANT — LANGUAGE-SPECIFIC LOGIC (MANDATORY):
  You MUST strictly follow the grammatical rules of ${language}.
  
  This includes but is NOT limited to:
  - Agreement rules (if applicable)
  - Word order
  - Conjugation systems
  - Particles / cases / postpositions
  - Politeness levels
  - Gender (ONLY if the language has gender)
  - Articles (ONLY if the language uses articles)
  - Plurals (explicit or implicit depending on language)
  
  ⚠️ NEVER apply grammar rules that do not exist in ${language}.
  ⚠️ NEVER force French/English grammar onto another language.
  
  ====================================================
  EXERCISE TYPE RULES (LANGUAGE-AWARE)
  ====================================================
  
  IMPORTANT:
  ALL exercises MUST be generated **according to ${language} grammar**, not French unless ${language} === "French".
  
  ----------------------------------------------------
  - "essay-challenge":
  ----------------------------------------------------
  Rules:
  - Generate an essay challenge appropriate to ${language}.
  - NEVER reuse previous examples.
  - Avoid textbook clichés.
  - Produce a 60–80 word English paragraph ONLY.
  - Topic must match CEFR level and unit theme.
  - The paragraph must be realistic, modern, and natural.
  - Provide a correct reference version in ${language}.
  
  Output STRICT JSON:
  {
    "type": "essay-challenge",
    "topic": "string",
    "english_text": "string",
    "language_reference": "string"
  }
  
  ----------------------------------------------------
  - "listening-story":
  ----------------------------------------------------
  Rules:
  ROLE: Native language conversation writer.

          TASK:
          Generate ONE short listening story in ${language} suitable for CEFR ${section} learners.

          CRITICAL GOAL:
          This MUST sound like how real people speak, NOT how textbooks explain language.

          ABSOLUTE RULES (NON-NEGOTIABLE):
          1. NO robotic self-introductions.
          2. NO repetitive sentence openings.
          3. NO word-by-word translation from English.
          4. NO “exam style” sentences.
          5. NO listing personal facts sentence by sentence.

          LANGUAGE-SPECIFIC RULES (VERY IMPORTANT):

          IF language = Hindi:
          - Prefer formal Hindi.
          - Combine ideas naturally.
          - Drop unnecessary subjects when context is clear.
          - Write how people actually talk in daily life.

          IF language = Japanese:
          - Avoid overly formal textbook constructions.
          - Use casual or neutral polite form consistently.
          - Prefer dialogue over narration.

          IF language = French / Spanish / German:
          - Use natural spoken phrasing.
          - Avoid classroom-style examples.

          QUALITY FILTER (MANDATORY):
          Reject the story if:
          - The same subject appears at the start of consecutive sentences.
          - The paragraph sounds like a self-introduction.
          - The sentences feel translated rather than original.


  - Topic must match CEFR level and unit theme.
  - Then generate 5 multiple-choice questions in ${language}  but 
  - CRITICAL  : in bracket write the same question in ENGLISH too .
 but generate options in ${language} only
  Structure:
  [
    {
      "type": "listening-story",
      "title": "Title",
      "script": "Full text in ${language}",
      "questions": [
        { "id": 1, "question": "...", "options": [...], "answer": "..." }
      ]
    }
  ]
  
  ----------------------------------------------------
  - "fill-in-the-blank":
  ----------------------------------------------------
  RULES:
  - Use "___" for the blank.
  - Blank MUST test a grammar-dependent form:
    → article (if language has articles)
    → adjective agreement (if applicable)
    → verb conjugation
    → particle / case / suffix
  - NEVER blank words that do not change form in ${language}.
  - NEVER blank the subject if the language requires a fixed subject marker.
  - Topic must match CEFR level and unit theme.
  - Sentence MUST be natural in ${language}.
  - SET difficulty according to unit level.
  
  OPTIONS RULES:
  - options = [Correct, Distractor1, Distractor2, Distractor3]
  - Distractors must be grammatically WRONG in ${language}, not random.
  
  ---------------------------------------------------
  - "complete-the-sentence":
  ----------------------------------------------------
  GOAL:
  Choose the ONLY ending that makes a grammatically and logically correct sentence in ${language}.
  
  Rules:
  - Sentence stem must strongly constrain the ending.
  - Topic must match CEFR level and unit theme.
  - Ending length: 2–5 words.
  - Distractors must be grammatically valid but logically wrong.
  - NO repetition.
  
  ----------------------------------------------------
  - "translate":
  ----------------------------------------------------
  Rules:
  - Question language and answer language MUST match task direction.
  - WORD → word options only.
  - SENTENCE → sentence options only.
  - Same structure, same subject, same tense.
  - Distractors must be plausible translations but incorrect.
  - Topic must match CEFR level and unit theme.
  
  Options format:
  options: [correct, d1, d2, d3]
  
  ----------------------------------------------------
  - "match-pairs":
  ----------------------------------------------------
  Rules :  - Topic must match CEFR level and unit theme. 
 
  Structure:
  {
    "id": 1,
    "type": "match-pairs",
    "question": "Match the following terms",
    "pairs": [
      { "left": "Word in ${language}", "right": "English meaning" }
    ]
  }
  
  ----------------------------------------------------
  - "missing-verb":
  ----------------------------------------------------
  Rules:
  - Parentheses MUST contain the infinitive or dictionary form
    (according to ${language}).
  - The blank must require correct conjugation.
  - Topic must match CEFR level and unit theme.
  - NEVER put the conjugated form in parentheses.
  - Difficulty scales with unit level.
  
  ----------------------------------------------------
  - "choose-article":
  ----------------------------------------------------
  ONLY apply if ${language} USES ARTICLES.
  
  Rules:
  - Blank ONLY the article.
  - Respect gender / number / case rules of ${language}.
  - Distractors must fail agreement rules.
  - Topic must match CEFR level and unit theme.
  
  ----------------------------------------------------
  - "choose-preposition":
  ----------------------------------------------------
  Rules:
  - Target real prepositions / particles used in ${language}.
  - Options must be grammatically valid but incorrect.
  - Topic must match CEFR level and unit theme.
  - Difficulty must match unit level.
  
  ----------------------------------------------------
  - "gender-engagement-drill":
  ----------------------------------------------------
  ONLY apply if ${language} HAS GENDER AGREEMENT.
  
  Rules:
  - Target adjective or noun forms.
  - Options must include correct + incorrect gender/number forms.
  - No repetition.
  - Topic must match CEFR level and unit theme.
  
  ====================================================
  FINAL OUTPUT RULE
  ====================================================
  Return ONLY valid JSON.
  No explanations.
  No markdown.
  No comments
  
  Output Structure Example:
  [
    { "id": 1, "type": "fill-in-the-blank", "question": "...", "answer": "...", "options": [...] }
  ]
  `;
  //-------------------------------------------------------------------------------------------------
  try {
    // const completion = await groq.chat.completions.create({
    //   messages: [{ role: "user", content: prompt }],
    //   model: "llama-3.1-8b-instant",
    //   temperature: 0.3,
    //   max_tokens: 3000,
    // });

    // const text = completion.choices[0]?.message?.content || "";
    const response = await cohere.chat({
      model: "command-light",

      // REQUIRED
      message: prompt,

      // OPTIONAL (but allowed)
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],

      temperature: 0.3,
      maxTokens: 3000,
    });

    const text = response.text || "";

    //-------------------------------------------------------------------------------------------------
    // --- JSON CLEANER ---
    let cleanText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const firstSquare = cleanText.indexOf("[");
    const firstCurly = cleanText.indexOf("{");
    let startIdx = -1;
    let endIdx = -1;

    if (firstSquare !== -1 && (firstCurly === -1 || firstSquare < firstCurly)) {
      startIdx = firstSquare;
      endIdx = cleanText.lastIndexOf("]");
    } else if (firstCurly !== -1) {
      startIdx = firstCurly;
      endIdx = cleanText.lastIndexOf("}");
    }

    if (startIdx !== -1 && endIdx !== -1) {
      cleanText = cleanText.substring(startIdx, endIdx + 1);
      try {
        let parsed = JSON.parse(cleanText);
        // Normalize single object (story/essay) to array for frontend
        if (!Array.isArray(parsed)) parsed = [parsed];

        res.json({ exercises: parsed });
      } catch (e) {
        console.error("JSON PARSE ERROR:", e);
        console.log("RAW TEXT:", text); // Check terminal if error persists
        res.status(500).json({ error: "Invalid JSON from AI" });
      }
    } else {
      console.error("NO JSON FOUND");
      res.status(500).json({ error: "No JSON found" });
    }
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "Failed to generate content." });
  }
});

// --- NEW: GRADE ESSAY ROUTE ---
// --- GRADE ESSAY ROUTE (FIXED) ---
app.post("/api/grade-essay", async (req, res) => {
  const { userText, originalText, referenceText, language } = req.body;
  console.log("Grading Essay...");

  const prompt = `
    Role: Strict Language Professor.
    Language: ${language}.
    
    TASK: Grade the student's translation.
    Original English: "${originalText}"
    Ideal Target (${language}): "${referenceText}"
    Student Input: "${userText}"
    
    INSTRUCTIONS:
    1. Check for grammar, vocabulary, and meaning.
    2. Give a score (0-100).
    3. The "feedback" MUST BE IN ENGLISH.
    4. Provide the "corrected" version.
    
    OUTPUT JSON ONLY:
    { "score": number, "feedback": "string", "corrected": "string" }
  `;
  //----------------------------------------------------------------------------------
  try {
    // ✨ FIX: USING GROQ HERE INSTEAD OF OPENAI
    // const completion = await groq.chat.completions.create({
    //   messages: [{ role: "user", content: prompt }],
    //   model: "llama-3.1-8b-instant",
    //   temperature: 0.1,
    // });

    // const text = completion.choices[0]?.message?.content || "";
    const response = await cohere.chat({
      model: "command-light",

      // REQUIRED
      message: prompt,

      // OPTIONAL (but allowed)
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],

      temperature: 0.3,
      maxTokens: 3000,
    });

    const text = response.text || "";

    //-------------------------------------------------------------------------------
    let cleanText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const firstBrace = cleanText.indexOf("{");
    const lastBrace = cleanText.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1) {
      const jsonResult = JSON.parse(
        cleanText.substring(firstBrace, lastBrace + 1)
      );

      // Trigger Kestra
      triggerKestraTutor("Essay Challenge", jsonResult.score, [
        { question: "Essay", wrongAnswer: jsonResult.feedback },
      ]);

      res.json(jsonResult);
    } else {
      res.status(500).json({ error: "Grading JSON invalid" });
    }
  } catch (error) {
    console.error("Grading Error:", error);
    res.status(500).json({ error: "Grading failed" });
  }
});

// --- CHECK ROUTE (FIXED: Using Groq now) ---
app.post("/api/check", async (req, res) => {
  const { question, userAnswer, language, type } = req.body;
  const prompt = `
        Role: Teacher. Lang: ${language}.
        Check answer: "${userAnswer}" for Question: "${question}".
        Return JSON: { "isCorrect": boolean, "correctAnswer": "string", "explanation": "string" }
    `;
  //-------------------------------------------------------------------------------------------------
  try {
    // const completion = await groq.chat.completions.create({
    //   messages: [{ role: "user", content: prompt }],
    //   model: "llama-3.1-8b-instant",
    // });
    // const text = completion.choices[0]?.message?.content || "";
    const response = await cohere.chat({
      model: "command-light",

      // REQUIRED
      message: prompt,

      // OPTIONAL (but allowed)
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],

      temperature: 0.3,
      maxTokens: 3000,
    });

    const text = response.text || "";

    //-----------------------------------------------------------------------------------------------
    const cleanText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const firstBrace = cleanText.indexOf("{");
    const lastBrace = cleanText.lastIndexOf("}");
    res.json(JSON.parse(cleanText.substring(firstBrace, lastBrace + 1)));
  } catch (error) {
    res.status(500).json({ error: "Check failed" });
  }
});

// 1. NEW: Route for Kestra to send data BACK to us
app.post("/api/kestra-callback", (req, res) => {
  const { user, message, type } = req.body;
  console.log("🔔 Notification Received from Kestra:", message);

  // Add to our "Database"
  notifications.unshift({
    id: Date.now(),
    user,
    message,
    type, // 'success' or 'warni ng'
    read: false,
    timestamp: new Date(),
  });

  res.json({ success: true });
});

// 2. NEW: Route for Frontend to fetch notifications
app.get("/api/notifications", (req, res) => {
  res.json(notifications);
});

// 3. NEW: Route to clear notifications
app.post("/api/notifications/clear", (req, res) => {
  notifications = [];
  res.json({ success: true });
});

// --- NEW ROUTE: END SESSION (This triggers Kestra for Worksheets)
app.post("/api/end-session", async (req, res) => {
  const { user, score, mistakes } = req.body;

  console.log(`🚀 Ending Session for ${user}. Score: ${score}%`);

  try {
    // Call our helper function to notify Kestra
    await triggerKestraTutor("Session Review", score, mistakes);

    res.json({ success: true, message: "Report generated!" });
  } catch (error) {
    console.error("Kestra Error:", error.message);
    res.status(500).json({ error: "Failed to trigger analysis" });
  }
});

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("LoopLingo backend is running.");
});

app.post("/users", async (req, res) => {
  try {
    const { email } = req.body;

    const result = await pool.query(
      "INSERT INTO users (email) VALUES ($1) RETURNING *",
      [email]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("DB ERROR:", err); // 👈 THIS LINE
    res.status(500).json({ error: err.message });
  }
});

app.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Create auth user
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) throw error;

    const userId = data.user.id;

    // 2. Insert into users table
    const { error: dbError } = await pool.query(
      "insert into users (id, email) values ($1, $2)",
      [userId, email]
    );

    if (dbError) throw dbError;

    res.json({ success: true, userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  res.json({
    user: data.user,
    session: data.session,
  });
});

app.get("/me", supabaseAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
  });
});

app.use("/progress", progressRoutes);
app.use("/generate", generateRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

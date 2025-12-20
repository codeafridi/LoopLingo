const express = require("express");
const cors = require("cors");
require("dotenv").config();
const Groq = require("groq-sdk");

const axios = require("axios");

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
      It must contain a "questions" array (5 multiple-choice questions in English about the script).
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
        2. VARY SUBJECTS (Je, Tu, Il, Elle...).
        3. ANSWER DISTRIBUTION: Ensure correct answers vary.
        4. ENSURE ANSWERS ARE DIFFERENT (Change the pronoun!).

        CRITICAL JSON RULES:
        1. Return ONLY raw JSON. No markdown.
        2. "options" ARRAY IS MANDATORY.
        3. "answer" MUST MATCH EXACTLY one of the options.

        SPECIFIC INSTRUCTIONS FOR OPTIONS:


        - "essay-challenge":
           You generate French essay challenges.

           Rules:
             - NEVER reuse previous examples.
             - AVOID typical textbook clichés: boy, girl, dog, cat, pizza, croissant.
             - Produce unique scenarios every time with new names, new settings, new daily-life contexts.
             - Use vocabulary that matches the CEFR level.
             - Generate a 60-80 word English paragraph ONLY.
             - Topic must match the CEFR unit theme.
             - The paragraph must be realistic, modern, and natural.
             - NO repeated structures.
             Output STRICT JSON:
                {
                  "type": "essay-challenge",
                  "topic": "string",
                  "english_text": "string",
                  "french_reference": "string"
                }



                 
        - "listening-story":
            - Create a coherent short story/dialogue in ${language}.
            - Then 5 multiple choice questions in English.
            - Structure:
              [
                {
                  "type": "listening-story",
                  "title": "Title",
                  "script": "Full text...",
                  "questions": [ { "id": 1, "question": "...", "options": [...], "answer": "..." } ]
                }
              ]

        - "fill-in-the-blank":
            RULES FOR ALL QUESTIONS:
              - Use "___" for the blank.
              - The blank must be a SINGLE WORD.
              - The blanked word must be something whose form depends on grammar:
                → article, adjective, verb conjugation, noun number, pronoun.
              - NEVER blank the subject ("Je", "Tu", "Il", "Elle").
              - NEVER blank a word that is identical in all forms (example: "fille").
              - NEVER blank a word that does not require agreement.
              - The sentence must ALWAYS be natural and valid French.
              -CRITICAL : DO NOT REPEAT THE SAME QUESTIONS.
              -SET DIFFICULTY ACCORDING TO UNIT LEVEL
              -CRITICAL  :  THE QUESTIONS "MUST" MAKE SENSE AS IF YOU ARE USING THEM IN REAL LIFE.

              ANSWER RULES:
              - "answer" must be the ONLY fully correct option.
              - Must obey gender agreement.
              - Must obey number agreement.
              - Must obey adjective agreement.
              - Must obey determiner agreement.
              - Must obey verb conjugation rules based on the subject.

              OPTIONS RULES:
              - "options" MUST be: [Correct, Distractor1, Distractor2, Distractor3].
              - All 4 options must be DIFFERENT.
              - Distractors must be WRONG because of gender/number/verb disagreement.
              - Distractors must still look realistic (not random words).

              FORMAT (STRICT JSON):
              [
                {
                  "id": 1,
                  "type": "fill-in-the-blank",
                  "question": "Sentence with ___ blank.",
                  "answer": "correct_word",
                  "options": ["correct_word", "distractor1", "distractor2", "distractor3"]
                }
              ]

              EXAMPLES OF VALID BLANK TYPES:
              - Articles: "Je vois ___ chat." → ["un", "une", "des", "le"]
              - Adjectives: "La maison est très ___." (blanc) → ["blanche", "blanc", "blancs", "blanches"]
              - Verbs: "Nous ___ au cinéma." (aller) → ["allons", "va", "allez", "vais"]
              - Nouns (only plural/singular agreement): "Il a deux ___." (chien) → ["chiens", "chien", "chiennes", "chiens?"]

              PROHIBITED CASES:
              - NO noun identity blanking (❌ "La fille est ___ (fille)")
              - NO blanks with prepositions
              - NO random vocabulary blanks
              - NO repeated options
              - NO English words


       - "complete-the-sentence":
           GOAL:
              The learner must choose the ONLY sentence ending that creates a logically correct, natural French sentence.

              RULES FOR THE QUESTION:
              - Provide a natural and grammatically correct French sentence stem ending with “___”.
              - The stem must strongly constrain what type of ending makes sense.
              - The ending must be a SHORT phrase (2–5 words), not a full sentence.
              - The meaning MUST fit logically with the sentence stem.
              -SET DIFFICULTY ACCORDING TO THE UNITS LEVEL. NO REPETITIONS
              

              RULES FOR THE CORRECT ANSWER:
              - Must be the ONLY grammatically correct AND logically meaningful continuation.
              - Must match tense, gender, person, and logic of the stem.
              - Must NOT repeat part of the stem.
              - Must NOT contradict the stem (ex: "Le matin, j'aime le soir" — FORBIDDEN).

              RULES FOR DISTRACTORS:
              - Must be grammatically valid FRENCH phrases but WRONG in meaning or logic.
              - Must be plausible enough to not look random.
              - Must NOT be nonsense phrases (“dormir noir”, “une table” for eating, etc.).
              - Must NOT accidentally create a valid sentence.
              - Must NOT rhyme or resemble the correct answer.

              STRUCTURE:
              Return an array of 5 items, each formatted EXACTLY like this:

              {
                "id": 1,
                "type": "complete-the-sentence",
                "question": "Sentence stem with ___",
                "answer": "correct_phrase",
                "options": ["correct_phrase", "d1", "d2"]
              }

              EXAMPLES OF GOOD QUESTIONS:
              - "Le matin, j’aime ___."  → ["manger un croissant", "regarder la lune", "porter un manteau rouge"]
              - "En été, nous aimons ___."  → ["aller à la plage", "faire un feu", "cuisiner une soupe chaude"]
              - "Quand il pleut, ils préfèrent ___." → ["rester à la maison", "prendre le soleil", "jouer au sable"]
              - "Avant de dormir, elle aime ___." → ["lire un livre", "faire du vélo", "manger un steak"]

              FORBIDDEN:
              - No English anywhere.
              - No full sentences as answers.
              - No nonsensical distractors.
              - No distractors that accidentally also fit the sentence.
              - No placeholders or empty text.
              - CRITICAL : NEVER REPEAT THE SAME QUESTION

        - "translate":
            You MUST generate:
          - "question":  a sentence to translate (based on difficulty)
           - "answer": The EXACT correct translation.
            - "options": MUST follow these rules:

              STRICT OPTIONS RULES:
              1. If the question is a WORD → options MUST be ONLY single words.
              2. If the question is a SENTENCE → options MUST be FULL sentences.
              3. Options MUST be grammatically valid.
              4. Options MUST be similar in structure to the answer (same length/type).
              5. NO emotional or unrelated sentences (no “The cat is tired.” etc.)
              6. CRITICAL : NO REPEATED QUESTIONS!!!.
              7. CRITICAL : SET QUESTIONS ACCORDING TO DIFFICULTY OF UNITS LEVEL
              7. EXACT FORMAT:
                options: [correct, distractor1, distractor2, distractor3]

                WORD EXAMPLES (Correct format):
                  Question: "Translate the word 'cat' to French."
                  Answer: "chat"
                  Options: ["chat", "chien", "rat", "femme"]

                SENTENCE EXAMPLES (Correct format):
                  Question: "Translate: 'The cat is sleeping.' to French."
                  Answer: "Le chat dort."
                  Options: ["Le chat dort.", "Le chat mange.", "Le chat joue.", "Le chat court."]

                YOU MUST FOLLOW:
                  - Same subject
                  - Same structure
                  - All options must be plausible translations but WRONG

        - "match-pairs":
            Structure:
            {
                "id": 1,
                "type": "match-pairs",
                "question": "Match the following terms",
                "pairs": [
                    { "left": "FrenchWord1", "right": "EnglishTranslation1" },
                    { "left": "FrenchWord2", "right": "EnglishTranslation2" },
                    { "left": "FrenchWord3", "right": "EnglishTranslation3" },
                    { "left": "FrenchWord4", "right": "EnglishTranslation4" }
                ]
            }
        - "missing-verb" (Conjugation Focus):
           - The word in parentheses MUST be the INFINITIVE (ending in -er, -ir, -re).
           - Ex: { "question": "Tu ___ (manger) une pizza.", "answer": "manges", ... }
           - Ex: { "question": "Nous ___ (avoir) un chien.", "answer": "avons", ... }
           - NEVER put the conjugated form in parentheses.
           - ENSURE ANSWERS ARE DIFFERENT (Change the pronoun!).
           -SET DIFFICULTY ACCORDNG TOT THE UNITS LEVEL MORE QUESTIONS MORE DIFFICULTY


        - "choose-article":
           RULES FOR ALL QUESTIONS:
            - The blank must replace ONLY an article (definite or indefinite).
            - Allowed articles: ["le", "la", "les", "l'", "un", "une", "des", "du", "de la"].
            - The sentence must be 100% natural and valid French.
            - NEVER blank anything except the article.
            - The noun following the blank MUST determine the correct gender/number.
            -SET DIFFICULTY ACCORDNG TOT THE UNITS LEVEL MORE QUESTIONS MORE DIFFICULTY

            ANSWER RULES:
            - "answer" must be the ONLY correct article that agrees with the noun.
            - Respect gender:
              - masculine singular → le / un
              - feminine singular → la / une
              - plural → les / des
              - vowel/h-muet → l'
            - Respect partitive:
              - du (masc mass noun), de la (fem mass noun)

            OPTIONS RULES:
            - "options" MUST be: ["correct", "d1", "d2", "d3"].
            - All 4 options must be DIFFERENT.
            - Distractors must be INCORRECT due to gender/number mismatch.
            - Do NOT use unrelated distractors (ex: “à”, “de”, “pour” ❌)

            FORMAT (STRICT JSON ONLY):
            [
              {
                "id": 1,
                "type": "choose-article",
                "question": "Sentence with ___ blank.",
                "answer": "correct_article",
                "options": ["correct_article", "d1", "d2", "d3"]
              }
            ]

            VALID EXAMPLES FOR THE AI TO FOLLOW:
            - "Le garçon est ___ ami." → ["un", "une", "des", "le"]
            - "Elle mange ___ pomme." → ["une", "un", "des", "la"]
            - "Ils regardent ___ étoiles." → ["les", "des", "la", "un"]
            - "Je veux ___ eau." → ["de l'", "du", "de la", "des"]
            - "C’est ___ chien adorable." → ["un", "une", "des", "le"]

            PROHIBITED CASES:
            - NO blanking nouns or adjectives.
            - NO options with same value repeated.
            - NO English anywhere.
            - NO irrelevant distractors.
            -NO REPETITION OF QUESTIONS
           - USE THE FOLLOWING ARTICLES: Le/La/Les/Un/Une/Des/du/de la/des/d'un/d'une/d'un/d'une/etc... .

       - "choose-preposition":
           - Target: Common prepositions (à, de, pour, sur, sous, dans, chez, en, avec,etc... according to the units level).
           - Question: Sentence with the preposition missing.
           - Options: [Correct, 3 Distractors].
           - Ex: { "question": "Je vais ___ Paris.", "answer": "à", "options": ["à", "en", "pour", "de"] }
           - Ex: { "question": "Il rentre ___ lui.", "answer": "chez", "options": ["chez", "à", "dans", "sur"] }
           -SET THE DIFFICULTY OF THE QUESTION ACCORDING TO THE UNITS LEVEL.


        - "gender-engagement-drill":
           
           - Target: Adjective agreements or Noun endings based on gender.
           - Question: A sentence with an adjective/noun missing.
           - Options: [Masculine form, Feminine form, Plural forms].
           - Ex: { "question": "La maison est ___ (blanc).", "answer": "blanche", "options": ["blanc", "blanche", "blancs"] }
           - Ex: { "question": "Il est ___ (heureux).", "answer": "heureux", "options": ["heureuse", "heureux", "heureuses"] }
           -CRITICAL RULE: ENSURE EACH ANSWER IS DIFFERENT.
           -CRITICAL RULE: QUESTIONS SHOULD NOT BE REPETITIVE.
           -CRITICAL RULE: SET THE DIFFICULTY OF THE QUESTION ACCORDING TO THE UNITS LEVEL.



        Output Structure Example:
        [
            { "id": 1, "type": "fill-in-the-blank", "question": "...", "answer": "...", "options": [...] }
        ]
    `;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 3000,
    });

    const text = completion.choices[0]?.message?.content || "";

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

  try {
    // ✨ FIX: USING GROQ HERE INSTEAD OF OPENAI
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
    });

    const text = completion.choices[0]?.message?.content || "";
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
  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
    });
    const text = completion.choices[0]?.message?.content || "";
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
    type, // 'success' or 'warning'
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

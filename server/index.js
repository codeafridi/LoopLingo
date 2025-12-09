const express = require("express");
const cors = require("cors");
require("dotenv").config();
const OpenAI = require("openai"); // We use the OpenAI SDK to talk to OpenRouter

const app = express();
app.use(cors());
app.use(express.json());

// Timeout set to 3 minutes
app.use((req, res, next) => {
  res.setTimeout(180000, () => {
    if (!res.headersSent) {
      console.log("Request has timed out.");
      res.status(408).send("Request has timed out");
    }
  });
  next();
});

// --- OPENROUTER SETUP (Accessing Qwen) ---
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY, // Make sure this is in your .env
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000", // Required by OpenRouter
    "X-Title": "LoopLingo",
  },
});

// --- GENERATE ROUTE ---
app.post("/api/generate", async (req, res) => {
  const {
    language,
    section,
    unit,
    vocabulary,
    grammar,
    type = "all",
  } = req.body;
  console.log(
    `Generating with Qwen 2.5: ${language} | ${unit} | Type: ${type}`
  );

  // 1. Vocabulary Constraints
  let vocabConstraint = "";
  if (vocabulary && vocabulary.length > 0) {
    const vocabList = vocabulary.join(", ");
    vocabConstraint = `
      STRICT VOCABULARY CONSTRAINT:
      You must ONLY use words from the following list (plus basic grammar connectors like 'a', 'the', 'is', 'and'):
      [ ${vocabList} ]

       CRITICAL EXCEPTION: You may use the INFINITIVE form of verbs (like 'manger', 'avoir', 'être' and many more) inside parentheses for grammar questions, even if they are not in the list.
      DON'T LIMIT THE INFINITIVE FORM OF VERBS TO ONLY THE ONES IN THE LIST.USE DIFFERENT VERBS FOR EACH QUESTION.
      USE THE DIFFICULTY OF THE VERBS ACCORDING TO THE UNITS LEVEL.
      DO NOT use any advanced vocabulary that is not in this list. 
      If you need a noun/verb not in the list, rephrase the sentence to use words from the list.
      `;
  } else {
    vocabConstraint =
      "Use only CEFR A1 beginner vocabulary suitable for this specific unit.";
  }

  // 2. Question Count Logic
  let requirementText = "";

  if (type === "all") {
    requirementText = `
      Generate a JSON array with EXACTLY 30 exercises in this specific order:
      1. 5 questions of type "fill-in-the-blank".
      2. 5 questions of type "complete-the-sentence".
      3. 5 questions of type "translate".
      4. 5 questions of type "match-pairs" (Each containing 4 pairs).
      5. 5 questions of type "missing-verb" (Grammar/Conjugation focus).
      6. 5 questions of type "choose-article" (Focus on Le/La/Les/Un/Une/Des/du/de la/des/d'un/d'une/d'un/d'une/etc...).
      
      TOTAL: 30 exercises. You MUST generate all 6 types.
    `;
  } else if (type === "listening-story") {
    requirementText = `
      Generate ONE object with type "listening-story".
      It must contain a "script" (80-120 words in ${language}) based on the unit topic.
      It must contain a "questions" array (5 multiple-choice questions in English about the script).
    `;
  } else if (type === "match-pairs") {
    requirementText = `Generate exactly 5 questions of type "match-pairs" (Each with 4 pairs).`;
  } else {
    requirementText = `Generate exactly 5 questions of type "${type}".`;
  }

  const prompt = `
        Role: Strict Language Curriculum Designer.
        Task: Create a worksheet for ${language}.
        Level: ${section}
        Topic: ${unit}

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
            -Use '___' for the blank. 
            -"options": [Correct Answer, Distractor 1, Distractor 2, Distractor 3].
            -ENSURE EACH ANSWER IS DIFFERENT.
            -ANSWERS SHOULD NOT BE REPETITIVE 
            -COVER WIDE VARIETY OF WORDS.
            - Distractors: Words that fit the sentence but DO NOT match the English hint STRICTLY.
            - RULE 3 (OPTIONS): The "options" array MUST contain the "answer"string.
            - RULE 4 (GENDER/NUMBER/VERB AGREEMENT): Check all grammar rules.
            - WHEN GIVING CORRECT ANSWER ALSO MENTION THE MEANING OF THE WORD IN ENGLISH IN A BRACKET.
        
        - "complete-the-sentence": 
            - QUESTION STYLE: Give the FIRST HALF of a sentence.
            - OPTIONS STYLE: Must be PHRASES or CLAUSES.
            - CRITICAL: DO NOT use single words.
            - LOGIC: The correct answer must logically finish the thought.
            - CRITICAL RULE: The question must set a CLEAR CONTEXT so only one answer is logically possible.
        
        - "translate": 
            - GIVE THE QUESTION IN THE FORM OF SENTENCE AND ANSWER IN THE FORM OF SENTENCE.
            - Mix 80% English->${language}, 20% ${language}->English.
            - "options": [Scrambled words of the answer + 3 extra distractor words].

        - "match-pairs":
            Structure:
            {
                "id": 1,
                "type": "match-pairs",
                "question": "Match the following terms",
                "pairs": [
                    { "left": "FrenchWord1", "right": "EnglishTranslation1" },
                    // ... 4 pairs
                ]
            }
        - "missing-verb" (Conjugation Focus):
           - The word in parentheses MUST be the INFINITIVE.
           - NEVER put the conjugated form in parentheses.
           - ENSURE ANSWERS ARE DIFFERENT.

        - "choose-article":
           - Target: Definite or Indefinite articles.
           - Question: Sentence with the article missing.
           - Options: List of articles.

        - "choose-preposition":
           - Target: Common prepositions.
           - Question: Sentence with the preposition missing.

        Output Structure Example:
        [
            { "id": 1, "type": "fill-in-the-blank", "question": "...", "answer": "...", "options": [...] }
        ]
    `;

  try {
    const completion = await openai.chat.completions.create({
      // ✨ USING QWEN 2.5 72B
      model: "qwen/qwen-2.5-7b-instruct",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
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

    // Smartly find if it's an Array [...] or Object {...}
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

        // Normalize single object to array (for Listening Story or single gens)
        if (!Array.isArray(parsed)) parsed = [parsed];

        // Handle nested "exercises" key if AI adds it
        if (parsed[0] && parsed[0].exercises) parsed = parsed[0].exercises;

        res.json({ exercises: parsed });
      } catch (parseError) {
        console.error("JSON PARSE ERROR:", parseError.message);
        console.log("RAW TEXT:", text);
        res.status(500).json({ error: "Invalid JSON from AI." });
      }
    } else {
      console.error("NO JSON FOUND");
      res.status(500).json({ error: "No JSON found" });
    }
  } catch (error) {
    console.error("OpenRouter Error:", error);
    res.status(500).json({ error: "Failed to generate exercises" });
  }
});

// --- CHECK ROUTE ---
app.post("/api/check", async (req, res) => {
  const { question, userAnswer, language, type } = req.body;
  const prompt = `
        Role: Teacher. Lang: ${language}.
        Check answer: "${userAnswer}" for Question: "${question}".
        Return JSON: { "isCorrect": boolean, "correctAnswer": "string", "explanation": "string" }
    `;
  try {
    const completion = await openai.chat.completions.create({
      model: "qwen/qwen-2.5-72b-instruct",
      messages: [{ role: "user", content: prompt }],
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
    console.error(error);
    res.status(500).json({ error: "Check failed" });
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));

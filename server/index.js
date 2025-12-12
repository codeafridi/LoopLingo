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

// --- KESTRA TRIGGER HELPER ---
const triggerKestraTutor = async (unit, score) => {
  try {
    // This URL matches the Flow ID you created in Kestra
    const kestraUrl =
      "http://localhost:8080/api/v1/executions/webhook/looplingo.prod/looplingo_ai_tutor/looplingo_secret_key";

    await axios.post(kestraUrl, {
      user: "Student",
      unit: unit || "General Practice",
      score: score,
      timestamp: new Date().toISOString(),
    });
    console.log(`✅ Triggered Kestra: Score ${score}%`);
  } catch (error) {
    console.error(
      "⚠️ Kestra Trigger Failed (Is Docker running?):",
      error.message
    );
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
              Output ONLY the English paragraph.


                 
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

              - RULE 3 (OPTIONS): The "options" array MUST contain the "answer"string. Do not generate a list of options that excludes the correct answer.
              - RULE 4 (GENDER AGREEMENT): Check the article before the blank AND MAKE SURE THE GENDER IS CORRECT.
              - RULE 5 (NUMBER AGREEMENT): Check the number before the blank AND MAKE SURE THE NUMBER IS CORRECT.
              - RULE 6 (VERB CONJUGATION): Check the verb before the blank AND MAKE SURE THE VERB IS CORRECT.
              - RULE 7 (ADJECTIVE AGREEMENT): Check the adjective before the blank AND MAKE SURE THE ADJECTIVE IS CORRECT.
              - RULE 8 (NOUN AGREEMENT): Check the noun before the blank AND MAKE SURE THE NOUN IS CORRECT.
              - RULE 9 (PREPOSITION AGREEMENT): Check the preposition before the blank AND MAKE SURE THE PREPOSITION IS CORRECT.
              - RULE 10 (ARTICLE AGREEMENT): Check the article before the blank AND MAKE SURE THE ARTICLE IS CORRECT.
              - RULE 11 (DETERMINER AGREEMENT): Check the determiner before the blank AND MAKE SURE THE DETERMINER IS CORRECT.
              - Options: [Correct, Distractor1, Distractor2, Distractor3].


       - "complete-the-sentence":
            - QUESTION STYLE: Give the FIRST HALF of a sentence (e.g., "Pour aller au marché, je...").
            - OPTIONS STYLE: Must be PHRASES or CLAUSES .
            - CRITICAL: DO NOT use single words as options.
            - Example Question: "Le matin, j'aime..."
            - Example Answer: "manger un croissant."
            - Example Distractors: ["le soir.", "dormir noir.", "une table."]
            - LOGIC: The correct answer must logically and grammatically finish the thought.
            - CRITICAL RULE: SET THE DIFFICULTY OF THE QUESTION ACCORDING TO THE UNITS LEVEL.
            - ALSO MENTION SOME LONG SENTENCES AS QUESTIONS AND ANSWERS.
            - CRITICAL RULE: The question must set a CLEAR CONTEXT so only one answer is logically possible.
            - GOOD FORMAT: "Goal -> Action" or "Condition -> Consequence".
            - Example Q: "J'ai très faim, alors je..." (I am very hungry, so I...)
            - Example A: "...mange une pizza." (eat a pizza.)
            - Example Distractors (Must be illogical): ["...dors dans le lit.", "...vais au cinéma.", "...suis content."]
            - AVOID GENERIC STARTERS like "Je vais..." because anything can follow.


        - "translate":
            - GIVE THE QUESTION IN THE FORM OF SENTENCE AND ANSWER IN THE FORM OF SENTENCE.
            - EXAMPLE: Question: "Translate the following sentence: 'The cat is sleeping.' to French."
            - Answer: "Le chat est endormi."
            - SET THE DIFFICULTY OF THE QUESTION ACCORDING TO THE UNITS LEVEL.
            -ALSO INCLUDE FEW WORDS ALONE AS QUESTIONS. EXAMPLE: Question: "Translate the word 'chat' to French."
            - Answer: "chat" (make sure the difficulty of the word is according to the units level.)
            -MAKE SURE YOU ASK QUESTIONS TO CONVERT FROM  ENGLISH TO FRENCH 80% OF THE TIME AND FROM FRENCH TO ENGLISH 20% OF THE TIME.

            "options": [Scrambled words of the answer + 3 extra distractor words].

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


        - "choose-article":
           - Target: Definite (le/la/les/l') or Indefinite (un/une/des) articles.
           - Question: Sentence with the article missing.
           - Options: Must be a list of articles.

           -CRITICAL RULE: ENSURE EACH ANSWER IS DIFFERENT.
           -CRITICAL RULE: ANSWERS SHOULD NOT BE REPETITIVE.
           -SET THE DIFFICULTY OF THE QUESTION ACCORDING TO THE UNITS LEVEL.
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
      model: "llama-3.1-8b-instant",
      temperature: 0.6,
      max_tokens: 8000,
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
      triggerKestraTutor("Essay Challenge", jsonResult.score);

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

app.listen(5000, () => console.log("Server running on port 5000"));

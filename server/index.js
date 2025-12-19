const express = require("express");
const cors = require("cors");
require("dotenv").config();
const Groq = require("groq-sdk");

const app = express();
app.use(cors());
app.use(express.json());

// Increase the timeout limit for large generations
app.use((req, res, next) => {
  res.setTimeout(180000, () => {
    // Increased to 3 mins for safety
    if (!res.headersSent) {
      console.log("Request has timed out.");
      res.status(408).send("Request has timed out");
    }
  });
  next();
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
  console.log(`Generating: ${language} | ${unit} | Type: ${type}`);

  // 1. Vocabulary Constraints (YOUR EXACT RULES)
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
    // Kept your 30 question logic
    requirementText = `
      Generate a JSON array with EXACTLY 20 exercises in this specific order:
      1. 3 questions of type "fill-in-the-blank".
      2. 3 questions of type "complete-the-sentence".
      3. 3 questions of type "translate".
      4. 3 questions of type "match-pairs" (Each containing 4 pairs).
      5. 3 questions of type "missing-verb" (Grammar/Conjugation focus).
      6. 3 questions of type "choose-article" (Focus on Le/La/Les/Un/Une/Des/du/de la/des/d'un/d'une/d'un/d'une/etc...).
      7. 2 questions of type "choose-preposition" 
      
      TOTAL: 20 exercises. You MUST generate all 7 types.
    `;
  }
  // --- FIX START: Added the missing Listening Logic here ---
  else if (type === "listening-story") {
    requirementText = `
      Generate ONE object with type "listening-story".
      It must contain a "script" (Medium-Length Paragraph, 80-120 words, natural flow) based on the unit topic.
      It must contain a "questions" array (5 multiple-choice questions in English about the script).
    `;
  }
  // --- FIX END ---
  else if (type === "match-pairs") {
    requirementText = `Generate exactly 5 questions of type "match-pairs" (Each with 4 pairs).`;
  } else {
    requirementText = `Generate exactly 5 questions of type "${type}".`;
  }

  // --- YOUR EXACT PROMPT ---
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
           - Ex: { "question": "J'aime ___ pomme.", "answer": "la", "options": ["le", "la", "les", "l'"] }
           -ENSURE EACH ANSWER IS DIFFERENT.
           -ANSWERS SHOULD NOT BE REPETITIVE. 
           -SET THE DIFFICULTY OF THE QUESTION ACCORDING TO THE UNITS LEVEL.
           - USE THE FOLLOWING ARTICLES: Le/La/Les/Un/Une/Des/du/de la/des/d'un/d'une/d'un/d'une/etc... .

       - "choose-preposition":
           - Target: Common prepositions (à, de, pour, sur, sous, dans, chez, en, avec,etc... according to the units level).
           - Question: Sentence with the preposition missing.
           - Options: [Correct, 3 Distractors].
           - Ex: { "question": "Je vais ___ Paris.", "answer": "à", "options": ["à", "en", "pour", "de"] }
           - Ex: { "question": "Il rentre ___ lui.", "answer": "chez", "options": ["chez", "à", "dans", "sur"] }
           -SET THE DIFFICULTY OF THE QUESTION ACCORDING TO THE UNITS LEVEL.
           

        Output Structure Example:
        [
            { "id": 1, "type": "fill-in-the-blank", "question": "...", "answer": "...", "options": [...] }
        ]
    `;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 8000,
    });

    const text = completion.choices[0]?.message?.content || "";

    // --- SMART JSON CLEANER (Added this to fix the "Error" issues) ---
    // This part is safe to change: it just helps read the AI's response better
    let cleanText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    // Find where the JSON actually starts (Array or Object)
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
        // If "listening-story" returns a single object, wrap it in array
        if (!Array.isArray(parsed)) parsed = [parsed];

        res.json({ exercises: parsed });
      } catch (e) {
        console.error("JSON PARSE ERROR:", e);
        console.log("RAW TEXT:", text); // Check terminal if error persists
        res.status(500).json({ error: "Invalid JSON from AI" });
      }
    } else {
      res.status(500).json({ error: "No JSON found" });
    }
  } catch (error) {
    console.error("Groq Error:", error);
    res.status(500).json({ error: "Failed to generate exercises" });
  }
});

// --- CHECK ROUTE ---
app.post("/api/check", async (req, res) => {
  const { question, userAnswer, language, type } = req.body;
  // ... (Your Check logic remains exactly the same) ...
  const prompt = `
        Role: Language Teacher.
        Language: ${language}.
        Exercise Type: ${type}
        
        Question: "${question}"
        Student Answer: "${userAnswer}"

        Task: Check if the answer is correct. 
        
        CRITICAL GRADING RULES:
        1. BE LENIENT with punctuation.
        2. BE LENIENT with capitalization.
        3. If accents are wrong but word is right, mark CORRECT.
        
        Return JSON:
        {
            "isCorrect": boolean,
            "correctAnswer": "The ideal answer",
            "explanation": "Short feedback."
        }
    `;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
    });
    const text = completion.choices[0]?.message?.content || "";
    // Basic clean just in case
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

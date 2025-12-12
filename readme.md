<!-- const express = require("express");
const cors = require("cors");
require("dotenv").config();
const Groq = require("groq-sdk");

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

// 1. Vocabulary Constraints
let vocabConstraint = "";
if (vocabulary && vocabulary.length > 0) {
const vocabList = vocabulary.join(", ");
vocabConstraint = `      STRICT VOCABULARY CONSTRAINT:
      You must ONLY use words from: [ ${vocabList} ] (plus basic connectors).
      EXCEPTION: You may use the INFINITIVE form of verbs (e.g., 'manger') inside parentheses.
   `;
} else {
vocabConstraint = "Use CEFR A1 beginner vocabulary.";
}

// 2. Logic Selection
let requirementText = "";

if (type === "all") {
requirementText = `      Generate a JSON array with EXACTLY 18 exercises in this specific order:
      1. 3 questions of type "fill-in-the-blank".
      2. 3 questions of type "complete-the-sentence".
      3. 3 questions of type "translate".
      4. 3 questions of type "match-pairs".
      5. 3 questions of type "missing-verb".
      6. 3 questions of type "choose-article".
      TOTAL: 18 exercises.
   `;
} else if (type === "listening-story") {
requirementText = `      Generate ONE object with type "listening-story".
      It must contain a "script" (80-120 words in ${language}) based on the unit topic.
      It must contain a "questions" array (5 multiple-choice questions in English about the script).
   `;
} else if (type === "essay-challenge") {
// ✨ ESSAY GENERATION LOGIC
requirementText = `      Generate ONE object with type "essay-challenge".
      It must contain:
      1. "topic": A title related to the unit.
      2. "english_text": A paragraph in English (approx 60-80 words) based on the unit's vocabulary.
      3. "french_reference": The ideal translation of that paragraph in ${language}.
   `;
} else if (type === "match-pairs") {
requirementText = `Generate exactly 5 questions of type "match-pairs".`;
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
           - "gender-drill" (NEW):
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
        // Helper: Ensure array output for "all", single object for others if needed
        if (type === "all" && !Array.isArray(parsed)) parsed = [parsed];
        if (
          (type === "listening-story" || type === "essay-challenge") &&
          !Array.isArray(parsed)
        )
          parsed = [parsed];

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
console.error("Groq API Error:", error);
res.status(500).json({ error: "Failed to generate content." });
}
});

// ...

// --- CHECK ANSWER ROUTE ---
app.post("/api/check", async (req, res) => {
const { question, userAnswer, language, type } = req.body;
const prompt = `        Role: Teacher. Lang: ${language}.
        Check answer: "${userAnswer}" for Question: "${question}".
        Return JSON: { "isCorrect": boolean, "correctAnswer": "string", "explanation": "string" }
   `;
try {
const completion = await groq.chat.completions.create({
messages: [{ role: "user", content: prompt }],
model: "llama-3.3-70b-versatile",
});
const text = completion.choices[0]?.message?.content || "";
const cleanText = text
.replace(/`json/g, "")
      .replace(/`/g, "")
.trim();
const firstBrace = cleanText.indexOf("{");
const lastBrace = cleanText.lastIndexOf("}");
res.json(JSON.parse(cleanText.substring(firstBrace, lastBrace + 1)));
} catch (error) {
res.status(500).json({ error: "Check failed" });
}
});

// --- NEW: GRADE ESSAY ROUTE (ROBUST) ---
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
    3. Be encouraging but strict on grammar errors.
    4. Provide the "corrected" version.

    OUTPUT JSON ONLY (Do not write any other text):
    {
      "score": number,
      "feedback": "Short explanation of mistakes in english.",
      "corrected": "The perfect version."
    }

`;

try {
const completion = await groq.chat.completions.create({
messages: [{ role: "user", content: prompt }],
model: "llama-3.3-70b-versatile", // Smartest model for grading
temperature: 0.3, // Low temp for consistent grading
});

    const text = completion.choices[0]?.message?.content || "";

    // --- SMART JSON CLEANER FOR GRADING ---
    let cleanText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const firstBrace = cleanText.indexOf("{");
    const lastBrace = cleanText.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1) {
      const jsonString = cleanText.substring(firstBrace, lastBrace + 1);
      try {
        res.json(JSON.parse(jsonString));
      } catch (e) {
        console.error("Grading JSON Error:", e);
        console.log("Raw Grading Text:", text);
        res.status(500).json({ error: "AI returned bad JSON." });
      }
    } else {
      console.error("No JSON in grading response");
      res.status(500).json({ error: "Grading JSON invalid" });
    }

} catch (error) {
console.error("Grading API Error:", error);
res.status(500).json({ error: "Grading failed" });
}
});

app.listen(5000, () => console.log("Server running on port 5000"));

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
           - "gender-drill" (NEW):
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
    `; -->

 <!-- const prompt = `
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
    `; -->

<!--
import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";
import { COURSE_DATA } from "./data";

// --- HELPER: Fixes "Objects are not valid as a React child" Error ---
// If the AI sends { text: "Cat", correct: true } instead of "Cat", this extracts the text.
const getString = (val) => {
  if (typeof val === "object" && val !== null) {
    return (
      val.text ||
      val.word ||
      val.left ||
      val.right ||
      val.answer ||
      JSON.stringify(val)
    );
  }
  return val;
};

function App() {
  const [view, setView] = useState("setup");
  const [essayLevel, setEssayLevel] = useState(1);
  const [lang, setLang] = useState("French");
  const [section, setSection] = useState(COURSE_DATA["French"][0]);
  const [unit, setUnit] = useState(COURSE_DATA["French"][0].units[0]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- HANDLERS ---
  const handleLangChange = (e) => {
    const l = e.target.value;
    setLang(l);
    setSection(COURSE_DATA[l][0]);
    setUnit(COURSE_DATA[l][0].units[0]);
  };

  const handleSectionChange = (e) => {
    const sName = e.target.value;
    const s = COURSE_DATA[lang].find((sec) => sec.name === sName);
    setSection(s);
    setUnit(s.units[0]);
  };

  const handleUnitChange = (e) => {
    const uTitle = e.target.value;
    const u = section.units.find((unit) => unit.title === uTitle);
    setUnit(u);
  };

  const enterDashboard = () => setView("dashboard");

  // --- API CALLS ---
  const generateWorksheet = async () => {
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/generate", {
        language: lang,
        section: section.name,
        unit: unit.title,
        vocabulary: unit.vocabulary,
        grammar: unit.grammar,
        type: "all",
      });
      setExercises(res.data.exercises || []);
      setView("worksheet");
    } catch (e) {
      alert("Error generating worksheet. Try again.");
    }
    setLoading(false);
  };

  const generateListening = async () => {
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/generate", {
        language: lang,
        section: section.name,
        unit: unit.title,
        vocabulary: unit.vocabulary,
        grammar: unit.grammar,
        type: "listening-story",
      });
      setExercises(res.data.exercises || []);
      setView("listening");
    } catch (e) {
      alert("Error generating story. Try again.");
    }
    setLoading(false);
  };

  // --- GENERATE MORE ---
  const generateMore = async (specificType) => {
    document.body.style.cursor = "wait";
    try {
      const res = await axios.post("http://localhost:5000/api/generate", {
        language: lang,
        section: section.name,
        unit: unit.title,
        vocabulary: unit.vocabulary,
        grammar: unit.grammar,
        type: specificType,
      });
      if (res.data.exercises)
        setExercises((prev) => [...prev, ...res.data.exercises]);
    } catch (e) {
      alert("Could not generate more.");
    }
    document.body.style.cursor = "default";
  };
  const generateEssay = async () => {
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/generate", {
        language: lang,
        section: section.name,
        unit: unit.title,
        vocabulary: unit.vocabulary,
        grammar: unit.grammar,
        type: "essay-challenge",
      });
      setExercises(res.data.exercises || []);
      setView("essay");
    } catch (e) {
      alert("Error generating essay tasks.");
    }
    setLoading(false);
  };
  // ================= VIEWS =================

  // --- NEW: HANDLE NEXT ESSAY (Increases Difficulty) ---
  const handleNextEssay = async () => {
    const nextLevel = essayLevel + 1;
    setEssayLevel(nextLevel); // Update UI to show Level 2, 3...
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:5000/api/generate", {
        language: lang,
        section: section.name,
        unit: unit.title,
        vocabulary: unit.vocabulary,
        grammar: unit.grammar,
        type: "essay-challenge",
        difficulty: nextLevel, // ✨ Sends the harder level to server
      });
      setExercises(res.data.exercises || []);
    } catch (e) {
      alert("Error generating next level.");
    }
    setLoading(false);
  };

  // 1. SETUP
  if (view === "setup") {
    return (
      // ... inside view === "setup"
      <div className="landing-page">
        <nav className="navbar">
          <div className="logo">
            Looplingo <span className="logo-icon">♾️</span>
          </div>
        </nav>

        {/* Container for background effects */}
        <div className="background-glow"></div>

        <header className="hero-section">
          <div className="hero-text">
            <h1>
              Master <span className="highlight-text">{lang}.</span>
            </h1>
            <p className="hero-sub">
              The AI-powered language gym that adapts to you.
              <br />
              Infinite practice, zero repetition.
            </p>
          </div>

          <div className="setup-card glass-panel">
            <div className="input-group">
              <label>I want to learn</label>
              <div className="select-wrapper">
                <select value={lang} onChange={handleLangChange}>
                  {Object.keys(COURSE_DATA).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="input-group">
              <label>My Level (Section)</label>
              <div className="select-wrapper">
                <select value={section.name} onChange={handleSectionChange}>
                  {COURSE_DATA[lang].map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="input-group">
              <label>Current Topic (Unit)</label>
              <div className="select-wrapper">
                <select value={unit.title} onChange={handleUnitChange}>
                  {section.units.map((u, i) => (
                    <option key={u.id || i} value={u.title}>
                      {u.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button className="start-btn glow-btn" onClick={enterDashboard}>
              Enter Dashboard ➔
            </button>
          </div>
        </header>
      </div>
    );
  }

  // 2. DASHBOARD
  if (view === "dashboard") {
    return (
      <div className="dashboard-container">
        <header className="dash-header">
          <button className="back-link-simple" onClick={() => setView("setup")}>
            ← Change Unit
          </button>
          <h2>{unit.title}</h2>
          <p className="dash-subtitle">{section.name}</p>
        </header>
        <div className="modules-grid two-col">
          <div className="module-card core" onClick={generateWorksheet}>
            <div className="icon">📝</div>
            <h3>Core Practice</h3>
            <p>Grammar, Vocabulary, Translation, Matching & Articles.</p>
            <button disabled={loading}>
              {loading ? "Generating..." : "Start Worksheet"}
            </button>
          </div>
          <div className="module-card listen" onClick={generateListening}>
            <div className="icon">🎧</div>
            <h3>Infinite Listening</h3>
            <p>AI-generated stories with comprehension questions.</p>
            <button disabled={loading}>
              {loading ? "Generating..." : "Start Listening"}
            </button>
          </div>

          {/* CARD 3: ESSAY WRITING */}
          <div className="module-card essay" onClick={generateEssay}>
            <div className="icon">✍️</div>
            <h3>Essay Challenge</h3>
            <p>Translate paragraphs and get AI grading.</p>
            <button disabled={loading}>
              {loading ? "Generating..." : "Start Writing"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. WORKSHEET
  if (view === "worksheet") {
    return (
      <div className="worksheet-container">
        <header className="worksheet-header">
          <button className="back-link" onClick={() => setView("dashboard")}>
            ← Dashboard
          </button>
          <h1>Core Practice</h1>
          <p className="worksheet-subtitle">{unit.title}</p>
        </header>

        <WorksheetSection
          title="I. Fill in the blanks"
          type="fill-in-the-blank"
          exercises={exercises.filter((e) => e.type === "fill-in-the-blank")}
          onGenerateMore={() => generateMore("fill-in-the-blank")}
          language={lang}
        />
        <WorksheetSection
          title="II. Missing Verbs (Conjugation)"
          type="missing-verb"
          exercises={exercises.filter((e) => e.type === "missing-verb")}
          onGenerateMore={() => generateMore("missing-verb")}
          language={lang}
        />
        <WorksheetSection
          title="III. Choose the Article"
          type="choose-article"
          exercises={exercises.filter((e) => e.type === "choose-article")}
          onGenerateMore={() => generateMore("choose-article")}
          language={lang}
        />
        <WorksheetSection
          title="IV. Choose the Preposition"
          type="choose-preposition"
          exercises={exercises.filter((e) => e.type === "choose-preposition")}
          onGenerateMore={() => generateMore("choose-preposition")}
          language={lang}
        />
        <WorksheetSection
          title="V. Complete the sentence"
          type="complete-the-sentence"
          exercises={exercises.filter(
            (e) => e.type === "complete-the-sentence"
          )}
          onGenerateMore={() => generateMore("complete-the-sentence")}
          language={lang}
        />
        <WorksheetSection
          title="VI. Translate"
          type="translate"
          exercises={exercises.filter((e) => e.type === "translate")}
          onGenerateMore={() => generateMore("translate")}
          language={lang}
        />
        <WorksheetSection
          title="VII. Gender Engagement drill"
          type="gender-engagement-drill"
          exercises={exercises.filter(
            (e) => e.type === "gender-engagement-drill"
          )}
          onGenerateMore={() => generateMore("gender-engagement-drill")}
          language={lang}
        />
        <WorksheetSection
          title="VII. Match the Pairs"
          type="match-pairs"
          exercises={exercises.filter((e) => e.type === "match-pairs")}
          onGenerateMore={() => generateMore("match-pairs")}
          language={lang}
        />

        <div className="worksheet-footer">
          <button className="finish-btn" onClick={() => setView("dashboard")}>
            Finish Practice
          </button>
        </div>
      </div>
    );
  }

  // 4. LISTENING
  if (view === "listening") {
    if (loading) {
      return (
        <div className="worksheet-container">
          <div className="loader-overlay">
            <div className="spinner"></div>
            <h2>Creating a new story...</h2>
            <p>Never Give Up on Your Dreams!!!</p>
          </div>
        </div>
      );
    }
    // Prevent Crash if no story generated
    if (!exercises || exercises.length === 0) {
      return (
        <div className="worksheet-container">
          <header className="worksheet-header">
            <button className="back-link" onClick={() => setView("dashboard")}>
              ← Dashboard
            </button>
            <h1>Error</h1>
          </header>
          <div style={{ textAlign: "center", padding: "40px", color: "white" }}>
            <h3>⚠️ AI Generation Failed.</h3>
            <button className="finish-btn" onClick={generateListening}>
              Try Again
            </button>
          </div>
        </div>
      );
    }

    const storyData = exercises[0];
    return (
      <div className="worksheet-container">
        <header className="worksheet-header">
          <button className="back-link" onClick={() => setView("dashboard")}>
            ← Dashboard
          </button>
          <h1>Listening Mode</h1>
          <p className="worksheet-subtitle">{unit.title}</p>
        </header>
        {storyData && (
          <ListeningStoryComponent
            key={storyData.script || "story"}
            data={storyData}
          />
        )}
        <div className="worksheet-footer">
          <button className="finish-btn" onClick={generateListening}>
            Next Story ➔
          </button>
        </div>
      </div>
    );
  }
  // ================= VIEW 5: ESSAY MODE =================
  // ==========================================
  // VIEW 5: ESSAY MODE (Infinite Loop Fix)
  // ==========================================
  // ================= VIEW 5: ESSAY MODE =================
  if (view === "essay") {
    if (loading) {
      return (
        <div className="worksheet-container">
          <div className="loader-overlay">
            <div className="spinner"></div>
            {/* Show the user the level is increasing */}
            <h2>Creating Level {essayLevel} Challenge...</h2>
            <p>Writing a longer, smarter scenario...</p>
          </div>
        </div>
      );
    }

    const data = exercises[0];
    if (!data)
      return (
        <div className="worksheet-container">
          <h1>Error: No Essay found.</h1>
          <button className="finish-btn" onClick={generateEssay}>
            Try Again
          </button>
        </div>
      );

    return (
      <div className="worksheet-container">
        <header className="worksheet-header">
          <button className="back-link" onClick={() => setView("dashboard")}>
            ← Dashboard
          </button>
          <h1>Essay Challenge (Lvl {essayLevel})</h1>
          <p className="worksheet-subtitle">{unit.title}</p>
        </header>

        {/* 👇 UPDATE THIS LINE: Use 'handleNextEssay' instead of 'generateEssay' */}
        <EssayComponent data={data} lang={lang} onNext={handleNextEssay} />
      </div>
    );
  }

  return <div className="loading-screen">Loading...</div>;
}

// --- COMPONENT: LISTENING STORY ---
// --- COMPONENT: LISTENING STORY (With Pause/Resume) ---
function ListeningStoryComponent({ data }) {
  const [isSpeaking, setIsSpeaking] = useState(false); // Is audio active?
  const [isPaused, setIsPaused] = useState(false); // Is it currently paused?
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [voices, setVoices] = useState([]);

  // 1. Cleanup & Reset when story changes
  useEffect(() => {
    // Stop any existing audio immediately
    window.speechSynthesis.cancel();
    setAnswers({});
    setSubmitted(false);
    setIsSpeaking(false);
    setIsPaused(false);

    // Cleanup when component unmounts (user leaves page)
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [data]);

  // 2. Load Voices
  useEffect(() => {
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  // 3. The Smart Toggle Function
  const toggleAudio = () => {
    const synth = window.speechSynthesis;

    // Case A: Audio is active (playing or paused)
    if (isSpeaking) {
      if (isPaused) {
        // Resume
        synth.resume();
        setIsPaused(false);
      } else {
        // Pause
        synth.pause();
        setIsPaused(true);
      }
    }
    // Case B: Audio is stopped (start fresh)
    else {
      if (!data.script) return;

      const utterance = new SpeechSynthesisUtterance(data.script);
      const targetLang = "fr";
      const bestVoice =
        voices.find(
          (v) => v.lang.startsWith(targetLang) && v.name.includes("Google")
        ) || voices.find((v) => v.lang.startsWith(targetLang));

      if (bestVoice) {
        utterance.voice = bestVoice;
        utterance.lang = bestVoice.lang;
      } else {
        utterance.lang = "fr-FR";
      }

      utterance.rate = 0.8; // Slow speed

      // Events to manage state
      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };

      utterance.onerror = (e) => {
        console.error("Audio error", e);
        setIsSpeaking(false);
      };

      synth.speak(utterance);
    }
  };

  const handleSelect = (qId, val) => setAnswers({ ...answers, [qId]: val });
  const checkAnswers = () => setSubmitted(true);
  const score = data.questions
    ? data.questions.reduce(
        (acc, q) =>
          acc + (getString(answers[q.id]) === getString(q.answer) ? 1 : 0),
        0
      )
    : 0;

  // Visualizer should only animate if speaking AND NOT paused
  const isAnimating = isSpeaking && !isPaused;

  return (
    <div className="listening-container">
      {/* AUDIO PLAYER BAR */}
      <div className={`audio-player-card ${isAnimating ? "playing" : ""}`}>
        <button className="play-fab" onClick={toggleAudio}>
          {/* Show Pause icon if playing, Play icon if paused/stopped */}
          {isSpeaking && !isPaused ? "⏸" : "▶"}
        </button>

        <div className="audio-visualizer">
          <div className="bar"></div>
          <div className="bar"></div>
          <div className="bar"></div>
          <div className="bar"></div>
          <div className="bar"></div>
        </div>

        <div className="player-text">
          {!isSpeaking ? "Click to Play" : isPaused ? "Paused" : "Listening..."}
        </div>
      </div>

      {/* QUESTIONS */}
      <div className="story-questions">
        {data.questions &&
          data.questions.map((q, i) => (
            <div key={q.id || i} className="story-q-item">
              <p className="story-q-text">
                {i + 1}. {getString(q.question)}
              </p>
              <div className="story-options">
                {q.options.map((opt) => (
                  <label
                    key={getString(opt)}
                    className={`story-opt ${
                      submitted && getString(opt) === getString(q.answer)
                        ? "correct"
                        : ""
                    } ${
                      submitted &&
                      getString(answers[q.id]) === getString(opt) &&
                      getString(opt) !== getString(q.answer)
                        ? "wrong"
                        : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={getString(opt)}
                      onChange={() => handleSelect(q.id, getString(opt))}
                      disabled={submitted}
                      checked={getString(answers[q.id]) === getString(opt)}
                    />
                    {getString(opt)}
                  </label>
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* FOOTER */}
      {!submitted ? (
        <button className="check-story-btn" onClick={checkAnswers}>
          Check Answers
        </button>
      ) : (
        <div className="story-result">
          <h3>
            You got {score} / {data.questions.length} correct!
          </h3>
          <div className="transcript-reveal">
            <h4>Transcript:</h4>
            <p>{data.script}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- COMPONENT: WORKSHEET SECTION ---
function WorksheetSection({
  title,
  type,
  exercises,
  language,
  onGenerateMore,
}) {
  const [showOptions, setShowOptions] = useState(true);
  if (!exercises || exercises.length === 0) return null;

  return (
    <div className="section-block">
      <div className="section-header">
        <h2>{title}</h2>
        {type !== "match-pairs" && (
          <div className="toggle-wrapper">
            <span className={!showOptions ? "active" : ""}>Hard</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={showOptions}
                onChange={() => setShowOptions(!showOptions)}
              />
              <span className="slider round"></span>
            </label>
            <span className={showOptions ? "active" : ""}>Easy</span>
          </div>
        )}
      </div>
      <div className="question-list">
        {exercises.map((ex, i) => {
          if (type === "match-pairs")
            return <MatchingGame key={i} data={ex} index={i + 1} />;
          return (
            <QuestionItem
              key={i}
              data={ex}
              showOptions={showOptions}
              language={language}
              index={i + 1}
            />
          );
        })}
      </div>
      <button className="generate-more-btn" onClick={onGenerateMore}>
        + Generate 5 more
      </button>
    </div>
  );
}

// --- COMPONENT: QUESTION ITEM (Robust) ---
function QuestionItem({ data, showOptions, language, index }) {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [checking, setChecking] = useState(false);
  const safeOptions = data.options || [];
  const isEasyMode = showOptions && safeOptions.length > 0;

  const check = async () => {
    if (!answer) return;
    setChecking(true);
    const normalize = (t) =>
      t
        ? t
            .toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "")
            .trim()
        : "";
    if (normalize(answer) === normalize(getString(data.answer))) {
      setFeedback({ isCorrect: true });
      setChecking(false);
      return;
    }
    if (isEasyMode && data.type !== "translate") {
      setFeedback({ isCorrect: false, correctAnswer: getString(data.answer) });
      setChecking(false);
      return;
    }
    try {
      const res = await axios.post("http://localhost:5000/api/check", {
        question: getString(data.question),
        userAnswer: answer,
        language,
        type: data.type,
      });
      setFeedback(res.data);
    } catch (e) {
      console.error(e);
    }
    setChecking(false);
  };

  const addWord = (w) =>
    setAnswer((prev) => (prev ? prev + " " + getString(w) : getString(w)));

  return (
    <div className="question-row">
      <span className="q-number">{index}.</span>
      <div className="q-content">
        <p className="q-text">{getString(data.question)}</p>
        <div className="input-area">
          {(data.type === "fill-in-the-blank" ||
            data.type === "missing-verb" ||
            data.type === "choose-article" ||
            data.type === "choose-preposition" ||
            data.type === "gender-engagement-drill") &&
            (isEasyMode ? (
              <select
                className="paper-select"
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!feedback}
              >
                <option value="">[ Select ]</option>
                {safeOptions.map((o) => (
                  <option key={getString(o)} value={getString(o)}>
                    {getString(o)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="paper-input"
                placeholder="_______"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!feedback}
              />
            ))}

          {data.type === "complete-the-sentence" && (
            <div className="radio-group">
              {safeOptions.map((opt) => (
                <label key={getString(opt)} className="radio-label">
                  <input
                    type="radio"
                    name={`q-${data.id}`}
                    value={getString(opt)}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={!!feedback}
                  />
                  {getString(opt)}
                </label>
              ))}
            </div>
          )}

          {data.type === "translate" && (
            <div>
              <input
                className="paper-input full-width"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!feedback}
                placeholder="Type translation..."
              />
              {isEasyMode && !feedback && (
                <div className="word-bank-mini">
                  {safeOptions.map((w, idx) => (
                    <button
                      key={idx}
                      className="wb-chip"
                      onClick={() => addWord(w)}
                    >
                      {getString(w)}
                    </button>
                  ))}
                  <button className="wb-clear" onClick={() => setAnswer("")}>
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {!feedback ? (
          <button
            className="mini-check-btn"
            onClick={check}
            disabled={checking}
          >
            Check
          </button>
        ) : (
          <div
            className={`mini-feedback ${
              feedback.isCorrect ? "correct" : "incorrect"
            }`}
          >
            <strong>{feedback.isCorrect ? "✓ Correct" : "✗ Incorrect"}</strong>
            {!feedback.isCorrect && (
              <span className="correction"> → {feedback.correctAnswer}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- COMPONENT: MATCHING GAME (Robust) ---
function MatchingGame({ data, index }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [matched, setMatched] = useState([]);
  const [wrong, setWrong] = useState(null);

  useEffect(() => {
    if (!data.pairs) return;
    const list = [];
    data.pairs.forEach((pair, idx) => {
      // FIX: Ensure pair.left/right are strings
      list.push({
        id: idx,
        type: "left",
        text: getString(pair.left),
        uuid: Math.random(),
      });
      list.push({
        id: idx,
        type: "right",
        text: getString(pair.right),
        uuid: Math.random(),
      });
    });
    setItems(list.sort(() => Math.random() - 0.5));
  }, [data]);

  const handleClick = (item) => {
    if (matched.includes(item.id) || wrong) return;
    if (!selected) {
      setSelected(item);
    } else {
      if (selected.uuid === item.uuid) {
        setSelected(null);
        return;
      }
      if (selected.id === item.id) {
        setMatched([...matched, item.id]);
        setSelected(null);
      } else {
        setWrong([selected.uuid, item.uuid]);
        setTimeout(() => {
          setWrong(null);
          setSelected(null);
        }, 800);
      }
    }
  };

  const isComplete = data.pairs && matched.length === data.pairs.length;

  return (
    <div className="matching-game-container">
      <div className="q-number">
        {index}. {getString(data.question)}
      </div>
      <div className="matching-grid">
        {items.map((item) => {
          const isSelected = selected && selected.uuid === item.uuid;
          const isMatched = matched.includes(item.id);
          const isWrong = wrong && wrong.includes(item.uuid);
          let statusClass = "match-card";
          if (isMatched) statusClass += " matched";
          else if (isWrong) statusClass += " wrong";
          else if (isSelected) statusClass += " selected";
          return (
            <button
              key={item.uuid}
              className={statusClass}
              onClick={() => handleClick(item)}
            >
              {item.text}
            </button>
          );
        })}
      </div>
      {isComplete && (
        <div className="match-success">✨ Awesome! Set Complete!</div>
      )}
    </div>
  );
}

// --- COMPONENT: ESSAY WRITING ---
// --- COMPONENT: ESSAY WRITING (Infinite) ---
function EssayComponent({ data, lang, onNext }) {
  const [userText, setUserText] = useState("");
  const [result, setResult] = useState(null);
  const [grading, setGrading] = useState(false);

  // Reset state when new data arrives (New Essay)
  useEffect(() => {
    setUserText("");
    setResult(null);
    setGrading(false);
  }, [data]);

  const handleSubmit = async () => {
    if (!userText.trim()) return;
    setGrading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/grade-essay", {
        userText,
        originalText: data.english_text,
        referenceText: data.french_reference,
        language: lang,
      });
      setResult(res.data);
    } catch (e) {
      alert("Grading failed. Please try again.");
      setGrading(false); // Stop loading if error
    }
    setGrading(false);
  };

  return (
    <div className="section-block">
      <div className="section-header">
        <h2>Topic: {data.topic}</h2>
      </div>

      <div className="essay-container">
        <div className="essay-prompt">
          <h4>Translate this to {lang}:</h4>
          <p className="source-text">"{data.english_text}"</p>
        </div>

        <textarea
          className="essay-input"
          rows="6"
          placeholder={`Write your ${lang} translation here...`}
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          disabled={!!result || grading}
        />

        {!result ? (
          <button
            className="finish-btn"
            onClick={handleSubmit}
            disabled={grading}
          >
            {grading ? "Grading..." : "Submit Essay"}
          </button>
        ) : (
          <div className="essay-result">
            <div className="score-circle">
              <span>{result.score}%</span>
            </div>
            <div className="feedback-content">
              <h4>Feedback:</h4>
              <p>{result.feedback}</p>
              <div className="correction-box">
                <strong>Correct Translation:</strong>
                <p>{result.corrected}</p>
              </div>
            </div>

            {/* THIS BUTTON NOW TRIGGERS THE INFINITE LOOP */}
            <button
              className="finish-btn"
              onClick={onNext}
              style={{ backgroundColor: "#3b82f6", marginTop: "30px" }}
            >
              Next Essay Scenario ➔
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
export default App; -->

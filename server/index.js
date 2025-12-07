const express = require("express");
const cors = require("cors");
require("dotenv").config();
const Groq = require("groq-sdk");

const app = express();
app.use(cors());
app.use(express.json());

// Increase the timeout limit for large generations
app.use((req, res, next) => {
  res.setTimeout(120000, () => {
    console.log("Request has timed out.");
    res.status(408).send("Request has timed out");
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
    vocabConstraint = `
      STRICT VOCABULARY CONSTRAINT:
      You must ONLY use words from the following list (plus basic grammar connectors like 'a', 'the', 'is', 'and'):
      [ ${vocabList} ]
      
      DO NOT use any advanced vocabulary that is not in this list. 
      If you need a noun/verb not in the list, rephrase the sentence to use words from the list.
      `;
  } else {
    vocabConstraint =
      "Use only CEFR A1 beginner vocabulary suitable for this specific unit.";
  }

  // 2. Question Count Logic (FIXED LOGIC)
  let requirementText = "";

  if (type === "all") {
    // We limit total questions to ~11 to prevent the AI from cutting off due to length limits
    requirementText = `
      Generate a JSON array with EXACTLY 20 exercises in this specific order:
      1. 5 questions of type "fill-in-the-blank".
      2. 5 questions of type "complete-the-sentence".
      3. 5 questions of type "translate".
      4. 5 questions of type "match-pairs" (Each containing 4 pairs).
      
      TOTAL: 20 exercises. You MUST generate all 4 types.
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

        CRITICAL JSON RULES:
        1. Return ONLY raw JSON. No markdown.
        2. "options" ARRAY IS MANDATORY.
        3. "answer" MUST MATCH EXACTLY one of the options.
        
        SPECIFIC INSTRUCTIONS FOR OPTIONS:
        
        - "fill-in-the-blank": 
            Use '___' for the blank. 
            "options": [Correct Answer, Distractor 1, Distractor 2, Distractor 3].
        
        - "complete-the-sentence": 
            "options": [Correct Answer, Distractor 1, Distractor 2, Distractor 3].
        
        - "translate": 
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

        Output Structure Example:
        [
            {
                "id": 1,
                "type": "fill-in-the-blank", 
                "question": "C'est ___ femme.",
                "answer": "une",
                "options": ["un", "une", "le", "la"] 
            },
            {
                "id": 10,
                "type": "match-pairs",
                "question": "Match the following terms",
                "pairs": [
                    { "left": "Chat", "right": "Cat" },
                    { "left": "Chien", "right": "Dog" }
                ]
            }
        ]
    `;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 4000,
    });

    const text = completion.choices[0]?.message?.content || "";

    const cleanJson = (txt) => {
      const firstBracket = txt.indexOf("[");
      const lastBracket = txt.lastIndexOf("]");
      if (firstBracket !== -1 && lastBracket !== -1) {
        return txt.substring(firstBracket, lastBracket + 1);
      }
      return txt;
    };

    const jsonString = cleanJson(text);
    const exercises = JSON.parse(jsonString);

    res.json({ exercises });
  } catch (error) {
    console.error("Groq Error:", error);
    res.status(500).json({ error: "Failed to generate exercises" });
  }
});

// --- CHECK ROUTE ---
app.post("/api/check", async (req, res) => {
  const { question, userAnswer, language, type } = req.body;

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
      model: "llama-3.3-70b-versatile",
    });

    const text = completion.choices[0]?.message?.content || "";
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    const jsonString = text.substring(firstBrace, lastBrace + 1);

    res.json(JSON.parse(jsonString));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Check failed" });
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));

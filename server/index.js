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

  // Vocabulary Constraints
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

  // Question Count Logic
  let requirementText = "";
  if (type === "all") {
    requirementText = `
      Generate a set of 15 exercises divided into these 3 categories:
      1. 5 questions of "fill-in-the-blank".
      2. 5 questions of "complete-the-sentence".
      3. 5 questions of "translate".
    `;
  } else {
    requirementText = `Generate exactly 5 questions of type "${type}".`;
  }

  const prompt = `
        Role: Strict Language Curriculum Designer.
        Task: Create a worksheet for ${language}.
        Level: ${section}
        Topic: ${unit}

        ${vocabConstraint}

        GRAMMAR FOCUS:
        The exercises must specifically test this grammar concept: "${
          grammar || "General grammar for this level"
        }".

        ${requirementText}

        DIVERSITY & UNIQUENESS RULES (CRITICAL):
        1. NO REPEATS: Absolutely DO NOT generate the same question or sentence structure twice.
        2. VARY SUBJECTS: You MUST use a mix of pronouns (Je, Tu, Il, Elle, Nous, Vous, Ils, Elles).
        3. VARY CONTEXTS: Mix statements (.), questions (?), and negations (ne...pas).
        4. ANSWER DISTRIBUTION: Ensure the correct answer is different for each question.
        5. SCENARIOS: Use different verbs and nouns from the vocabulary list for every single question.

        CRITICAL JSON RULES:
        1. Return ONLY raw JSON. No markdown.
        2. "options" ARRAY IS MANDATORY.
        3. "answer" MUST MATCH EXACTLY one of the options.
        
        SPECIFIC INSTRUCTIONS FOR OPTIONS:
        - For 'fill-in-the-blank': 
            **CRITICAL: There must be EXACTLY ONE blank (represented by '___') per question.** 
            NEVER create a sentence with two or more blanks.
            Options must include the Correct Answer + 3 Distractors. 
        
        - For 'complete-the-sentence': 
            The distractors must be GRAMMATICALLY INCORRECT or LOGICALLY NONSENSE (so there is only 1 clear winner).
        
        - For 'translate': 
            Options must contain the shuffled words of the answer + 3 extra words.

        Output Structure Example:
        [
            {
                "id": 1,
                "type": "fill-in-the-blank", 
                "question": "C'est ___ femme.",
                "answer": "une",
                "options": ["un", "une", "le", "la"] 
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

// --- CHECK ROUTE (Lenient Checker) ---
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
        1. BE LENIENT with punctuation. (Ignore missing periods, commas, or question marks).
        2. BE LENIENT with capitalization.
        3. BE LENIENT with missing hyphens.
        4. If the words are correct but accents are wrong, mark it as CORRECT but mention the accent in the explanation.
        
        Return JSON:
        {
            "isCorrect": boolean,
            "correctAnswer": "The ideal answer (or correction)",
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

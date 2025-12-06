import React, { useState } from "react";
import axios from "axios";
import "./App.css";
import { COURSE_DATA } from "./data";

function App() {
  // --- HELPER: Get default values safely ---
  // This prevents crashes if data is missing or empty
  const getDefaultValues = () => {
    const defaultLang = "French";
    // Check if French exists
    const sec = COURSE_DATA[defaultLang] ? COURSE_DATA[defaultLang][0] : null;
    // Check if section has units
    const u = sec && sec.units && sec.units.length > 0 ? sec.units[0] : null;

    return {
      lang: defaultLang,
      section: sec || { name: "", units: [] },
      unit: u || { title: "", vocabulary: [], grammar: "" },
    };
  };

  const defaults = getDefaultValues();

  // --- STATE ---
  const [lang, setLang] = useState(defaults.lang);
  const [section, setSection] = useState(defaults.section);
  const [unit, setUnit] = useState(defaults.unit);

  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- HANDLERS ---
  const handleLangChange = (e) => {
    const newLang = e.target.value;
    setLang(newLang);
    if (COURSE_DATA[newLang] && COURSE_DATA[newLang][0]) {
      const newSec = COURSE_DATA[newLang][0];
      setSection(newSec);
      if (newSec.units.length > 0) {
        setUnit(newSec.units[0]);
      }
    }
  };

  const handleSectionChange = (e) => {
    const newSectionName = e.target.value;
    const newSec = COURSE_DATA[lang].find((s) => s.name === newSectionName);
    if (newSec) {
      setSection(newSec);
      if (newSec.units.length > 0) {
        setUnit(newSec.units[0]);
      }
    }
  };

  const handleUnitChange = (e) => {
    const newUnitTitle = e.target.value;
    // Find the full unit object based on the title selected
    const newUnit = section.units.find((u) => u.title === newUnitTitle);
    if (newUnit) {
      setUnit(newUnit);
    }
  };

  // --- GENERATE FUNCTIONS ---
  const generateInitial = async () => {
    setLoading(true);
    setExercises([]);
    try {
      const res = await axios.post("http://localhost:5000/api/generate", {
        language: lang,
        section: section.name,
        unit: unit.title, // Send the title string
        vocabulary: unit.vocabulary, // Send the vocab array
        grammar: unit.grammar, // Send the grammar string
        type: "all",
      });
      setExercises(res.data.exercises || []);
    } catch (e) {
      console.error(e);
      alert("Server Error. Check console for details.");
    }
    setLoading(false);
  };

  const generateMore = async (type) => {
    try {
      document.body.style.cursor = "wait";
      const res = await axios.post("http://localhost:5000/api/generate", {
        language: lang,
        section: section.name,
        unit: unit.title,
        vocabulary: unit.vocabulary,
        grammar: unit.grammar,
        type: type,
      });

      if (res.data.exercises) {
        setExercises((prev) => [...prev, ...res.data.exercises]);
      }
    } catch (e) {
      alert("Could not load more.");
    }
    document.body.style.cursor = "default";
  };

  // --- VIEW 1: WORKSHEET MODE ---
  if (exercises.length > 0) {
    return (
      <div className="worksheet-container">
        <header className="worksheet-header">
          <button className="back-link" onClick={() => setExercises([])}>
            ← Back to Setup
          </button>
          <h1>{unit.title}</h1>
          <p className="worksheet-subtitle">
            {lang} • {section.name}
          </p>
        </header>

        {/* SECTION I */}
        <WorksheetSection
          title="I. Fill in the blanks"
          type="fill-in-the-blank"
          exercises={exercises.filter((e) => e.type === "fill-in-the-blank")}
          onGenerateMore={() => generateMore("fill-in-the-blank")}
          language={lang}
        />

        {/* SECTION II */}
        <WorksheetSection
          title="II. Complete the sentence"
          type="complete-the-sentence"
          exercises={exercises.filter(
            (e) => e.type === "complete-the-sentence"
          )}
          onGenerateMore={() => generateMore("complete-the-sentence")}
          language={lang}
        />

        {/* SECTION III */}
        <WorksheetSection
          title="III. Translate the sentence"
          type="translate"
          exercises={exercises.filter((e) => e.type === "translate")}
          onGenerateMore={() => generateMore("translate")}
          language={lang}
        />

        <div className="worksheet-footer">
          <button className="finish-btn" onClick={() => setExercises([])}>
            Finish Practice
          </button>
        </div>
      </div>
    );
  }

  // --- VIEW 2: LANDING PAGE ---
  return (
    <div className="landing-page">
      <nav className="navbar">
        <div className="logo">GrammarGenie 🧞‍♂️</div>
      </nav>
      <header className="hero-section">
        <div className="hero-text">
          <h1>
            Master a language,
            <br />
            one rule at a time.
          </h1>
          <p>Infinite practice worksheet generator.</p>
        </div>
        <div className="setup-card">
          <h3>Setup your practice</h3>

          <div className="input-group">
            <label>Language</label>
            <select value={lang} onChange={handleLangChange}>
              {Object.keys(COURSE_DATA).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Section</label>
            <select value={section.name} onChange={handleSectionChange}>
              {COURSE_DATA[lang].map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Unit</label>
            <select value={unit.title} onChange={handleUnitChange}>
              {/* 
                   CRITICAL FIX: 
                   We now map over `section.units` which are OBJECTS.
                   We use `u.title` for the text and value.
                */}
              {section.units.map((u, idx) => (
                <option key={u.id || idx} value={u.title}>
                  {u.title}
                </option>
              ))}
            </select>
          </div>

          <button
            className="start-btn"
            onClick={generateInitial}
            disabled={loading}
          >
            {loading ? "Generating Worksheet..." : "Create Worksheet"}
          </button>
        </div>
      </header>
    </div>
  );
}

// --- SUB-COMPONENT: SECTION BLOCK ---
function WorksheetSection({
  title,
  type,
  exercises,
  onGenerateMore,
  language,
}) {
  const [showOptions, setShowOptions] = useState(true);

  if (exercises.length === 0) return null;

  return (
    <div className="section-block">
      <div className="section-header">
        <h2>{title}</h2>
        <div className="toggle-wrapper">
          <span className={!showOptions ? "active" : ""}>No Options</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={showOptions}
              onChange={() => setShowOptions(!showOptions)}
            />
            <span className="slider round"></span>
          </label>
          <span className={showOptions ? "active" : ""}>With Options</span>
        </div>
      </div>

      <div className="question-list">
        {exercises.map((ex, i) => (
          <QuestionItem
            key={i}
            data={ex}
            showOptions={showOptions}
            language={language}
            index={i + 1}
          />
        ))}
      </div>

      <button className="generate-more-btn" onClick={onGenerateMore}>
        + Generate 5 more
      </button>
    </div>
  );
}

// --- SUB-COMPONENT: INDIVIDUAL QUESTION ---
function QuestionItem({ data, showOptions, language, index }) {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [checking, setChecking] = useState(false);

  // 1. Get Options Safely
  const safeOptions = data.options || [];

  // 2. Decide Mode
  const isEasyMode = showOptions && safeOptions.length > 0;

  const check = async () => {
    if (!answer) return;
    setChecking(true);

    // --- STEP 1: SMART LOCAL CHECK ---
    const normalize = (text) =>
      text
        ? text
            .toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "")
            .trim()
        : "";

    const cleanUser = normalize(answer);
    const cleanAnswer = normalize(data.answer);

    if (cleanUser === cleanAnswer) {
      setFeedback({ isCorrect: true });
      setChecking(false);
      return;
    }

    // --- STEP 2: DROPDOWN CHECK ---
    if (isEasyMode && data.type !== "translate") {
      setFeedback({
        isCorrect: false,
        correctAnswer: data.answer,
        explanation: "Incorrect selection.",
      });
      setChecking(false);
      return;
    }

    // --- STEP 3: AI CHECK ---
    try {
      const res = await axios.post("http://localhost:5000/api/check", {
        question: data.question,
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

  const addWord = (w) => setAnswer((prev) => (prev ? prev + " " + w : w));

  return (
    <div className="question-row">
      <span className="q-number">{index}.</span>

      <div className="q-content">
        <p className="q-text">{data.question}</p>

        <div className="input-area">
          {data.type === "fill-in-the-blank" &&
            (isEasyMode ? (
              <select
                className="paper-select"
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!feedback}
              >
                <option value="">[ Select ]</option>
                {safeOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
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

          {data.type === "complete-the-sentence" &&
            (isEasyMode ? (
              <div className="radio-group">
                {safeOptions.map((opt) => (
                  <label key={opt} className="radio-label">
                    <input
                      type="radio"
                      name={`q-${data.id}`}
                      value={opt}
                      onChange={(e) => setAnswer(e.target.value)}
                      disabled={!!feedback}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="paper-textarea"
                placeholder="Finish the sentence..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!feedback}
              />
            ))}

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
                      {w}
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

export default App;

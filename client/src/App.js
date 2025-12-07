import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";
import { COURSE_DATA } from "./data";

function App() {
  // --- STATE ---
  // View options: 'setup' | 'dashboard' | 'worksheet' | 'listening'
  const [view, setView] = useState("setup");

  // Selection State
  const [lang, setLang] = useState("French");
  // Default to first item to prevent crashes
  const [section, setSection] = useState(COURSE_DATA["French"][0]);
  const [unit, setUnit] = useState(COURSE_DATA["French"][0].units[0]);

  // Content State
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- HANDLERS (Setup) ---
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

  const enterDashboard = () => {
    setView("dashboard");
  };

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
        type: "all", // Triggers your mixed 30-question logic
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
        type: "listening-story", // Triggers your story logic
      });
      setExercises(res.data.exercises || []);
      setView("listening");
    } catch (e) {
      alert("Error generating story. Try again.");
    }
    setLoading(false);
  };

  // ==========================================
  // VIEW 1: SETUP SCREEN (Landing Page)
  // ==========================================
  if (view === "setup") {
    return (
      <div className="landing-page">
        <nav className="navbar">
          <div className="logo">Looplingo ♾️</div>
        </nav>
        <header className="hero-section">
          <div className="hero-text">
            <h1>Master {lang}.</h1>
            <p>Your AI-powered language gym.</p>
          </div>
          <div className="setup-card">
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
                {section.units.map((u, i) => (
                  <option key={u.id || i} value={u.title}>
                    {u.title}
                  </option>
                ))}
              </select>
            </div>
            {/* THIS BUTTON NOW GOES TO DASHBOARD */}
            <button className="start-btn" onClick={enterDashboard}>
              Enter Dashboard ➔
            </button>
          </div>
        </header>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: DASHBOARD (The Hub)
  // ==========================================
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

        <div className="modules-grid">
          {/* CARD 1: CORE WORKSHEET */}
          <div className="module-card core" onClick={generateWorksheet}>
            <div className="icon">📝</div>
            <h3>Core Practice</h3>
            <p>Grammar, Vocab, Matching & Translation.</p>
            <button disabled={loading}>
              {loading ? "Generating..." : "Start Worksheet"}
            </button>
          </div>

          {/* CARD 2: LISTENING */}
          <div className="module-card listen" onClick={generateListening}>
            <div className="icon">🎧</div>
            <h3>Infinite Listening</h3>
            <p>AI-generated stories with questions.</p>
            <button disabled={loading}>
              {loading ? "Generating..." : "Start Listening"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: WORKSHEET MODE
  // ==========================================
  if (view === "worksheet") {
    return (
      <div className="worksheet-container">
        <header className="worksheet-header">
          {/* Back goes to Dashboard now */}
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
          language={lang}
        />

        <WorksheetSection
          title="II. Missing Verbs (Conjugation)"
          type="missing-verb"
          exercises={exercises.filter((e) => e.type === "missing-verb")}
          language={lang}
        />

        <WorksheetSection
          title="III. Choose the Article"
          type="choose-article"
          exercises={exercises.filter((e) => e.type === "choose-article")}
          language={lang}
        />

        <WorksheetSection
          title="IV. Complete the sentence"
          type="complete-the-sentence"
          exercises={exercises.filter(
            (e) => e.type === "complete-the-sentence"
          )}
          language={lang}
        />

        <WorksheetSection
          title="V. Translate"
          type="translate"
          exercises={exercises.filter((e) => e.type === "translate")}
          language={lang}
        />

        <WorksheetSection
          title="VI. Match the Pairs"
          type="match-pairs"
          exercises={exercises.filter((e) => e.type === "match-pairs")}
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

  // ==========================================
  // VIEW 4: LISTENING MODE
  // ==========================================
  // --- VIEW 4: LISTENING MODE ---
  if (view === "listening") {
    // If loading, show the spinner INSTEAD of the component
    if (loading) {
      return (
        <div className="worksheet-container">
          <div className="loader-overlay">
            <div className="spinner"></div>
            <h2>Creating a new story...</h2>
            <p>Our AI author is writing a unique script for you.</p>
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
          <ListeningStoryComponent key={storyData.script} data={storyData} />
        )}

        <div className="worksheet-footer">
          {/* This triggers the loading state above */}
          <button className="finish-btn" onClick={generateListening}>
            Next Story ➔
          </button>
        </div>
      </div>
    );
  }

  return <div className="loading-screen">Loading...</div>;
}

// --- SUB-COMPONENT: WORKSHEET SECTION ---
function WorksheetSection({ title, type, exercises, language }) {
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
    </div>
  );
}

// --- SUB-COMPONENT: LISTENING STORY ---
// --- SUB-COMPONENT: LISTENING STORY (Fixed Audio) ---
function ListeningStoryComponent({ data }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [voices, setVoices] = useState([]);

  // Reset when data changes
  useEffect(() => {
    setAnswers({});
    setSubmitted(false);
    setIsPlaying(false);
    window.speechSynthesis.cancel();
  }, [data]);

  // Load voices
  useEffect(() => {
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  const playAudio = () => {
    if (!data.script) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(data.script);

    // Voice Selection Logic
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

    utterance.rate = 0.75;
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleSelect = (qId, val) => {
    setAnswers({ ...answers, [qId]: val });
  };

  const checkAnswers = () => {
    setSubmitted(true);
  };

  const score = data.questions
    ? data.questions.reduce(
        (acc, q) => acc + (answers[q.id] === q.answer ? 1 : 0),
        0
      )
    : 0;

  return (
    <div className="listening-container">
      {/* 1. AUDIO PLAYER BAR */}
      <div className={`audio-player-card ${isPlaying ? "playing" : ""}`}>
        <button className="play-fab" onClick={playAudio} disabled={isPlaying}>
          {isPlaying ? "⏸" : "▶"}
        </button>

        <div className="audio-visualizer">
          {/* Fake bars for animation */}
          <div className="bar"></div>
          <div className="bar"></div>
          <div className="bar"></div>
          <div className="bar"></div>
          <div className="bar"></div>
        </div>

        <div className="player-text">
          {isPlaying ? "Listen..." : "Click to Play"}
        </div>
      </div>

      {/* 2. QUESTIONS */}
      <div className="story-questions">
        {data.questions &&
          data.questions.map((q, i) => (
            <div key={q.id} className="story-q-item">
              <p className="story-q-text">
                {i + 1}. {q.question}
              </p>
              <div className="story-options">
                {q.options.map((opt) => (
                  <label
                    key={opt}
                    className={`story-opt ${
                      submitted && opt === q.answer ? "correct" : ""
                    } ${
                      submitted && answers[q.id] === opt && opt !== q.answer
                        ? "wrong"
                        : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={opt}
                      onChange={() => handleSelect(q.id, opt)}
                      disabled={submitted}
                      checked={answers[q.id] === opt} // Controlled input
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* 3. FOOTER & RESULTS */}
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

// --- SUB-COMPONENT: QUESTION ITEM ---
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
    if (normalize(answer) === normalize(data.answer)) {
      setFeedback({ isCorrect: true });
      setChecking(false);
      return;
    }
    if (isEasyMode && data.type !== "translate") {
      setFeedback({ isCorrect: false, correctAnswer: data.answer });
      setChecking(false);
      return;
    }
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
          {(data.type === "fill-in-the-blank" ||
            data.type === "missing-verb" ||
            data.type === "choose-article") &&
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

          {data.type === "complete-the-sentence" && (
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

// --- SUB-COMPONENT: MATCHING GAME ---
function MatchingGame({ data, index }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [matched, setMatched] = useState([]);
  const [wrong, setWrong] = useState(null);

  useEffect(() => {
    if (!data.pairs) return;
    const list = [];
    data.pairs.forEach((pair, idx) => {
      list.push({
        id: idx,
        type: "left",
        text: pair.left,
        uuid: Math.random(),
      });
      list.push({
        id: idx,
        type: "right",
        text: pair.right,
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
        {index}. {data.question}
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

export default App;

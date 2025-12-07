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

  // ================= VIEWS =================

  // 1. SETUP
  if (view === "setup") {
    return (
      <div className="landing-page">
        <nav className="navbar">
          <div className="logo">Looplingo ♾️</div>
        </nav>
        <header className="hero-section">
          <div className="hero-text">
            <h1>Master {lang}.</h1>
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
            <button className="start-btn" onClick={enterDashboard}>
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
            <p>Our AI author is writing a unique script for you.</p>
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
            data.type === "choose-preposition") &&
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

export default App;

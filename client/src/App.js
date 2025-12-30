import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";
import { COURSE_DATA } from "./data";
import "./styles/landing.css";
import { supabase } from "./supabase";

// --- HELPER ---
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

  // Log view changes for debugging
  useEffect(() => {
    console.log("App:view ->", view);
  }, [view]);

  // Log Supabase session on mount to confirm auth state inside App
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } = {} } = await supabase.auth.getSession();
        console.log("App:supabase session present?", !!session, session);
      } catch (e) {
        console.error("App:failed to get session", e);
      }
    })();
  }, []);

  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [essayLevel, setEssayLevel] = useState(1);
  const [lang, setLang] = useState("French");
  const [section, setSection] = useState(COURSE_DATA["French"][0]);
  const [unit, setUnit] = useState(COURSE_DATA["French"][0].units[0]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✨ NEW: User Identity & Scoreboard
  const [userName, setUserName] = useState("");
  // ✨ NEW: Store the final result here
  const [sessionResult, setSessionResult] = useState(null);
  const [sessionStats, setSessionStats] = useState({
    correctCount: 0,
    totalAttempted: 0,
    mistakesLog: [],
  });

  // Ensure landing UI renders by using the 'setup' view name
  // (previously setView("landing") — App expects "setup" for the landing page)
  useEffect(() => {
    setView("setup");
  }, []);

  useEffect(() => {
    if (view === "landing") return;

    const interval = setInterval(() => {
      axios
        .get("https://looplingo.onrender.com/api/notifications")
        .then((res) => setNotifications(res.data))
        .catch(console.error);
    }, 5000);

    return () => clearInterval(interval);
  }, [view]);

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
    setEssayLevel(1);
  };

  const enterDashboard = () => setView("dashboard");

  // ✨ NEW: Track Results per Question
  const handleTrackResult = (isCorrect, questionData, userAnswer) => {
    setSessionStats((prev) => ({
      correctCount: isCorrect ? prev.correctCount + 1 : prev.correctCount,
      totalAttempted: prev.totalAttempted + 1,
      mistakesLog: isCorrect
        ? prev.mistakesLog
        : [
            ...prev.mistakesLog,
            {
              question: getString(questionData.question),
              wrongAnswer: userAnswer,
              type: questionData.type,
            },
          ],
    }));
  };

  // ✨ NEW: Finish & Trigger Kestra
  // --- FINISH & ANALYZE ---
  const finishSession = async () => {
    if (sessionStats.totalAttempted === 0) {
      // Small check, no alert needed, just return
      return;
    }

    const finalScore = Math.round(
      (sessionStats.correctCount / sessionStats.totalAttempted) * 100
    );

    // 1. Show the Result Card immediately (UI Update)
    setSessionResult({
      score: finalScore,
      correct: sessionStats.correctCount,
      total: sessionStats.totalAttempted,
      message: "Analyzing your performance...",
    });

    // 2. Send Data to Background (Kestra)
    try {
      await axios.post("https://looplingo.onrender.com/api/end-session", {
        user: userName || "Student",
        score: finalScore,
        mistakes: sessionStats.mistakesLog,
      });
      // Update status to show success
      setSessionResult((prev) => ({
        ...prev,
        message: "✅ Sent to AI Tutor for analysis.",
      }));
    } catch (e) {
      console.error(e);
      setSessionResult((prev) => ({
        ...prev,
        message: "⚠️ LoopLingo.",
      }));
    }
  };

  // Helper to close the result and go home
  const closeSession = () => {
    setSessionResult(null); // Clear result
    setSessionStats({ correctCount: 0, totalAttempted: 0, mistakesLog: [] }); // Reset stats
    setView("dashboard");
  };

  // --- API CALLS ---
  const generateWorksheet = async () => {
    setLoading(true);
    setSessionStats({ correctCount: 0, totalAttempted: 0, mistakesLog: [] }); // Reset
    try {
      const res = await axios.post(
        "https://looplingo.onrender.com/api/generate",
        {
          language: lang,
          section: section.name,
          unit: unit.title,
          vocabulary: unit.vocabulary,
          grammar: unit.grammar,
          type: "all",
        }
      );
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
      const res = await axios.post(
        "https://looplingo.onrender.com/api/generate",
        {
          language: lang,
          section: section.name,
          unit: unit.title,
          vocabulary: unit.vocabulary,
          grammar: unit.grammar,
          type: "listening-story",
        }
      );
      setExercises(res.data.exercises || []);
      setView("listening");
    } catch (e) {
      alert("Error generating story. Try again.");
    }
    setLoading(false);
  };

  const generateMore = async (specificType) => {
    document.body.style.cursor = "wait";
    try {
      const res = await axios.post(
        "https://looplingo.onrender.com/api/generate",
        {
          language: lang,
          section: section.name,
          unit: unit.title,
          vocabulary: unit.vocabulary,
          grammar: unit.grammar,
          type: specificType,
        }
      );
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
      const res = await axios.post(
        "https://looplingo.onrender.com/api/generate",
        {
          language: lang,
          section: section.name,
          unit: unit.title,
          vocabulary: unit.vocabulary,
          grammar: unit.grammar,
          type: "essay-challenge",
          difficulty: 1,
        }
      );
      setExercises(res.data.exercises || []);
      setEssayLevel(1);
      setView("essay");
    } catch (e) {
      alert("Error generating essay tasks.");
    }
    setLoading(false);
  };

  const handleNextEssay = async () => {
    const nextLevel = essayLevel + 1;
    setEssayLevel(nextLevel);
    setLoading(true);
    try {
      const res = await axios.post(
        "https://looplingo.onrender.com/api/generate",
        {
          language: lang,
          section: section.name,
          unit: unit.title,
          vocabulary: unit.vocabulary,
          grammar: unit.grammar,
          type: "essay-challenge",
          difficulty: nextLevel,
        }
      );
      setExercises(res.data.exercises || []);
    } catch (e) {
      alert("Error generating next level.");
    }
    setLoading(false);
  };

  // ================= VIEWS =================
  // 1. SETUP

  if (view === "setup") {
    return (
      <div className="landing-page">
        <nav className="navbar">
          <div className="logo">
            Looplingo <span className="logo-icon"></span>
          </div>{" "}
          {/* NOTIFICATION BELL (anchored dropdown) */}
          <div
            className="notif-container"
            onClick={() => setShowNotifs(!showNotifs)}
            style={{
              position: "relative",
              display: "inline-block",
              cursor: "pointer",
            }}
          >
            <span className="bell-icon">🔔</span>
            {notifications.length > 0 && (
              <span className="badge">{notifications.length}</span>
            )}
            {showNotifs && (
              <div
                className="notif-dropdown"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  minWidth: 300,
                  background: "rgba(7, 15, 30, 0.95)",
                  color: "#e6eef8",
                  padding: "12px",
                  borderRadius: 10,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  zIndex: 1200,
                }}
              >
                <h4 style={{ margin: 0, marginBottom: 8, color: "#cfe6ff" }}>
                  AI Tutor Feedback
                </h4>
                {notifications.length === 0 ? (
                  <p style={{ margin: 0, color: "#b8c7d9" }}>
                    No new messages.
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`notif-item ${n.type}`}
                      style={{
                        padding: "8px 6px",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                      }}
                    >
                      <p style={{ margin: 0 }}>{n.message}</p>
                      <span
                        className="time"
                        style={{ fontSize: 12, opacity: 0.7 }}
                      >
                        Just now
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </nav>
        <div className="background-glow"></div>
        <header className="hero-section">
          <div className="hero-text">
            <h1>
              {" "}
              Master <span className="highlight-text">{lang}.</span>{" "}
            </h1>
            <p className="hero-sub">
              {" "}
              The AI-powered language gym that adapts to you.{" "}
            </p>
          </div>
          <div className="setup-card glass-panel">
            {" "}
            {/* ✨ ADDED NAME INPUT */}
            <div className="input-group">
              <label>Your Name</label>
              <input
                className="paper-input full-width"
                style={{
                  background: "#0f172a",
                  color: "white",
                  border: "1px solid #334155",
                }}
                placeholder="Enter Name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>I want to learn</label>
              <div className="select-wrapper">
                <select value={lang} onChange={handleLangChange}>
                  {Object.keys(COURSE_DATA).map((l) => (
                    <option key={l} value={l}>
                      {" "}
                      {l}{" "}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="input-group">
              <label>My Level</label>
              <div className="select-wrapper">
                <select value={section.name} onChange={handleSectionChange}>
                  {COURSE_DATA[lang].map((s) => (
                    <option key={s.name} value={s.name}>
                      {" "}
                      {s.name}{" "}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="input-group">
              <label>Current Topic</label>
              <div className="select-wrapper">
                <select value={unit.title} onChange={handleUnitChange}>
                  {section.units.map((u, i) => (
                    <option key={u.id || i} value={u.title}>
                      {" "}
                      {u.title}{" "}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="start-btn glow-btn" onClick={enterDashboard}>
              {" "}
              Enter Dashboard ➔{" "}
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
            {" "}
            ← Change Unit{" "}
          </button>
          <h2>{unit.title}</h2>
          <p className="dash-subtitle">{section.name}</p>
        </header>
        <div className="modules-grid two-col">
          <div className="module-card core" onClick={generateWorksheet}>
            <div className="icon">📝</div>
            <h3>Core Practice</h3>
            <p>Grammar, Vocabulary, Translation, Matching.</p>
            <button disabled={loading}>
              {" "}
              {loading ? "Generating..." : "Start Worksheet"}{" "}
            </button>
          </div>
          <div className="module-card listen" onClick={generateListening}>
            <div className="icon">🎧</div>
            <h3>Infinite Listening</h3>
            <p>AI-generated stories with questions.</p>
            <button disabled={loading}>
              {" "}
              {loading ? "Generating..." : "Start Listening"}{" "}
            </button>
          </div>
          <div className="module-card essay" onClick={generateEssay}>
            <div className="icon">✍️</div>
            <h3>Essay Challenge</h3>
            <p>Translate paragraphs and get AI grading.</p>
            <button disabled={loading}>
              {" "}
              {loading ? "Generating..." : "Start Writing"}{" "}
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
            {" "}
            ← Dashboard{" "}
          </button>
          <h1>Core Practice</h1>
          <p className="worksheet-subtitle">{unit.title}</p>{" "}
          {/* ✨ SHOW LIVE SCORE */}
          <div
            style={{ marginTop: "10px", color: "#22c55e", fontWeight: "bold" }}
          >
            {" "}
            Score: {sessionStats.correctCount} / {sessionStats.totalAttempted}{" "}
          </div>
        </header>{" "}
        {/* ✨ PASSED onResult TO ALL SECTIONS */}
        <WorksheetSection
          title="I. Fill in the blanks"
          type="fill-in-the-blank"
          exercises={exercises.filter((e) => e.type === "fill-in-the-blank")}
          onGenerateMore={() => generateMore("fill-in-the-blank")}
          language={lang}
          onResult={handleTrackResult}
        />
        <WorksheetSection
          title="II. Missing Verbs (Conjugation)"
          type="missing-verb"
          exercises={exercises.filter((e) => e.type === "missing-verb")}
          onGenerateMore={() => generateMore("missing-verb")}
          language={lang}
          onResult={handleTrackResult}
        />
        <WorksheetSection
          title="III. Choose the Article"
          type="choose-article"
          exercises={exercises.filter((e) => e.type === "choose-article")}
          onGenerateMore={() => generateMore("choose-article")}
          language={lang}
          onResult={handleTrackResult}
        />
        <WorksheetSection
          title="IV. Choose the Preposition"
          type="choose-preposition"
          exercises={exercises.filter((e) => e.type === "choose-preposition")}
          onGenerateMore={() => generateMore("choose-preposition")}
          language={lang}
          onResult={handleTrackResult}
        />
        <WorksheetSection
          title="V. Complete the sentence"
          type="complete-the-sentence"
          exercises={exercises.filter(
            (e) => e.type === "complete-the-sentence"
          )}
          onGenerateMore={() => generateMore("complete-the-sentence")}
          language={lang}
          onResult={handleTrackResult}
        />
        <WorksheetSection
          title="VI. Translate"
          type="translate"
          exercises={exercises.filter((e) => e.type === "translate")}
          onGenerateMore={() => generateMore("translate")}
          language={lang}
          onResult={handleTrackResult}
        />
        <WorksheetSection
          title="VII. Gender Agreement"
          type="gender-drill"
          exercises={exercises.filter((e) => e.type === "gender-drill")}
          onGenerateMore={() => generateMore("gender-drill")}
          language={lang}
          onResult={handleTrackResult}
        />
        <WorksheetSection
          title="VIII. Match the Pairs"
          type="match-pairs"
          exercises={exercises.filter((e) => e.type === "match-pairs")}
          onGenerateMore={() => generateMore("match-pairs")}
          language={lang}
          onResult={handleTrackResult}
        />
        <div className="worksheet-footer">
          {" "}
          {/* ✨ CONDITIONAL RENDERING: Show Button OR Result Card */}
          {!sessionResult ? (
            <button className="finish-btn" onClick={finishSession}>
              {" "}
              Finish & Analyze{" "}
            </button>
          ) : (
            <div className="session-summary-card">
              <h2>Session Complete!</h2>
              <div className="score-display">
                <span className="big-score">{sessionResult.score}%</span>
                <span className="score-detail">
                  {" "}
                  {sessionResult.correct} / {sessionResult.total} Correct{" "}
                </span>
              </div>
              <div className="ai-status-bar">
                <span className="pulse-dot"></span> {sessionResult.message}{" "}
              </div>
              <p className="summary-hint">
                {" "}
                Check your email or notifications later for your personalized
                study guide.{" "}
              </p>
              <button
                className="back-link-simple"
                style={{ marginTop: "20px", color: "white" }}
                onClick={closeSession}
              >
                {" "}
                Return to Dashboard{" "}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. LISTENING (Same)
  if (view === "listening") {
    if (loading)
      return (
        <div className="worksheet-container">
          <div className="loader-overlay">
            <div className="spinner"></div>
            <h2>Creating a new story...</h2>
          </div>
        </div>
      );
    const storyData = exercises[0];
    if (!storyData)
      return (
        <div className="worksheet-container">
          <header className="worksheet-header">
            <button className="back-link" onClick={() => setView("dashboard")}>
              {" "}
              ← Dashboard{" "}
            </button>
            <h1>Error</h1>
          </header>
          <div style={{ textAlign: "center", padding: "40px", color: "white" }}>
            <h3>⚠️ AI Generation Failed.</h3>
            <button className="finish-btn" onClick={generateListening}>
              {" "}
              Try Again{" "}
            </button>
          </div>
        </div>
      );
    return (
      <div className="worksheet-container">
        <header className="worksheet-header">
          <button className="back-link" onClick={() => setView("dashboard")}>
            {" "}
            ← Dashboard{" "}
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
            {" "}
            Next Story ➔{" "}
          </button>
        </div>
      </div>
    );
  }

  // 5. ESSAY (Same)
  if (view === "essay") {
    if (loading)
      return (
        <div className="worksheet-container">
          <div className="loader-overlay">
            <div className="spinner"></div>
            <h2>Creating Level {essayLevel} Challenge...</h2>
            <p>Writing a scenario...</p>
          </div>
        </div>
      );
    const data = exercises[0];
    if (!data)
      return (
        <div className="worksheet-container">
          <h1>Error: No Essay found.</h1>
          <button className="finish-btn" onClick={generateEssay}>
            {" "}
            Try Again{" "}
          </button>
        </div>
      );
    return (
      <div className="worksheet-container">
        <header className="worksheet-header">
          <button className="back-link" onClick={() => setView("dashboard")}>
            {" "}
            ← Dashboard{" "}
          </button>
          <h1>Essay Challenge (Lvl {essayLevel})</h1>
          <p className="worksheet-subtitle">{unit.title}</p>
        </header>
        <EssayComponent data={data} lang={lang} onNext={handleNextEssay} />
      </div>
    );
  }

  return <div className="loading-screen">Loading...</div>;
}

// --- SUB-COMPONENTS ---
// ✨ UPDATED: Accepts onResult function
function WorksheetSection({
  title,
  type,
  exercises,
  language,
  onGenerateMore,
  onResult,
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
            return (
              <MatchingGame
                key={i}
                data={ex}
                index={i + 1}
                onResult={onResult}
              />
            );
          return (
            <QuestionItem
              key={i}
              data={ex}
              showOptions={showOptions}
              language={language}
              index={i + 1}
              onResult={onResult}
            />
          );
        })}
      </div>
      <button className="generate-more-btn" onClick={onGenerateMore}>
        {" "}
        + Generate 5 more{" "}
      </button>
    </div>
  );
}

// ✨ UPDATED: Tracks Score
function QuestionItem({ data, showOptions, language, index, onResult }) {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [checking, setChecking] = useState(false);
  const [isDone, setIsDone] = useState(false); // Only score once

  const safeOptions = data.options || [];
  const isEasyMode = showOptions && safeOptions.length > 0;

  const check = async () => {
    if (!answer || isDone) return;
    setChecking(true);

    const normalize = (t) =>
      t
        ? t
            .toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_~()?]/g, "")
            .trim()
        : "";

    const isCorrectLocally =
      normalize(answer) === normalize(getString(data.answer));

    if (isCorrectLocally) {
      setFeedback({ isCorrect: true });
      setIsDone(true);
      if (onResult) onResult(true, data, answer);
      setChecking(false);
      return;
    }

    if (isEasyMode && data.type !== "translate") {
      setFeedback({ isCorrect: false, correctAnswer: getString(data.answer) });
      setIsDone(true);
      if (onResult) onResult(false, data, answer);
      setChecking(false);
      return;
    }

    try {
      const res = await axios.post("https://looplingo.onrender.com/api/check", {
        question: getString(data.question),
        userAnswer: answer,
        language,
        type: data.type,
      });
      setFeedback(res.data);
      setIsDone(true);
      if (onResult) onResult(res.data.isCorrect, data, answer);
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
            data.type === "gender-drill") &&
            (isEasyMode ? (
              <select
                className="paper-select"
                onChange={(e) => setAnswer(e.target.value)}
                disabled={isDone || !!feedback}
              >
                <option value="">[ Select ]</option>
                {safeOptions.map((o) => (
                  <option key={getString(o)} value={getString(o)}>
                    {" "}
                    {getString(o)}{" "}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="paper-input"
                placeholder="_______"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={isDone || !!feedback}
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
                    disabled={isDone || !!feedback}
                    checked={getString(answer) === getString(opt)}
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
                disabled={isDone || !!feedback}
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
                      {" "}
                      {getString(w)}{" "}
                    </button>
                  ))}
                  <button className="wb-clear" onClick={() => setAnswer("")}>
                    {" "}
                    Clear{" "}
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
            disabled={checking || isDone}
          >
            {" "}
            Check{" "}
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

// ✨ UPDATED: Tracks Score
function MatchingGame({ data, index, onResult }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [matched, setMatched] = useState([]);
  const [wrong, setWrong] = useState(null);
  const [hasReported, setHasReported] = useState(false); // Prevent double reporting

  useEffect(() => {
    if (!data.pairs) return;
    const list = [];
    data.pairs.forEach((pair, idx) => {
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

  useEffect(() => {
    if (isComplete && !hasReported) {
      setHasReported(true);
      if (onResult) onResult(true, data, "Matched All");
    }
  }, [isComplete, hasReported, onResult, data]);

  return (
    <div className="matching-game-container">
      <div className="q-number">
        {" "}
        {index}. {getString(data.question)}{" "}
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
              {" "}
              {item.text}{" "}
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

// ... (EssayComponent and ListeningStoryComponent remain same) ...
function EssayComponent({ data, lang, onNext }) {
  const [userText, setUserText] = useState("");
  const [result, setResult] = useState(null);
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    setUserText("");
    setResult(null);
    setGrading(false);
  }, [data]);

  const handleSubmit = async () => {
    if (!userText.trim()) return;
    setGrading(true);
    try {
      const res = await axios.post(
        "https://looplingo.onrender.com/api/grade-essay",
        {
          userText,
          originalText: data.english_text,
          referenceText: data.french_reference,
          language: lang,
        }
      );
      setResult(res.data);
    } catch (e) {
      alert("Grading failed.");
      setGrading(false);
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
            {" "}
            {grading ? "Grading..." : "Submit Essay"}{" "}
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
            <button
              className="finish-btn"
              onClick={onNext}
              style={{ backgroundColor: "#3b82f6", marginTop: "30px" }}
            >
              {" "}
              Next Essay Scenario ➔{" "}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- COMPONENT: LISTENING STORY (Fixed Variable Name) ---
function ListeningStoryComponent({ data }) {
  // State is named 'isPlaying' and 'setIsPlaying'
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    window.speechSynthesis.cancel();
    setAnswers({});
    setSubmitted(false);
    setIsPlaying(false); // Fixed
    setIsPaused(false);
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [data]);

  useEffect(() => {
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  const detectLang = () => {
    if (/[\u0900-\u097F]/.test(data.script)) return "hi"; // Hindi (Devanagari)
    if (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(data.script)) return "ja"; // Japanese
    return "fr"; // default
  };

  const toggleAudio = () => {
    const synth = window.speechSynthesis;
    // Use 'isPlaying' variable
    if (isPlaying) {
      if (isPaused) {
        synth.resume();
        setIsPaused(false);
      } else {
        synth.pause();
        setIsPaused(true);
      }
    } else {
      if (!data.script) return;
      const utterance = new SpeechSynthesisUtterance(data.script);

      const langCode = detectLang();

      // pick voice by detected language
      const bestVoice =
        voices.find(
          (v) =>
            v.lang.startsWith(langCode) &&
            v.name.toLowerCase().includes("google")
        ) || voices.find((v) => v.lang.startsWith(langCode));

      utterance.lang =
        langCode === "hi" ? "hi-IN" : langCode === "ja" ? "ja-JP" : "fr-FR";

      if (bestVoice) utterance.voice = bestVoice;

      // pacing fixes
      utterance.rate = langCode === "ja" ? 0.9 : langCode === "hi" ? 0.85 : 0.8;

      // ✨ FIX: Use setIsPlaying instead of setIsSpeaking
      utterance.onstart = () => {
        setIsPlaying(true);
        setIsPaused(false);
      };
      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };
      utterance.onerror = (e) => {
        console.error("Audio error", e);
        setIsPlaying(false);
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

  // Use 'isPlaying' variable
  const isAnimating = isPlaying && !isPaused;

  return (
    <div className="listening-container">
      <div className={`audio-player-card ${isAnimating ? "playing" : ""}`}>
        {" "}
        {/* Use 'isPlaying' variable */}
        <button className="play-fab" onClick={toggleAudio}>
          {" "}
          {isPlaying && !isPaused ? "⏸" : "▶"}{" "}
        </button>
        <div className="audio-visualizer">
          <div className="bar"></div>
          <div className="bar"></div>
          <div className="bar"></div>
        </div>{" "}
        {/* Use 'isPlaying' variable */}
        <div className="player-text">
          {" "}
          {!isPlaying
            ? "Click to Play"
            : isPaused
            ? "Paused"
            : "Listening..."}{" "}
        </div>
      </div>
      <div className="story-questions">
        {data.questions &&
          data.questions.map((q, i) => (
            <div key={q.id || i} className="story-q-item">
              <p className="story-q-text">
                {" "}
                {i + 1}. {getString(q.question)}{" "}
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
      {!submitted ? (
        <button className="check-story-btn" onClick={checkAnswers}>
          {" "}
          Check Answers{" "}
        </button>
      ) : (
        <div className="story-result">
          <h3>
            {" "}
            You got {score} / {data.questions.length} correct!{" "}
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

export default App;

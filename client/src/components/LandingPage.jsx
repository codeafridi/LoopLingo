import "../styles/landing.css";
import { Link } from "react-router-dom";

export default function LandingPage({ onEnter }) {
  return (
    <div className="lp-root">
      {/* NAVBAR */}
      <nav className="lp-navbar">
        <div className="lp-container lp-nav-inner">
          <div className="lp-logo">LoopLingo</div>
          <div className="lp-nav-links">
            <input type="checkbox" id="nav-toggle" />
            <label htmlFor="nav-toggle" className="lp-hamburger">
              ☰
            </label>

            <div className="lp-mobile-menu">
              <a href="#how">How it works</a>
              <a href="#features">Features</a>
              <a href="#faq">FAQs</a>
              <Link to="/auth" className="lp-btn-primary">
                Try LoopLingo
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-container lp-hero-grid">
          <div>
            <h1>
              LoopLingo
              <br />
              Language Practice Engine
            </h1>
            <p>
              A language enhancer that turns speaking, writing, and mistakes
              into daily learning loops designed for real fluency.
            </p>
            <div className="lp-hero-cta">
              {/* force full page navigation to /auth to avoid client-router state jumping */}
              <a
                href="/auth"
                className="lp-btn-primary"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = "/auth";
                }}
              >
                Get Started
              </a>
              <a className="lp-btn-secondary" href="#features">
                See features
              </a>
            </div>
            <p className="lp-supported">
              Supports French, Spanish, German, Japanese, Hindi, Korean, Italian
              and more.
            </p>
          </div>

          <div className="hero-image">
            <img
              src="/dashboard-preview.png"
              alt="LoopLingo dashboard preview"
              className="dashboard-preview"
            />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="lp-section">
        <div className="lp-container">
          <h2>Everything you need to master a language</h2>
          <p className="lp-subtitle">
            Practice, track progress, and improve faster using structured
            lessons and feedback.
          </p>

          <div className="lp-grid-3">
            <div className="lp-card">
              <h3>Structured Learning Path</h3>
              <p>
                Clearly defined units, sections, and levels instead of random
                exercises.
              </p>
            </div>
            <div className="lp-card">
              <h3>Smart Worksheets</h3>
              <p>
                Grammar, vocabulary, and translation with instant AI correction.
              </p>
            </div>
            <div className="lp-card">
              <h3>Progress Tracking</h3>
              <p>Track attempts, scores, and improvement across every unit.</p>
            </div>
            <div className="lp-card">
              <h3>Essay Challenges</h3>
              <p>Write essays and get AI grading with actionable feedback.</p>
            </div>
            <div className="lp-card">
              <h3>Infinite Listening</h3>
              <p>
                AI-generated listening practice with comprehension questions.
              </p>
            </div>
            <div className="lp-card">
              <h3>Daily Practice Loop</h3>
              <p>Build habits without streak pressure or gamification traps.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="lp-section lp-muted">
        <div className="lp-container">
          <h2>How it works</h2>

          <div className="lp-steps">
            <div className="lp-step">
              <span>1</span>
              <p>Choose a language and your current level</p>
            </div>
            <div className="lp-step">
              <span>2</span>
              <p>Practice with worksheets, listening, and writing</p>
            </div>
            <div className="lp-step">
              <span>3</span>
              <p>Get instant AI feedback and track progress</p>
            </div>
            <div className="lp-step">
              <span>4</span>
              <p>Repeat daily loops until fluency compounds</p>
            </div>
          </div>
        </div>
      </section>

      {/* PREVIEW */}
      <section className="lp-section">
        <div className="lp-container">
          <h2>Designed for real practice</h2>
          <p className="lp-subtitle">
            No distractions. Just focused learning workflows.
          </p>

          <div className="lp-preview-box">
            <img
              src="/dashboard-preview2.png"
              alt="LoopLingo dashboard preview"
              className="lp-preview-image"
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="lp-section lp-muted">
        <div className="lp-container">
          <h2>FAQs</h2>

          <div className="lp-faq">
            <details>
              <summary>How does LoopLingo work?</summary>
              <p>
                It combines structured lessons with AI feedback loops for faster
                learning.
              </p>
            </details>
            <details>
              <summary>Is this better than flashcards?</summary>
              <p>
                Yes. You practice real language usage, not passive memorization.
              </p>
            </details>
            <details>
              <summary>Can beginners use this?</summary>
              <p>Yes. Levels are aligned with CEFR from beginner upward.</p>
            </details>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="lp-final">
        <div className="lp-container">
          <h2>Start practicing smarter today</h2>
          <a
            href="/auth"
            className="lp-btn-primary large"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = "/auth";
            }}
          >
            Try LoopLingo
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        © {new Date().getFullYear()} LoopLingo
      </footer>
    </div>
  );
}

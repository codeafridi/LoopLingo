import "../styles/landing.css";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "../supabase";

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } = {} } = await supabase.auth.getSession();
        if (active && session) navigate("/app", { replace: true });
      } catch {
        // ignore auth check errors on landing
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/app", { replace: true });
    });

    return () => {
      active = false;
      if (subscription?.unsubscribe) subscription.unsubscribe();
    };
  }, [navigate]);

  const scrollToSection = (id) => {
    const target = document.getElementById(id);
    if (!target) return;

    const navOffset = 72;
    const top =
      target.getBoundingClientRect().top + window.pageYOffset - navOffset;
    window.scrollTo({ top, behavior: "smooth" });

    const toggle = document.getElementById("nav-toggle");
    if (toggle) toggle.checked = false;
  };

  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash || "";
      const normalized = hash.replace(/^#\/?/, "");
      if (
        normalized === "features" ||
        normalized === "how" ||
        normalized === "faq"
      ) {
        setTimeout(() => scrollToSection(normalized), 0);
      }
    };

    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

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
              <button
                type="button"
                onClick={() => scrollToSection("how")}
              >
                How it works
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("features")}
              >
                Features
              </button>
              <button type="button" onClick={() => scrollToSection("faq")}>
                FAQs
              </button>
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
              <Link to="/auth" className="lp-btn-primary">
                Get Started
              </Link>

              <button
                type="button"
                className="lp-btn-secondary"
                onClick={() => scrollToSection("features")}
              >
                See features
              </button>
            </div>
            <p className="lp-inline-cta">
              New here?{" "}
              <Link to="/auth?mode=signup" className="lp-inline-link">
                Create account
              </Link>
            </p>
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
          <Link to="/auth" className="lp-btn-primary large">
            Try LoopLingo
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        © {new Date().getFullYear()} LoopLingo
        <span className="lp-footer-sep">•</span>
        <a
          className="lp-footer-link"
          href="https://x.com/LoopLingo_in"
          target="_blank"
          rel="noreferrer"
        >
          Follow on X
        </a>
      </footer>
    </div>
  );
}

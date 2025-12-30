import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import "../styles/landing.css";

function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    const init = async () => {
      const hasOAuthToken =
        /access_token=|refresh_token=|provider_token=|#access_token|#refresh_token/.test(
          window.location.href
        );

      if (hasOAuthToken) {
        if (typeof supabase.auth.getSessionFromUrl === "function") {
          try {
            const res = await supabase.auth.getSessionFromUrl();
            const sessionFromUrl = res?.data?.session;
            if (
              sessionFromUrl &&
              sessionFromUrl.user &&
              sessionFromUrl.user.id
            ) {
              window.history.replaceState(
                {},
                document.title,
                window.location.pathname
              );
              navigate("/app", { replace: true });
              return;
            }
          } catch {
            // ignore
          }
        }
      }

      try {
        const { data: { session } = {} } = await supabase.auth.getSession();
        setSession(session);
      } catch {
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } = {} } = supabase.auth.onAuthStateChange(
      (_, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    return () => {
      if (subscription && subscription.unsubscribe) subscription.unsubscribe();
    };
  }, [navigate]);

  const signInWithGoogle = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/app` },
      });
    } catch (error) {
      console.error("Auth:signInWithGoogle error", error);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
    } catch (e) {
      console.error("Auth:signOut failed", e);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#94a3b8",
        }}
      >
        Checking session…
      </div>
    );
  }

  // If a session exists, show choices instead of forcing immediate redirect
  if (session) {
    const userEmail =
      session.user?.email || session.user?.user_metadata?.email || "Account";
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg, #0b1220, #020617)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(16px)",
            borderRadius: "20px",
            padding: "40px",
            boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.08)",
            textAlign: "center",
            color: "white",
          }}
        >
          <h2 style={{ marginBottom: 6 }}>Continue as</h2>
          <p style={{ marginBottom: 18, color: "#94a3b8" }}>{userEmail}</p>

          <button
            onClick={() => navigate("/app", { replace: true })}
            className="lp-btn-primary"
            style={{ width: "100%", fontSize: 16, marginBottom: 12 }}
          >
            Continue to Dashboard
          </button>

          <button
            onClick={signOut}
            className="lp-btn-secondary"
            style={{ width: "100%", fontSize: 14 }}
          >
            Sign out / Use another account
          </button>
        </div>
      </div>
    );
  }

  // No session: show sign-in UI
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0b1220, #020617)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "rgba(15, 23, 42, 0.7)",
          backdropFilter: "blur(16px)",
          borderRadius: "20px",
          padding: "40px",
          boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
          color: "white",
        }}
      >
        <h1 style={{ marginBottom: "12px" }}>Welcome to LoopLingo</h1>
        <p style={{ color: "#94a3b8", marginBottom: "32px" }}>
          Sign in to start your language practice.
        </p>

        <button
          onClick={signInWithGoogle}
          className="lp-btn-primary"
          style={{
            width: "100%",
            fontSize: "16px",
          }}
        >
          Continue with Google
        </button>

        <p
          style={{
            marginTop: "24px",
            fontSize: "13px",
            color: "#64748b",
          }}
        >
          By continuing, you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}

export default Auth;

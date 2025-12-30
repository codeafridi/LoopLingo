import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import "../styles/landing.css";

function Auth() {
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: { session } = {} } = await supabase.auth.getSession();
      if (session) navigate("/app", { replace: true });
    };
    init();

    const { data: { subscription } = {} } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) navigate("/app", { replace: true });
      }
    );

    return () => {
      if (subscription && subscription.unsubscribe) subscription.unsubscribe();
    };
  }, [navigate]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/app`,
      },
    });

    if (error) {
      console.error(error.message);
    }
  };

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

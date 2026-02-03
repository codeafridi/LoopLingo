import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleAuth = async () => {
      setLoading(true);
      setError("");

      // 🔑 Handle OAuth callback FIRST (hash router uses # for routing)
      if (window.location.hash.includes("access_token")) {
        const { error: sessionError } =
          await supabase.auth.getSessionFromUrl();

        if (sessionError) {
          setError(sessionError.message || "Authentication failed.");
          setLoading(false);
          return;
        }

        // Clean URL and go to app
        window.history.replaceState(
          {},
          document.title,
          `${window.location.pathname}#/app`
        );
        navigate("/app", { replace: true });
        return;
      }

      // Normal session check
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate("/app", { replace: true });
        return;
      }

      setLoading(false);
    };

    handleAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/app", { replace: true });
    });

    return () => {
      if (subscription?.unsubscribe) subscription.unsubscribe();
    };
  }, [navigate]);

  const signInWithGoogle = async () => {
    setError("");
    setLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Use implicit flow to keep access_token in the hash, then clean it.
        redirectTo: window.location.origin,
      },
    });

    if (oauthError) {
      setError(oauthError.message || "Google sign-in failed.");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <button
          onClick={signInWithGoogle}
          className="lp-btn-primary"
          disabled={loading}
        >
          {loading ? "Signing you in..." : "Continue with Google"}
        </button>
        {error ? (
          <div style={{ marginTop: "12px", color: "#ef4444" }}>{error}</div>
        ) : null}
      </div>
    </div>
  );
}

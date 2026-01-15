import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function Auth() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      // 🔑 Handle OAuth callback FIRST
      if (window.location.hash.includes("access_token")) {
        await supabase.auth.getSessionFromUrl();

        // clean URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname + "#/app"
        );

        navigate("/app", { replace: true });
        return;
      }

      // normal session check
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate("/app", { replace: true });
      }
    };

    handleAuth();
  }, [navigate]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin, // IMPORTANT
      },
    });
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <button onClick={signInWithGoogle} className="lp-btn-primary">
        Continue with Google
      </button>
    </div>
  );
}

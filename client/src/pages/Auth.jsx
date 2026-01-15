import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function Auth() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate("/app", { replace: true });
      }
    });
  }, [navigate]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/#/app`,
      },
    });
    console.log("OAuth Redirect URL:", `${window.location.origin}/#/app`);
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <button onClick={signInWithGoogle} className="lp-btn-primary">
        Continue with Google
      </button>
    </div>
  );
}

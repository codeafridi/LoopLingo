import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function Protected({ children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    const init = async () => {
      // If URL might contain OAuth tokens, parse them (guarded)
      if (window.location.hash || window.location.search) {
        if (typeof supabase.auth.getSessionFromUrl === "function") {
          try {
            await supabase.auth.getSessionFromUrl();
            // clean URL hash/search after parsing tokens
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
          } catch (e) {
            // ignore parse errors
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
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    return () => {
      if (subscription && subscription.unsubscribe) subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#020617",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#94a3b8",
          fontSize: "14px",
        }}
      >
        Loading LoopLingo…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

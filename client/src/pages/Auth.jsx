import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabase";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const blockRedirectRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return localStorage.getItem("ll_remember_me") !== "false";
    } catch {
      return true;
    }
  });

  const redirectToAuth = `${window.location.origin}/#/auth`;

  useEffect(() => {
    const handleAuth = async () => {
      setLoading(true);
      setError("");
      setInfo("");

      // 🔑 Handle OAuth callback FIRST (hash router uses # for routing)
      if (window.location.hash.includes("access_token")) {
        const isRecovery = window.location.hash.includes("type=recovery");
        const { error: sessionError } =
          await supabase.auth.getSessionFromUrl();

        if (sessionError) {
          setError(sessionError.message || "Authentication failed.");
          setLoading(false);
          return;
        }

        if (isRecovery) {
          blockRedirectRef.current = true;
          setMode("reset-new");
          setInfo("Create a new password to continue.");
          window.history.replaceState(
            {},
            document.title,
            `${window.location.pathname}#/auth`
          );
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
      if (blockRedirectRef.current) return;
      if (session) navigate("/app", { replace: true });
    });

    return () => {
      if (subscription?.unsubscribe) subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextMode = params.get("mode");
    if (nextMode === "signup" || nextMode === "signin") {
      if (mode === "reset-new" || mode === "confirm-email") return;
      setMode(nextMode);
    }
  }, [location.search, mode]);

  const updateRememberMe = (value) => {
    setRememberMe(value);
    try {
      localStorage.setItem("ll_remember_me", value ? "true" : "false");
    } catch {
      // ignore storage errors
    }
  };

  const signInWithGoogle = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    updateRememberMe(rememberMe);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Send back to /#/auth so we can handle the OAuth callback.
        redirectTo: redirectToAuth,
      },
    });

    if (oauthError) {
      setError(oauthError.message || "Google sign-in failed.");
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    if (!email || !password) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }

    try {
      updateRememberMe(rememberMe);
      if (mode === "signin") {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (signInError) throw signInError;
        if (data?.session) navigate("/app", { replace: true });
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectToAuth,
          },
        });

        if (signUpError) throw signUpError;
        if (data?.session) {
          navigate("/app", { replace: true });
        } else {
          setMode("confirm-email");
          setInfo("We sent a confirmation link to your email.");
        }
      }
    } catch (err) {
      setError(err?.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    setError("");
    setInfo("");
    setLoading(true);

    if (!email) {
      setError("Enter your email to resend the confirmation link.");
      setLoading(false);
      return;
    }

    try {
      if (typeof supabase.auth.resend !== "function") {
        setInfo("Please check your inbox for the confirmation email.");
        setLoading(false);
        return;
      }
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: redirectToAuth },
      });
      if (resendError) throw resendError;
      setInfo("Confirmation email resent.");
    } catch (err) {
      setError(err?.message || "Failed to resend confirmation email.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    if (!email) {
      setError("Enter the email you used to sign up.");
      setLoading(false);
      return;
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: redirectToAuth }
      );
      if (resetError) throw resetError;
      setInfo("Reset link sent. Check your email.");
    } catch (err) {
      setError(err?.message || "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    if (!newPassword) {
      setError("Enter a new password.");
      setLoading(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
      blockRedirectRef.current = false;
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err?.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRecovery = async () => {
    blockRedirectRef.current = false;
    await supabase.auth.signOut();
    setMode("signin");
    setLoading(false);
  };

  const isResetRequest = mode === "reset-request";
  const isResetNew = mode === "reset-new";
  const isConfirmEmail = mode === "confirm-email";
  const isEmailAuth = mode === "signin" || mode === "signup";

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
          maxWidth: "460px",
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(16px)",
          borderRadius: "22px",
          padding: "36px",
          boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
          color: "white",
        }}
      >
        <h1 style={{ marginBottom: "6px" }}>Welcome to LoopLingo</h1>
        <p style={{ color: "#94a3b8", marginBottom: "24px" }}>
          Sign in to start your language practice.
        </p>

        {!isResetNew && (
          <button
            onClick={signInWithGoogle}
            className="lp-btn-primary"
            disabled={loading}
            style={{ width: "100%" }}
          >
            {loading ? "Signing you in..." : "Continue with Google"}
          </button>
        )}

        {!isResetNew && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              margin: "18px 0",
              color: "#94a3b8",
              fontSize: "13px",
            }}
          >
            <div style={{ height: 1, flex: 1, background: "#e5e7eb" }} />
            <span>or</span>
            <div style={{ height: 1, flex: 1, background: "#e5e7eb" }} />
          </div>
        )}

        {isEmailAuth && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="lp-btn-secondary"
              style={{
                width: "50%",
                borderColor: mode === "signin" ? "#0f172a" : "#e5e7eb",
                color: "#0f172a",
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className="lp-btn-secondary"
              style={{
                width: "50%",
                borderColor: mode === "signup" ? "#0f172a" : "#e5e7eb",
                color: "#0f172a",
              }}
            >
              Sign Up
            </button>
          </div>
        )}

        {isEmailAuth && (
          <form
            onSubmit={handleEmailAuth}
            style={{
              display: "grid",
              gap: "10px",
              textAlign: "left",
            }}
          >
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="paper-input"
              style={{
                width: "100%",
                background: "#ffffff",
                color: "#0f172a",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "12px 14px",
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="paper-input"
              style={{
                width: "100%",
                background: "#ffffff",
                color: "#0f172a",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "12px 14px",
              }}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                color: "#94a3b8",
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => updateRememberMe(e.target.checked)}
                disabled={loading}
              />
              Remember me on this device
            </label>
            <button
              type="submit"
              className="lp-btn-primary"
              disabled={loading}
              style={{ width: "100%" }}
            >
              {loading
                ? "Please wait..."
                : mode === "signin"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>
        )}

        {isConfirmEmail && (
          <div style={{ textAlign: "left" }}>
            <p style={{ color: "#cbd5f5", marginBottom: "10px" }}>
              We sent a confirmation link to <strong>{email}</strong>.
              Once you confirm, come back and sign in.
            </p>
            <button
              type="button"
              className="lp-btn-primary"
              onClick={handleResendConfirmation}
              disabled={loading}
              style={{ width: "100%", marginBottom: "10px" }}
            >
              {loading ? "Resending..." : "Resend confirmation email"}
            </button>
            <button
              type="button"
              className="lp-btn-secondary"
              onClick={() => setMode("signin")}
              style={{ width: "100%", color: "#0f172a" }}
            >
              Back to Sign In
            </button>
          </div>
        )}

        {isResetRequest && (
          <form
            onSubmit={handleResetRequest}
            style={{
              display: "grid",
              gap: "10px",
              textAlign: "left",
            }}
          >
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="paper-input"
              style={{
                width: "100%",
                background: "#ffffff",
                color: "#0f172a",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "12px 14px",
              }}
            />
            <button
              type="submit"
              className="lp-btn-primary"
              disabled={loading}
              style={{ width: "100%" }}
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
            <button
              type="button"
              className="lp-btn-secondary"
              onClick={() => setMode("signin")}
              style={{ width: "100%", color: "#0f172a" }}
            >
              Back to Sign In
            </button>
          </form>
        )}

        {isResetNew && (
          <form
            onSubmit={handleUpdatePassword}
            style={{
              display: "grid",
              gap: "10px",
              textAlign: "left",
            }}
          >
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              className="paper-input"
              style={{
                width: "100%",
                background: "#ffffff",
                color: "#0f172a",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "12px 14px",
              }}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              className="paper-input"
              style={{
                width: "100%",
                background: "#ffffff",
                color: "#0f172a",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "12px 14px",
              }}
            />
            <button
              type="submit"
              className="lp-btn-primary"
              disabled={loading}
              style={{ width: "100%" }}
            >
              {loading ? "Updating..." : "Update password"}
            </button>
            <button
              type="button"
              className="lp-btn-secondary"
              onClick={handleCancelRecovery}
              style={{ width: "100%", color: "#0f172a" }}
            >
              Cancel
            </button>
          </form>
        )}

        {isEmailAuth && (
          <button
            type="button"
            onClick={() => setMode("reset-request")}
            style={{
              marginTop: "10px",
              background: "none",
              border: "none",
              color: "#cbd5f5",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Forgot password?
          </button>
        )}

        {error ? (
          <div style={{ marginTop: "12px", color: "#ef4444" }}>{error}</div>
        ) : null}
        {info ? (
          <div style={{ marginTop: "12px", color: "#16a34a" }}>{info}</div>
        ) : null}

        <p
          style={{
            marginTop: "18px",
            fontSize: "12px",
            color: "#64748b",
          }}
        >
          By continuing, you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}

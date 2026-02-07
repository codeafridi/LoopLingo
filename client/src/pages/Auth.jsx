import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabase";
import "../styles/auth.css";

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

      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash || "";
      const hashQueryIndex = hash.indexOf("?");
      const hashQuery =
        hashQueryIndex >= 0 ? hash.slice(hashQueryIndex + 1) : "";
      const hashParams = new URLSearchParams(hashQuery);

      const tokenFragmentIndex = hash.lastIndexOf("#");
      const tokenFragment =
        tokenFragmentIndex >= 0 ? hash.slice(tokenFragmentIndex + 1) : "";
      const tokenParams = new URLSearchParams(tokenFragment);

      const code = searchParams.get("code") || hashParams.get("code");
      const accessToken = tokenParams.get("access_token");
      const refreshToken = tokenParams.get("refresh_token");
      const errorParam =
        searchParams.get("error_description") ||
        searchParams.get("error") ||
        hashParams.get("error_description") ||
        hashParams.get("error");
      const isRecovery =
        hash.includes("type=recovery") ||
        searchParams.get("type") === "recovery" ||
        hashParams.get("type") === "recovery";

      if (errorParam) {
        setError(decodeURIComponent(errorParam));
        setLoading(false);
        return;
      }

      // 🔑 Handle OAuth callback (PKCE uses ?code=, implicit uses #access_token)
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message || "Authentication failed.");
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

        window.history.replaceState(
          {},
          document.title,
          `${window.location.pathname}#/app`
        );
        navigate("/app", { replace: true });
        return;
      }

      if (accessToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        });

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

        window.history.replaceState(
          {},
          document.title,
          `${window.location.pathname}#/app`
        );
        navigate("/app", { replace: true });
        return;
      }

      if (hash.includes("access_token")) {
        const { error: sessionError } =
          await supabase.auth.getSessionFromUrl();

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
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Send back to /#/auth so we can handle the OAuth callback.
        redirectTo: redirectToAuth,
      },
    });

    if (data?.url) {
      window.location.href = data.url;
      return;
    }

    if (oauthError) {
      setError(oauthError.message || "Google sign-in failed.");
      setLoading(false);
      return;
    }

    setError("Unable to start Google sign-in. Please try again.");
    setLoading(false);
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
        const session =
          data?.session || (await supabase.auth.getSession()).data.session;
        if (session) {
          navigate("/app", { replace: true });
        } else {
          setError("Sign in succeeded, but no session was created.");
        }
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
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Welcome to LoopLingo</h1>
        <p className="auth-subtitle">
          Sign in to start your language practice.
        </p>

        {!isResetNew && (
          <button
            onClick={signInWithGoogle}
            className="auth-google-btn"
            disabled={loading}
          >
            {loading ? "Signing you in..." : "Continue with Google"}
          </button>
        )}

        {!isResetNew && <div className="auth-divider"><span>or</span></div>}

        {isEmailAuth && (
          <div className="auth-tabs">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`auth-tab ${mode === "signin" ? "active" : ""}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            >
              Sign Up
            </button>
          </div>
        )}

        {isEmailAuth && (
          <form
            onSubmit={handleEmailAuth}
            className="auth-form"
          >
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="auth-input"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="auth-input"
            />
            <label className="auth-remember">
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
              className="auth-primary"
              disabled={loading}
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
              className="auth-primary"
              onClick={handleResendConfirmation}
              disabled={loading}
              style={{ marginBottom: "10px" }}
            >
              {loading ? "Resending..." : "Resend confirmation email"}
            </button>
            <button
              type="button"
              className="auth-secondary"
              onClick={() => setMode("signin")}
            >
              Back to Sign In
            </button>
          </div>
        )}

        {isResetRequest && (
          <form
            onSubmit={handleResetRequest}
            className="auth-form"
          >
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="auth-input"
            />
            <button
              type="submit"
              className="auth-primary"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
            <button
              type="button"
              className="auth-secondary"
              onClick={() => setMode("signin")}
            >
              Back to Sign In
            </button>
          </form>
        )}

        {isResetNew && (
          <form
            onSubmit={handleUpdatePassword}
            className="auth-form"
          >
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              className="auth-input"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              className="auth-input"
            />
            <button
              type="submit"
              className="auth-primary"
              disabled={loading}
            >
              {loading ? "Updating..." : "Update password"}
            </button>
            <button
              type="button"
              className="auth-secondary"
              onClick={handleCancelRecovery}
            >
              Cancel
            </button>
          </form>
        )}

        {isEmailAuth && (
          <button
            type="button"
            onClick={() => setMode("reset-request")}
            className="auth-link"
          >
            Forgot password?
          </button>
        )}

        {error ? (
          <div className="auth-error">{error}</div>
        ) : null}
        {info ? (
          <div className="auth-info">{info}</div>
        ) : null}

        <p className="auth-legal">
          By continuing, you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}

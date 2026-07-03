import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);

  // If already logged in, redirect immediately to company directory
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "339462828557-smpb22g16a1b241315b74681329c3v3d.apps.googleusercontent.com";

    console.log("Initializing Google Sign-in with Client ID:", clientId);

    // Callback invoked when user successfully logs in with Google
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleCredentialResponse = async (response: any) => {
      setError(null);
      setAuthenticating(true);
      try {
        await login(response.credential);
        navigate("/");
      } catch (err: any) {
        console.error("Login failed:", err);
        setError(
          err.response?.data?.message ||
          "Authentication failed. Please verify your email is pre-registered in the directory."
        );
      } finally {
        setAuthenticating(false);
      }
    };

    // The Google GSI script loads with async+defer, so window.google may not
    // be available yet when this effect first runs. Poll until it is ready.
    let attempts = 0;
    const maxAttempts = 40; // wait up to ~4 seconds (40 × 100 ms)
    let timerId: ReturnType<typeof setTimeout>;

    const initGoogle = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const googleAccounts = (window as any).google?.accounts?.id;

      if (googleAccounts) {
        try {
          googleAccounts.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          const buttonEl = document.getElementById("google-signin-button");
          if (buttonEl) {
            googleAccounts.renderButton(buttonEl, {
              theme: "outline",
              size: "large",
              width: 280,
              text: "signin_with",
              shape: "pill",
              logo_alignment: "left",
            });
          }
        } catch (e) {
          console.error("Google accounts script failed to initialize", e);
        }
      } else {
        attempts++;
        if (attempts < maxAttempts) {
          // Script not ready yet — try again in 100 ms
          timerId = setTimeout(initGoogle, 100);
        } else {
          console.error("Google Sign-In script failed to load after 4 seconds.");
          setError("Google Sign-In failed to load. Please refresh the page and try again.");
        }
      }
    };

    initGoogle();

    // Cleanup: cancel any pending timer when the component unmounts
    return () => clearTimeout(timerId);
  }, [login, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 relative overflow-hidden select-none">
      {/* Background soft radial gradient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Card container */}
      <div className="w-full max-w-sm space-y-7 rounded-xl border border-slate-200 bg-white p-8 shadow-md relative z-10">
        
        {/* Branding header */}
        <div className="text-center">
          <div className="flex justify-center">
            <img 
              src="/5y.webp" 
              alt="5yinc Logo" 
              className="h-14 w-auto object-contain hover:scale-102 transition-transform duration-300"
            />
          </div>
          <h2 className="mt-5 text-center font-display text-lg font-bold text-slate-800">
            Company Directory
          </h2>
          <p className="mt-1.5 text-center text-xs text-slate-500">
            Sign in to explore teams, careers, and organization structures.
          </p>
        </div>

        {/* Error alert banner */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 text-center animate-fade-in">
            {error}
          </div>
        )}

        {/* Action Button Container */}
        <div className="mt-6 flex flex-col items-center justify-center gap-4">
          {authenticating ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              <span className="text-[10px] font-bold tracking-wide uppercase text-slate-400 animate-pulse">
                Verifying...
              </span>
            </div>
          ) : (
            <div id="google-signin-button" className="min-h-[40px] flex items-center justify-center" />
          )}
        </div>

        {/* Footer legalities */}
        <div className="text-center text-[10px] text-slate-400">
          This system is restricted to authorized employees only.
        </div>
      </div>
    </div>
  );
}

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
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "339462828557-smpb22g16a1b241315b74681329c3v3d.apps.googleusercontent.com"; // placeholder or default client ID

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

    // Initialize Google Identity Services
    try {
      if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
        const idObj = (window as any).google.accounts.id;
        idObj.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true
        });

        idObj.renderButton(
          document.getElementById("google-signin-button"),
          {
            theme: "outline",
            size: "large",
            width: 280,
            text: "signin_with",
            shape: "pill",
            logo_alignment: "left"
          }
        );
      }
    } catch (e) {
      console.error("Google accounts script failed to initialize", e);
    }
  }, [login, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 relative overflow-hidden select-none">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Card container */}
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-white/10 bg-white/[0.02] p-8 shadow-2xl backdrop-blur-md">
        
        {/* Branding header */}
        <div className="text-center">
          <div className="flex justify-center">
            <img 
              src="/5y.webp" 
              alt="5yinc Logo" 
              className="h-16 w-auto object-contain hover:scale-105 transition-transform duration-350"
            />
          </div>
          <h2 className="mt-6 text-center font-display text-2xl font-black tracking-tight text-white">
            Company Directory
          </h2>
          <p className="mt-2 text-center text-xs font-semibold text-slate-400">
            Sign in to explore teams, careers, and organization structures.
          </p>
        </div>

        {/* Error alert banner */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs font-semibold text-red-400 text-center animate-fade-in">
            ⚠️ {error}
          </div>
        )}

        {/* Action Button Container */}
        <div className="mt-8 flex flex-col items-center justify-center gap-4">
          {authenticating ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <span className="text-[10px] font-bold tracking-wide uppercase text-slate-500 animate-pulse">
                Verifying Credentials...
              </span>
            </div>
          ) : (
            <div id="google-signin-button" className="min-h-[44px] flex items-center justify-center" />
          )}
        </div>

        {/* Footer legalities */}
        <div className="text-center text-[10px] font-semibold text-slate-500">
          This system is restricted to authorized 5yinc employees only.
        </div>
      </div>
    </div>
  );
}

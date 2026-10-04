import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Status = "loading" | "success" | "error";

const AuthCallback = () => {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const { setSessionFromCallback } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.substring(1); // strip leading #
    const params = new URLSearchParams(hash);

    const error = params.get("error");
    const errorDesc = params.get("error_description");

    if (error) {
      setErrorMsg(errorDesc?.replace(/\+/g, " ") || "Verification failed. The link may have expired.");
      setStatus("error");
      return;
    }

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const expiresIn = parseInt(params.get("expires_in") || "3600", 10);
    const type = params.get("type");

    if (!accessToken || !refreshToken) {
      setErrorMsg("No session found in the verification link. Please try signing up again.");
      setStatus("error");
      return;
    }

    setSessionFromCallback(accessToken, refreshToken, expiresIn)
      .then(() => {
        setStatus("success");
        setTimeout(() => navigate(type === "recovery" ? "/profile" : "/dashboard"), 1500);
      })
      .catch((err) => {
        setErrorMsg(err.message || "Could not establish session. Please try logging in.");
        setStatus("error");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        <div className="glass-card p-10">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className={`absolute inset-0 rounded-full blur-2xl animate-pulse-slow ${status === "error" ? "bg-destructive/20" : "bg-primary/20"}`} />
            <div className={`relative w-20 h-20 rounded-full flex items-center justify-center border ${status === "error" ? "bg-destructive/10 border-destructive/30" : "bg-primary/10 border-primary/30"}`}>
              {status === "loading" && <Shield className="w-10 h-10 text-primary animate-pulse" />}
              {status === "success" && <CheckCircle className="w-10 h-10 text-success" />}
              {status === "error" && <XCircle className="w-10 h-10 text-destructive" />}
            </div>
          </div>

          {status === "loading" && (
            <>
              <h1 className="text-xl font-bold mb-2">Verifying your account…</h1>
              <p className="text-muted-foreground text-sm mb-4">Please wait while we confirm your email.</p>
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
            </>
          )}

          {status === "success" && (
            <>
              <h1 className="text-xl font-bold mb-2 text-success">Email verified!</h1>
              <p className="text-muted-foreground text-sm">Your account is now active. Redirecting to your dashboard…</p>
            </>
          )}

          {status === "error" && (
            <>
              <h1 className="text-xl font-bold mb-2 text-destructive">Verification failed</h1>
              <p className="text-muted-foreground text-sm mb-6">{errorMsg}</p>
              <div className="space-y-3">
                <button
                  onClick={() => navigate("/login")}
                  className="w-full btn-primary"
                >
                  Back to Sign In
                </button>
                <button
                  onClick={() => navigate("/signup")}
                  className="w-full py-2.5 px-4 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm"
                >
                  Create a new account
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;

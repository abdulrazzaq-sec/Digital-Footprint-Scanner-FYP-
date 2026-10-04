import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const { login, resendVerification } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const validate = () => {
    const e: typeof errors = {};
    if (!email) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Please enter a valid email";
    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "Password must be at least 6 characters";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setErrors({});
    setUnverifiedEmail(null);

    const result = await login(email, password);
    setIsLoading(false);

    if (result.success) {
      toast({ title: "Welcome back!", description: "You've successfully signed in." });
      navigate("/dashboard");
    } else if (result.code === "EMAIL_NOT_VERIFIED") {
      setUnverifiedEmail(email);
    } else {
      setErrors({ form: result.error || "Invalid email or password. Please try again." });
    }
  };

  const handleResend = async () => {
    if (!unverifiedEmail) return;
    setIsResending(true);
    const result = await resendVerification(unverifiedEmail);
    setIsResending(false);
    if (result.success) {
      toast({ title: "Verification email sent", description: "Check your inbox and click the link to verify your account." });
    } else {
      toast({ title: "Failed to resend", description: result.error, variant: "destructive" });
    }
  };

  return (
    <div className="landing-theme min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary/20 via-background to-secondary/20 items-center justify-center p-12">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="relative z-10 text-center">
          <div className="relative w-48 h-48 mx-auto mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-secondary/30 rounded-full blur-3xl animate-pulse-slow" />
            <div className="relative z-10 w-full h-full flex items-center justify-center">
              <Shield className="w-24 h-24 text-primary animate-float" />
            </div>
          </div>
          <h2 className="text-3xl font-bold mb-4">
            Welcome to <span className="text-primary">Digital Footprint Scanner</span>
          </h2>
          <p className="text-muted-foreground max-w-md">
            Your complete digital footprint analysis platform. Discover what the internet knows about you.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <Shield className="w-10 h-10 text-primary" />
            <span className="text-2xl font-bold">
              Digital Footprint<span className="text-primary"> Scanner</span>
            </span>
          </div>

          <div className="glass-card p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">Sign In</h1>
              <p className="text-muted-foreground">Enter your credentials to access your account</p>
            </div>

            {/* Email not verified banner */}
            {unverifiedEmail && (
              <div className="mb-6 p-4 rounded-lg bg-warning/10 border border-warning/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-warning mb-1">Email not verified</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      We sent a verification link to{" "}
                      <span className="font-medium">{unverifiedEmail}</span>. Check your inbox
                      (and spam folder) and click the link to activate your account.
                    </p>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isResending}
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isResending ? "animate-spin" : ""}`} />
                      {isResending ? "Sending…" : "Resend verification email"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Form-level error */}
            {errors.form && (
              <div className="mb-5 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errors.form}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined, form: undefined })); }}
                    placeholder="Enter your email"
                    autoComplete="email"
                    className={`input-cyber w-full pl-12 ${errors.email ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Password</label>
                  <span className="text-xs text-primary hover:underline cursor-pointer">Forgot password?</span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined, form: undefined })); }}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className={`input-cyber w-full pl-12 pr-12 ${errors.password ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive mt-1">{errors.password}</p>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" />Signing in…</>
                ) : (
                  <>Sign In<ArrowRight className="w-5 h-5" /></>
                )}
              </button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Don't have an account?{" "}
              <Link to="/signup" className="text-primary hover:underline font-medium">Sign up</Link>
            </p>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-4">
            <Link to="/" className="hover:text-primary transition-colors">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

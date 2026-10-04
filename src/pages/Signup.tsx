import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Shield, Mail, Lock, Eye, EyeOff, User, ArrowRight, Loader2, Check, X, RefreshCw, MailCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; confirmPassword?: string; terms?: string }>({});
  const [passwordStrength, setPasswordStrength] = useState(0);

  const { signup, resendVerification } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    let s = 0;
    if (password.length >= 8) s += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) s += 25;
    if (/\d/.test(password)) s += 25;
    if (/[^a-zA-Z0-9]/.test(password)) s += 25;
    setPasswordStrength(s);
  }, [password]);

  const strengthColor = passwordStrength <= 25 ? "bg-destructive" : passwordStrength <= 50 ? "bg-warning" : passwordStrength <= 75 ? "bg-secondary" : "bg-success";
  const strengthLabel = passwordStrength <= 25 ? "Weak" : passwordStrength <= 50 ? "Fair" : passwordStrength <= 75 ? "Good" : "Strong";

  const passwordChecks = [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "Uppercase & lowercase letters", valid: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: "At least one number", valid: /\d/.test(password) },
    { label: "At least one special character", valid: /[^a-zA-Z0-9]/.test(password) },
  ];

  const validate = () => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Name is required";
    if (!email) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Please enter a valid email";
    if (!password) e.password = "Password is required";
    else if (password.length < 8) e.password = "Password must be at least 8 characters";
    if (!confirmPassword) e.confirmPassword = "Please confirm your password";
    else if (password !== confirmPassword) e.confirmPassword = "Passwords do not match";
    if (!acceptTerms) e.terms = "You must accept the terms and conditions";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    const result = await signup(name, email, password);
    setIsLoading(false);

    if (result.success) {
      setPendingEmail(email);
    } else {
      toast({ title: "Signup failed", description: result.error || "Please try again later.", variant: "destructive" });
    }
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setIsResending(true);
    const result = await resendVerification(pendingEmail);
    setIsResending(false);
    if (result.success) {
      toast({ title: "Email resent", description: "Check your inbox for a new verification link." });
    } else {
      toast({ title: "Could not resend", description: result.error, variant: "destructive" });
    }
  };

  // Verification pending screen
  if (pendingEmail) {
    return (
      <div className="landing-theme min-h-screen bg-background flex items-center justify-center p-8">
        <div className="w-full max-w-md text-center">
          <div className="glass-card p-10">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse-slow" />
              <div className="relative w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                <MailCheck className="w-10 h-10 text-primary" />
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-3">Check your inbox</h1>
            <p className="text-muted-foreground mb-2">
              We sent a verification link to
            </p>
            <p className="font-semibold text-foreground mb-6">{pendingEmail}</p>

            <div className="p-4 rounded-lg bg-muted/30 text-left space-y-2 mb-6 text-sm text-muted-foreground">
              <p className="flex items-center gap-2"><Check className="w-4 h-4 text-success flex-shrink-0" /> Open the email from Digital Footprint Scanner</p>
              <p className="flex items-center gap-2"><Check className="w-4 h-4 text-success flex-shrink-0" /> Click the "Confirm your email" button</p>
              <p className="flex items-center gap-2"><Check className="w-4 h-4 text-success flex-shrink-0" /> You'll be redirected back and signed in automatically</p>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Didn't receive it? Check your spam folder, or click below to resend.
            </p>

            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isResending ? "animate-spin" : ""}`} />
              {isResending ? "Sending…" : "Resend verification email"}
            </button>

            <div className="mt-6 pt-6 border-t border-border/30">
              <Link to="/login" className="text-sm text-primary hover:underline">
                ← Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-theme min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-secondary/20 via-background to-primary/20 items-center justify-center p-12">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="relative z-10 text-center">
          <div className="relative w-48 h-48 mx-auto mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/30 to-primary/30 rounded-full blur-3xl animate-pulse-slow" />
            <div className="relative z-10 w-full h-full flex items-center justify-center">
              <Shield className="w-24 h-24 text-primary animate-float" />
            </div>
          </div>
          <h2 className="text-3xl font-bold mb-4">
            Join <span className="text-primary">Digital Footprint Scanner</span>
          </h2>
          <p className="text-muted-foreground max-w-md">
            Start protecting your digital identity today.
          </p>
          <div className="mt-8 text-left max-w-sm mx-auto space-y-3">
            {["16+ security scans", "Real-time breach monitoring", "Ghost account discovery", "Personalized security recommendations"].map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                <span className="text-muted-foreground">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <Shield className="w-10 h-10 text-primary" />
            <span className="text-2xl font-bold">Digital Footprint<span className="text-primary"> Scanner</span></span>
          </div>

          <div className="glass-card p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold mb-2">Create Account</h1>
              <p className="text-muted-foreground">Start your digital security journey</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    className={`input-cyber w-full pl-12 ${errors.name ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    autoComplete="email"
                    className={`input-cyber w-full pl-12 ${errors.email ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    className={`input-cyber w-full pl-12 pr-12 ${errors.password ? "border-destructive" : ""}`}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Password strength</span>
                      <span className={passwordStrength >= 75 ? "text-success" : passwordStrength >= 50 ? "text-warning" : "text-destructive"}>{strengthLabel}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-300 ${strengthColor}`} style={{ width: `${passwordStrength}%` }} />
                    </div>
                    <div className="mt-2 space-y-1">
                      {passwordChecks.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {c.valid ? <Check className="w-3 h-3 text-success" /> : <X className="w-3 h-3 text-muted-foreground" />}
                          <span className={c.valid ? "text-success" : "text-muted-foreground"}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {errors.password && <p className="text-sm text-destructive mt-1">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    className={`input-cyber w-full pl-12 pr-12 ${errors.confirmPassword ? "border-destructive" : ""}`}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>}
              </div>

              {/* Terms */}
              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-border bg-muted accent-primary"
                  />
                  <span className="text-sm text-muted-foreground">
                    I agree to the{" "}
                    <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
                    {" "}and{" "}
                    <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                  </span>
                </label>
                {errors.terms && <p className="text-sm text-destructive mt-1">{errors.terms}</p>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" />Creating account…</>
                ) : (
                  <>Create Account<ArrowRight className="w-5 h-5" /></>
                )}
              </button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
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

export default Signup;

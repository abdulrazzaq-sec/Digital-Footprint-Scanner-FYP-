import { useState, type ReactNode } from "react";
import {
  Mail,
  Search,
  Download,
  AlertTriangle,
  Shield,
  Info,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Key,
  User,
  Phone,
  MapPin,
  Calendar,
  Globe,
  CreditCard,
  Hash,
  Eye,
  EyeOff,
  Zap,
} from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import BreachCard from "@/components/common/BreachCard";
import ProgressBar from "@/components/common/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";
import { downloadEmailScanPDF } from "@/lib/pdfExport";

const computeRiskScore = (fields: string[], breachCount: number): number => {
  if (breachCount === 0) return 0;
  const f = fields.map((x) => x.toLowerCase());
  let score = 20 + Math.min(breachCount * 5, 25);
  if (f.includes("password")) score += 30;
  else if (f.includes("password_hash") || f.includes("hash")) score += 18;
  if (f.includes("ssn") || f.includes("cc")) score += 20;
  if (f.includes("dob")) score += 8;
  if (f.includes("phone")) score += 6;
  if (f.includes("address")) score += 5;
  if (f.includes("name")) score += 4;
  if (f.includes("username")) score += 4;
  if (f.includes("ip")) score += 2;
  return Math.min(score, 95);
};

const getDynamicRisks = (fields: string[], score: number) => {
  const f = fields.map((x) => x.toLowerCase());
  const hasPassword = f.includes("password") || f.includes("hash");
  const hasPII = f.some((x) => ["dob", "ssn", "address", "name"].includes(x));
  const hasAccountData = f.some((x) => ["password", "username", "login"].includes(x));

  return [
    {
      label: "Password Exposure",
      value: hasPassword ? Math.min(score + 15, 100) : Math.min(score * 0.3, 40),
      level: hasPassword ? (f.includes("password") ? "high" : "medium") : "low",
    },
    {
      label: "Identity Theft Risk",
      value: hasPII ? Math.min(score + 8, 95) : Math.min(score * 0.4, 55),
      level: f.includes("ssn") || f.includes("dob") ? "high" : hasPII ? "medium" : "low",
    },
    {
      label: "Account Takeover Risk",
      value: hasAccountData ? Math.min(score + 5, 95) : Math.min(score * 0.45, 60),
      level: f.includes("password") ? "high" : hasAccountData ? "medium" : "low",
    },
  ];
};

const getRecommendations = (
  fields: string[],
  count: number
): Array<{ text: string; priority: "critical" | "high" | "medium" | "low" }> => {
  const f = fields.map((x) => x.toLowerCase());
  const recs: Array<{ text: string; priority: "critical" | "high" | "medium" | "low" }> = [];

  if (f.includes("password") || f.includes("hash")) {
    recs.push({
      text: "Change your password immediately on all affected accounts, especially anywhere you reused it",
      priority: "critical",
    });
  }
  if (f.includes("ssn") || f.includes("dob") || f.includes("cc")) {
    recs.push({
      text: "Place a credit freeze at Equifax, Experian, and TransUnion to prevent new accounts being opened in your name",
      priority: "critical",
    });
  }
  if (count > 0) {
    recs.push({
      text: "Enable two-factor authentication on all accounts linked to this email address",
      priority: "high",
    });
  }
  if (f.includes("phone")) {
    recs.push({
      text: "Contact your mobile carrier to add a PIN, your number may be targeted for SIM-swap attacks",
      priority: "high",
    });
  }
  recs.push({
    text: "Use a password manager to generate and store a unique password for every account",
    priority: "high",
  });
  recs.push({
    text: "Monitor your accounts for suspicious login attempts and enable login notifications where available",
    priority: "medium",
  });
  recs.push({
    text: "Use email aliases (e.g. SimpleLogin, Apple Hide My Email) for future sign-ups to limit exposure",
    priority: "low",
  });

  return recs.slice(0, 5);
};

const FIELD_META: Record<string, { icon: ReactNode; color: string }> = {
  password: { icon: <Key className="w-3 h-3" />, color: "bg-destructive/20 text-destructive border-destructive/30" },
  "password hash": { icon: <Hash className="w-3 h-3" />, color: "bg-destructive/10 text-destructive border-destructive/20" },
  "social security number": { icon: <CreditCard className="w-3 h-3" />, color: "bg-destructive/20 text-destructive border-destructive/30" },
  "credit card": { icon: <CreditCard className="w-3 h-3" />, color: "bg-destructive/20 text-destructive border-destructive/30" },
  "date of birth": { icon: <Calendar className="w-3 h-3" />, color: "bg-warning/20 text-warning border-warning/30" },
  "phone number": { icon: <Phone className="w-3 h-3" />, color: "bg-warning/20 text-warning border-warning/30" },
  "physical address": { icon: <MapPin className="w-3 h-3" />, color: "bg-warning/20 text-warning border-warning/30" },
  "full name": { icon: <User className="w-3 h-3" />, color: "bg-warning/15 text-warning border-warning/20" },
  username: { icon: <User className="w-3 h-3" />, color: "bg-secondary/15 text-secondary border-secondary/20" },
  "email address": { icon: <Mail className="w-3 h-3" />, color: "bg-secondary/10 text-secondary border-secondary/15" },
  "ip address": { icon: <Globe className="w-3 h-3" />, color: "bg-muted/50 text-muted-foreground border-border/30" },
};

const getRiskBarColor = (level: string): "destructive" | "warning" | "primary" => {
  if (level === "high") return "destructive";
  if (level === "medium") return "warning";
  return "primary";
};

const getYear = (date: string | null): number | null => {
  if (!date) return null;
  if (/^\d{4}$/.test(date)) return parseInt(date);
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d.getFullYear();
};

const SENSITIVE_FIELDS = new Set([
  "password", "password_hash", "hash", "pass", "passwd",
  "md5", "sha1", "sha256", "bcrypt", "line",
]);

const PaidLeakedRecords = ({ results }: { results: any[] }) => {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const toggleReveal = (key: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="glass-card p-4 sm:p-6 border border-primary/20">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-semibold">Leaked Records</h2>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary/15 text-primary border border-primary/30">
            Premium
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Actual data found in breach databases
        </p>
      </div>

      <div className="space-y-4">
        {results.map((record, idx) => {
          const src = record.source;
          const sourceName = src?.name || "Unknown";
          const breachDate = src?.breach_date || null;
          const fields = Object.entries(record).filter(([k]) => k !== "source");

          return (
            <div key={idx} className="rounded-lg bg-muted/20 border border-border/30 overflow-hidden">
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-muted/30 border-b border-border/30">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                <span className="font-medium text-sm">{sourceName}</span>
                {breachDate && (
                  <span className="text-xs text-muted-foreground">
                    {breachDate.substring(0, 10)}
                  </span>
                )}
                {src?.unverified ? (
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-warning/20 text-warning border border-warning/30">
                    Unverified
                  </span>
                ) : null}
              </div>
              <div className="divide-y divide-border/20">
                {fields.map(([key, value]) => {
                  const isSensitive = SENSITIVE_FIELDS.has(key.toLowerCase());
                  const revealKey = `${idx}-${key}`;
                  const isRevealed = revealed.has(revealKey);
                  const displayValue = String(value ?? "");

                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 text-sm"
                    >
                      <span className="w-20 sm:w-28 shrink-0 text-muted-foreground capitalize text-xs sm:text-sm">
                        {key.replace(/_/g, " ")}
                      </span>
                      <span
                        className={`flex-1 font-mono text-xs break-all ${
                          isSensitive && !isRevealed
                            ? "blur-sm select-none"
                            : "text-foreground"
                        }`}
                      >
                        {displayValue}
                      </span>
                      {isSensitive && (
                        <button
                          onClick={() => toggleReveal(revealKey)}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          title={isRevealed ? "Hide" : "Reveal"}
                        >
                          {isRevealed ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const EmailScan = () => {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [breaches, setBreaches] = useState<any[]>([]);
  const [riskScore, setRiskScore] = useState(0);
  const [exposedFields, setExposedFields] = useState<string[]>([]);
  const [displayFields, setDisplayFields] = useState<string[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [paidResults, setPaidResults] = useState<any[]>([]);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [hasLeaks, setHasLeaks] = useState(false);
  const [isAdvancedScanning, setIsAdvancedScanning] = useState(false);
  const [advancedError, setAdvancedError] = useState<string | null>(null);
  const { saveScanResult } = useAuth();

  const handleScan = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailError(null);
    setScanError(null);
    setAdvancedError(null);
    setIsScanning(true);
    setShowResults(false);
    setScanProgress(0);
    setHasLeaks(false);
    setIsPaid(false);
    setPaidResults([]);
    setQuotaRemaining(null);

    const statuses = [
      "Connecting to breach databases...",
      "Searching 12 billion records...",
      "Analyzing exposure patterns...",
      "Calculating risk score...",
      "Generating report...",
    ];

    try {
      for (let i = 0; i < statuses.length; i++) {
        setScanStatus(statuses[i]);
        setScanProgress((i + 1) * 20);
        await new Promise((r) => setTimeout(r, 400));
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/email-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mode: "basic" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Scan failed. Please try again.");
      }

      const rawFields = data.fields || [];
      const enrichedSources = data.sources || [];
      const dFields = data.displayFields || rawFields;

      const mappedBreaches = enrichedSources.map((source: any, index: number) => ({
        id: String(index + 1),
        name: source.name,
        domain: source.domain || null,
        date: source.date || null,
        severity: source.severity || "high",
        dataTypes: dFields,
        description:
          `Your data was found in the ${source.name} breach` +
          (source.date ? ` (${source.date.substring(0, 4)})` : "") +
          ". " +
          (dFields.length > 0
            ? `Exposed: ${dFields.join(", ")}.`
            : "The exact data types were not disclosed."),
        records: source.records ?? null,
      }));

      const score = computeRiskScore(rawFields, mappedBreaches.length);

      setBreaches(mappedBreaches);
      setRiskScore(score);
      setExposedFields(rawFields);
      setDisplayFields(dFields);
      setIsPaid(data.isPaid || false);
      setPaidResults(data.paidResults || []);
      setQuotaRemaining(data.quota ?? null);

      saveScanResult("email", {
        email,
        breachCount: data.found || mappedBreaches.length,
        riskScore: score,
        breaches: mappedBreaches,
      });

      setHasLeaks(mappedBreaches.length > 0);
      setShowResults(true);
    } catch (err: any) {
      setScanError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleAdvancedScan = async () => {
    setAdvancedError(null);
    setIsAdvancedScanning(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/email-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mode: "advanced" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Advanced scan failed.");
      setIsPaid(true);
      setPaidResults(data.paidResults || []);
      setQuotaRemaining(data.quota ?? null);
    } catch (err: any) {
      setAdvancedError(err.message || "Advanced scan failed. Please try again.");
    } finally {
      setIsAdvancedScanning(false);
    }
  };

  const dynamicRisks = getDynamicRisks(exposedFields, riskScore);
  const recommendations = getRecommendations(exposedFields, breaches.length);

  const breachYears = breaches
    .map((b) => getYear(b.date))
    .filter((y): y is number => y !== null)
    .sort((a, b) => a - b);
  const oldestYear = breachYears[0] ?? null;
  const newestYear = breachYears[breachYears.length - 1] ?? null;

  return (
    <div className="min-h-screen py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Left Panel - Input */}
          <div className="space-y-4 sm:space-y-6">
            <div className="glass-card p-4 sm:p-8">
              <div className="flex items-center gap-3 mb-5 sm:mb-6">
                <div className="p-2.5 sm:p-3 rounded-xl bg-primary/10 shrink-0">
                  <Mail className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold">Email Breach Intelligence</h1>
                  <p className="text-muted-foreground text-sm">
                    Check if your email appears in known data breaches
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError(null);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && !isScanning && handleScan()}
                      placeholder="Enter your email address"
                      className="input-cyber w-full pl-12"
                    />
                  </div>
                  {emailError && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {emailError}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleScan}
                    disabled={isScanning || isAdvancedScanning || !email}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5" />
                        Basic Scan
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleAdvancedScan}
                    disabled={!hasLeaks || isScanning || isAdvancedScanning || isPaid}
                    title={!hasLeaks ? "Run Basic Scan first, only unlocks if leaks are found" : isPaid ? "Advanced scan already complete" : "Fetch detailed leaked records"}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 border
                      disabled:opacity-40 disabled:cursor-not-allowed
                      enabled:bg-primary/10 enabled:border-primary/40 enabled:text-primary enabled:hover:bg-primary/20
                      disabled:bg-muted/20 disabled:border-border/30 disabled:text-muted-foreground"
                  >
                    {isAdvancedScanning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Advanced Scan
                      </>
                    )}
                  </button>
                </div>

                {isScanning && (
                  <div className="space-y-3 animate-fade-in">
                    <ProgressBar value={scanProgress} color="primary" size="md" />
                    <p className="text-sm text-center text-muted-foreground animate-pulse">
                      {scanStatus}
                    </p>
                  </div>
                )}

                {scanError && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{scanError}</p>
                  </div>
                )}

                {advancedError && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{advancedError}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 p-4 rounded-lg bg-secondary/10 border border-secondary/20">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-secondary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-secondary">How it works</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      We query your email against 12B+ breached records from threat intelligence
                      sources. Your email is never stored.
                    </p>
                  </div>
                </div>
              </div>

              <details className="mt-6 group">
                <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <span className="transition-transform group-open:rotate-90">▸</span>
                  Why this matters
                </summary>
                <div className="mt-4 pl-4 text-sm text-muted-foreground space-y-2">
                  <p>Data breaches expose your personal information to attackers who use it for:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Credential stuffing attacks on other accounts</li>
                    <li>Identity theft and financial fraud</li>
                    <li>Targeted phishing and social engineering</li>
                    <li>SIM-swapping and account takeovers</li>
                  </ul>
                </div>
              </details>
            </div>
          </div>

          {/* Right Panel - Results */}
          {!showResults && !isScanning && (
            <div className="flex items-center justify-center">
              <div className="text-center glass-card p-6 sm:p-12 w-full">
                <Shield className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Scan Results Yet</h3>
                <p className="text-muted-foreground">
                  Enter your email address and click "Scan Email" to check for data breaches.
                </p>
              </div>
            </div>
          )}

          {showResults && (
            <div className="space-y-4 sm:space-y-6 animate-fade-in">
              {/* Overall Status */}
              <div className="glass-card p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Scan Results</h2>
                    <p className="text-sm text-muted-foreground break-all">{email}</p>
                  </div>
                  <span className={breaches.length > 0 ? "badge-danger" : "badge-success"}>
                    {breaches.length > 0 ? (
                      <>
                        <ShieldAlert className="w-3 h-3 mr-1" />
                        {breaches.length} {breaches.length === 1 ? "Breach" : "Breaches"} Found
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        No Breaches Found
                      </>
                    )}
                  </span>
                </div>

                {/* Summary row */}
                {breaches.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5 p-2 sm:p-3 rounded-lg bg-muted/20 border border-border/20">
                    <div className="text-center">
                      <p className="text-xl sm:text-2xl font-bold text-destructive">{breaches.length}</p>
                      <p className="text-xs text-muted-foreground">Breaches</p>
                    </div>
                    <div className="text-center border-x border-border/20">
                      <p className="text-xl sm:text-2xl font-bold">{displayFields.length}</p>
                      <p className="text-xs text-muted-foreground">Data Types</p>
                    </div>
                    <div className="text-center">
                      {oldestYear && newestYear && oldestYear !== newestYear ? (
                        <>
                          <p className="text-lg sm:text-2xl font-bold leading-tight">{oldestYear}–{newestYear}</p>
                          <p className="text-xs text-muted-foreground">Years Exposed</p>
                        </>
                      ) : (
                        <>
                          <p className="text-xl sm:text-2xl font-bold">{newestYear ?? "–"}</p>
                          <p className="text-xs text-muted-foreground">Year</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
                  <RiskGauge score={riskScore} size="md" label="Risk Score" />

                  <div className="flex-1 w-full space-y-4">
                    {dynamicRisks.map((risk) => (
                      <div key={risk.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">{risk.label}</span>
                          <span
                            className={
                              risk.level === "high"
                                ? "text-destructive"
                                : risk.level === "medium"
                                ? "text-warning"
                                : "text-success"
                            }
                          >
                            {risk.level === "high" ? "High" : risk.level === "medium" ? "Medium" : "Low"}
                          </span>
                        </div>
                        <ProgressBar
                          value={risk.value}
                          color={getRiskBarColor(risk.level)}
                          showValue={false}
                          size="sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Exposed Data Types */}
              {displayFields.length > 0 && (
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-1">What Was Exposed</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    The following data types were found across your breach records
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {displayFields.map((field) => {
                      const key = field.toLowerCase();
                      const meta = FIELD_META[key];
                      const style = meta
                        ? meta.color
                        : "bg-muted/40 text-muted-foreground border-border/30";
                      return (
                        <span
                          key={field}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${style}`}
                        >
                          {meta?.icon}
                          {field}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No breach positive state */}
              {breaches.length === 0 && (
                <div className="glass-card p-6 border border-success/20">
                  <div className="flex items-center gap-3 mb-2">
                    <ShieldCheck className="w-8 h-8 text-success" />
                    <div>
                      <h3 className="font-semibold text-success">You're in the clear</h3>
                      <p className="text-sm text-muted-foreground">
                        No breaches found for this email in our database
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    This doesn't guarantee complete safety - new breaches are discovered regularly.
                    Continue practicing good security hygiene.
                  </p>
                </div>
              )}

              {/* Breach Timeline */}
              {breaches.length > 0 && (
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-4">Breach Timeline</h2>
                  <div className="space-y-4">
                    {breaches.map((breach) => (
                      <BreachCard key={breach.id} {...breach} />
                    ))}
                  </div>
                </div>
              )}

              {/* Paid Leaked Records */}
              {isPaid && paidResults.length > 0 && (
                <PaidLeakedRecords results={paidResults} />
              )}

              {/* Export Options */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => downloadEmailScanPDF(email, riskScore, breaches, exposedFields, recommendations)}
                  className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <Download className="w-4 h-4" />
                  Download PDF Report
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailScan;

import { useState } from "react";
import {
  Fingerprint,
  Mail,
  Phone,
  User,
  Calendar,
  CreditCard,
  MapPin,
  AtSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  ShieldAlert,
  TrendingUp,
  Eye,
  EyeOff,
  Loader2,
  Database,
  Lock,
  Info,
  ChevronDown,
  ChevronUp,
  Zap,
  Search,
} from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import ProgressBar from "@/components/common/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";


interface FieldResult {
  label: string;
  provided: string;
  exposed: boolean | null;
  severity: "critical" | "high" | "medium" | "low" | "safe" | "unknown";
  detail: string;
  riskPoints: number;
  sources: string[];
  exposedTypes: string[];
  breachCount?: number;
  age?: number | null;
}

interface CombinationRisk {
  fields: string[];
  risk: "critical" | "high" | "medium";
  threat: string;
  description: string;
  likelihood: number;
}

interface ScanResults {
  fields: Record<string, FieldResult>;
  piiScore: number;
  syntheticFraudRisk: number;
  combinationRisks: CombinationRisk[];
  brokerCount: number;
  exposedFieldCount: number;
  totalFields: number;
  breachData: { found: number; fields: string[] } | null;
}


const SEVERITY_CONFIG = {
  critical: { label: "Critical",  bg: "bg-destructive/10", border: "border-destructive/30", text: "text-destructive",  badge: "badge-danger" },
  high:     { label: "High Risk", bg: "bg-orange-500/10",  border: "border-orange-500/30",  text: "text-orange-500",  badge: "badge-danger" },
  medium:   { label: "Medium",    bg: "bg-warning/10",     border: "border-warning/30",      text: "text-warning",    badge: "badge-warning" },
  low:      { label: "Low",       bg: "bg-muted/30",       border: "border-border/30",       text: "text-muted-foreground", badge: "badge-success" },
  safe:     { label: "Not Found", bg: "bg-success/10",     border: "border-success/30",      text: "text-success",   badge: "badge-success" },
  unknown:  { label: "Unknown",   bg: "bg-muted/30",       border: "border-border/30",       text: "text-muted-foreground", badge: "badge-warning" },
};

const RISK_CONFIG = {
  critical: { bg: "bg-destructive/10", border: "border-destructive/30", icon: "text-destructive", badge: "badge-danger" },
  high:     { bg: "bg-orange-500/10",  border: "border-orange-500/30",  icon: "text-orange-500",  badge: "badge-danger" },
  medium:   { bg: "bg-warning/10",     border: "border-warning/30",      icon: "text-warning",    badge: "badge-warning" },
};

function riskLabel(score: number): { text: string; cls: string } {
  if (score >= 75) return { text: "Critical Exposure",  cls: "text-destructive" };
  if (score >= 50) return { text: "High Exposure",      cls: "text-orange-500" };
  if (score >= 25) return { text: "Moderate Exposure",  cls: "text-warning" };
  return { text: "Low Exposure", cls: "text-success" };
}

function fraudLabel(score: number): { text: string; cls: string } {
  if (score >= 75) return { text: "Critically Vulnerable", cls: "text-destructive" };
  if (score >= 50) return { text: "High Risk",             cls: "text-orange-500" };
  if (score >= 25) return { text: "Elevated Risk",         cls: "text-warning" };
  return { text: "Low Risk", cls: "text-success" };
}

const FIELD_ICONS: Record<string, React.ReactNode> = {
  email:       <Mail       className="w-5 h-5" />,
  phone:       <Phone      className="w-5 h-5" />,
  fullName:    <User       className="w-5 h-5" />,
  dateOfBirth: <Calendar   className="w-5 h-5" />,
  ssnLast4:    <CreditCard className="w-5 h-5" />,
  address:     <MapPin     className="w-5 h-5" />,
  username:    <AtSign     className="w-5 h-5" />,
};


const FraudMeter = ({ score }: { score: number }) => {
  const segments = [
    { label: "Low",      max: 25,  color: "bg-success" },
    { label: "Elevated", max: 50,  color: "bg-warning" },
    { label: "High",     max: 75,  color: "bg-orange-500" },
    { label: "Critical", max: 100, color: "bg-destructive" },
  ];
  const active = segments.find(s => score <= s.max) || segments[3];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Synthetic Identity Fraud Risk</span>
        <span className={`text-2xl font-bold ${fraudLabel(score).cls}`}>{score}%</span>
      </div>

      {/* Track */}
      <div className="relative h-4 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${active.color}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-muted-foreground">
        {segments.map(s => (
          <span key={s.label} className={score <= s.max && score > (s.max - 25) ? `font-semibold ${active.color.replace("bg-", "text-")}` : ""}>
            {s.label}
          </span>
        ))}
      </div>

      <p className={`text-sm font-semibold ${fraudLabel(score).cls}`}>{fraudLabel(score).text}</p>
    </div>
  );
};


const PIIScan = () => {
  const { saveScanResult } = useAuth();

  const [form, setForm] = useState({
    email: "", phone: "", fullName: "", dateOfBirth: "",
    ssnLast4: "", address: "", username: "",
  });
  const [showSSN, setShowSSN] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<ScanResults | null>(null);
  const [error, setError] = useState("");
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [showAllCombos, setShowAllCombos] = useState(false);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const hasAny = Object.values(form).some(v => v.trim().length > 0);

  const handleScan = async () => {
    setError("");
    setIsScanning(true);
    setResults(null);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/scan-pii`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      let data: any;
      try { data = await res.json(); }
      catch { throw new Error("Backend returned unexpected response. Make sure the server is running on port 5000."); }

      if (!res.ok) throw new Error(data.error || "Scan failed");

      setResults(data);
      saveScanResult("pii", {
        piiScore: data.piiScore,
        syntheticFraudRisk: data.syntheticFraudRisk,
        exposedFields: data.exposedFieldCount,
      });
    } catch (err: any) {
      setError(err.message || "Scan failed. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Left Panel ── */}
          <div className="space-y-6">
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Fingerprint className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">PII Exposure Score</h1>
                  <p className="text-muted-foreground text-sm">
                    Discover how much of your identity is exposed and at risk
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Email Address
                    <span className="ml-2 text-xs text-primary font-normal">Checks breach databases</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={update("email")}
                      placeholder="you@example.com"
                      className="input-cyber w-full pl-10"
                    />
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Full Legal Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={update("fullName")}
                      placeholder="First Last"
                      className="input-cyber w-full pl-10"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={update("phone")}
                      placeholder="+1 (555) 000-0000"
                      className="input-cyber w-full pl-10"
                    />
                  </div>
                </div>

                {/* DOB */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Date of Birth
                    <span className="ml-2 text-xs text-destructive font-normal">High identity theft risk</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={update("dateOfBirth")}
                      className="input-cyber w-full pl-10"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Residential Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={form.address}
                      onChange={update("address")}
                      placeholder="123 Main St, City, State"
                      className="input-cyber w-full pl-10"
                    />
                  </div>
                </div>

                {/* SSN Last 4 */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    SSN (Last 4 Digits)
                    <span className="ml-2 text-xs text-destructive font-normal">Highest-risk field</span>
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showSSN ? "text" : "password"}
                      value={form.ssnLast4}
                      onChange={update("ssnLast4")}
                      placeholder="XXXX"
                      maxLength={4}
                      className="input-cyber w-full pl-10 pr-10 font-mono tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSSN(!showSSN)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSSN ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Username / Online Handle</label>
                  <div className="relative">
                    <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={form.username}
                      onChange={update("username")}
                      placeholder="your_username"
                      className="input-cyber w-full pl-10"
                    />
                  </div>
                </div>

                {/* Privacy notice */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your data is used only for this analysis and is not stored. SSN digits are never logged or echoed back.
                    All fields are optional - provide only what you want assessed.
                  </p>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2 text-sm text-destructive">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  onClick={handleScan}
                  disabled={isScanning || !hasAny}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isScanning ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing exposure…</>
                  ) : (
                    <><Search className="w-5 h-5" /> Run PII Exposure Scan</>
                  )}
                </button>
              </div>
            </div>

            {/* What Is Synthetic Identity Fraud? */}
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-warning" />
                What Is Synthetic Identity Fraud?
              </h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Synthetic identity fraud is the <span className="text-foreground font-medium">fastest-growing financial crime</span> in the US.
                  Criminals combine real and fabricated PII to create new identities - not to impersonate you directly, but to
                  open entirely new accounts.
                </p>
                {[
                  { title: "Step 1 - Build the Profile", desc: "Attacker acquires your SSN, DOB, or name from a breach or data broker." },
                  { title: "Step 2 - Create the Identity", desc: "They pair it with a fake name and address to form a synthetic identity." },
                  { title: "Step 3 - Build Credit", desc: "The synthetic identity is used to open secured credit cards and build a credit history over 12–24 months." },
                  { title: "Step 4 - Bust Out", desc: "All credit lines are maxed out simultaneously, then the identity is abandoned, leaving you with collections on your credit report." },
                ].map((step, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/30">
                    <p className="font-medium text-foreground text-xs mb-1">{step.title}</p>
                    <p className="text-xs">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right Panel ── */}
          {!results && !isScanning ? (
            <div className="flex items-center justify-center">
              <div className="text-center glass-card p-12 w-full">
                <Fingerprint className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Enter Your PII to Analyze</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Fill in any combination of fields on the left. The more you provide, the more accurate your combined identity theft risk will be.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3 text-left max-w-sm mx-auto">
                  {[
                    { icon: <Mail className="w-4 h-4" />, text: "Breach database lookup" },
                    { icon: <Database className="w-4 h-4" />, text: "Data broker exposure" },
                    { icon: <ShieldAlert className="w-4 h-4" />, text: "Combination risk matrix" },
                    { icon: <TrendingUp className="w-4 h-4" />, text: "Fraud risk score" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                      <span className="text-primary">{item.icon}</span>
                      {item.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : isScanning ? (
            <div className="flex items-center justify-center">
              <div className="text-center glass-card p-12 w-full">
                <Fingerprint className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
                <h3 className="text-lg font-semibold mb-4">Analyzing your PII exposure…</h3>
                <div className="space-y-2 text-sm text-muted-foreground max-w-xs mx-auto">
                  {[
                    "Querying breach databases",
                    "Cross-referencing data broker profiles",
                    "Running combination risk analysis",
                    "Calculating synthetic fraud score",
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin flex-shrink-0" />
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : results && (
            <div className="space-y-6 animate-fade-in">

              {/* ── Dual Score Overview ── */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-6">Identity Exposure Overview</h2>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="text-center">
                    <RiskGauge score={results.piiScore} size="sm" label="PII Score" />
                    <p className={`text-xs font-semibold mt-2 ${riskLabel(results.piiScore).cls}`}>
                      {riskLabel(results.piiScore).text}
                    </p>
                  </div>
                  <div className="text-center">
                    <RiskGauge score={results.syntheticFraudRisk} size="sm" label="Fraud Risk" />
                    <p className={`text-xs font-semibold mt-2 ${fraudLabel(results.syntheticFraudRisk).cls}`}>
                      {fraudLabel(results.syntheticFraudRisk).text}
                    </p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Exposed Fields",
                      value: `${results.exposedFieldCount}/${results.totalFields}`,
                      warn: results.exposedFieldCount > 2,
                    },
                    {
                      label: "Risk Combos",
                      value: results.combinationRisks.length,
                      warn: results.combinationRisks.length > 0,
                    },
                    {
                      label: "Data Brokers",
                      value: `~${results.brokerCount}`,
                      warn: results.brokerCount > 50,
                    },
                  ].map((stat, i) => (
                    <div key={i} className={`p-3 rounded-lg text-center ${stat.warn ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
                      <p className={`text-xl font-bold ${stat.warn ? "text-destructive" : "text-foreground"}`}>{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Synthetic Fraud Risk Meter ── */}
              <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">Synthetic Identity Fraud Meter</h2>
                </div>
                <FraudMeter score={results.syntheticFraudRisk} />
                <p className="text-xs text-muted-foreground mt-3">
                  Measures how easily a criminal could use your exposed data to create a synthetic identity.
                  Scores above 50% indicate sufficient data for new account fraud.
                </p>
              </div>

              {/* ── Field-by-Field Breakdown ── */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  Field-by-Field Exposure
                </h2>
                <div className="space-y-3">
                  {Object.entries(results.fields).map(([key, field]) => {
                    const cfg = SEVERITY_CONFIG[field.severity] || SEVERITY_CONFIG.unknown;
                    const isExpanded = expandedField === key;
                    return (
                      <div key={key} className={`rounded-lg border ${cfg.bg} ${cfg.border}`}>
                        <button
                          className="w-full p-4 flex items-center gap-3 text-left"
                          onClick={() => setExpandedField(isExpanded ? null : key)}
                        >
                          <div className={`p-2 rounded-md bg-background/30 ${cfg.text}`}>
                            {FIELD_ICONS[key] || <Shield className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-medium text-sm">{field.label}</span>
                              <span className={cfg.badge}>{cfg.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              {field.provided}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {field.exposed === true && <XCircle className="w-5 h-5 text-destructive" />}
                            {field.exposed === false && <CheckCircle className="w-5 h-5 text-success" />}
                            {field.exposed === null && <AlertTriangle className="w-5 h-5 text-warning" />}
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-3 border-t border-border/20 pt-3">
                            <p className="text-sm text-muted-foreground">{field.detail}</p>
                            {field.riskPoints > 0 && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-muted-foreground">Contribution to PII score</span>
                                  <span className="text-xs font-medium">+{field.riskPoints} pts</span>
                                </div>
                                <ProgressBar value={Math.min((field.riskPoints / 35) * 100, 100)} />
                              </div>
                            )}
                            {field.sources.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1.5">
                                  {field.exposed ? "Known in:" : "Checked in:"}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {field.sources.map((s, i) => (
                                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Combination Risk Matrix ── */}
              {results.combinationRisks.length > 0 && (
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-destructive" />
                    Combination Risk Matrix
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Certain combinations of exposed data unlock specific attack vectors beyond individual field risk.
                  </p>
                  <div className="space-y-3">
                    {(showAllCombos ? results.combinationRisks : results.combinationRisks.slice(0, 3)).map((combo, i) => {
                      const cfg = RISK_CONFIG[combo.risk];
                      return (
                        <div key={i} className={`p-4 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div>
                              <p className="font-semibold text-sm">{combo.threat}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {combo.fields.map((f, j) => (
                                  <span key={j} className="text-xs px-1.5 py-0.5 rounded bg-background/30 font-medium">{f}</span>
                                ))}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span className={cfg.badge}>{combo.risk === "critical" ? "Critical" : combo.risk === "high" ? "High" : "Medium"}</span>
                              <span className="text-xs text-muted-foreground">{combo.likelihood}% likely</span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">{combo.description}</p>
                          <div className="mt-2">
                            <ProgressBar value={combo.likelihood} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {results.combinationRisks.length > 3 && (
                    <button
                      onClick={() => setShowAllCombos(!showAllCombos)}
                      className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {showAllCombos
                        ? <><ChevronUp className="w-4 h-4" /> Show less</>
                        : <><ChevronDown className="w-4 h-4" /> Show {results.combinationRisks.length - 3} more combination{results.combinationRisks.length - 3 !== 1 ? "s" : ""}</>}
                    </button>
                  )}
                </div>
              )}

              {/* ── Data Broker Exposure ── */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  Estimated Data Broker Exposure
                </h2>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1">
                    <ProgressBar value={Math.min((results.brokerCount / 200) * 100, 100)} />
                  </div>
                  <span className="text-2xl font-bold text-destructive flex-shrink-0">~{results.brokerCount}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Based on the fields you provided, your personal information is likely listed in approximately
                  <span className="text-foreground font-medium"> {results.brokerCount} data broker databases</span>.
                  These companies legally buy, compile, and sell personal profiles.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: "People Search Sites", risk: "high", examples: "WhitePages, Spokeo, FastPeopleSearch" },
                    { name: "Marketing Databases", risk: "medium", examples: "Acxiom, Experian Marketing, Oracle Data Cloud" },
                    { name: "Background Check Sites", risk: "high", examples: "BeenVerified, Intelius, Checkr" },
                    { name: "Public Records Aggregators", risk: "medium", examples: "CourtListener, PACER, county property sites" },
                  ].map((broker, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs font-medium mb-0.5">{broker.name}</p>
                      <p className="text-xs text-muted-foreground">{broker.examples}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Risk Score Breakdown ── */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  PII Score Breakdown
                </h2>
                <div className="space-y-4">
                  {Object.entries(results.fields).map(([key, field]) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <span className="text-muted-foreground">{FIELD_ICONS[key]}</span>
                          {field.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {field.exposed === false ? "Not exposed" : `+${field.riskPoints} pts`}
                        </span>
                      </div>
                      <ProgressBar value={field.exposed === false ? 3 : Math.min((field.riskPoints / 35) * 100, 100)} />
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Recommendations ── */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  Recommended Actions
                </h2>
                <div className="space-y-3">
                  {[
                    results.piiScore >= 50 && {
                      text: "Place a free credit freeze at all three bureaus (Experian, TransUnion, Equifax) to block new account openings in your name.",
                      priority: "high",
                    },
                    results.syntheticFraudRisk >= 50 && {
                      text: "Sign up for IRS Identity Protection PIN to prevent fraudulent tax returns filed with your SSN.",
                      priority: "high",
                    },
                    results.fields.email?.exposed && {
                      text: "Change passwords on all accounts linked to your breached email. Use a unique password per service with a password manager.",
                      priority: "high",
                    },
                    results.fields.dateOfBirth?.exposed && {
                      text: "Never answer security questions with your real date of birth - use a memorable false answer stored in your password manager.",
                      priority: "medium",
                    },
                    results.brokerCount > 50 && {
                      text: `Submit opt-out requests to data broker sites. Services like DeleteMe or Privacy Bee automate removal across ~${results.brokerCount} databases.`,
                      priority: "medium",
                    },
                    results.fields.phone?.exposed && {
                      text: "Contact your mobile carrier to add a SIM lock PIN to prevent unauthorized SIM swaps on your account.",
                      priority: "medium",
                    },
                    {
                      text: "Enable multi-factor authentication (MFA) on all email, banking, and social accounts - preferably with an authenticator app, not SMS.",
                      priority: "medium",
                    },
                    {
                      text: "Review your credit report quarterly for unfamiliar accounts at annualcreditreport.com - it is free and does not affect your score.",
                      priority: "low",
                    },
                    {
                      text: "Set up Google Alerts for your full name and email address to receive notifications when your data appears in new indexed pages.",
                      priority: "low",
                    },
                  ]
                    .filter(Boolean)
                    .map((rec: any, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 p-3 rounded-lg ${
                          rec.priority === "high"
                            ? "bg-destructive/10 border border-destructive/20"
                            : rec.priority === "medium"
                            ? "bg-warning/10 border border-warning/20"
                            : "bg-muted/30"
                        }`}
                      >
                        <AlertTriangle
                          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                            rec.priority === "high" ? "text-destructive" : rec.priority === "medium" ? "text-warning" : "text-muted-foreground"
                          }`}
                        />
                        <p className="text-sm flex-1">{rec.text}</p>
                        <span className={`text-xs flex-shrink-0 ${
                          rec.priority === "high" ? "badge-danger" : rec.priority === "medium" ? "badge-warning" : "badge-success"
                        }`}>
                          {rec.priority === "high" ? "Critical" : rec.priority === "medium" ? "Medium" : "Low"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PIIScan;

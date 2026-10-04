import { useState } from "react";
import {
  Search,
  User,
  Mail,
  Globe,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Database,
  MessageSquare,
  Clock,
  ShieldAlert,
  Shield,
  Eye,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  Zap,
  TriangleAlert,
  Newspaper,
  Lock,
  Code,
  Music,
  Image,
  DollarSign,
  PenLine,
  Monitor,
} from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import ProgressBar from "@/components/common/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";


interface PlatformResult {
  id: string;
  name: string;
  category: string;
  riskWeight: number;
  status: "found" | "not_found" | "unknown";
  url: string;
  confirmedBySerpAPI?: boolean;
}

interface WebMention {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

interface TimelinePhase {
  phase: string;
  action: string;
  icon: string;
  risk: "high" | "medium" | "low";
  findings: string;
  items: string[];
}

interface ScanResults {
  success: boolean;
  scanTarget: string;
  username: string | null;
  email: string | null;
  platforms: PlatformResult[];
  notFound: Array<{ id: string; name: string; category: string }>;
  unknownPlatforms: number;
  webMentions: WebMention[];
  piiMentions: WebMention[];
  pasteResults: Array<{ title: string; url: string; snippet: string }>;
  emailBreach: { found: number; fields: string[]; sources: string[] } | null;
  riskScore: number;
  attackerTimeline: TimelinePhase[];
  exposureCategories: Array<{ label: string; value: number }>;
  totalPlatformsChecked: number;
  serpAPIUsed: boolean;
}


const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string; badgeCls: string }> = {
  Developer: { icon: <Code className="w-3.5 h-3.5" />,   color: "text-primary",      badgeCls: "bg-primary/10 text-primary" },
  Forum:     { icon: <MessageSquare className="w-3.5 h-3.5" />, color: "text-orange-500", badgeCls: "bg-orange-500/10 text-orange-500" },
  Identity:  { icon: <Shield className="w-3.5 h-3.5" />,  color: "text-destructive",  badgeCls: "bg-destructive/10 text-destructive" },
  Finance:   { icon: <DollarSign className="w-3.5 h-3.5" />, color: "text-destructive", badgeCls: "bg-destructive/10 text-destructive" },
  Photos:    { icon: <Image className="w-3.5 h-3.5" />,   color: "text-pink-500",     badgeCls: "bg-pink-500/10 text-pink-500" },
  Video:     { icon: <Monitor className="w-3.5 h-3.5" />, color: "text-secondary",    badgeCls: "bg-secondary/10 text-secondary" },
  Music:     { icon: <Music className="w-3.5 h-3.5" />,   color: "text-secondary",    badgeCls: "bg-secondary/10 text-secondary" },
  Writing:   { icon: <PenLine className="w-3.5 h-3.5" />, color: "text-muted-foreground", badgeCls: "bg-muted/40 text-muted-foreground" },
  Tech:      { icon: <Zap className="w-3.5 h-3.5" />,     color: "text-muted-foreground", badgeCls: "bg-muted/40 text-muted-foreground" },
  Data:      { icon: <Database className="w-3.5 h-3.5" />, color: "text-destructive", badgeCls: "bg-destructive/10 text-destructive" },
};

const getCategoryMeta = (cat: string) => CATEGORY_META[cat] || CATEGORY_META.Tech;


function riskLabel(score: number) {
  if (score >= 75) return { text: "Critical: Highly Exposed",    cls: "text-destructive" };
  if (score >= 55) return { text: "High: Significant Footprint", cls: "text-orange-500" };
  if (score >= 30) return { text: "Moderate: Some Exposure",     cls: "text-warning" };
  return { text: "Low: Limited Footprint", cls: "text-success" };
}

const TIMELINE_ICON_CLS = "w-5 h-5 flex-shrink-0";
const TimelineIcon = ({ icon }: { icon: string }) => {
  switch (icon) {
    case "search":   return <Search      className={TIMELINE_ICON_CLS} />;
    case "users":    return <User        className={TIMELINE_ICON_CLS} />;
    case "message":  return <MessageSquare className={TIMELINE_ICON_CLS} />;
    case "database": return <Database    className={TIMELINE_ICON_CLS} />;
    case "warning":  return <TriangleAlert className={TIMELINE_ICON_CLS} />;
    default:         return <Eye         className={TIMELINE_ICON_CLS} />;
  }
};

const RISK_PHASE = {
  high:   { bg: "bg-destructive/10", border: "border-destructive/30", iconCls: "text-destructive", badge: "badge-danger" },
  medium: { bg: "bg-warning/10",     border: "border-warning/30",     iconCls: "text-warning",     badge: "badge-warning" },
  low:    { bg: "bg-muted/20",       border: "border-border/20",      iconCls: "text-muted-foreground", badge: "badge-success" },
};


const DoxxingScan = () => {
  const { saveScanResult } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<ScanResults | null>(null);
  const [error, setError] = useState("");
  const [expandedPhase, setExpandedPhase] = useState<number | null>(0);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [showNotFound, setShowNotFound] = useState(false);

  const canScan = username.trim().length > 0 || email.trim().includes("@");

  const handleScan = async () => {
    setError("");
    setIsScanning(true);
    setResults(null);
    setExpandedPhase(0);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/scan-doxxing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim() || undefined,
          email: email.trim() || undefined,
          fullName: fullName.trim() || undefined,
        }),
      });

      let data: any;
      try { data = await res.json(); }
      catch { throw new Error("Backend returned unexpected response. Make sure the server is running on port 5000."); }

      if (!res.ok) throw new Error(data.error || "Scan failed");

      setResults(data);
      saveScanResult("doxxing", {
        riskScore: data.riskScore,
        profilesFound: data.platforms.length,
        scanTarget: data.scanTarget,
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
                  <Eye className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Doxxing Vulnerability Scanner</h1>
                  <p className="text-muted-foreground text-sm">
                    See exactly what an attacker finds about you in 15 minutes
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Username / Handle
                    <span className="ml-2 text-xs text-primary">Checked across 18 platforms</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && canScan && !isScanning && handleScan()}
                      placeholder="your_username"
                      className="input-cyber w-full pl-10"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Email Address
                    <span className="ml-2 text-xs text-muted-foreground">Optional · adds breach check</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="input-cyber w-full pl-10"
                    />
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Full Name
                    <span className="ml-2 text-xs text-muted-foreground">Optional · adds web mention context</span>
                  </label>
                  <div className="relative">
                    <Newspaper className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="John Doe"
                      className="input-cyber w-full pl-10"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border/30 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This tool is for personal security awareness only. Use it to assess your own digital footprint and take protective action.
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
                  disabled={isScanning || !canScan}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isScanning ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Scanning across the web…</>
                  ) : (
                    <><Search className="w-5 h-5" /> Run Doxxing Vulnerability Scan</>
                  )}
                </button>

                {isScanning && (
                  <div className="p-4 rounded-lg bg-muted/20 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-3">Checking platforms in parallel…</p>
                    {["Scanning 18 social & data platforms", "Running web search queries", "Checking breach databases", "Building attacker timeline"].map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin text-primary flex-shrink-0" />
                        {step}
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-2">This may take 10–15 seconds.</p>
                  </div>
                )}
              </div>
            </div>

            {/* What is Doxxing? */}
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-warning" />
                What Is Doxxing?
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Doxxing is the act of researching and publicly exposing private information about a person using open-source intelligence (OSINT).
                It typically takes an experienced attacker <span className="text-foreground font-medium">under 15 minutes</span> to build a complete profile from public data alone.
              </p>
              <div className="space-y-2">
                {[
                  { label: "Phase 1", text: "Google searches reveal profiles, forum posts, and mentions" },
                  { label: "Phase 2", text: "Username enumeration confirms accounts across 18+ platforms" },
                  { label: "Phase 3", text: "Forum history mining reveals location, employer, and habits" },
                  { label: "Phase 4", text: "Breach databases expose credentials and personal data" },
                  { label: "Phase 5", text: "Data brokers sell physical address and phone for ~$2–5" },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/20">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded flex-shrink-0">{step.label}</span>
                    <p className="text-xs text-muted-foreground">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right Panel ── */}
          {!results && !isScanning ? (
            <div className="flex items-center justify-center">
              <div className="text-center glass-card p-12 w-full">
                <Eye className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Enter a Username or Email</h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-6">
                  We'll check 18 platforms in parallel, search the open web, and show exactly what an attacker finds in 15 minutes.
                </p>
                <div className="grid grid-cols-2 gap-2 text-left max-w-xs mx-auto">
                  {[
                    "18 platform checks",
                    "Web mention search",
                    "Pastebin/leak detection",
                    "Email breach lookup",
                    "PII exposure alerts",
                    "15-min attack timeline",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded bg-muted/20">
                      <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : results && (
            <div className="space-y-6 animate-fade-in">

              {/* ── Risk Score ── */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Doxxing Vulnerability Score</h2>
                    <p className={`text-sm font-medium mt-0.5 ${riskLabel(results.riskScore).cls}`}>
                      {riskLabel(results.riskScore).text}
                    </p>
                  </div>
                  <RiskGauge score={results.riskScore} size="sm" label="Risk" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Profiles Found",   value: results.platforms.length,   warn: results.platforms.length > 3 },
                    { label: "Web Mentions",      value: results.webMentions.length, warn: results.webMentions.length > 3 },
                    { label: "PII Exposed",       value: results.piiMentions.length, warn: results.piiMentions.length > 0 },
                    { label: "Paste/Leak Sites",  value: results.pasteResults.length, warn: results.pasteResults.length > 0 },
                  ].map((stat, i) => (
                    <div key={i} className={`p-3 rounded-lg text-center ${stat.warn && stat.value > 0 ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
                      <p className={`text-2xl font-bold ${stat.warn && stat.value > 0 ? "text-destructive" : "text-foreground"}`}>{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {!results.serpAPIUsed && (
                  <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
                    <Info className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Web search (SerpAPI) is not configured - platform checks are running but Google mentions and Pastebin searches are unavailable.
                      Add <span className="font-mono text-foreground">SERPAPI_KEY</span> to <span className="font-mono text-foreground">.env</span> for full results.
                    </p>
                  </div>
                )}
              </div>

              {/* ── 15-Minute Attacker Timeline ── */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  What an Attacker Finds in 15 Minutes
                </h2>
                <p className="text-xs text-muted-foreground mb-4">
                  The following is a realistic reconstruction of how a doxxer would research "{results.scanTarget}" using only free, public tools.
                </p>
                <div className="space-y-2">
                  {results.attackerTimeline.map((phase, i) => {
                    const cfg = RISK_PHASE[phase.risk];
                    const isOpen = expandedPhase === i;
                    return (
                      <div key={i} className={`rounded-lg border overflow-hidden ${cfg.bg} ${cfg.border}`}>
                        <button
                          className="w-full p-4 flex items-start gap-3 text-left"
                          onClick={() => setExpandedPhase(isOpen ? null : i)}
                        >
                          <div className={`mt-0.5 ${cfg.iconCls}`}>
                            <TimelineIcon icon={phase.icon} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{phase.phase}</span>
                              <span className="font-medium text-sm">{phase.action}</span>
                              <span className={cfg.badge}>
                                {phase.risk === "high" ? "High Risk" : phase.risk === "medium" ? "Medium" : "Low Risk"}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-snug">{phase.findings}</p>
                          </div>
                          {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
                        </button>
                        {isOpen && phase.items.length > 0 && (
                          <div className="px-4 pb-4 pt-1 border-t border-border/20 space-y-1.5">
                            {phase.items.map((item, j) => (
                              <div key={j} className="flex items-start gap-2 text-xs text-muted-foreground p-2 rounded bg-background/30">
                                <span className="text-primary mt-0.5">›</span>
                                <span className="font-mono leading-relaxed break-all">{item}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Found Profiles ── */}
              {results.platforms.length > 0 && (
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      Confirmed Profiles
                      <span className="text-sm font-normal text-muted-foreground">({results.platforms.length})</span>
                    </h2>
                    <span className="badge-danger">{results.platforms.length} found</span>
                  </div>
                  <div className="space-y-2">
                    {(showAllPlatforms ? results.platforms : results.platforms.slice(0, 6)).map((p, i) => {
                      const meta = getCategoryMeta(p.category);
                      const isHighRisk = ["Finance", "Identity", "Data"].includes(p.category);
                      return (
                        <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${isHighRisk ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
                          <div className={`p-1.5 rounded-md ${isHighRisk ? "bg-destructive/20" : "bg-muted/50"} ${meta.color}`}>
                            {meta.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{p.name}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${meta.badgeCls}`}>{p.category}</span>
                              {isHighRisk && <span className="badge-danger text-xs">High Risk</span>}
                            </div>
                          </div>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                  {results.platforms.length > 6 && (
                    <button
                      onClick={() => setShowAllPlatforms(!showAllPlatforms)}
                      className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {showAllPlatforms
                        ? <><ChevronUp className="w-4 h-4" /> Show less</>
                        : <><ChevronDown className="w-4 h-4" /> Show all {results.platforms.length} profiles</>}
                    </button>
                  )}

                  {/* Not found toggle */}
                  {results.notFound.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/20">
                      <button
                        onClick={() => setShowNotFound(!showNotFound)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {showNotFound ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {showNotFound ? "Hide" : "Show"} {results.notFound.length} platforms where username was not found
                      </button>
                      {showNotFound && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {results.notFound.map((p, i) => (
                            <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-success/10 text-success border border-success/20">
                              <CheckCircle className="w-3 h-3" />
                              {p.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {results.platforms.length === 0 && (
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Platform Check
                  </h2>
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                    <p className="text-sm">Username not found on any of the {results.totalPlatformsChecked} checked platforms.</p>
                  </div>
                </div>
              )}

              {/* ── Web Mentions ── */}
              {results.webMentions.length > 0 && (
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" />
                    Web Mentions
                    <span className="text-sm font-normal text-muted-foreground">({results.webMentions.length})</span>
                  </h2>
                  <div className="space-y-3">
                    {results.webMentions.slice(0, 5).map((mention, i) => {
                      const hasPII = results.piiMentions.some(p => p.url === mention.url);
                      return (
                        <div key={i} className={`p-3 rounded-lg ${hasPII ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-medium line-clamp-1">{mention.title}</p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {hasPII && <span className="badge-danger text-xs">PII</span>}
                              <a href={mention.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono mb-1">{mention.domain}</p>
                          {mention.snippet && <p className="text-xs text-muted-foreground line-clamp-2">{mention.snippet}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Pastebin / Leak Sites ── */}
              {results.pasteResults.length > 0 && (
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-destructive" />
                    Paste / Leak Site Results
                    <span className="badge-danger">{results.pasteResults.length} found</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Your username appears in public paste documents. These may include credential dumps, doxx files, or forum archives.
                  </p>
                  <div className="space-y-2">
                    {results.pasteResults.map((p, i) => (
                      <div key={i} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium">{p.title}</p>
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-destructive hover:underline flex-shrink-0">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        {p.snippet && <p className="text-xs text-muted-foreground line-clamp-2">{p.snippet}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Email Breach ── */}
              {results.emailBreach && (
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    Breach Database Result
                  </h2>
                  {results.emailBreach.found > 0 ? (
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Email Found in Breaches</span>
                          <span className="badge-danger">{results.emailBreach.found} breach{results.emailBreach.found > 1 ? "es" : ""}</span>
                        </div>
                        {results.emailBreach.fields.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {results.emailBreach.fields.map((f, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive border border-destructive/20">{f}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      {results.emailBreach.sources.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          From: {results.emailBreach.sources.join(", ")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-success/10 border border-success/20 flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                      <p className="text-sm">Email not found in known breach databases.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Exposure Category Breakdown ── */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-primary" />
                  Exposure Breakdown
                </h2>
                <div className="space-y-4">
                  {results.exposureCategories.map((cat, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium">{cat.label}</span>
                        <span className={`text-xs font-medium ${cat.value >= 70 ? "text-destructive" : cat.value >= 40 ? "text-warning" : "text-success"}`}>
                          {cat.value >= 70 ? "High" : cat.value >= 40 ? "Medium" : cat.value <= 5 ? "None" : "Low"}
                        </span>
                      </div>
                      <ProgressBar value={cat.value} />
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Protective Actions ── */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  Reduce Your Doxxing Risk
                </h2>
                <div className="space-y-3">
                  {[
                    results.platforms.some(p => p.category === "Finance") && {
                      text: "Your Venmo or Cash App profile is public and links your username to your real name. Set your profile to private immediately.",
                      priority: "high",
                    },
                    results.pasteResults.length > 0 && {
                      text: `Your username appears in ${results.pasteResults.length} Pastebin document(s). Review each link to check if personal data is exposed and contact Pastebin support to request removal.`,
                      priority: "high",
                    },
                    results.emailBreach && results.emailBreach.found > 0 && {
                      text: "Your email was found in breaches. Change passwords on all affected services and enable multi-factor authentication.",
                      priority: "high",
                    },
                    results.piiMentions.length > 0 && {
                      text: `${results.piiMentions.length} web result(s) contain personal details. Review and request removal under the platform's privacy policy or GDPR/CCPA rights.`,
                      priority: "high",
                    },
                    results.platforms.some(p => p.id === "gravatar") && {
                      text: "Your Gravatar profile is linked to your email address - it can reveal your real identity when used on any WordPress or comment system.",
                      priority: "medium",
                    },
                    results.platforms.length > 4 && {
                      text: `You use the same username across ${results.platforms.length} platforms. Consider using distinct handles per service to make cross-platform profiling harder.`,
                      priority: "medium",
                    },
                    results.platforms.some(p => p.id === "reddit") && {
                      text: "Reddit post history is fully public and time-stamped. Regularly review old posts for location mentions, employer references, or personal details.",
                      priority: "medium",
                    },
                    {
                      text: "Submit opt-out requests to data brokers (Spokeo, BeenVerified, WhitePages). Services like DeleteMe or Privacy Bee automate this across 50+ sites.",
                      priority: "medium",
                    },
                    {
                      text: "Set up Google Alerts for your username and email address to be notified when new results appear about you online.",
                      priority: "low",
                    },
                    {
                      text: "Review privacy settings on all social accounts. Restrict who can see your friends list, tagged photos, and check-ins.",
                      priority: "low",
                    },
                  ]
                    .filter(Boolean)
                    .slice(0, 8)
                    .map((rec: any, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/20"
                      >
                        <AlertTriangle
                          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                            rec.priority === "high" ? "text-amber-600" : rec.priority === "medium" ? "text-blue-500" : "text-muted-foreground"
                          }`}
                        />
                        <p className="text-sm flex-1">{rec.text}</p>
                        <span className={`text-xs flex-shrink-0 px-2 py-0.5 rounded-full font-medium border ${
                          rec.priority === "high" ? "bg-amber-50 text-amber-700 border-amber-200" : rec.priority === "medium" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          {rec.priority === "high" ? "High" : rec.priority === "medium" ? "Medium" : "Low"}
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

export default DoxxingScan;

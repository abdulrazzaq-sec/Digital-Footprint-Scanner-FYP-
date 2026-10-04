import { useState } from "react";
import {
  Crosshair,
  Search,
  Loader2,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Mail,
  MapPin,
  Building2,
  Briefcase,
  User,
  Link as LinkIcon,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  Eye,
  TriangleAlert,
  MessageSquare,
  Phone,
  Share2,
} from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import ProgressBar from "@/components/common/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";

interface SocialProfile {
  platform: string;
  url: string;
}

interface Findings {
  name: string;
  email: string | null;
  location: string | null;
  linkedinUrl: string | null;
  jobTitle: string | null;
  employer: string | null;
  socialProfiles: SocialProfile[];
  publicMentions: number;
  emailPubliclyFound: boolean;
}

interface Simulation {
  type: string;
  severity: "critical" | "high" | "medium";
  channel: string;
  subject: string;
  sender: string;
  body: string;
  whyEffective: string[];
}

// Attack vector likelihood based on what was found
const computeAttackVectors = (findings: Findings, score: number) => [
  {
    name: "Email Phishing",
    icon: <Mail className="w-4 h-4" />,
    description: "Targeted email impersonating a trusted sender",
    value: findings.email || findings.emailPubliclyFound ? Math.min(score + 10, 95) : Math.min(score * 0.7, 75),
    level: findings.employer || findings.emailPubliclyFound ? "high" : "medium",
  },
  {
    name: "Corporate Pretexting",
    icon: <Briefcase className="w-4 h-4" />,
    description: "Impersonating IT, HR, or management",
    value: findings.employer ? Math.min(score + 15, 95) : Math.min(score * 0.4, 45),
    level: findings.employer ? "high" : "low",
  },
  {
    name: "Social Media Manipulation",
    icon: <Share2 className="w-4 h-4" />,
    description: "Fake connections, messages or friend requests",
    value: findings.socialProfiles.length > 0 ? Math.min(score + 5, 90) : Math.min(score * 0.35, 40),
    level: findings.socialProfiles.length > 1 ? "high" : findings.socialProfiles.length === 1 ? "medium" : "low",
  },
  {
    name: "SMS Smishing",
    icon: <MessageSquare className="w-4 h-4" />,
    description: "Fake text messages with urgent links",
    value: Math.min(score * 0.6, 65),
    level: score > 60 ? "medium" : "low",
  },
  {
    name: "Voice Vishing",
    icon: <Phone className="w-4 h-4" />,
    description: "Phone impersonation using your personal details",
    value: findings.employer || findings.location ? Math.min(score * 0.8, 75) : Math.min(score * 0.4, 50),
    level: findings.employer ? "medium" : "low",
  },
];

const getRecommendations = (findings: Findings) => {
  const recs: Array<{ text: string; priority: "critical" | "high" | "medium" | "low" }> = [];

  if (findings.linkedinUrl) {
    recs.push({
      text: "Reduce LinkedIn visibility - hide your employer, location, and contact info from public view in Privacy Settings",
      priority: "high",
    });
  }
  if (findings.employer) {
    recs.push({
      text: "Be suspicious of any email claiming to be from your company's IT or HR - always verify via a separate channel before clicking",
      priority: "critical",
    });
  }
  if (findings.emailPubliclyFound || findings.email) {
    recs.push({
      text: "Use email aliases (SimpleLogin, Apple Hide My Email) for public profiles so your real address isn't scraped",
      priority: "high",
    });
  }
  if (findings.socialProfiles.length > 0) {
    recs.push({
      text: "Review privacy settings on all social media accounts - limit who can see your posts, employer, and location",
      priority: "high",
    });
  }
  recs.push({
    text: "Enable multi-factor authentication on all accounts - even if credentials are phished, MFA blocks access",
    priority: "high",
  });
  recs.push({
    text: "Never click links in unexpected emails - go directly to the official website by typing the URL",
    priority: "medium",
  });
  recs.push({
    text: "Train yourself to recognize urgency tactics - legitimate companies never demand action within hours via email",
    priority: "medium",
  });
  return recs.slice(0, 5);
};

const levelColor = (level: string) => {
  if (level === "high") return "text-destructive";
  if (level === "medium") return "text-warning";
  return "text-success";
};

const levelBarColor = (level: string): "destructive" | "warning" | "primary" => {
  if (level === "high") return "destructive";
  if (level === "medium") return "warning";
  return "primary";
};

const PhishingProfiler = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [location, setLocation] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [riskScore, setRiskScore] = useState(0);
  const [findings, setFindings] = useState<Findings | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [searchesPerformed, setSearchesPerformed] = useState(false);
  const { saveScanResult } = useAuth();

  const handleScan = async () => {
    if (!name.trim() || name.trim().split(/\s+/).length < 1 || name.trim().length < 2) {
      setNameError("Please enter at least a first name");
      return;
    }
    setNameError(null);
    setScanError(null);
    setIsScanning(true);
    setShowResults(false);
    setScanProgress(0);

    const statuses = [
      "Searching public databases...",
      "Scanning LinkedIn and social profiles...",
      "Analysing digital footprint...",
      "Mapping your attack surface...",
      "Generating phishing simulation...",
    ];

    try {
      for (let i = 0; i < statuses.length; i++) {
        setScanStatus(statuses[i]);
        setScanProgress((i + 1) * 20);
        await new Promise((r) => setTimeout(r, 480));
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/scan-phishing-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          linkedin: linkedinUrl.trim() || undefined,
          location: location.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");

      setFindings(data.findings);
      setRiskScore(data.riskScore);
      setSimulation(data.simulation);
      setSearchesPerformed(data.searchesPerformed);

      saveScanResult("phishing-profiler", {
        name: name.trim(),
        riskScore: data.riskScore,
        findings: data.findings,
      });

      setShowResults(true);
    } catch (err: any) {
      setScanError(err.message || "Scan failed. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const attackVectors = findings ? computeAttackVectors(findings, riskScore) : [];
  const recommendations = findings ? getRecommendations(findings) : [];

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── Left Panel ─────────────────────────────────────── */}
          <div className="space-y-6">
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-destructive/10">
                  <Crosshair className="w-8 h-8 text-destructive" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Phishing Vulnerability Profiler</h1>
                  <p className="text-muted-foreground">
                    See what a targeted spear-phishing attack on you would look like
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Full Name <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (nameError) setNameError(null);
                      }}
                      placeholder="e.g. Jennifer Adams"
                      className="input-cyber w-full pl-12"
                    />
                  </div>
                  {nameError && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {nameError}
                    </p>
                  )}
                </div>

                {/* Optional fields */}
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Optional · more details improve the simulation accuracy
                  </p>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address (optional)"
                      className="input-cyber w-full pl-12"
                    />
                  </div>
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="url"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="LinkedIn profile URL (optional)"
                      className="input-cyber w-full pl-12"
                    />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="City / Location (optional)"
                      className="input-cyber w-full pl-12"
                    />
                  </div>
                </div>

                <button
                  onClick={handleScan}
                  disabled={isScanning || !name.trim()}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Profiling...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Run Phishing Profile
                    </>
                  )}
                </button>

                {isScanning && (
                  <div className="space-y-3 animate-fade-in">
                    <ProgressBar value={scanProgress} color="destructive" size="md" />
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
              </div>

              {/* Info box */}
              <div className="mt-6 p-4 rounded-lg bg-secondary/10 border border-secondary/20">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-secondary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-secondary">How it works</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      We use OSINT techniques to find your publicly available information, then
                      construct a realistic spear-phishing attack to show exactly how
                      an attacker would target you, and what to do about it.
                    </p>
                  </div>
                </div>
              </div>

              <details className="mt-6 group">
                <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <span className="transition-transform group-open:rotate-90">▸</span>
                  Why spear-phishing is dangerous
                </summary>
                <div className="mt-4 pl-4 text-sm text-muted-foreground space-y-2">
                  <p>
                    Unlike generic phishing, spear-phishing uses your real name, employer, location,
                    and personal details - making it nearly indistinguishable from a real message.
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>1 in 3 AI-powered spear-phishing attacks succeed</li>
                    <li>Attacks are generated in seconds using public data</li>
                    <li>No technical skill required - tools are freely available</li>
                    <li>Targets executives, employees, and private individuals alike</li>
                  </ul>
                </div>
              </details>
            </div>
          </div>

          {/* ── Right Panel ────────────────────────────────────── */}
          {!showResults && !isScanning && (
            <div className="flex items-center justify-center">
              <div className="text-center glass-card p-12 w-full">
                <Crosshair className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Profile Scanned Yet</h3>
                <p className="text-muted-foreground">
                  Enter a name and optional details to generate a personalised phishing attack
                  simulation and see your vulnerability score.
                </p>
              </div>
            </div>
          )}

          {showResults && findings && simulation && (
            <div className="space-y-6 animate-fade-in">
              {/* ── Risk Overview ── */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Vulnerability Profile</h2>
                    <p className="text-sm text-muted-foreground">{findings.name}</p>
                  </div>
                  <span
                    className={
                      riskScore >= 70
                        ? "badge-danger"
                        : riskScore >= 40
                        ? "badge-warning"
                        : "badge-success"
                    }
                  >
                    {riskScore >= 70 ? (
                      <>
                        <ShieldAlert className="w-3 h-3 mr-1" />
                        High Risk
                      </>
                    ) : riskScore >= 40 ? (
                      <>
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Medium Risk
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Low Risk
                      </>
                    )}
                  </span>
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-3 mb-5 p-3 rounded-lg bg-muted/20 border border-border/20">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-destructive">
                      {[
                        findings.linkedinUrl,
                        findings.employer,
                        findings.jobTitle,
                        findings.location,
                        findings.emailPubliclyFound ? findings.email : null,
                      ].filter(Boolean).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Data Points</p>
                  </div>
                  <div className="text-center border-x border-border/20">
                    <p className="text-2xl font-bold">{findings.socialProfiles.length}</p>
                    <p className="text-xs text-muted-foreground">Social Profiles</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{findings.publicMentions}</p>
                    <p className="text-xs text-muted-foreground">Public Mentions</p>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <RiskGauge score={riskScore} size="md" label="Phishing Risk" />
                  <div className="flex-1 space-y-4">
                    {attackVectors.slice(0, 3).map((v) => (
                      <div key={v.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">{v.name}</span>
                          <span className={levelColor(v.level)}>
                            {v.level.charAt(0).toUpperCase() + v.level.slice(1)}
                          </span>
                        </div>
                        <ProgressBar
                          value={v.value}
                          color={levelBarColor(v.level)}
                          showValue={false}
                          size="sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {!searchesPerformed && (
                  <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5 border-t border-border/20 pt-3">
                    <Info className="w-3.5 h-3.5" />
                    Live OSINT search requires SerpAPI key. Score is based on provided details only.
                  </p>
                )}
              </div>

              {/* ── OSINT Findings ── */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-1">What Attackers Can Find</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Public information discovered about {findings.name}
                </p>
                <div className="space-y-2">
                  {[
                    {
                      label: "LinkedIn Profile",
                      icon: <LinkIcon className="w-4 h-4" />,
                      value: findings.linkedinUrl,
                      found: !!findings.linkedinUrl,
                      risk: "high" as const,
                    },
                    {
                      label: "Employer / Company",
                      icon: <Building2 className="w-4 h-4" />,
                      value: findings.employer,
                      found: !!findings.employer,
                      risk: "high" as const,
                    },
                    {
                      label: "Job Title",
                      icon: <Briefcase className="w-4 h-4" />,
                      value: findings.jobTitle,
                      found: !!findings.jobTitle,
                      risk: "high" as const,
                    },
                    {
                      label: "Location",
                      icon: <MapPin className="w-4 h-4" />,
                      value: findings.location,
                      found: !!findings.location,
                      risk: "medium" as const,
                    },
                    {
                      label: "Email Publicly Listed",
                      icon: <Mail className="w-4 h-4" />,
                      value: findings.emailPubliclyFound ? findings.email : null,
                      found: findings.emailPubliclyFound,
                      risk: "high" as const,
                    },
                    {
                      label: "Social Media Profiles",
                      icon: <Share2 className="w-4 h-4" />,
                      value:
                        findings.socialProfiles.length > 0
                          ? findings.socialProfiles.map((s) => s.platform).join(", ")
                          : null,
                      found: findings.socialProfiles.length > 0,
                      risk: "medium" as const,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        item.found
                          ? item.risk === "high"
                            ? "bg-destructive/5 border-destructive/20"
                            : "bg-warning/5 border-warning/20"
                          : "bg-muted/15 border-border/20"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={
                            item.found
                              ? item.risk === "high"
                                ? "text-destructive"
                                : "text-warning"
                              : "text-muted-foreground"
                          }
                        >
                          {item.icon}
                        </span>
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      {item.found ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                            {typeof item.value === "string" && item.value.startsWith("http")
                              ? new URL(item.value).pathname.slice(0, 20) + "…"
                              : item.value}
                          </span>
                          <span
                            className={
                              item.risk === "high" ? "badge-danger" : "badge-warning"
                            }
                          >
                            Found
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-success text-xs font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Not found
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Phishing Simulation ── */}
              <div className="glass-card p-6 border border-destructive/30">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Simulated Phishing Attack</h2>
                    <p className="text-sm text-muted-foreground">
                      {simulation.type} - via {simulation.channel}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="badge-danger text-xs font-bold tracking-wide">
                      ⚠ SIMULATION
                    </span>
                    <span
                      className={
                        simulation.severity === "critical"
                          ? "badge-danger"
                          : "badge-warning"
                      }
                    >
                      {simulation.severity.charAt(0).toUpperCase() + simulation.severity.slice(1)} Severity
                    </span>
                  </div>
                </div>

                {/* Email mock-up */}
                <div className="rounded-lg border border-border/40 bg-muted/10 overflow-hidden text-sm">
                  {/* Email header */}
                  <div className="border-b border-border/30 p-3 space-y-1.5 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-14 text-xs">From:</span>
                      <span className="text-destructive font-mono text-xs">{simulation.sender}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground w-14 text-xs">Subject:</span>
                      <span className="font-medium text-xs">{simulation.subject}</span>
                    </div>
                  </div>
                  {/* Email body */}
                  <pre className="p-4 font-mono text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">
                    {simulation.body}
                  </pre>
                </div>

                <div className="mt-3 p-3 rounded-lg bg-muted/20 border border-border/20 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    This is a simulated attack for educational purposes only. It is constructed from
                    publicly available information to demonstrate real-world risk.
                  </p>
                </div>
              </div>

              {/* ── Why It Works ── */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-1">Why This Attack Would Work</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Psychological and technical tactics used in the simulation above
                </p>
                <div className="space-y-2">
                  {simulation.whyEffective.map((reason, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/15"
                    >
                      <TriangleAlert className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      <p className="text-sm">{reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Attack Vector Analysis ── */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-1">Attack Vector Analysis</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Likelihood of each attack type targeting {findings.name.split(" ")[0]}
                </p>
                <div className="space-y-4">
                  {attackVectors.map((v) => (
                    <div key={v.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={levelColor(v.level)}>{v.icon}</span>
                          <span className="text-sm font-medium">{v.name}</span>
                        </div>
                        <span className={`text-xs font-medium ${levelColor(v.level)}`}>
                          {v.level.charAt(0).toUpperCase() + v.level.slice(1)}
                        </span>
                      </div>
                      <ProgressBar
                        value={v.value}
                        color={levelBarColor(v.level)}
                        showValue={false}
                        size="sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{v.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Recommendations ── */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-1">Reduce Your Attack Surface</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Actions to make a personalised phishing attack against you much harder
                </p>
                <div className="space-y-3">
                  {recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                    >
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${
                          rec.priority === "critical" || rec.priority === "high"
                            ? "bg-amber-500"
                            : rec.priority === "medium"
                            ? "bg-blue-400"
                            : "bg-slate-400"
                        }`}
                      />
                      <div className="flex-1">
                        <p className="text-sm">{rec.text}</p>
                        <span
                          className={`text-xs mt-1 inline-block font-medium ${
                            rec.priority === "critical" || rec.priority === "high"
                              ? "text-amber-700"
                              : rec.priority === "medium"
                              ? "text-blue-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)} Priority
                        </span>
                      </div>
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

export default PhishingProfiler;

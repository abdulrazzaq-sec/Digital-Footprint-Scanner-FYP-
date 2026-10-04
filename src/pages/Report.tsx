import { Link } from "react-router-dom";
import {
  Shield, Printer, Mail, CheckCircle, AlertTriangle, Clock, FileText,
  Lock, Fingerprint, Globe, Phone, Image, Key, UserSearch,
  EyeOff, Ghost, Wifi, FileSearch, Crosshair, Monitor,
} from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import ProgressBar from "@/components/common/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";

function dataToRisk(d: any): number | null {
  if (!d) return null;
  if (d.riskScore      !== undefined) return d.riskScore;
  if (d.strength       !== undefined) return 100 - d.strength;
  if (d.privacyScore   !== undefined) return 100 - d.privacyScore;
  if (d.trackabilityScore !== undefined) return d.trackabilityScore;
  if (d.forgottenScore !== undefined) return 100 - d.forgottenScore;
  if (d.score          !== undefined) return 100 - d.score;
  const lvl = (d.riskLevel || "").toLowerCase();
  if (lvl === "high" || lvl === "critical") return 75;
  if (lvl === "medium" || lvl === "moderate") return 45;
  if (lvl === "low")                          return 20;
  return null;
}

function dataToSecurityScore(d: any): number | null {
  const risk = dataToRisk(d);
  return risk !== null ? Math.max(0, 100 - risk) : null;
}

const Report = () => {
  const { scanResults } = useAuth();
  const sr = scanResults as any;

  const completedCount = Object.keys(scanResults).length;
  const hasEnoughScans = completedCount >= 3;

  const calculateOverallRisk = (): number => {
    const scores = Object.values(scanResults)
      .map((r: any) => dataToRisk(r?.data))
      .filter((s): s is number => s !== null);
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  const overallRisk = calculateOverallRisk();

  const scanCategories = [
    { name: "Email Security",       icon: Mail,          key: "email",             path: "/scan/email" },
    { name: "Password Strength",    icon: Key,           key: "password",          path: "/scan/password" },
    { name: "Username Exposure",    icon: UserSearch,    key: "username",          path: "/scan/username" },
    { name: "Phone Security",       icon: Phone,         key: "phone",             path: "/scan/phone" },
    { name: "Image Privacy",        icon: Image,         key: "image",             path: "/scan/image" },
    { name: "Document Security",    icon: FileText,      key: "document",          path: "/scan/document" },
    { name: "IP Privacy",           icon: Globe,         key: "ip",                path: "/scan/ip" },
    { name: "Device Fingerprint",   icon: Monitor,       key: "fingerprint",       path: "/scan/fingerprint" },
    { name: "Phishing Awareness",   icon: AlertTriangle, key: "phishing",          path: "/scan/phishing" },
    { name: "Phishing Profile",     icon: Crosshair,     key: "phishing-profiler", path: "/scan/phishing-profiler" },
    { name: "Doxxing Risk",         icon: EyeOff,        key: "doxxing",           path: "/scan/doxxing" },
    { name: "Ghost Accounts",       icon: Ghost,         key: "ghost",             path: "/scan/ghost" },
    { name: "Network Exposure",     icon: Wifi,          key: "network",           path: "/scan/network" },
    { name: "Session Security",     icon: Lock,          key: "session",           path: "/scan/session" },
    { name: "Image Metadata",       icon: FileSearch,    key: "metadata",          path: "/scan/metadata" },
  ];

  const getSecurityScore = (key: string): number | null => {
    const result = sr[key];
    if (!result) return null;
    return dataToSecurityScore(result.data);
  };

  const generateActions = () => {
    const actions: { text: string; priority: "critical" | "high" | "medium"; time: string }[] = [];

    if (sr.email?.data?.breachCount > 0)
      actions.push({ text: `Change passwords for your ${sr.email.data.breachCount} breached account${sr.email.data.breachCount > 1 ? "s" : ""}`, priority: "critical", time: "15 min" });

    if (sr.password?.data?.leaked)
      actions.push({ text: "Your password was found in a data breach - change it immediately", priority: "critical", time: "5 min" });

    if (sr.image?.data?.adultSites > 0)
      actions.push({ text: `Your image appears on ${sr.image.data.adultSites} adult site${sr.image.data.adultSites > 1 ? "s" : ""} - request removal`, priority: "critical", time: "30 min" });

    if (sr.doxxing?.data?.riskScore > 60)
      actions.push({ text: `Personal information exposed on ${sr.doxxing.data.profilesFound ?? "multiple"} sites - request opt-out`, priority: "critical", time: "1 hr" });

    if (sr.metadata?.data?.hasGPS)
      actions.push({ text: "GPS coordinates embedded in your photos - strip EXIF before sharing", priority: "high", time: "10 min" });

    if (sr.phone?.data?.riskScore > 50)
      actions.push({ text: "Phone number has high spam/scam risk - remove from public directories", priority: "high", time: "20 min" });

    if (sr.ip?.data?.privacyScore < 50)
      actions.push({ text: "IP address reveals your location - use a VPN for better privacy", priority: "high", time: "15 min" });

    if (sr.fingerprint?.data?.trackabilityScore > 80)
      actions.push({ text: "Device is highly trackable - use a privacy-focused browser or VPN", priority: "medium", time: "15 min" });

    if (sr.session?.data?.storageTokens > 10)
      actions.push({ text: "Many tokens found in browser storage - clear cookies and sessions regularly", priority: "medium", time: "5 min" });

    if (sr.network?.data?.riskScore > 50)
      actions.push({ text: "Network exposes sensitive data - avoid public WiFi without a VPN", priority: "medium", time: "10 min" });

    if (sr.ghost?.data?.accountsFound > 3)
      actions.push({ text: `${sr.ghost.data.accountsFound} forgotten accounts found - deactivate unused ones`, priority: "medium", time: "30 min" });

    if (!actions.find(a => a.priority === "critical"))
      actions.push({ text: "Enable two-factor authentication on email and financial accounts", priority: "high", time: "10 min" });

    if (actions.length < 4)
      actions.push({ text: "Use a password manager to generate unique passwords per site", priority: "medium", time: "20 min" });

    return actions.slice(0, 8);
  };

  const priorityActions = generateActions();

  const formatTimestamp = (ts: string) => {
    try { return new Date(ts).toLocaleString(); }
    catch { return ts; }
  };

  if (!hasEnoughScans) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="glass-card p-12 text-center animate-fade-in">
            <Shield className="w-20 h-20 text-muted-foreground/30 mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-4">Not Enough Data for Report</h1>
            <p className="text-muted-foreground mb-8">
              Complete at least 3 security scans to generate your comprehensive security report.
              You've completed {completedCount} scan{completedCount !== 1 ? "s" : ""} so far.
            </p>
            <div className="mb-8">
              <div className="flex justify-between text-sm mb-2">
                <span>Progress</span>
                <span>{completedCount}/3 scans</span>
              </div>
              <ProgressBar value={(completedCount / 3) * 100} color="primary" size="md" />
            </div>
            <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const scoreColor = (s: number) =>
    s >= 70 ? "text-success" : s >= 40 ? "text-warning" : "text-destructive";

  const scoreBarColor = (s: number): "success" | "warning" | "danger" =>
    s >= 70 ? "success" : s >= 40 ? "warning" : "danger";

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-2">Comprehensive Security Report</h1>
            <p className="text-muted-foreground text-sm">
              Generated: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()} · {completedCount} of {scanCategories.length} scans completed
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="btn-primary flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">

            {/* Executive Summary */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4">Executive Summary</h2>
              <div className="flex items-start gap-6">
                <RiskGauge score={overallRisk} size="lg" />
                <div className="flex-1">
                  <p className="text-muted-foreground mb-4">
                    Based on {completedCount} completed scan{completedCount !== 1 ? "s" : ""}, your digital security posture shows{" "}
                    <span className={`font-semibold ${overallRisk <= 30 ? "text-success" : overallRisk <= 60 ? "text-warning" : "text-destructive"}`}>
                      {overallRisk <= 30 ? "low" : overallRisk <= 60 ? "moderate" : "high"} risk
                    </span>.{" "}
                    {overallRisk > 60
                      ? "Immediate action is recommended - review the priority actions below."
                      : overallRisk > 30
                      ? "Some areas need attention - follow the recommended actions to improve."
                      : "Your digital footprint looks well-managed. Keep it up!"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge-info">{completedCount}/{scanCategories.length} Scans Completed</span>
                    <span className={`badge-${overallRisk > 60 ? "danger" : overallRisk > 30 ? "warning" : "success"}`}>
                      {overallRisk > 60 ? "High Risk" : overallRisk > 30 ? "Medium Risk" : "Low Risk"}
                    </span>
                    {priorityActions.filter(a => a.priority === "critical").length > 0 && (
                      <span className="badge-danger">
                        {priorityActions.filter(a => a.priority === "critical").length} Critical Issues
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Key Findings */}
            {(sr.email?.data?.breachCount > 0 || sr.password?.data?.leaked || sr.image?.data?.adultSites > 0 || sr.doxxing?.data?.riskScore > 60 || sr.metadata?.data?.hasGPS) && (
              <div className="glass-card p-6 border border-destructive/20">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Critical Findings
                </h2>
                <div className="space-y-3">
                  {sr.email?.data?.breachCount > 0 && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10">
                      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Email found in {sr.email.data.breachCount} data breach{sr.email.data.breachCount > 1 ? "es" : ""}</p>
                        <p className="text-xs text-muted-foreground">Your email address was exposed. Change passwords for all affected accounts.</p>
                      </div>
                    </div>
                  )}
                  {sr.password?.data?.leaked && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10">
                      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Password found in data breach database</p>
                        <p className="text-xs text-muted-foreground">This password has been leaked. Stop using it immediately.</p>
                      </div>
                    </div>
                  )}
                  {sr.image?.data?.adultSites > 0 && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10">
                      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Image found on {sr.image.data.adultSites} adult site{sr.image.data.adultSites > 1 ? "s" : ""}</p>
                        <p className="text-xs text-muted-foreground">Your image may have been shared without consent.</p>
                      </div>
                    </div>
                  )}
                  {sr.metadata?.data?.hasGPS && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10">
                      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-destructive">GPS location embedded in image metadata</p>
                        <p className="text-xs text-muted-foreground">Your precise location is encoded in this image file.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Category Scores */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-6">Security Scores by Category</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {scanCategories.map((category) => {
                  const score = getSecurityScore(category.key);
                  const isCompleted = score !== null;
                  const result = sr[category.key];

                  return (
                    <Link
                      key={category.key}
                      to={category.path}
                      className={`flex items-center gap-4 p-4 rounded-lg transition-colors group ${
                        isCompleted ? "bg-muted/30 hover:bg-muted/50" : "bg-muted/10 hover:bg-muted/20"
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${
                        !isCompleted ? "bg-muted/30" :
                        score >= 70 ? "bg-success/10" : score >= 40 ? "bg-warning/10" : "bg-destructive/10"
                      }`}>
                        <category.icon className={`w-5 h-5 ${
                          !isCompleted ? "text-muted-foreground" :
                          score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-destructive"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm truncate">{category.name}</span>
                          {isCompleted ? (
                            <span className={`text-sm font-bold shrink-0 ml-2 ${scoreColor(score)}`}>{score}%</span>
                          ) : (
                            <span className="text-xs text-muted-foreground shrink-0 ml-2">Not scanned</span>
                          )}
                        </div>
                        {isCompleted ? (
                          <>
                            <ProgressBar value={score} color={scoreBarColor(score)} showValue={false} size="sm" />
                            {result?.timestamp && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Last scanned: {formatTimestamp(result.timestamp)}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">Click to run this scan</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Scan Details */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4">Scan Details</h2>
              <div className="space-y-3">
                {[
                  sr.email && { label: "Email", detail: `${sr.email.data?.email || ""}${sr.email.data?.breachCount ? ` · ${sr.email.data.breachCount} breaches` : " · No breaches found"}` },
                  sr.password && { label: "Password", detail: `Strength ${sr.password.data?.strength ?? 0}% (Grade ${sr.password.data?.grade || "N/A"})${sr.password.data?.leaked ? " · LEAKED" : ""}` },
                  sr.username && { label: "Username", detail: `Found on ${sr.username.data?.platformsFound ?? 0} of ${sr.username.data?.totalPlatforms ?? 0} platforms` },
                  sr.phone && { label: "Phone", detail: `${sr.phone.data?.phone || ""} · ${sr.phone.data?.spamReports ?? 0} spam reports` },
                  sr.image && { label: "Image Search", detail: `${sr.image.data?.matchesFound ?? 0} matches, ${sr.image.data?.adultSites ?? 0} adult sites` },
                  sr.ip && { label: "IP Privacy", detail: `${sr.ip.data?.ip || ""} · ${sr.ip.data?.location || ""} · Privacy ${sr.ip.data?.privacyScore ?? 0}%` },
                  sr.fingerprint && { label: "Device Fingerprint", detail: `${sr.fingerprint.data?.uniqueness ?? 0}% unique · Trackability ${sr.fingerprint.data?.trackabilityScore ?? 0}%` },
                  sr.network && { label: "Network", detail: `Risk ${sr.network.data?.riskScore ?? 0}% · ${sr.network.data?.riskLevel || ""}` },
                  sr.doxxing && { label: "Doxxing", detail: `${sr.doxxing.data?.profilesFound ?? 0} profiles found for "${sr.doxxing.data?.scanTarget || ""}"` },
                  sr.ghost && { label: "Ghost Accounts", detail: `${sr.ghost.data?.accountsFound ?? 0} forgotten accounts for "${sr.ghost.data?.scanUsername || ""}"` },
                  sr.session && { label: "Session", detail: `${sr.session.data?.cookieCount ?? 0} cookies · ${sr.session.data?.storageTokens ?? 0} tokens · HTTPS: ${sr.session.data?.isHTTPS ? "Yes" : "No"}` },
                  sr.metadata && { label: "Image Metadata", detail: `${sr.metadata.data?.filename || "File"} · ${sr.metadata.data?.totalFields ?? 0} fields · GPS: ${sr.metadata.data?.hasGPS ? "Present" : "None"}` },
                  sr.document && { label: "Document", detail: `${sr.document.data?.risksFound ?? 0} risks · Risk Level: ${sr.document.data?.riskLevel || "N/A"}` },
                  sr.phishing && { label: "Phishing Test", detail: `Score ${sr.phishing.data?.score ?? 0}% · ${sr.phishing.data?.correctAnswers ?? 0}/${sr.phishing.data?.totalQuestions ?? 0} correct` },
                  sr["phishing-profiler"] && { label: "Phishing Profile", detail: `Risk ${sr["phishing-profiler"].data?.riskScore ?? 0}%` },
                ].filter(Boolean).map((item: any, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                    <CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    <div>
                      <span className="text-sm font-medium">{item.label}: </span>
                      <span className="text-sm text-muted-foreground">{item.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Priority Actions */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                Priority Actions
              </h2>
              <div className="space-y-3">
                {priorityActions.map((action, index) => (
                  <div key={index} className="p-3 rounded-lg bg-muted/30">
                    <p className="text-sm mb-2">{action.text}</p>
                    <div className="flex items-center gap-2">
                      <span className={`badge-${action.priority === "critical" ? "danger" : action.priority === "high" ? "warning" : "info"}`}>
                        {action.priority}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {action.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Stats</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Scans Completed</span>
                  <span className="font-bold">{completedCount}/{scanCategories.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Overall Risk</span>
                  <span className={`font-bold ${overallRisk > 60 ? "text-destructive" : overallRisk > 30 ? "text-warning" : "text-success"}`}>
                    {overallRisk}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Critical Issues</span>
                  <span className={`font-bold ${priorityActions.filter(a => a.priority === "critical").length > 0 ? "text-destructive" : "text-success"}`}>
                    {priorityActions.filter(a => a.priority === "critical").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email Breaches</span>
                  <span className={`font-bold ${(sr.email?.data?.breachCount ?? 0) > 0 ? "text-destructive" : "text-success"}`}>
                    {sr.email?.data?.breachCount ?? "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Image Matches</span>
                  <span className="font-bold">{sr.image?.data?.matchesFound ?? "-"}</span>
                </div>
              </div>
            </div>

            {/* Scans Still Needed */}
            {completedCount < scanCategories.length && (
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-3">Scans Not Yet Run</h2>
                <div className="space-y-2">
                  {scanCategories
                    .filter(c => !sr[c.key])
                    .slice(0, 6)
                    .map(c => (
                      <Link
                        key={c.key}
                        to={c.path}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <c.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-muted-foreground">{c.name}</span>
                        <span className="ml-auto text-xs text-primary">→</span>
                      </Link>
                    ))}
                  {scanCategories.filter(c => !sr[c.key]).length > 6 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{scanCategories.filter(c => !sr[c.key]).length - 6} more on the dashboard
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Security Tip */}
            <div className="glass-card p-6 bg-gradient-to-br from-primary/10 to-secondary/10">
              <Lock className="w-8 h-8 text-primary mb-4" />
              <h3 className="font-semibold mb-2">Security Tip</h3>
              <p className="text-sm text-muted-foreground">
                {overallRisk > 60
                  ? "Your risk score is high. Start with the critical actions above - changing breached passwords and enabling 2FA will have the biggest immediate impact."
                  : overallRisk > 30
                  ? "Use a password manager to generate and store unique passwords for each account. Even a few strong, unique passwords dramatically reduce your risk."
                  : "Great security posture! Keep scanning regularly and stay aware of new data breaches by checking your email scan monthly."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Report;

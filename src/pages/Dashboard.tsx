import { Link } from "react-router-dom";
import {
  Mail, Key, UserSearch, Phone, Image, FileText, Globe, Monitor,
  AlertTriangle, Shield, BarChart3, Bell, Clock, Settings, Download, Scan,
  EyeOff, Ghost, Wifi, Fingerprint, Lock, FileSearch, Crosshair, CreditCard,
} from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import ScanCard from "@/components/common/ScanCard";
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
  if (lvl === "high"   || lvl === "critical") return 75;
  if (lvl === "medium" || lvl === "moderate") return 45;
  if (lvl === "low")                          return 20;
  return null;
}

const Dashboard = () => {
  const { user, scanResults } = useAuth();

  const completedScans = Object.keys(scanResults).length;
  const hasScans = completedScans > 0;

  const calculateOverallRisk = () => {
    const scores = Object.values(scanResults)
      .map((r: any) => dataToRisk(r?.data))
      .filter((s): s is number => s !== null);
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  const overallRisk = calculateOverallRisk();

  const breachCount = scanResults.email?.data?.breachCount ?? null;

  const getTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1)  return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)   return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const sr = scanResults as any;

  const scanCards = [
    {
      title: "Email Breach Intelligence",
      description: "Check if your email appears in known data breaches",
      icon: Mail,
      path: "/scan/email",
      status: sr.email
        ? sr.email.data?.breachCount > 0 ? ("issues_found" as const) : ("scanned" as const)
        : ("not_scanned" as const),
      lastScanned: sr.email?.timestamp,
      quickStats: sr.email ? `${sr.email.data?.breachCount ?? 0} breach${sr.email.data?.breachCount !== 1 ? "es" : ""} found` : undefined,
      riskScore: sr.email?.data?.riskScore,
    },
    {
      title: "Password Security",
      description: "Test password strength and check for leaks",
      icon: Key,
      path: "/scan/password",
      status: sr.password
        ? sr.password.data?.leaked ? ("issues_found" as const) : ("scanned" as const)
        : ("not_scanned" as const),
      lastScanned: sr.password?.timestamp,
      quickStats: sr.password ? `Strength: ${sr.password.data?.strength ?? 0}%` : undefined,
    },
    {
      title: "Username Footprint",
      description: "Discover where your username appears online",
      icon: UserSearch,
      path: "/scan/username",
      status: sr.username
        ? sr.username.data?.platformsFound > 5 ? ("issues_found" as const) : ("scanned" as const)
        : ("not_scanned" as const),
      lastScanned: sr.username?.timestamp,
      quickStats: sr.username ? `${sr.username.data?.platformsFound ?? 0} platforms found` : undefined,
    },
    {
      title: "Phone Number Risk",
      description: "Assess risks associated with your phone number",
      icon: Phone,
      path: "/scan/phone",
      status: sr.phone
        ? sr.phone.data?.riskScore > 50 ? ("issues_found" as const) : ("scanned" as const)
        : ("not_scanned" as const),
      lastScanned: sr.phone?.timestamp,
      quickStats: sr.phone ? `${sr.phone.data?.spamReports ?? 0} spam reports` : undefined,
      riskScore: sr.phone?.data?.riskScore,
    },
    {
      title: "Profile Image Search",
      description: "Find where your profile picture appears online",
      icon: Image,
      path: "/scan/image",
      status: sr.image
        ? sr.image.data?.adultSites > 0 ? ("issues_found" as const) : ("scanned" as const)
        : ("not_scanned" as const),
      lastScanned: sr.image?.timestamp,
      quickStats: sr.image ? `${sr.image.data?.matchesFound ?? 0} matches found` : undefined,
      riskScore: sr.image?.data?.riskScore,
    },
    {
      title: "IP Privacy Scanner",
      description: "See what your IP address reveals about you",
      icon: Globe,
      path: "/scan/ip",
      status: sr.ip
        ? sr.ip.data?.privacyScore < 50 ? ("issues_found" as const) : ("scanned" as const)
        : ("not_scanned" as const),
      lastScanned: sr.ip?.timestamp,
      quickStats: sr.ip ? `Privacy: ${sr.ip.data?.privacyScore ?? 0}%` : undefined,
    },
    {
      title: "Device Fingerprint",
      description: "See how unique and trackable your device is",
      icon: Monitor,
      path: "/scan/fingerprint",
      status: sr.fingerprint
        ? sr.fingerprint.data?.trackabilityScore > 80 ? ("issues_found" as const) : ("scanned" as const)
        : ("not_scanned" as const),
      lastScanned: sr.fingerprint?.timestamp,
      quickStats: sr.fingerprint ? `${sr.fingerprint.data?.uniqueness ?? 0}% unique` : undefined,
    },
    {
      title: "Phishing Risk Test",
      description: "Test your ability to spot phishing attempts",
      icon: AlertTriangle,
      path: "/scan/phishing",
      status: sr.phishing
        ? sr.phishing.data?.score < 60 ? ("issues_found" as const) : ("scanned" as const)
        : ("not_scanned" as const),
      lastScanned: sr.phishing?.timestamp,
      quickStats: sr.phishing ? `Score: ${sr.phishing.data?.score ?? 0}%` : undefined,
    },
    {
      title: "Phishing Profiler",
      description: "Personalised phishing vulnerability assessment",
      icon: Crosshair,
      path: "/scan/phishing-profiler",
      status: sr["phishing-profiler"]
        ? sr["phishing-profiler"].data?.riskScore > 50 ? ("issues_found" as const) : ("scanned" as const)
        : ("not_scanned" as const),
      lastScanned: sr["phishing-profiler"]?.timestamp,
      quickStats: sr["phishing-profiler"] ? `Risk: ${sr["phishing-profiler"].data?.riskScore ?? 0}%` : undefined,
      riskScore: sr["phishing-profiler"]?.data?.riskScore,
    },
    {
      title: "Doxxing Vulnerability",
      description: "Check if personal info is publicly exposed",
      icon: EyeOff,
      path: "/scan/doxxing",
      status: sr.doxxing
        ? sr.doxxing.data?.riskScore > 50 ? ("issues_found" as const) : ("scanned" as const)
        : ("not_scanned" as const),
      lastScanned: sr.doxxing?.timestamp,
      quickStats: sr.doxxing ? `${sr.doxxing.data?.profilesFound ?? 0} profiles found` : undefined,
      riskScore: sr.doxxing?.data?.riskScore,
    },
    {
      title: "Ghost Account Finder",
      description: "Find forgotten accounts tied to your identity",
      icon: Ghost,
      path: "/scan/ghost",
      status: sr.ghost
        ? sr.ghost.data?.accountsFound > 0 ? ("issues_found" as const) : ("scanned" as const)
        : ("not_scanned" as const),
      lastScanned: sr.ghost?.timestamp,
      quickStats: sr.ghost ? `${sr.ghost.data?.accountsFound ?? 0} accounts found` : undefined,
    },
    {
      title: "Network Exposure",
      description: "See what an attacker on public WiFi can learn",
      icon: Wifi,
      path: "/scan/network",
      status: sr.network
        ? sr.network.data?.riskScore > 50 ? ("issues_found" as const) : ("scanned" as const)
        : ("not_scanned" as const),
      lastScanned: sr.network?.timestamp,
      quickStats: sr.network ? `Risk: ${sr.network.data?.riskScore ?? 0}%` : undefined,
      riskScore: sr.network?.data?.riskScore,
    },
    {
      title: "Session & Cookie Analyzer",
      description: "Analyze browser session tokens and cookies",
      icon: Lock,
      path: "/scan/session",
      status: sr.session
        ? sr.session.data?.riskScore > 50 ? ("issues_found" as const) : ("scanned" as const)
        : ("not_scanned" as const),
      lastScanned: sr.session?.timestamp,
      quickStats: sr.session ? `${sr.session.data?.cookieCount ?? 0} cookies found` : undefined,
      riskScore: sr.session?.data?.riskScore,
    },
    {
      title: "Image Metadata Detector",
      description: "Extract hidden metadata and GPS from images",
      icon: FileSearch,
      path: "/scan/metadata",
      status: sr.metadata
        ? sr.metadata.data?.hasGPS || sr.metadata.data?.riskScore > 50 ? ("issues_found" as const) : ("scanned" as const)
        : ("not_scanned" as const),
      lastScanned: sr.metadata?.timestamp,
      quickStats: sr.metadata ? `${sr.metadata.data?.totalFields ?? 0} metadata fields` : undefined,
      riskScore: sr.metadata?.data?.riskScore,
    },
    {
      title: "Document Analyzer",
      description: "Discover hidden information in your documents",
      icon: FileText,
      path: "/scan/document",
      status: sr.document
        ? sr.document.data?.risksFound > 0 ? ("issues_found" as const) : ("scanned" as const)
        : ("not_scanned" as const),
      lastScanned: sr.document?.timestamp,
      quickStats: sr.document ? `${sr.document.data?.risksFound ?? 0} risks found` : undefined,
    },
    {
      title: "CNIC Lookup",
      description: "Find all SIM cards registered to a Pakistani CNIC",
      icon: CreditCard,
      path: "/scan/cnic",
      status: sr.cnic
        ? sr.cnic.data?.found ? ("issues_found" as const) : ("scanned" as const)
        : ("not_scanned" as const),
      lastScanned: sr.cnic?.timestamp,
      quickStats: sr.cnic
        ? sr.cnic.data?.found
          ? `${sr.cnic.data?.simCount ?? 0} SIM${sr.cnic.data?.simCount !== 1 ? "s" : ""} registered`
          : "No records found"
        : undefined,
    },
    {
      title: "Overall Risk Analysis",
      description: "Comprehensive security assessment across all scans",
      icon: Shield,
      path: "/report",
      status: completedScans >= 3 ? ("issues_found" as const) : ("not_scanned" as const),
      lastScanned: undefined,
      quickStats: completedScans >= 3 ? `Risk Score: ${overallRisk}%` : "Complete 3+ scans first",
      riskScore: completedScans >= 3 ? overallRisk : undefined,
    },
  ];

  const TOTAL_SCANS = 18;

  const recentActivity = Object.entries(scanResults)
    .map(([type, result]: [string, any]) => ({ type, timestamp: result.timestamp, data: result.data }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  const activityLabel: Record<string, string> = {
    email: "Email Breach Scan",
    password: "Password Security Check",
    username: "Username Footprint Scan",
    phone: "Phone Risk Assessment",
    image: "Profile Image Search",
    ip: "IP Privacy Scan",
    fingerprint: "Device Fingerprint",
    phishing: "Phishing Risk Test",
    "phishing-profiler": "Phishing Profiler",
    plate: "Vehicle Plate Lookup",
    doxxing: "Doxxing Vulnerability Scan",
    ghost: "Ghost Account Finder",
    network: "Network Exposure Scan",
    session: "Session & Cookie Analysis",
    metadata: "Image Metadata Detection",
    document: "Document Analyzer",
    cnic: "CNIC Lookup",
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        {/* Welcome Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Welcome back, <span className="text-primary">{user?.name || "User"}!</span>
            </h1>
            <p className="text-muted-foreground">
              {hasScans
                ? "Here's an overview of your digital security status"
                : "Start scanning to discover your digital footprint"}
            </p>
          </div>
          <Link to="/scan/email" className="btn-primary inline-flex items-center gap-2">
            <Scan className="w-4 h-4" />
            Start Scanning
          </Link>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="lg:col-span-1 glass-card p-6 flex flex-col items-center">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Overall Risk Score</h3>
            {hasScans ? (
              <>
                <RiskGauge score={overallRisk} size="lg" />
                <p className="text-xs text-muted-foreground mt-4">Based on {completedScans} completed scan{completedScans !== 1 ? "s" : ""}</p>
              </>
            ) : (
              <div className="text-center py-4">
                <Shield className="w-16 h-16 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Run scans to see your risk score</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <span className="text-sm text-muted-foreground">Breaches</span>
              </div>
              <span className={`text-2xl font-bold ${breachCount !== null && breachCount > 0 ? "text-destructive" : ""}`}>
                {breachCount !== null ? breachCount : "-"}
              </span>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Scan className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">Scans Done</span>
              </div>
              <span className="text-2xl font-bold text-primary">{completedScans}/{TOTAL_SCANS}</span>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <BarChart3 className="w-5 h-5 text-warning" />
                </div>
                <span className="text-sm text-muted-foreground">Risk Level</span>
              </div>
              {hasScans ? (
                <span className={`badge-${overallRisk > 60 ? "danger" : overallRisk > 30 ? "warning" : "success"}`}>
                  {overallRisk > 60 ? "High" : overallRisk > 30 ? "Medium" : "Low"}
                </span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <Bell className="w-5 h-5 text-secondary" />
                </div>
                <span className="text-sm text-muted-foreground">Issues Found</span>
              </div>
              <span className="text-2xl font-bold text-secondary">
                {hasScans
                  ? scanCards.filter(c => c.status === "issues_found").length
                  : "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Scan Cards */}
          <div className="xl:col-span-3">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Security Scans</h2>
              {completedScans >= 3 && (
                <Link to="/report" className="text-sm text-primary hover:underline">
                  View Full Report →
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scanCards.map((card) => (
                <ScanCard key={card.path} {...card} />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="xl:col-span-1 space-y-6">
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link
                  to="/report"
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    completedScans >= 3
                      ? "bg-muted/30 hover:bg-muted/50 cursor-pointer"
                      : "bg-muted/20 opacity-50 pointer-events-none"
                  }`}
                >
                  <Download className="w-5 h-5 text-primary" />
                  <div>
                    <span className="text-sm block">Generate Full Report</span>
                    {completedScans < 3 && (
                      <span className="text-xs text-muted-foreground">Complete 3+ scans first</span>
                    )}
                  </div>
                </Link>
                <Link
                  to="/profile"
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <Settings className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm">Settings & Profile</span>
                </Link>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4">Recent Activity</h3>
              {recentActivity.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentActivity.map((activity, index) => {
                    const risk = dataToRisk(activity.data);
                    return (
                      <div key={index} className="flex items-start gap-3 pb-3 border-b border-border/30 last:border-0">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          risk !== null && risk > 60 ? "bg-destructive" :
                          risk !== null && risk > 30 ? "bg-warning" : "bg-success"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {activityLabel[activity.type] || `${activity.type} Scan`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {getTimeAgo(activity.timestamp)}
                            {risk !== null && (
                              <span className={`ml-2 ${risk > 60 ? "text-destructive" : risk > 30 ? "text-warning" : "text-success"}`}>
                                · Risk {risk}%
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Run a scan to get started</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

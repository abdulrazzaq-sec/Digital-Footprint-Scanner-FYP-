import { useState } from "react";
import { Link } from "react-router-dom";
import {
  User, Settings, Shield, Clock, Download, Trash2,
  Award, TrendingUp, ChevronRight, LogOut, Mail, Key,
  UserSearch, Phone, Image, FileText, Globe,
  Monitor, AlertTriangle, Ghost, Wifi, Lock, FileSearch,
  CreditCard, Crosshair, EyeOff, CheckCircle,
} from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import ProgressBar from "@/components/common/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";
import { downloadAllScansPDF } from "@/lib/pdfExport";

const TOTAL_SCAN_TYPES = 16;

const SCAN_META: Record<string, { label: string; icon: any; path: string }> = {
  email:              { label: "Email Breach Intelligence",  icon: Mail,          path: "/scan/email" },
  password:           { label: "Password Security",         icon: Key,           path: "/scan/password" },
  username:           { label: "Username Footprint",        icon: UserSearch,    path: "/scan/username" },
  phone:              { label: "Phone Number Risk",         icon: Phone,         path: "/scan/phone" },
  image:              { label: "Profile Image Search",      icon: Image,         path: "/scan/image" },
  ip:                 { label: "IP Privacy Scanner",        icon: Globe,         path: "/scan/ip" },
  fingerprint:        { label: "Device Fingerprint",        icon: Monitor,       path: "/scan/fingerprint" },
  phishing:           { label: "Phishing Risk Test",        icon: AlertTriangle, path: "/scan/phishing" },
  "phishing-profiler":{ label: "Phishing Profiler",         icon: Crosshair,     path: "/scan/phishing-profiler" },
  doxxing:            { label: "Doxxing Vulnerability",     icon: EyeOff,        path: "/scan/doxxing" },
  ghost:              { label: "Ghost Account Finder",      icon: Ghost,         path: "/scan/ghost" },
  network:            { label: "Network Exposure",          icon: Wifi,          path: "/scan/network" },
  session:            { label: "Session & Cookie Analyzer", icon: Lock,          path: "/scan/session" },
  metadata:           { label: "Image Metadata Detector",   icon: FileSearch,    path: "/scan/metadata" },
  document:           { label: "Document Analyzer",         icon: FileText,      path: "/scan/document" },
  cnic:               { label: "CNIC Lookup",               icon: CreditCard,    path: "/scan/cnic" },
};

function dataToRisk(data: any): number | null {
  if (!data) return null;
  if (data.riskScore          !== undefined) return data.riskScore;
  if (data.piiScore           !== undefined) return data.piiScore;
  if (data.strength           !== undefined) return 100 - data.strength;
  if (data.privacyScore       !== undefined) return 100 - data.privacyScore;
  if (data.trackabilityScore  !== undefined) return data.trackabilityScore;
  if (data.forgottenScore     !== undefined) return 100 - data.forgottenScore;
  if (data.score              !== undefined) return 100 - data.score;
  const lvl = (data.riskLevel || "").toLowerCase();
  if (lvl === "high" || lvl === "critical") return 75;
  if (lvl === "medium" || lvl === "moderate") return 45;
  if (lvl === "low") return 20;
  return null;
}

function getTimeAgo(timestamp: string) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getScanQuickStat(key: string, data: any): string {
  if (!data) return "";
  switch (key) {
    case "email":      return `${data.breachCount ?? 0} breach${data.breachCount !== 1 ? "es" : ""} found`;
    case "password":   return data.leaked ? "Password leaked" : `Strength: ${data.strength ?? 0}%`;
    case "username":   return `${data.platformsFound ?? 0} platforms found`;
    case "phone":      return `${data.spamReports ?? 0} spam reports`;
    case "image":      return `${data.matchesFound ?? 0} matches found`;
    case "ip":         return `Privacy: ${data.privacyScore ?? 0}%`;
    case "fingerprint":return `${data.uniqueness ?? 0}% unique`;
    case "phishing":   return `Score: ${data.score ?? 0}%`;
    case "phishing-profiler": return `Risk: ${data.riskScore ?? 0}%`;
    case "doxxing":    return `${data.profilesFound ?? 0} profiles found`;
    case "ghost":      return `${data.accountsFound ?? 0} accounts found`;
    case "network":    return `Risk: ${data.riskScore ?? 0}%`;
    case "session":    return `${data.cookieCount ?? 0} cookies found`;
    case "metadata":   return `${data.totalFields ?? 0} metadata fields`;
    case "document":   return `${data.risksFound ?? 0} risks found`;
    case "cnic":       return data.found ? `${data.simCount ?? 0} SIM${data.simCount !== 1 ? "s" : ""} registered` : "No records found";
    default:           return "";
  }
}

const Profile = () => {
  const { user, scanResults, logout, clearScanResults } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  const completedScans = Object.entries(scanResults);
  const completedCount = completedScans.length;
  const remaining = TOTAL_SCAN_TYPES - completedCount;

  const riskScores = completedScans
    .map(([_, r]: [string, any]) => dataToRisk(r?.data))
    .filter((s): s is number => s !== null);
  const overallRiskScore = riskScores.length
    ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length)
    : 0;

  const issuesFound = completedScans.filter(([_, r]: [string, any]) => {
    const risk = dataToRisk(r?.data);
    return risk !== null && risk > 50;
  }).length;

  const allActivity = completedScans
    .map(([key, r]: [string, any]) => ({
      key,
      timestamp: r.timestamp,
      data: r.data,
      risk: dataToRisk(r.data),
      meta: SCAN_META[key] ?? { label: key, icon: Shield, path: "/dashboard" },
      quickStat: getScanQuickStat(key, r.data),
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const recentScans = allActivity.slice(0, 6);

  const badges = [
    {
      name: "Security Conscious",
      description: "Ran your first scan",
      earned: completedCount >= 1,
      icon: Shield,
      progress: completedCount >= 1 ? 100 : 0,
    },
    {
      name: "Comprehensive User",
      description: `Ran all ${TOTAL_SCAN_TYPES} scan types`,
      earned: completedCount >= TOTAL_SCAN_TYPES,
      icon: Award,
      progress: Math.round((completedCount / TOTAL_SCAN_TYPES) * 100),
    },
    {
      name: "Vigilant",
      description: "Overall risk score below 30",
      earned: completedCount > 0 && overallRiskScore < 30,
      icon: TrendingUp,
      progress: completedCount > 0 ? Math.max(0, Math.round(((100 - overallRiskScore) / 70) * 100)) : 0,
    },
    {
      name: "Privacy Advocate",
      description: "Completed 10+ scans",
      earned: completedCount >= 10,
      icon: User,
      progress: Math.round((completedCount / 10) * 100),
    },
  ];


  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Left Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile Card */}
            <div className="glass-card p-6 text-center">
              <div className="relative inline-block mb-4">
                <img
                  src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || "default"}`}
                  alt="avatar"
                  className="w-24 h-24 rounded-full border-2 border-primary/30"
                />
                <button
                  onClick={() => setActiveTab("settings")}
                  className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
              <h2 className="text-xl font-bold">{user?.name || "User"}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>

            {/* Statistics */}
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4">Statistics</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Scans Completed</span>
                  <span className="font-bold">{completedCount} / {TOTAL_SCAN_TYPES}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Issues Found</span>
                  <span className={`font-bold ${issuesFound > 0 ? "text-destructive" : "text-success"}`}>
                    {completedCount > 0 ? issuesFound : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Overall Risk</span>
                  <span className={`font-bold ${
                    overallRiskScore <= 30 ? "text-success" :
                    overallRiskScore <= 60 ? "text-warning" : "text-destructive"
                  }`}>
                    {completedCount > 0 ? `${overallRiskScore}%` : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email Verified</span>
                  <span className={`text-sm font-medium ${user?.emailVerified ? "text-success" : "text-warning"}`}>
                    {user?.emailVerified ? "Yes" : "Pending"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link to="/dashboard" className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="text-sm">Run Scans</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/report"
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    completedCount >= 3
                      ? "bg-muted/30 hover:bg-muted/50"
                      : "bg-muted/20 opacity-50 pointer-events-none"
                  }`}
                >
                  <span className="text-sm">View Report</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => downloadAllScansPDF(user, scanResults)}
                  disabled={completedCount === 0}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors w-full disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span className="text-sm">Download Report</span>
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {["overview", "activity", "settings"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <div className="space-y-6 animate-fade-in">

                {/* Security Overview */}
                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-6">Security Overview</h3>
                  {completedCount > 0 ? (
                    <div className="flex flex-col sm:flex-row items-center gap-8">
                      <RiskGauge score={overallRiskScore} size="lg" />
                      <div className="flex-1 w-full">
                        <p className="text-muted-foreground mb-4 text-sm">
                          Based on {completedCount} completed scan{completedCount !== 1 ? "s" : ""}.
                          {remaining > 0 && ` Complete ${remaining} more scan${remaining !== 1 ? "s" : ""} for a full assessment.`}
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 rounded-lg bg-primary/10 text-center">
                            <p className="text-primary font-bold text-xl">{completedCount}</p>
                            <p className="text-xs text-muted-foreground">Completed</p>
                          </div>
                          <div className="p-3 rounded-lg bg-warning/10 text-center">
                            <p className="text-warning font-bold text-xl">{remaining}</p>
                            <p className="text-xs text-muted-foreground">Remaining</p>
                          </div>
                          <div className="p-3 rounded-lg bg-destructive/10 text-center">
                            <p className="text-destructive font-bold text-xl">{issuesFound}</p>
                            <p className="text-xs text-muted-foreground">Issues</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Shield className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">
                        No scans completed yet. Start scanning to see your security overview.
                      </p>
                      <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2">
                        Start Scanning
                      </Link>
                    </div>
                  )}
                </div>

                {/* Recent Scans */}
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Recent Scans</h3>
                    {completedCount > 6 && (
                      <button onClick={() => setActiveTab("activity")} className="text-xs text-primary hover:underline">
                        View all →
                      </button>
                    )}
                  </div>
                  {recentScans.length > 0 ? (
                    <div className="space-y-2">
                      {recentScans.map((scan) => {
                        const Icon = scan.meta.icon;
                        const risk = scan.risk;
                        const statusCls = risk === null ? "text-muted-foreground" :
                          risk > 60 ? "text-destructive" : risk > 30 ? "text-warning" : "text-success";
                        return (
                          <Link
                            key={scan.key}
                            to={scan.meta.path}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Icon className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{scan.meta.label}</p>
                                <p className="text-xs text-muted-foreground">{getTimeAgo(scan.timestamp)}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {risk !== null ? (
                                <span className={`text-sm font-bold ${statusCls}`}>{risk}%</span>
                              ) : (
                                <CheckCircle className="w-4 h-4 text-success" />
                              )}
                              {scan.quickStat && (
                                <p className="text-xs text-muted-foreground">{scan.quickStat}</p>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-6 text-sm">
                      No scans completed yet.
                    </p>
                  )}
                </div>

                {/* Achievements */}
                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-4">Achievements</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {badges.map((badge) => (
                      <div
                        key={badge.name}
                        className={`p-4 rounded-lg ${
                          badge.earned ? "bg-primary/10 border border-primary/20" : "bg-muted/30"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${badge.earned ? "bg-primary/20" : "bg-muted/50"}`}>
                            <badge.icon className={`w-5 h-5 ${badge.earned ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-sm ${!badge.earned ? "text-muted-foreground" : ""}`}>
                              {badge.name}
                            </p>
                            <p className="text-xs text-muted-foreground">{badge.description}</p>
                            {!badge.earned && (
                              <div className="mt-2">
                                <ProgressBar value={Math.min(badge.progress, 100)} color="primary" size="sm" />
                                <p className="text-xs text-muted-foreground mt-1">{Math.min(badge.progress, 100)}%</p>
                              </div>
                            )}
                          </div>
                          {badge.earned && <Award className="w-5 h-5 text-primary shrink-0" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── ACTIVITY TAB ── */}
            {activeTab === "activity" && (
              <div className="glass-card p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold">Scan History</h3>
                  <span className="text-sm text-muted-foreground">{completedCount} scan{completedCount !== 1 ? "s" : ""} completed</span>
                </div>
                {allActivity.length > 0 ? (
                  <div className="space-y-3">
                    {allActivity.map((scan) => {
                      const Icon = scan.meta.icon;
                      const risk = scan.risk;
                      const statusDot = risk === null ? "bg-success" :
                        risk > 60 ? "bg-destructive" : risk > 30 ? "bg-warning" : "bg-success";
                      const statusText = risk === null ? "text-success" :
                        risk > 60 ? "text-destructive" : risk > 30 ? "text-warning" : "text-success";
                      return (
                        <Link
                          key={scan.key}
                          to={scan.meta.path}
                          className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border/20"
                        >
                          <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${statusDot}`} />
                          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{scan.meta.label}</p>
                            {scan.quickStat && (
                              <p className="text-xs text-muted-foreground mt-0.5">{scan.quickStat}</p>
                            )}
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              {getTimeAgo(scan.timestamp)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            {risk !== null ? (
                              <>
                                <span className={`text-sm font-bold ${statusText}`}>{risk}%</span>
                                <p className="text-xs text-muted-foreground">risk</p>
                              </>
                            ) : (
                              <CheckCircle className="w-4 h-4 text-success" />
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No scan history yet.</p>
                    <Link to="/dashboard" className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
                      Start Scanning
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* ── SETTINGS TAB ── */}
            {activeTab === "settings" && (
              <div className="space-y-6 animate-fade-in">
                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-4">Account Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Display Name</label>
                      <input
                        type="text"
                        defaultValue={user?.name || ""}
                        className="input-cyber w-full"
                        readOnly
                      />
                      <p className="text-xs text-muted-foreground mt-1">Name is managed through your account provider.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Email Address</label>
                      <input
                        type="email"
                        defaultValue={user?.email || ""}
                        className="input-cyber w-full"
                        readOnly
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Email verified:</span>
                      {user?.emailVerified ? (
                        <span className="badge-success text-xs flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Verified
                        </span>
                      ) : (
                        <span className="badge-warning text-xs">Pending verification</span>
                      )}
                    </div>
                  </div>
                </div>



                <div className="glass-card p-6 border border-destructive/30">
                  <h3 className="font-semibold mb-4 text-destructive">Danger Zone</h3>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/30">
                      <p className="text-sm font-medium mb-1">Delete All Scan Data</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Permanently removes all your scan results and resets your risk score to zero. This cannot be undone.
                      </p>
                      <button
                        onClick={clearScanResults}
                        className="btn-secondary flex items-center gap-2 text-destructive border-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete All Scan Data
                      </button>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30">
                      <p className="text-sm font-medium mb-1">Sign Out</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Sign out of your account on this device.
                      </p>
                      <button
                        onClick={logout}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors text-sm"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

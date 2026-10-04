import { useState, useCallback } from "react";
import {
  Wifi, WifiOff, Shield, AlertTriangle, Globe, Monitor,
  Eye, Lock, Server, Radio, RefreshCw, Fingerprint,
  CheckCircle, XCircle, HelpCircle, ChevronDown, ChevronRight,
  Terminal, Signal, Search, Loader2, Info, Dna,
} from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import ProgressBar from "@/components/common/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface WebRTCResult  { localIPs: string[]; publicIPs: string[]; leaked: boolean; blocked: boolean; }
interface DNSResult     { resolverIP: string | null; possibleLeak: boolean; checked: boolean; }
interface GeoInfo       { ip: string; country: string; countryCode: string; regionName: string; city: string; isp: string; org: string; proxy: boolean; hosting: boolean; }
interface FingerprintInfo { browser: string; os: string; screen: string; viewport: string; timezone: string; language: string; languages: string[]; cores: number; memory: number; platform: string; cookiesEnabled: boolean; doNotTrack: string | null; touchPoints: number; uniquenessScore: number; }
interface HeadersInfo   { userAgent: string | null; acceptLanguage: string | null; acceptEncoding: string | null; dnt: string | null; secChUa: string | null; secChUaMobile: string | null; secChUaPlatform: string | null; referer: string | null; }
interface RiskItem      { label: string; points: number; severity: "safe" | "warning" | "danger"; }
interface NetworkResult { geo: GeoInfo | null; webrtc: WebRTCResult; dns: DNSResult; fingerprint: FingerprintInfo; headers: HeadersInfo; isHttps: boolean; connection: { effectiveType: string; downlink: number; rtt: number } | null; riskScore: number; riskLevel: "low" | "moderate" | "high" | "critical"; breakdown: RiskItem[]; }

const STEPS = [
  { id: "geo",         label: "Detecting public IP & geolocation" },
  { id: "webrtc",      label: "Running WebRTC IP leak test" },
  { id: "dns",         label: "Checking DNS resolver for leaks" },
  { id: "fingerprint", label: "Analyzing browser fingerprint" },
  { id: "connection",  label: "Inspecting connection & headers" },
  { id: "risk",        label: "Computing exposure risk score" },
];

function parseBrowser(ua: string) {
  if (ua.includes("Edg/"))     return `Edge ${ua.match(/Edg\/([\d]+)/)?.[1] ?? ""}`;
  if (ua.includes("OPR/"))     return `Opera ${ua.match(/OPR\/([\d]+)/)?.[1] ?? ""}`;
  if (ua.includes("Firefox/")) return `Firefox ${ua.match(/Firefox\/([\d]+)/)?.[1] ?? ""}`;
  if (ua.includes("Chrome/"))  return `Chrome ${ua.match(/Chrome\/([\d]+)/)?.[1] ?? ""}`;
  if (ua.includes("Safari/"))  return `Safari ${ua.match(/Version\/([\d]+)/)?.[1] ?? ""}`;
  return "Unknown Browser";
}
function parseOS(ua: string) {
  if (ua.includes("Windows NT 10.0")) return "Windows 10/11";
  if (ua.includes("Windows NT 6.3"))  return "Windows 8.1";
  if (ua.includes("Mac OS X"))        return `macOS ${ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, ".") ?? ""}`;
  if (ua.includes("Android"))         return `Android ${ua.match(/Android ([\d.]+)/)?.[1] ?? ""}`;
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Linux"))           return "Linux";
  return "Unknown OS";
}

async function getGeoInfo(): Promise<{ geo: GeoInfo | null; headers: HeadersInfo }> {
  const emptyHeaders: HeadersInfo = { userAgent: null, acceptLanguage: null, acceptEncoding: null, dnt: null, secChUa: null, secChUaMobile: null, secChUaPlatform: null, referer: null };
  try {
    const r = await fetch(`${API}/network-info`);
    if (r.ok) {
      const d = await r.json();
      return { geo: d.geo ?? null, headers: d.exposedHeaders ?? emptyHeaders };
    }
  } catch { /* fallback */ }

  try {
    const r = await fetch("https://ipapi.co/json/");
    if (r.ok) {
      const d = await r.json();
      const geo: GeoInfo = {
        ip: d.ip, country: d.country_name, countryCode: d.country_code,
        regionName: d.region, city: d.city, isp: d.org, org: d.org,
        proxy: false, hosting: false,
      };
      const ua = navigator.userAgent;
      const headers: HeadersInfo = {
        userAgent:      ua,
        acceptLanguage: navigator.languages?.join(",") ?? navigator.language,
        acceptEncoding: "gzip, deflate, br",
        dnt:            navigator.doNotTrack,
        secChUa:        (navigator as any).userAgentData?.brands?.map((b: any) => `"${b.brand}";v="${b.version}"`).join(", ") ?? null,
        secChUaMobile:  (navigator as any).userAgentData?.mobile != null ? ((navigator as any).userAgentData.mobile ? "?1" : "?0") : null,
        secChUaPlatform:(navigator as any).userAgentData?.platform ?? null,
        referer:        null,
      };
      return { geo, headers };
    }
  } catch { /* give up */ }

  return { geo: null, headers: emptyHeaders };
}

async function detectWebRTC(): Promise<WebRTCResult> {
  return new Promise((resolve) => {
    const res: WebRTCResult = { localIPs: [], publicIPs: [], leaked: false, blocked: false };
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pc.createDataChannel("");
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          pc.close();
          res.leaked = res.localIPs.length > 0 || res.publicIPs.length > 0;
          resolve(res); return;
        }
        const ips = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/g) ?? [];
        ips.forEach(ip => {
          if (ip.startsWith("10.") || ip.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) {
            if (!res.localIPs.includes(ip)) res.localIPs.push(ip);
          } else if (ip !== "0.0.0.0" && !ip.startsWith("127.")) {
            if (!res.publicIPs.includes(ip)) res.publicIPs.push(ip);
          }
        });
      };
      pc.createOffer().then(o => pc.setLocalDescription(o)).catch(() => resolve({ ...res, blocked: true }));
      setTimeout(() => { try { pc.close(); } catch { /**/ } res.leaked = res.localIPs.length > 0 || res.publicIPs.length > 0; resolve(res); }, 5000);
    } catch { resolve({ ...res, blocked: true }); }
  });
}

async function detectDNSLeak(geoIP: string | null): Promise<DNSResult> {
  try {
    const r = await fetch(
      "https://cloudflare-dns.com/dns-query?name=whoami.cloudflare&type=TXT",
      { headers: { accept: "application/dns-json" } }
    );
    if (!r.ok) return { resolverIP: null, possibleLeak: false, checked: false };
    const d = await r.json();
    const resolverIP = (d.Answer?.[0]?.data ?? "").replace(/"/g, "") || null;
    const possibleLeak = !!(resolverIP && geoIP && resolverIP !== geoIP);
    return { resolverIP, possibleLeak, checked: true };
  } catch {
    return { resolverIP: null, possibleLeak: false, checked: false };
  }
}

function gatherFingerprint(): FingerprintInfo {
  const ua = navigator.userAgent;
  let score = 20;
  if (![1920,1366,1440,1280,1536,1024].includes(screen.width)) score += 12;
  if ((navigator.languages ?? []).length > 2)                   score += 8;
  if (navigator.hardwareConcurrency > 8)                        score += 8;
  if (navigator.maxTouchPoints > 0 && screen.width > 1024)      score += 15;
  if ((navigator as any).deviceMemory > 8)                      score += 8;
  if (navigator.doNotTrack === "1")                             score += 5;
  if (new Date().getTimezoneOffset() !== 0)                     score += 8;
  if (ua.includes("Edg/") || ua.includes("OPR/") || ua.includes("Firefox/")) score += 6;
  if (window.devicePixelRatio > 1)                              score += 5;
  return {
    browser: parseBrowser(ua), os: parseOS(ua),
    screen: `${screen.width} × ${screen.height}`,
    viewport: `${window.innerWidth} × ${window.innerHeight}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    languages: Array.from(navigator.languages ?? [navigator.language]),
    cores: navigator.hardwareConcurrency ?? 0,
    memory: (navigator as any).deviceMemory ?? 0,
    platform: (navigator as any).platform ?? "Unknown",
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    touchPoints: navigator.maxTouchPoints,
    uniquenessScore: Math.min(score, 100),
  };
}

function computeRisk(geo: GeoInfo | null, webrtc: WebRTCResult, dns: DNSResult, fp: FingerprintInfo, isHttps: boolean) {
  const breakdown: RiskItem[] = [];
  let score = 0;

  if (!isHttps) { score += 30; breakdown.push({ label: "Traffic over unencrypted HTTP", points: 30, severity: "danger" }); }
  else            breakdown.push({ label: "HTTPS encrypted - traffic protected", points: 0, severity: "safe" });

  if (webrtc.blocked) breakdown.push({ label: "WebRTC blocked - no IP leak possible", points: 0, severity: "safe" });
  else if (webrtc.leaked) {
    const pts = 25 + (webrtc.publicIPs.length > 0 ? 10 : 0);
    score += pts;
    breakdown.push({ label: `WebRTC leaking IPs: ${[...webrtc.localIPs, ...webrtc.publicIPs].join(", ")}`, points: pts, severity: "danger" });
  } else breakdown.push({ label: "No WebRTC IP leak detected", points: 0, severity: "safe" });

  if (dns.checked && dns.possibleLeak) {
    score += 15;
    breakdown.push({ label: `DNS resolver IP (${dns.resolverIP}) differs from your IP - possible DNS leak`, points: 15, severity: "warning" });
  } else if (dns.checked) {
    breakdown.push({ label: "DNS resolver appears consistent - no DNS leak detected", points: 0, severity: "safe" });
  }

  if (geo && !geo.proxy && !geo.hosting) {
    score += 15;
    breakdown.push({ label: `Real IP visible - no VPN/proxy detected (${geo.ip})`, points: 15, severity: "warning" });
  } else if (geo?.proxy || geo?.hosting) {
    breakdown.push({ label: "VPN / proxy detected - IP is masked", points: 0, severity: "safe" });
  }

  if (geo?.city) { score += 5; breakdown.push({ label: `City-level location exposed (${geo.city}, ${geo.country})`, points: 5, severity: "warning" }); }
  if (geo?.isp)  { score += 5; breakdown.push({ label: `ISP visible to every server (${geo.isp})`, points: 5, severity: "warning" }); }

  const fpPts = Math.round(fp.uniquenessScore * 0.12);
  if (fpPts > 0) { score += fpPts; breakdown.push({ label: `Browser fingerprint ${fp.uniquenessScore}% unique, cross-site trackable`, points: fpPts, severity: fp.uniquenessScore > 65 ? "warning" : "safe" }); }

  score = Math.min(Math.round(score), 100);
  const level = score <= 25 ? "low" : score <= 50 ? "moderate" : score <= 75 ? "high" : "critical";
  return { score, level: level as NetworkResult["riskLevel"], breakdown };
}

function riskLabel(score: number) {
  if (score >= 75) return { text: "Critical: Highly Exposed",    cls: "text-destructive" };
  if (score >= 55) return { text: "High: Significant Exposure",  cls: "text-orange-500"  };
  if (score >= 30) return { text: "Moderate: Some Exposure",     cls: "text-warning"     };
  return                  { text: "Low: Well Protected",         cls: "text-success"     };
}

const SEV_DOT:      Record<string, string>           = { safe: "bg-success", warning: "bg-warning", danger: "bg-destructive" };
const SEV_ICON:     Record<string, React.ElementType> = { safe: CheckCircle, warning: AlertTriangle, danger: XCircle, unknown: HelpCircle };
const SEV_ICON_CLS: Record<string, string>           = { safe: "text-success", warning: "text-warning", danger: "text-destructive", unknown: "text-muted-foreground" };

function CheckCard({ icon: Icon, title, sev, finding, detail, expanded, onToggle }: {
  icon: React.ElementType; title: string; sev: string; finding: string; detail: string[]; expanded: boolean; onToggle: () => void;
}) {
  const StatusIcon = SEV_ICON[sev] ?? HelpCircle;
  return (
    <div className={`p-4 rounded-lg border ${sev === "danger" ? "bg-destructive/5 border-destructive/20" : sev === "warning" ? "bg-warning/5 border-warning/20" : "bg-muted/20 border-border/20"}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg flex-shrink-0 ${sev === "danger" ? "bg-destructive/10" : sev === "warning" ? "bg-warning/10" : "bg-primary/10"}`}>
          <Icon className={`w-4 h-4 ${sev === "danger" ? "text-destructive" : sev === "warning" ? "text-warning" : "text-primary"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-semibold">{title}</span>
            <StatusIcon className={`w-4 h-4 flex-shrink-0 ${SEV_ICON_CLS[sev] ?? "text-muted-foreground"}`} />
          </div>
          <p className="text-xs text-muted-foreground mb-2">{finding}</p>
          {detail.length > 0 && (
            <button onClick={onToggle} className="flex items-center gap-1 text-xs text-primary hover:underline">
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {expanded ? "Less detail" : "More detail"}
            </button>
          )}
          {expanded && (
            <ul className="mt-2 space-y-1 border-t border-border/30 pt-2">
              {detail.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="text-primary mt-0.5 flex-shrink-0">›</span>{d}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const NetworkScan = () => {
  const [isScanning,    setIsScanning]    = useState(false);
  const [results,       setResults]       = useState<NetworkResult | null>(null);
  const [stepStates,    setStepStates]    = useState<Record<string, "idle"|"running"|"done"|"error">>({});
  const [expanded,      setExpanded]      = useState<Record<string, boolean>>({});
  const [showAllHeaders,setShowAllHeaders]= useState(false);
  const { saveScanResult } = useAuth();

  const toggle = (key: string) => setExpanded(p => ({ ...p, [key]: !p[key] }));
  const setStep = (id: string, state: "running"|"done"|"error") =>
    setStepStates(p => ({ ...p, [id]: state }));

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    setResults(null);
    setStepStates({});
    setShowAllHeaders(false);

    setStep("geo", "running");
    const { geo, headers } = await getGeoInfo();
    setStep("geo", geo ? "done" : "error");

    setStep("webrtc", "running");
    const webrtc = await detectWebRTC();
    setStep("webrtc", "done");

    setStep("dns", "running");
    const dns = await detectDNSLeak(geo?.ip ?? null);
    setStep("dns", "done");

    setStep("fingerprint", "running");
    await new Promise(r => setTimeout(r, 200)); // slight delay for UX
    const fingerprint = gatherFingerprint();
    setStep("fingerprint", "done");

    setStep("connection", "running");
    await new Promise(r => setTimeout(r, 150));
    const conn = (navigator as any).connection;
    const connection = conn
      ? { effectiveType: conn.effectiveType ?? "unknown", downlink: conn.downlink ?? 0, rtt: conn.rtt ?? 0 }
      : null;
    const isHttps = window.location.protocol === "https:";
    setStep("connection", "done");

    setStep("risk", "running");
    const { score, level, breakdown } = computeRisk(geo, webrtc, dns, fingerprint, isHttps);
    setStep("risk", "done");

    const final: NetworkResult = { geo, webrtc, dns, fingerprint, headers, isHttps, connection, riskScore: score, riskLevel: level, breakdown };
    setResults(final);
    setIsScanning(false);

    saveScanResult("network", {
      riskScore: score,
      webrtcLeaked: webrtc.leaked,
      dnsLeaked: dns.possibleLeak,
      isHttps,
      ip: geo?.ip,
      city: geo?.city,
      country: geo?.country,
      isp: geo?.isp,
      fingerprintUniqueness: fingerprint.uniquenessScore,
    });
  }, [saveScanResult]);

  function buildChecks(r: NetworkResult) {
    return [
      {
        id: "ip", icon: Globe, title: "IP & Location Exposure",
        sev: r.geo ? (r.geo.proxy || r.geo.hosting ? "safe" : "warning") : "unknown",
        finding: r.geo
          ? (r.geo.proxy || r.geo.hosting ? `${r.geo.ip} - VPN/proxy detected` : `${r.geo.ip} - ${r.geo.city}, ${r.geo.country} (${r.geo.isp})`)
          : "Could not determine IP - check connection",
        detail: r.geo
          ? [`IP: ${r.geo.ip}`, `Location: ${r.geo.city}, ${r.geo.regionName}, ${r.geo.country}`, `ISP / Org: ${r.geo.isp}`, r.geo.proxy ? "A VPN or proxy is masking your true IP." : "Every site you visit sees your exact IP and can derive your city and ISP in real time."]
          : ["IP geolocation unavailable."],
      },
      {
        id: "webrtc", icon: Radio, title: "WebRTC IP Leak",
        sev: r.webrtc.blocked ? "safe" : r.webrtc.leaked ? "danger" : "safe",
        finding: r.webrtc.blocked
          ? "WebRTC blocked - no IP leak possible"
          : r.webrtc.leaked
          ? `Leaking: ${[...r.webrtc.localIPs, ...r.webrtc.publicIPs].join(", ")}`
          : "No WebRTC IP leak detected",
        detail: r.webrtc.leaked
          ? [`Private IPs: ${r.webrtc.localIPs.join(", ") || "none"}`, `Public IPs: ${r.webrtc.publicIPs.join(", ") || "none"}`, "WebRTC can bypass VPN tunnels and expose your real local network IP.", "Fix: Enable 'Prevent WebRTC leaks' in uBlock Origin, or disable WebRTC (about:config on Firefox)."]
          : ["WebRTC found no IP addresses to expose. Network IPs are protected."],
      },
      {
        id: "dns", icon: Dna, title: "DNS Resolver Leak",
        sev: r.dns.checked ? (r.dns.possibleLeak ? "warning" : "safe") : "unknown",
        finding: !r.dns.checked
          ? "DNS leak check unavailable (no internet or blocked)"
          : r.dns.possibleLeak
          ? `DNS resolver IP (${r.dns.resolverIP}) differs from your public IP - possible leak`
          : `DNS resolver consistent with your connection${r.dns.resolverIP ? ` (${r.dns.resolverIP})` : ""}`,
        detail: [
          "DNS leak occurs when DNS requests bypass a VPN tunnel and reveal your real ISP to DNS servers.",
          r.dns.resolverIP ? `Cloudflare DoH reports your DNS resolver is at: ${r.dns.resolverIP}` : "",
          r.dns.possibleLeak
            ? "Consider enabling DNS-over-HTTPS in browser settings or using a VPN with DNS leak protection."
            : "Your DNS requests appear to be going through the same path as your traffic.",
        ].filter(Boolean),
      },
      {
        id: "fp", icon: Fingerprint, title: "Browser Fingerprint",
        sev: r.fingerprint.uniquenessScore > 75 ? "danger" : r.fingerprint.uniquenessScore > 45 ? "warning" : "safe",
        finding: `${r.fingerprint.uniquenessScore}% uniqueness - ${r.fingerprint.browser} on ${r.fingerprint.os}`,
        detail: [`Browser: ${r.fingerprint.browser}`, `OS: ${r.fingerprint.os}`, `Screen: ${r.fingerprint.screen} / Viewport: ${r.fingerprint.viewport}`, `Timezone: ${r.fingerprint.timezone}`, `Languages: ${r.fingerprint.languages.join(", ")}`, `CPU: ${r.fingerprint.cores} cores, RAM: ${r.fingerprint.memory ? r.fingerprint.memory + " GB" : "?"}`, `Touch points: ${r.fingerprint.touchPoints}`, "This combination lets trackers identify you across sites without cookies."],
      },
      {
        id: "https", icon: Lock, title: "Connection Encryption",
        sev: r.isHttps ? "safe" : "danger",
        finding: r.isHttps ? "HTTPS active - traffic encrypted end-to-end" : "HTTP only - traffic is unencrypted and visible",
        detail: r.isHttps
          ? ["TLS/SSL encryption is active.", "Attackers on the same Wi-Fi cannot read your traffic or steal session tokens."]
          : ["All data is in plain text - passwords, cookies, and messages are visible to anyone on the network.", "Never log in or enter payment details on HTTP sites."],
      },
      {
        id: "headers", icon: Server, title: "HTTP Headers Exposed",
        sev: Object.values(r.headers).filter(Boolean).length > 5 ? "warning" : "safe",
        finding: `${Object.values(r.headers).filter(Boolean).length} identifying headers sent automatically to every server`,
        detail: ["Every HTTP request includes headers that expose your browser version, OS, and accepted languages.", "Sec-CH-UA (Client Hints) on Chromium browsers gives granular browser and OS info.", "Referer header can reveal which page linked you here."],
      },
      {
        id: "conn", icon: Signal, title: "Network Connection",
        sev: r.connection ? (r.connection.rtt > 200 ? "warning" : "safe") : "unknown",
        finding: r.connection
          ? `${r.connection.effectiveType?.toUpperCase()} - ${r.connection.downlink} Mbps, RTT ${r.connection.rtt}ms`
          : "Network Information API not available in this browser",
        detail: r.connection
          ? [`Type: ${r.connection.effectiveType}`, `Speed: ${r.connection.downlink} Mbps`, `Round-trip time: ${r.connection.rtt}ms`, r.connection.rtt > 200 ? "High latency may indicate routing through a VPN or congested network." : "Latency is normal."]
          : [],
      },
    ];
  }

  const progress = Object.values(stepStates).filter(s => s === "done" || s === "error").length / STEPS.length * 100;

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Left Panel ── */}
          <div className="space-y-6">
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Wifi className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Network Exposure Scanner</h1>
                  <p className="text-muted-foreground text-sm">IP · WebRTC · DNS leaks · fingerprint · headers</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-warning mb-1">Public Wi-Fi Risk</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Attackers on the same network can intercept unencrypted traffic, steal session cookies, and run man-in-the-middle attacks - especially on hotel, airport, and café Wi-Fi.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border/30 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    All checks run in your browser. IP geolocation uses your backend when available, otherwise ipapi.co. DNS leak check uses Cloudflare DoH.
                  </p>
                </div>

                <button onClick={handleScan} disabled={isScanning}
                  className="btn-primary w-full flex items-center justify-center gap-2">
                  {isScanning
                    ? <><Loader2 className="w-5 h-5 animate-spin" />Scanning…</>
                    : <><Search className="w-5 h-5" />Run Network Exposure Scan</>}
                </button>

                {/* Sequential step list */}
                {(isScanning || Object.keys(stepStates).length > 0) && (
                  <div className="space-y-3">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="space-y-1.5">
                      {STEPS.map(step => {
                        const s = stepStates[step.id] ?? "idle";
                        return (
                          <div key={step.id} className="flex items-center gap-2.5 text-xs">
                            {s === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />}
                            {s === "done"    && <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0" />}
                            {s === "error"   && <XCircle className="w-3.5 h-3.5 text-warning flex-shrink-0" />}
                            {s === "idle"    && <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 flex-shrink-0" />}
                            <span className={s === "idle" ? "text-muted-foreground/50" : s === "running" ? "text-foreground font-medium" : "text-muted-foreground"}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Education card */}
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                Network Attack Types
              </h3>
              <div className="space-y-2">
                {[
                  { label: "Evil Twin",        text: "Fake Wi-Fi hotspot mirrors a legitimate network to intercept all traffic" },
                  { label: "WebRTC Leak",      text: "Browser reveals your private IP even through a VPN via WebRTC protocol" },
                  { label: "DNS Leak",         text: "DNS queries bypass the VPN and expose which sites you visit to your ISP" },
                  { label: "Session Hijack",   text: "Attacker steals session cookies from unencrypted HTTP to impersonate you" },
                  { label: "DNS Spoofing",     text: "Redirects domain lookups to malicious servers - invisible to the user" },
                  { label: "Fingerprinting",   text: "Browser attributes identify you across every site without cookies" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/20">
                    <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded flex-shrink-0 mt-0.5">{item.label}</span>
                    <p className="text-xs text-muted-foreground">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right Panel ── */}
          {!results && !isScanning ? (
            <div className="flex items-center justify-center">
              <div className="text-center glass-card p-12 w-full">
                <Wifi className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Click Scan to Analyze</h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-6">
                  7 checks including WebRTC leak, DNS leak, fingerprint, and headers - all run locally.
                </p>
                <div className="grid grid-cols-2 gap-2 text-left max-w-xs mx-auto">
                  {["IP & geolocation", "WebRTC IP leak", "DNS resolver leak", "Browser fingerprint", "HTTPS verification", "HTTP headers audit", "Connection info"].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded bg-muted/20">
                      <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />{item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : results && (
            <div className="space-y-6 animate-fade-in">

              {/* Risk Score */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Network Exposure Score</h2>
                    <p className={`text-sm font-medium mt-0.5 ${riskLabel(results.riskScore).cls}`}>
                      {riskLabel(results.riskScore).text}
                    </p>
                  </div>
                  <RiskGauge score={results.riskScore} size="sm" label="Risk" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Public IP",    value: results.geo?.ip ?? "Unknown",                                               warn: !results.geo?.proxy },
                    { label: "WebRTC",       value: results.webrtc.blocked ? "Blocked" : results.webrtc.leaked ? "Leaking" : "Safe", warn: results.webrtc.leaked },
                    { label: "DNS Leak",     value: !results.dns.checked ? "N/A" : results.dns.possibleLeak ? "Possible" : "Safe", warn: results.dns.possibleLeak },
                    { label: "Encryption",   value: results.isHttps ? "HTTPS ✓" : "HTTP ✗",                                    warn: !results.isHttps },
                  ].map((stat, i) => (
                    <div key={i} className={`p-3 rounded-lg text-center ${stat.warn ? "bg-destructive/10 border border-destructive/20" : "bg-success/10 border border-success/20"}`}>
                      <p className={`text-sm font-bold truncate ${stat.warn ? "text-destructive" : "text-success"}`}>{stat.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Breakdown */}
                <div className="space-y-2 pt-2 border-t border-border/30">
                  <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Score Breakdown</p>
                  {results.breakdown.map((item, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SEV_DOT[item.severity] ?? "bg-muted-foreground"}`} />
                          <span className="text-muted-foreground">{item.label}</span>
                        </div>
                        <span className={`font-semibold ${item.points > 0 ? "text-destructive" : "text-success"}`}>
                          {item.points > 0 ? `+${item.points}` : "✓"}
                        </span>
                      </div>
                      {item.points > 0 && <ProgressBar value={item.points} max={35} color={item.severity === "danger" ? "destructive" : "warning"} showValue={false} size="sm" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Attacker view */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" />
                  What an Attacker Sees Right Now
                </h2>
                <div className="rounded-lg border border-border/40 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border/30">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-destructive/60" />
                      <span className="w-3 h-3 rounded-full bg-warning/60" />
                      <span className="w-3 h-3 rounded-full bg-success/60" />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground ml-2">attacker-view - live</span>
                  </div>
                  <div className="bg-background/60 p-4 font-mono text-xs space-y-1.5">
                    {[
                      { k: "TARGET IP",    v: results.geo?.ip ?? "Unknown",                                                            danger: !results.geo?.proxy },
                      { k: "LOCATION",     v: results.geo ? `${results.geo.city}, ${results.geo.regionName}, ${results.geo.country}` : "Unknown", danger: !!results.geo?.city },
                      { k: "ISP",          v: results.geo?.isp ?? "Unknown",                                                           danger: !!results.geo?.isp  },
                      { k: "VPN/PROXY",    v: (results.geo?.proxy || results.geo?.hosting) ? "Detected ✓" : "Not detected - real IP exposed", danger: !(results.geo?.proxy || results.geo?.hosting) },
                      { k: "WEBRTC",       v: results.webrtc.blocked ? "Blocked ✓" : results.webrtc.leaked ? `EXPOSED: ${[...results.webrtc.localIPs, ...results.webrtc.publicIPs].join(", ")}` : "No leak ✓", danger: results.webrtc.leaked },
                      { k: "DNS LEAK",     v: !results.dns.checked ? "Check failed" : results.dns.possibleLeak ? `POSSIBLE LEAK → resolver: ${results.dns.resolverIP}` : `No leak (resolver: ${results.dns.resolverIP ?? "?"})`, danger: results.dns.possibleLeak },
                      { k: "BROWSER",      v: `${results.fingerprint.browser} on ${results.fingerprint.os}`,                          danger: true },
                      { k: "SCREEN",       v: results.fingerprint.screen,                                                             danger: false },
                      { k: "TIMEZONE",     v: results.fingerprint.timezone,                                                           danger: false },
                      { k: "LANGUAGE",     v: results.fingerprint.languages.join(", "),                                               danger: false },
                      { k: "ENCRYPTION",   v: results.isHttps ? "HTTPS ✓" : "HTTP - UNENCRYPTED ⚠",                                  danger: !results.isHttps },
                      { k: "FINGERPRINT",  v: `${results.fingerprint.uniquenessScore}% unique - cross-site trackable`,                danger: results.fingerprint.uniquenessScore > 50 },
                    ].map(({ k, v, danger }) => (
                      <div key={k} className="flex items-baseline gap-3">
                        <span className="text-muted-foreground w-28 flex-shrink-0">{k}</span>
                        <span className="text-muted-foreground flex-shrink-0">›</span>
                        <span className={danger ? "text-destructive font-semibold" : "text-success"}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Detailed checks */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4">Detailed Check Results</h2>
                <div className="space-y-3">
                  {buildChecks(results).map(card => (
                    <CheckCard key={card.id} icon={card.icon} title={card.title} sev={card.sev}
                      finding={card.finding} detail={card.detail}
                      expanded={!!expanded[card.id]} onToggle={() => toggle(card.id)} />
                  ))}
                </div>
              </div>

              {/* Headers */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  HTTP Headers Sent to Every Server
                </h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Automatically attached to every request - no way to opt out without a VPN or privacy browser.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="text-left py-2 pr-4 font-semibold text-muted-foreground uppercase text-xs w-48">Header</th>
                        <th className="text-left py-2 font-semibold text-muted-foreground uppercase text-xs">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {(Object.entries(results.headers) as [string, string | null][])
                        .filter(([, v]) => v !== null)
                        .slice(0, showAllHeaders ? undefined : 4)
                        .map(([key, val]) => (
                          <tr key={key} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2.5 pr-4 font-mono text-primary">{key.replace(/([A-Z])/g, "-$1").toLowerCase()}</td>
                            <td className="py-2.5 font-mono text-muted-foreground break-all">{val}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {Object.values(results.headers).filter(Boolean).length > 4 && (
                  <button onClick={() => setShowAllHeaders(!showAllHeaders)} className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline">
                    {showAllHeaders ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {showAllHeaders ? "Show less" : `Show ${Object.values(results.headers).filter(Boolean).length - 4} more headers`}
                  </button>
                )}
              </div>

              {/* Recommendations */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Protection Recommendations
                </h2>
                <div className="space-y-3">
                  {[
                    { show: !results.geo?.proxy && !results.geo?.hosting, icon: Globe,       priority: "High",     title: "Use a reputable VPN", desc: "Encrypts your tunnel and hides your real IP. Choose one with a verified no-logs policy and DNS leak protection built in." },
                    { show: results.webrtc.leaked,                        icon: Radio,       priority: "High",     title: "Block WebRTC IP leaks", desc: "Enable 'Prevent WebRTC leaks' in uBlock Origin. On Firefox: set media.peerconnection.enabled=false in about:config." },
                    { show: results.dns.possibleLeak,                     icon: Dna,         priority: "High",     title: "Fix DNS leak", desc: "Enable DNS-over-HTTPS in browser settings (Settings → Privacy → DNS over HTTPS) and ensure your VPN's kill switch is active." },
                    { show: !results.isHttps,                             icon: Lock,        priority: "Critical", title: "Avoid HTTP sites", desc: "Never enter credentials on HTTP-only pages. Use browsers that auto-upgrade to HTTPS or install the HTTPS Everywhere extension." },
                    { show: results.fingerprint.uniquenessScore > 50,     icon: Fingerprint, priority: "Medium",   title: "Reduce fingerprint uniqueness", desc: "Use Brave (built-in fingerprint randomisation) or Firefox with Canvas Blocker and uBlock Origin." },
                    { show: true,                                          icon: WifiOff,     priority: "High",     title: "Avoid public Wi-Fi for sensitive tasks", desc: "Never access banking or work accounts on public Wi-Fi without a VPN. Evil Twin hotspots are indistinguishable from real ones." },
                    { show: true,                                          icon: Eye,         priority: "Medium",   title: "Use a private DNS resolver", desc: "Switch to Cloudflare (1.1.1.1) or NextDNS with DNS-over-HTTPS. This encrypts DNS queries so your ISP can't see which sites you visit." },
                  ].filter(r => r.show).map((rec, i) => {
                    const pCls = rec.priority === "Critical"
                      ? "text-amber-700 bg-amber-50 border-amber-200"
                      : rec.priority === "High"
                      ? "text-amber-600 bg-amber-50 border-amber-200"
                      : "text-blue-600 bg-blue-50 border-blue-200";
                    return (
                      <div key={i} className="flex gap-3 p-4 rounded-lg bg-muted/20 border border-border/20">
                        <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0 h-fit">
                          <rec.icon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold">{rec.title}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${pCls}`}>{rec.priority}</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{rec.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Re-scan */}
              <div className="flex justify-center pb-4">
                <button onClick={handleScan}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm">
                  <RefreshCw className="w-4 h-4" /> Re-scan Network
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkScan;

import { useState } from "react";
import {
  Monitor, RefreshCw, Shield, Fingerprint, Globe, Cpu,
  Palette, Music, Type, Eye, CheckCircle, XCircle, Lock,
} from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import { useAuth } from "@/contexts/AuthContext";

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function toHex(n: number, len = 8) { return n.toString(16).padStart(len, "0"); }

function getBrowserInfo() {
  const ua  = navigator.userAgent;
  const nav = navigator as any;

  const name =
    ua.includes("Edg/")    ? "Edge"    :
    ua.includes("Firefox") ? "Firefox" :
    ua.includes("Chrome")  ? "Chrome"  :
    ua.includes("Safari")  ? "Safari"  :
    ua.includes("Opera")   ? "Opera"   : "Unknown";

  const verRe: Record<string, RegExp> = {
    Edge: /Edg\/(\d+)/, Firefox: /Firefox\/(\d+)/,
    Chrome: /Chrome\/(\d+)/, Safari: /Version\/(\d+)/,
  };
  const version = ua.match(verRe[name] ?? /(\d+)/)?.[1] ?? "?";

  return {
    name, version,
    userAgent: ua,
    plugins: nav.plugins?.length ?? 0,
    languages: Array.from(navigator.languages ?? [navigator.language]) as string[],
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    platform: nav.platform ?? "Unknown",
  };
}

function getSystemInfo() {
  const ua  = navigator.userAgent;
  const nav = navigator as any;

  const os =
    ua.includes("Windows NT 10.0") ? "Windows 10/11"  :
    ua.includes("Windows NT 6.3")  ? "Windows 8.1"    :
    ua.includes("Windows")         ? "Windows"         :
    ua.includes("iPhone")          ? "iOS (iPhone)"    :
    ua.includes("iPad")            ? "iOS (iPad)"      :
    ua.includes("Android")         ? "Android"         :
    ua.includes("Mac OS X")        ? "macOS"           :
    ua.includes("Linux")           ? "Linux"           : "Unknown";

  return {
    os,
    screenWidth:   screen.width,
    screenHeight:  screen.height,
    colorDepth:    screen.colorDepth,
    pixelRatio:    window.devicePixelRatio || 1,
    cpuCores:      nav.hardwareConcurrency ?? "?",
    deviceMemory:  nav.deviceMemory        ?? "?",
    timezone:      Intl.DateTimeFormat().resolvedOptions().timeZone,
    tzOffset:      new Date().getTimezoneOffset(),
    touchPoints:   nav.maxTouchPoints ?? 0,
  };
}

async function getCanvasFingerprint(): Promise<{ hash: string; dataUrl: string; blocked: boolean }> {
  try {
    const cv  = document.createElement("canvas");
    cv.width  = 300; cv.height = 70;
    const ctx = cv.getContext("2d");
    if (!ctx) return { hash: "blocked", dataUrl: "", blocked: true };

    // Background gradient unique to GPU rendering
    const g = ctx.createLinearGradient(0, 0, 300, 70);
    g.addColorStop(0, "#1B2A4A"); g.addColorStop(1, "#C9A84C");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 300, 70);

    // Multi-font text (different fonts render slightly differently per GPU/OS)
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "bold 13px Arial";
    ctx.fillText("Cwm fjordbank glyphs vext quiz ☃é", 5, 20);

    ctx.font = "italic 11px 'Times New Roman'";
    ctx.fillStyle = "rgba(255,220,80,0.88)";
    ctx.fillText("Device fingerprint αβ عربي 中文", 5, 38);

    // Shapes (arc rendering varies slightly per GPU)
    ctx.beginPath();
    ctx.arc(270, 35, 22, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(100,220,120,0.45)"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.font = "10px Courier New";
    ctx.fillStyle = "rgba(200,200,255,0.7)";
    ctx.fillText(`${screen.width}x${screen.height} | tz:${new Date().getTimezoneOffset()}`, 5, 62);

    const dataUrl = cv.toDataURL("image/png");

    // Detect if canvas is being blocked (all pixels identical)
    const id = ctx.getImageData(0, 0, 300, 70);
    const allSame = id.data.every(v => v === id.data[0]);

    return { hash: toHex(fnv1a(dataUrl)), dataUrl, blocked: allSame };
  } catch {
    return { hash: "blocked", dataUrl: "", blocked: true };
  }
}

function getWebGLInfo() {
  try {
    const cv = document.createElement("canvas");
    const gl = (cv.getContext("webgl") || cv.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return { renderer: "Not supported", vendor: "N/A", extensions: 0, hash: "none", blocked: true };

    const dbg      = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const vendor   = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)   : gl.getParameter(gl.VENDOR);
    const exts     = gl.getSupportedExtensions()?.length ?? 0;

    return {
      renderer: renderer ?? "Unknown",
      vendor:   vendor   ?? "Unknown",
      extensions: exts,
      hash: toHex(fnv1a((renderer ?? "") + (vendor ?? ""))),
      blocked: false,
    };
  } catch {
    return { renderer: "Blocked", vendor: "Blocked", extensions: 0, hash: "blocked", blocked: true };
  }
}

async function getAudioFingerprint(): Promise<{ hash: string; available: boolean }> {
  try {
    const AC = window.OfflineAudioContext ?? (window as any).webkitOfflineAudioContext;
    if (!AC) return { hash: "not supported", available: false };

    const ctx  = new AC(1, 44100, 44100);
    const osc  = ctx.createOscillator();
    const comp = ctx.createDynamicsCompressor();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(10000, ctx.currentTime);
    comp.threshold.setValueAtTime(-50, ctx.currentTime);
    comp.knee.setValueAtTime(40, ctx.currentTime);
    comp.ratio.setValueAtTime(12, ctx.currentTime);
    comp.attack.setValueAtTime(0, ctx.currentTime);
    comp.release.setValueAtTime(0.25, ctx.currentTime);

    osc.connect(comp);
    comp.connect(ctx.destination);
    osc.start(0);

    const buf = await ctx.startRendering();
    const ch  = buf.getChannelData(0);
    let sum = 0;
    for (let i = 4500; i < 5000; i++) sum += Math.abs(ch[i]);

    return { hash: toHex(fnv1a(sum.toFixed(15))), available: true };
  } catch {
    return { hash: "blocked", available: false };
  }
}

const PROBE_FONTS = [
  "Arial", "Arial Black", "Arial Narrow", "Comic Sans MS", "Courier New",
  "Georgia", "Helvetica", "Impact", "Palatino Linotype", "Tahoma",
  "Times New Roman", "Trebuchet MS", "Verdana", "Calibri", "Cambria",
  "Consolas", "Garamond", "Lucida Console", "Lucida Sans Unicode",
  "Segoe UI", "Microsoft Sans Serif", "Gill Sans MT", "Franklin Gothic Medium",
  "MS Gothic", "Leelawadee UI", "Ubuntu", "DejaVu Sans", "Liberation Mono",
  "Roboto", "Open Sans",
];

function detectFonts(): string[] {
  const TEST  = "mmmmmmmmmmlli";
  const BASES = ["monospace", "sans-serif", "serif"];

  const span = document.createElement("span");
  span.style.cssText = "font-size:72px;position:absolute;left:-99999px;visibility:hidden";
  span.textContent = TEST;
  document.body.appendChild(span);

  const baseW = BASES.map(b => { span.style.fontFamily = b; return span.offsetWidth; });

  const found: string[] = [];
  for (const font of PROBE_FONTS) {
    for (let i = 0; i < BASES.length; i++) {
      span.style.fontFamily = `'${font}',${BASES[i]}`;
      if (span.offsetWidth !== baseW[i]) { found.push(font); break; }
    }
  }

  document.body.removeChild(span);
  return found;
}

function calcTrackability(
  canvas: { blocked: boolean },
  webgl: { blocked: boolean },
  audio: { available: boolean },
  fonts: string[],
  browser: ReturnType<typeof getBrowserInfo>,
  system: ReturnType<typeof getSystemInfo>
) {
  let bits = 0;

  // Canvas = most powerful signal (~14 bits)
  if (!canvas.blocked) bits += 14;

  // WebGL GPU renderer (~10 bits - GPU is very unique)
  if (!webgl.blocked) bits += 10;

  // Audio stack (~6 bits)
  if (audio.available) bits += 6;

  // Fonts: each detected font incrementally narrows the pool
  bits += Math.min(10, fonts.length * 0.35);

  // Screen resolution
  const res = `${system.screenWidth}x${system.screenHeight}`;
  const commonRes = ["1920x1080","1366x768","1280x800","1440x900","2560x1440","1536x864","1280x720"];
  bits += commonRes.includes(res) ? 3 : 5;

  // Pixel ratio (retina = less common)
  if (system.pixelRatio > 1) bits += 2;

  // Browser (Chrome is 65% of market)
  bits += browser.name === "Chrome" ? 2 : browser.name === "Safari" ? 3 : 4;

  // OS
  bits += ["Windows 10/11", "macOS"].includes(system.os) ? 2 : 4;

  // Timezone + language combo
  bits += 4;
  bits += browser.languages.length > 1 ? 3 : 2;

  // Hardware concurrency + memory
  if (system.cpuCores !== "?")  bits += 2;
  if (system.deviceMemory !== "?") bits += 2;

  // Plugins (rare = more unique)
  bits += browser.plugins > 0 ? 1 : 0;

  bits = Math.round(bits);
  const score  = Math.min(99, Math.round((bits / 55) * 100));
  // Cap display at ~1 trillion
  const oneInX = Math.min(Math.round(Math.pow(2, bits)), 999_000_000_000);

  const label =
    score >= 85 ? "Highly Trackable" :
    score >= 65 ? "Easily Trackable" :
    score >= 45 ? "Moderately Trackable" :
                  "Difficult to Track";

  return { score, bits, oneInX, label };
}

const FingerprintScan = () => {
  const [isScanning,   setIsScanning]   = useState(false);
  const [step,         setStep]         = useState("");
  const [progress,     setProgress]     = useState(0);
  const [results,      setResults]      = useState<any>(null);
  const [activeTab,    setActiveTab]    = useState("overview");
  const { saveScanResult } = useAuth();

  const handleScan = async () => {
    setIsScanning(true);
    setResults(null);
    setProgress(0);

    setStep("Reading browser info…");     setProgress(8);
    const browser = getBrowserInfo();

    setStep("Reading system info…");      setProgress(18);
    const system  = getSystemInfo();

    setStep("Rendering canvas fingerprint…"); setProgress(32);
    const canvas  = await getCanvasFingerprint();

    setStep("Querying WebGL GPU info…");  setProgress(48);
    const webgl   = getWebGLInfo();

    setStep("Probing installed fonts…");  setProgress(64);
    const fonts   = detectFonts();

    setStep("Running audio fingerprint…"); setProgress(80);
    const audio   = await getAudioFingerprint();

    setStep("Computing fingerprint hash…"); setProgress(95);

    const trackability = calcTrackability(canvas, webgl, audio, fonts, browser, system);

    // Final combined hash - the "fingerprint ID"
    const combined = [
      canvas.hash, webgl.hash, audio.hash,
      browser.userAgent, browser.languages.join(","), browser.plugins,
      `${system.screenWidth}x${system.screenHeight}`, system.colorDepth,
      system.pixelRatio, system.cpuCores, system.deviceMemory,
      system.timezone, system.tzOffset, fonts.join(","),
    ].join("|");

    const id =
      toHex(fnv1a(combined.slice(0, 200))) +
      toHex(fnv1a(combined.slice(200) || combined)) +
      toHex(fnv1a(combined.split("").reverse().join("")));

    const data = { id, browser, system, canvas, webgl, audio, fonts, trackability };
    setResults(data);

    saveScanResult("fingerprint", {
      trackabilityScore: trackability.score,
      fingerprintId: id,
      uniqueness: trackability.bits,
    });

    setStep(""); setProgress(100);
    setIsScanning(false);
  };

  const Signal = ({
    icon: Icon, label, value, bits, blocked = false,
  }: { icon: any; label: string; value: string; bits: number; blocked?: boolean }) => (
    <div className={`p-4 rounded-lg border ${blocked ? "bg-success/10 border-success/30" : "bg-muted/30 border-border/20"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${blocked ? "text-success" : "text-primary"}`} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        {blocked
          ? <span className="text-xs text-success flex items-center gap-1"><CheckCircle className="w-3 h-3" />Protected</span>
          : <span className="text-xs text-destructive flex items-center gap-1"><XCircle className="w-3 h-3" />Exposed ({bits} bits)</span>
        }
      </div>
      <p className="text-xs text-muted-foreground font-mono break-all">{value}</p>
    </div>
  );

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-5xl">

        {/* Header card */}
        <div className="glass-card p-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Monitor className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Device Fingerprint Analyzer</h1>
              <p className="text-muted-foreground text-sm">
                Real browser API signals - canvas, WebGL GPU, audio stack, fonts &amp; more
              </p>
            </div>
          </div>

          {!results && !isScanning && (
            <div className="text-center py-10">
              <Fingerprint className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Ready to Analyze</h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                We'll collect real signals from your browser - canvas rendering, GPU info, installed fonts,
                audio stack - and compute how uniquely identifiable you are online.
              </p>
              <button onClick={handleScan} className="btn-primary inline-flex items-center gap-2">
                <Fingerprint className="w-5 h-5" /> Analyze My Device
              </button>
            </div>
          )}

          {isScanning && (
            <div className="py-8 animate-fade-in">
              <div className="flex items-center justify-center mb-6">
                <div className="w-14 h-14 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
              <p className="text-center text-sm text-muted-foreground mb-4 animate-pulse">{step}</p>
              <div className="max-w-md mx-auto">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Collecting signals</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {results && (
          <div className="space-y-6 animate-fade-in">

            {/* Score + ID */}
            <div className="glass-card p-8">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <RiskGauge score={results.trackability.score} size="lg" label="Trackability" />
                <div className="flex-1 text-center md:text-left space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Your Fingerprint ID</p>
                    <p className="font-mono text-lg font-bold tracking-wider text-primary break-all">
                      {results.id}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This hash is computed entirely in your browser - nothing is sent to any server.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="p-3 rounded-lg bg-primary/10 text-center min-w-[90px]">
                      <p className="font-bold text-primary">{results.trackability.bits}</p>
                      <p className="text-xs text-muted-foreground">entropy bits</p>
                    </div>
                    <div className="p-3 rounded-lg bg-destructive/10 text-center min-w-[90px]">
                      <p className="font-bold text-destructive">
                        1 in {results.trackability.oneInX >= 1_000_000_000
                          ? `${(results.trackability.oneInX / 1_000_000_000).toFixed(0)}B`
                          : results.trackability.oneInX >= 1_000_000
                          ? `${(results.trackability.oneInX / 1_000_000).toFixed(0)}M`
                          : results.trackability.oneInX.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">devices</p>
                    </div>
                    <div className="p-3 rounded-lg bg-warning/10 text-center min-w-[90px]">
                      <p className="font-bold text-warning">{results.fonts.length}</p>
                      <p className="text-xs text-muted-foreground">fonts detected</p>
                    </div>
                  </div>
                  <span className={`inline-block text-sm font-semibold px-3 py-1 rounded-full ${
                    results.trackability.score >= 85 ? "bg-destructive/20 text-destructive" :
                    results.trackability.score >= 65 ? "bg-warning/20 text-warning" :
                    "bg-success/20 text-success"
                  }`}>
                    {results.trackability.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Canvas fingerprint image */}
            {results.canvas.dataUrl && !results.canvas.blocked && (
              <div className="glass-card p-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-primary" />
                  Canvas Fingerprint
                  <span className="ml-auto text-xs font-mono text-muted-foreground">
                    hash: {results.canvas.hash}
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  This image is rendered by your GPU. Pixel-level differences in text rendering, anti-aliasing,
                  and color blending make it uniquely identifiable - even across incognito sessions.
                </p>
                <img
                  src={results.canvas.dataUrl}
                  alt="canvas fingerprint"
                  className="rounded-lg border border-border/30 w-full max-w-sm"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
            )}
            {results.canvas.blocked && (
              <div className="glass-card p-6 border border-success/30">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <div>
                    <p className="font-semibold text-success text-sm">Canvas Fingerprinting Blocked</p>
                    <p className="text-xs text-muted-foreground">Your browser is randomizing canvas output - good privacy posture.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {["overview", "browser", "system", "fonts"].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Overview tab */}
            {activeTab === "overview" && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Signal Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Signal icon={Palette} label="Canvas Fingerprint"
                    value={results.canvas.blocked ? "Blocked by browser" : results.canvas.hash}
                    bits={14} blocked={results.canvas.blocked} />
                  <Signal icon={Monitor} label="WebGL GPU Renderer"
                    value={results.webgl.blocked ? "Blocked" : results.webgl.renderer}
                    bits={10} blocked={results.webgl.blocked} />
                  <Signal icon={Music} label="Audio Fingerprint"
                    value={results.audio.available ? results.audio.hash : "Not available"}
                    bits={6} blocked={!results.audio.available} />
                  <Signal icon={Type} label="Font Enumeration"
                    value={`${results.fonts.length} of ${PROBE_FONTS.length} fonts detected`}
                    bits={Math.round(Math.min(10, results.fonts.length * 0.35))} />
                  <Signal icon={Globe} label="Language + Timezone"
                    value={`${results.browser.languages.join(", ")} / ${results.system.timezone}`}
                    bits={7} />
                  <Signal icon={Cpu} label="Hardware Fingerprint"
                    value={`${results.system.cpuCores} cores · ${results.system.deviceMemory}GB RAM · ${results.system.screenWidth}×${results.system.screenHeight}`}
                    bits={6} />
                </div>

                {/* Recommendations */}
                <div className="glass-card p-6 mt-2">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-primary" /> How to Reduce Your Fingerprint
                  </h3>
                  <div className="space-y-2">
                    {[
                      { text: "Use Brave Browser - randomizes canvas & WebGL per site", eff: 90, easy: true },
                      { text: "Enable Firefox fingerprinting protection (privacy.resistFingerprinting)", eff: 85, easy: true },
                      { text: "Use Tor Browser - all users share the same fingerprint", eff: 99, easy: false },
                      { text: "Install Canvas Blocker extension (Firefox/Chrome)", eff: 70, easy: true },
                      { text: "Use a VM or separate browser profile per site", eff: 80, easy: false },
                    ].map((r, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{r.text}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${r.easy ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                              {r.easy ? "Easy" : "Advanced"}
                            </span>
                            <span className="text-xs text-muted-foreground">{r.eff}% effective</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Browser tab */}
            {activeTab === "browser" && (
              <div className="glass-card p-6 animate-fade-in">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" /> Browser Details
                </h3>
                <div className="space-y-3">
                  {[
                    ["Browser",         `${results.browser.name} ${results.browser.version}`],
                    ["Platform",        results.browser.platform],
                    ["Languages",       results.browser.languages.join(", ")],
                    ["Plugins",         `${results.browser.plugins} installed`],
                    ["Cookies",         results.browser.cookiesEnabled ? "Enabled" : "Disabled"],
                    ["Do Not Track",    results.browser.doNotTrack === "1" ? "Enabled" : "Not set"],
                    ["WebGL hash",      results.webgl.hash],
                    ["WebGL renderer",  results.webgl.renderer],
                    ["WebGL vendor",    results.webgl.vendor],
                    ["WebGL extensions",`${results.webgl.extensions}`],
                    ["Audio hash",      results.audio.hash],
                    ["Canvas hash",     results.canvas.hash],
                  ].map(([label, val]) => (
                    <div key={label} className="flex items-start justify-between gap-4 py-2 border-b border-border/20 last:border-0">
                      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
                      <span className="text-sm font-mono text-right break-all">{val}</span>
                    </div>
                  ))}
                  <div className="pt-2">
                    <span className="text-sm text-muted-foreground block mb-1">User-Agent</span>
                    <p className="text-xs font-mono bg-muted/30 p-2 rounded break-all">{results.browser.userAgent}</p>
                  </div>
                </div>
              </div>
            )}

            {/* System tab */}
            {activeTab === "system" && (
              <div className="glass-card p-6 animate-fade-in">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-primary" /> System Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    ["Operating System",   results.system.os],
                    ["Screen Resolution",  `${results.system.screenWidth} × ${results.system.screenHeight}`],
                    ["Color Depth",        `${results.system.colorDepth}-bit`],
                    ["Pixel Ratio",        `${results.system.pixelRatio}x (${results.system.pixelRatio > 1 ? "Retina/HiDPI" : "Standard"})`],
                    ["CPU Cores",          `${results.system.cpuCores}`],
                    ["Device Memory",      results.system.deviceMemory === "?" ? "Not disclosed" : `${results.system.deviceMemory} GB`],
                    ["Timezone",           results.system.timezone],
                    ["UTC Offset",         `UTC ${results.system.tzOffset <= 0 ? "+" : ""}${-results.system.tzOffset / 60}h`],
                    ["Touch Points",       results.system.touchPoints > 0 ? `${results.system.touchPoints} (touch device)` : "None (desktop)"],
                  ].map(([label, val]) => (
                    <div key={label} className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fonts tab */}
            {activeTab === "fonts" && (
              <div className="glass-card p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Type className="w-5 h-5 text-primary" /> Installed Fonts
                  </h3>
                  <span className="text-sm text-muted-foreground">
                    {results.fonts.length} detected of {PROBE_FONTS.length} probed
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Font detection works by measuring text width - if a font is installed, the rendered width
                  differs from the fallback. More fonts = more unique fingerprint.
                </p>
                <div className="flex flex-wrap gap-2">
                  {PROBE_FONTS.map(font => {
                    const found = results.fonts.includes(font);
                    return (
                      <span key={font}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                          found
                            ? "bg-destructive/10 border border-destructive/20 text-destructive"
                            : "bg-muted/30 border border-border/20 text-muted-foreground"
                        }`}
                        style={found ? { fontFamily: font } : {}}
                      >
                        {found ? <Eye className="w-3 h-3" /> : <XCircle className="w-3 h-3 opacity-40" />}
                        {font}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Re-analyze */}
            <div className="text-center pb-4">
              <button onClick={handleScan} className="btn-secondary inline-flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Re-analyze Device
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default FingerprintScan;

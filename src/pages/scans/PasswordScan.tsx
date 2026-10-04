import { useState, useEffect } from "react";
import {
  Key, Eye, EyeOff, RefreshCw, Copy, Check,
  AlertTriangle, Shield, XCircle, Loader2, Lock,
} from "lucide-react";
import ProgressBar from "@/components/common/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";

const COMMON = new Set([
  "password","123456","123456789","qwerty","abc123","password1","iloveyou",
  "admin","welcome","monkey","1234567890","password123","princess","sunshine",
  "12345678","dragon","master","letmein","login","hello","charlie","donald",
  "qwerty123","111111","654321","superman","batman","football","baseball","soccer",
  "letmein1","welcome1","password2","pass","pass123","admin123","root","test",
  "user","guest","000000","696969","555555","666666","777777","888888","999999",
  "112233","123321","123123","12341234","1q2w3e4r","qazwsx","zxcvbnm","asdfgh",
  "asdfghjkl","trustno1","shadow","michael","jennifer","thomas","robert","jessica",
  "emily","andrew","joshua","mustang","butterfly","chocolate","summer","winter",
  "spring","autumn","flower","lovely","baseball1","football1","soccer1","matrix",
  "starwars","pokemon","minecraft","google","amazon","facebook","twitter","instagram",
  "hunter","hunter2","1password","p@ssword","p@$$w0rd","passw0rd","pa$$word",
  "qwerty1","abc1234","password!","iloveyou1","admin1234","pass1234","user1234",
  "test1234","hello123","welcome123","mypassword","mypassword1","newpassword",
  "changeme","changeme1","default","rootroot","adminadmin","aaaaaa","bbbbbb",
  "zzzzzz","000000000","11111111","22222222","33333333","44444444","55555555",
  "99999999","12121212","13131313","qqqqqqqq","aaaaaaaa","password0","pa55word",
]);

async function sha1Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("").toUpperCase();
}

async function checkHIBP(password: string): Promise<number> {
  const hash   = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const res    = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { "Add-Padding": "true" },
  });
  if (!res.ok) throw new Error("HIBP unavailable");
  const text  = await res.text();
  const match = text.split("\r\n").find(l => l.startsWith(suffix));
  return match ? parseInt(match.split(":")[1], 10) : 0;
}

function deLeet(s: string): string {
  return s.toLowerCase()
    .replace(/@/g, "a").replace(/4/g, "a")
    .replace(/0/g, "o")
    .replace(/3/g, "e")
    .replace(/1/g, "i").replace(/!/g, "i")
    .replace(/\$/g, "s").replace(/5/g, "s")
    .replace(/7/g, "t").replace(/\+/g, "t")
    .replace(/8/g, "b")
    .replace(/6/g, "g")
    .replace(/9/g, "g");
}

function isLeetOfCommon(pwd: string): boolean {
  const decoded = deLeet(pwd);
  if (COMMON.has(decoded)) return true;
  // Strip all non-alpha and check
  if (COMMON.has(decoded.replace(/[^a-z]/g, ""))) return true;
  // Check if it starts with a very common root after de-leeting
  const roots = ["password","qwerty","admin","welcome","letmein","monkey",
                 "dragon","master","shadow","sunshine","princess","football",
                 "baseball","soccer","batman","superman","michael","charlie"];
  return roots.some(r => decoded.startsWith(r) || decoded.endsWith(r));
}

function hasSequential(pwd: string): boolean {
  const s = pwd.toLowerCase();
  const seqs = [
    "abcdefghijklmnopqrstuvwxyz", "zyxwvutsrqponmlkjihgfedcba",
    "0123456789", "9876543210",
    "qwertyuiop", "poiuytrewq",
    "asdfghjkl",  "lkjhgfdsa",
    "zxcvbnm",    "mnbvcxz",
  ];
  return seqs.some(seq => {
    for (let i = 0; i <= seq.length - 3; i++) {
      if (s.includes(seq.slice(i, i + 3))) return true;
    }
    return false;
  });
}

function hasKeyboardWalk(pwd: string): boolean {
  // 4+ consecutive keys in any keyboard row/column
  const rows = [
    "qwertyuiop","asdfghjkl","zxcvbnm","1234567890",
    "poiuytrewq","lkjhgfdsa","mnbvcxz","0987654321",
    "qazwsxedcrfvtgbyhnujmik", // diagonals
    "1qaz2wsx3edc4rfv5tgb6yhn7ujm8ik9ol0p",
  ];
  const s = pwd.toLowerCase();
  return rows.some(row => {
    for (let i = 0; i <= row.length - 4; i++) {
      if (s.includes(row.slice(i, i + 4))) return true;
    }
    return false;
  });
}

function hasRepeatingBlock(pwd: string): boolean {
  const len = pwd.length;
  for (let bLen = 1; bLen <= Math.floor(len / 2); bLen++) {
    const block = pwd.slice(0, bLen);
    const re = new RegExp(
      `(${block.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}){2,}`,
      "i"
    );
    const m = pwd.match(re);
    if (m && m[0].length >= len * 0.6) return true;
  }
  return false;
}

function hasDatePattern(pwd: string): boolean {
  if (/(19[0-9]{2}|20[0-2][0-9]|2030)/.test(pwd)) return true;
  if (/\d{2}[\/\-\.]\d{2}/.test(pwd)) return true;
  return false;
}

function calcEntropy(pwd: string): number {
  let pool = 0;
  if (/[a-z]/.test(pwd)) pool += 26;
  if (/[A-Z]/.test(pwd)) pool += 26;
  if (/[0-9]/.test(pwd)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pwd)) pool += 32;
  return pool > 0 ? Math.log2(Math.pow(pool, pwd.length)) : 0;
}

function entropyToCrackTime(entropy: number): string {
  const seconds = Math.pow(2, entropy) / 1e10;
  if (seconds < 1)              return "Instantly";
  if (seconds < 60)             return `${Math.round(seconds)}s`;
  if (seconds < 3600)           return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400)          return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 2_592_000)      return `${Math.round(seconds / 86400)} days`;
  if (seconds < 31_536_000)     return `${Math.round(seconds / 2_592_000)} months`;
  if (seconds < 3_153_600_000)  return `${Math.round(seconds / 31_536_000)} years`;
  return "Centuries+";
}

function analyzePassword(pwd: string) {
  const len         = pwd.length;
  const lower       = pwd.toLowerCase();
  const hasUpper    = /[A-Z]/.test(pwd);
  const hasLower    = /[a-z]/.test(pwd);
  const hasDigit    = /[0-9]/.test(pwd);
  const hasSym      = /[^a-zA-Z0-9]/.test(pwd);
  const upperCount  = (pwd.match(/[A-Z]/g) || []).length;
  const digitCount  = (pwd.match(/[0-9]/g) || []).length;
  const symCount    = (pwd.match(/[^a-zA-Z0-9]/g) || []).length;
  const uniqueCount = new Set(pwd).size;
  const classCount  = [hasUpper, hasLower, hasDigit, hasSym].filter(Boolean).length;

  // Pattern checks
  const isCommon      = COMMON.has(lower) || COMMON.has(lower.replace(/[^a-z0-9]/g, ""));
  const isLeeted      = !isCommon && isLeetOfCommon(pwd);
  const allSameChar   = uniqueCount === 1;
  const repeatChars   = /(.)\1{2,}/.test(pwd);           // aaa, 111
  const seqPattern    = hasSequential(pwd);
  const kbPattern     = hasKeyboardWalk(pwd);
  const datePattern   = hasDatePattern(pwd);
  const repeatBlock   = hasRepeatingBlock(pwd);
  const lowDiversity  = len >= 6 && uniqueCount / len < 0.3;

  let score = 0;

  // 1. Length (primary factor - max 60 pts)
  if      (len >= 20) score += 60;
  else if (len >= 16) score += 50;
  else if (len >= 12) score += 38;
  else if (len >= 10) score += 28;
  else if (len >= 8)  score += 18;
  else if (len >= 6)  score += 8;

  // 2. Character variety (max 33 pts)
  if (hasLower)  score += 5;
  if (hasUpper)  score += 5;
  if (hasDigit)  score += 5;
  if (hasSym)    score += 10;
  if (classCount === 4) score += 5;   // all-four-types bonus
  if (symCount  >= 2)   score += 3;
  if (digitCount >= 3)  score += 2;
  if (upperCount >= 2)  score += 2;

  // 3. Diversity bonus
  if (uniqueCount >= Math.ceil(len * 0.75) && len >= 8) score += 5;

  if (allSameChar)              score = Math.min(score, 2);   // aaaaaaa
  if (isCommon)                 score = Math.min(score, 5);   // top common list
  if (isLeeted)                 score = Math.min(score, Math.max(score - 25, 8)); // p@ssw0rd
  if (classCount === 1)         score -= 15;   // only one char type
  if (!hasSym && !hasDigit && len < 16) score -= 8;   // all letters, short
  if (len < 8)                  score -= 20;   // too short
  if (len < 6)                  score -= 10;   // extra penalty
  if (repeatChars)              score -= 10;   // aaa, 111
  if (seqPattern)               score -= 10;   // abc, 123
  if (kbPattern)                score -= 15;   // qwerty walk
  if (datePattern)              score -= 8;    // 1990, 2024
  if (repeatBlock)              score -= 10;   // abcabc
  if (lowDiversity)             score -= 15;   // too many duplicate chars

  score = Math.max(0, Math.min(100, score));

  // Grade
  const grade =
    score >= 90 ? "Very Strong" :
    score >= 75 ? "Strong"      :
    score >= 55 ? "Good"        :
    score >= 35 ? "Fair"        :
    score >= 15 ? "Weak"        :
                  "Very Weak";

  // Crack time uses raw entropy (conservative estimate)
  const entropy = calcEntropy(pwd);
  // Apply effective reduction for patterns
  const effectiveEntropy = isCommon ? 10 : allSameChar ? 5 :
    entropy * (isLeeted ? 0.4 : 1) * (seqPattern ? 0.6 : 1) *
    (kbPattern ? 0.5 : 1) * (repeatChars ? 0.7 : 1);

  const crackTime = entropyToCrackTime(effectiveEntropy);

  const checks = {
    length:    { valid: len >= 12,     label: "Length", message: `${len} characters - ${len >= 16 ? "Excellent" : len >= 12 ? "Good" : len >= 8 ? "Minimum" : "Too short"}` },
    uppercase: { valid: hasUpper,      label: "Uppercase", message: hasUpper  ? "Contains uppercase letters"        : "Add uppercase letters (A–Z)" },
    lowercase: { valid: hasLower,      label: "Lowercase", message: hasLower  ? "Contains lowercase letters"        : "Add lowercase letters (a–z)" },
    numbers:   { valid: hasDigit,      label: "Numbers",   message: hasDigit  ? "Contains numbers"                  : "Add numbers (0–9)" },
    symbols:   { valid: hasSym,        label: "Symbols",   message: hasSym    ? "Contains special symbols"          : "Add special symbols (!@#$…)" },
    notCommon: { valid: !isCommon,     label: "Not common",message: !isCommon ? "Not a common password"             : "This is one of the most common passwords" },
    notLeeted: { valid: !isLeeted,     label: "No leet",   message: !isLeeted ? "No simple letter substitutions"    : "Avoid obvious substitutions (@ for a, 0 for o)" },
    noRepeat:  { valid: !repeatChars,  label: "No repeats",message: !repeatChars  ? "No repeated characters"        : "Avoid repeated characters (aaa, 111)" },
    noPattern: { valid: !seqPattern && !kbPattern, label: "No patterns", message: (!seqPattern && !kbPattern) ? "No sequential or keyboard patterns" : "Avoid sequences (abc, 123) and keyboard walks (qwerty)" },
    diversity: { valid: uniqueCount >= Math.ceil(len * 0.6) && len >= 6, label: "Diversity", message: (uniqueCount >= Math.ceil(len * 0.6) || len < 6) ? "Good character diversity" : "Too many repeated characters - use more variety" },
  };

  return { strength: score, grade, crackTime, entropy: Math.round(entropy), checks };
}

const PasswordScan = () => {
  const [password,    setPassword]    = useState("");
  const [showPwd,     setShowPwd]     = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [isChecking,  setIsChecking]  = useState(false);
  const [analysis,    setAnalysis]    = useState<ReturnType<typeof analyzePassword> | null>(null);
  const [breachCount, setBreachCount] = useState<number | null>(null);
  const [breachError, setBreachError] = useState(false);
  const { saveScanResult } = useAuth();

  const [genSettings, setGenSettings] = useState({
    length: 16, uppercase: true, lowercase: true, numbers: true, symbols: true,
  });

  useEffect(() => {
    if (password) {
      setAnalysis(analyzePassword(password));
      setBreachCount(null);
      setBreachError(false);
    } else {
      setAnalysis(null);
      setBreachCount(null);
    }
  }, [password]);

  const handleBreachCheck = async () => {
    if (!password || !analysis) return;
    setIsChecking(true);
    setBreachError(false);
    try {
      const count = await checkHIBP(password);
      setBreachCount(count);
      saveScanResult("password", {
        strength:    analysis.strength,
        grade:       analysis.grade,
        leaked:      count > 0,
        breachCount: count,
      });
    } catch {
      setBreachError(true);
    } finally {
      setIsChecking(false);
    }
  };

  const generatePassword = () => {
    const chars = {
      uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      lowercase: "abcdefghijklmnopqrstuvwxyz",
      numbers:   "0123456789",
      symbols:   "!@#$%^&*()-_=+[]{}|;:,.<>?",
    };
    let charset = "";
    if (genSettings.uppercase) charset += chars.uppercase;
    if (genSettings.lowercase) charset += chars.lowercase;
    if (genSettings.numbers)   charset += chars.numbers;
    if (genSettings.symbols)   charset += chars.symbols;
    if (!charset) charset = chars.lowercase + chars.numbers;

    const arr = new Uint32Array(genSettings.length);
    crypto.getRandomValues(arr);
    setPassword(Array.from(arr).map(n => charset[n % charset.length]).join(""));
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const gradeColor = (grade: string) => {
    switch (grade) {
      case "Very Strong": return "text-emerald-500";
      case "Strong":      return "text-green-500";
      case "Good":        return "text-primary";
      case "Fair":        return "text-warning";
      case "Weak":        return "text-orange-500";
      default:            return "text-destructive";
    }
  };

  const strengthBarColor = (): "destructive" | "warning" | "primary" | "success" | "auto" => {
    if (!analysis) return "primary";
    if (analysis.strength >= 75) return "success";
    if (analysis.strength >= 55) return "primary";
    if (analysis.strength >= 35) return "warning";
    return "destructive";
  };

  // 5-segment visual bar
  const segments = analysis
    ? [1, 2, 3, 4, 5].map(seg => {
        const filled = analysis.strength >= seg * 20 - 10;
        const color =
          analysis.strength >= 75 ? "bg-green-500" :
          analysis.strength >= 55 ? "bg-primary"   :
          analysis.strength >= 35 ? "bg-yellow-500":
          analysis.strength >= 15 ? "bg-orange-500": "bg-destructive";
        return { filled, color };
      })
    : [];

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Left panel ── */}
          <div className="space-y-6">
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Key className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Password Security Analyzer</h1>
                  <p className="text-muted-foreground text-sm">
                    Multi-factor strength analysis · HIBP breach database · 1B+ leaked passwords
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Enter Password to Analyze</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter a password to test"
                      className="input-cyber w-full pl-12 pr-24 font-mono"
                      autoComplete="new-password"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <button onClick={() => setShowPwd(!showPwd)}
                        className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        {showPwd
                          ? <EyeOff className="w-4 h-4 text-muted-foreground" />
                          : <Eye    className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      {password && (
                        <button onClick={copyPassword}
                          className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          {copied
                            ? <Check className="w-4 h-4 text-success" />
                            : <Copy  className="w-4 h-4 text-muted-foreground" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <button onClick={handleBreachCheck}
                  disabled={isChecking || !password}
                  className="btn-primary w-full flex items-center justify-center gap-2">
                  {isChecking ? (
                    <><Loader2 className="w-5 h-5 animate-spin" />Checking 1B+ breached passwords…</>
                  ) : (
                    <><Shield className="w-5 h-5" />Check Breach Databases</>
                  )}
                </button>

                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground flex items-start gap-2">
                    <Lock className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <span>
                      <span className="text-success font-medium">Privacy-safe:</span> all strength
                      analysis is 100% local. Breach check uses k-anonymity - only the first 5 chars
                      of a SHA-1 hash are sent, never your actual password.
                    </span>
                  </p>
                </div>
              </div>

              {/* Generator */}
              <div className="mt-8 pt-6 border-t border-border/30">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-primary" />
                  Password Generator
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Length: <span className="font-semibold">{genSettings.length}</span></span>
                      <span className="text-muted-foreground text-xs">
                        {genSettings.length >= 20 ? "Excellent" : genSettings.length >= 16 ? "Recommended" : genSettings.length >= 12 ? "Good" : "Minimum"}
                      </span>
                    </div>
                    <input type="range" min={8} max={64} value={genSettings.length}
                      onChange={e => setGenSettings({ ...genSettings, length: +e.target.value })}
                      className="w-full accent-primary" />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {(["uppercase","lowercase","numbers","symbols"] as const).map(type => (
                      <label key={type}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          genSettings[type] ? "bg-primary/20 border border-primary/30" : "bg-muted/30 border border-border/30"
                        }`}>
                        <input type="checkbox" checked={genSettings[type]}
                          onChange={e => setGenSettings({ ...genSettings, [type]: e.target.checked })}
                          className="sr-only" />
                        <span className="text-sm capitalize">{type}</span>
                      </label>
                    ))}
                  </div>
                  <button onClick={generatePassword}
                    className="btn-secondary w-full flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Generate Secure Password
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right panel ── */}
          {!analysis ? (
            <div className="flex items-center justify-center">
              <div className="text-center glass-card p-12 w-full">
                <Key className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Enter a Password</h3>
                <p className="text-muted-foreground">
                  Type or generate a password to see real-time strength analysis, pattern detection,
                  and breach lookup against 1 billion+ leaked passwords.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">

              {/* Strength meter */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-6">Password Strength</h2>

                {/* Grade + segments */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-2xl font-bold ${gradeColor(analysis.grade)}`}>
                    {analysis.grade}
                  </span>
                  <span className="text-sm text-muted-foreground">{analysis.strength}%</span>
                </div>

                {/* Segmented bar */}
                <div className="flex gap-1.5 mb-4">
                  {segments.map((seg, i) => (
                    <div key={i}
                      className={`h-2.5 flex-1 rounded-full transition-all duration-300 ${
                        seg.filled ? seg.color : "bg-muted/50"
                      }`}
                    />
                  ))}
                </div>

                {/* Breach result */}
                {breachCount !== null && (
                  breachCount > 0 ? (
                    <div className="p-4 mb-4 rounded-lg bg-destructive/20 border border-destructive/30 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <p className="text-destructive font-semibold text-sm">Found in breach databases</p>
                        <p className="text-destructive/80 text-xs mt-0.5">
                          Seen <span className="font-bold">{breachCount.toLocaleString()}</span> times in leaked data. Do not use this password.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 mb-4 rounded-lg bg-success/10 border border-success/30 flex items-center gap-3">
                      <Shield className="w-5 h-5 text-success shrink-0" />
                      <p className="text-success font-semibold text-sm">Not found in any known breach database</p>
                    </div>
                  )
                )}

                {breachError && (
                  <div className="p-3 mb-3 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning">
                    Could not reach HIBP - check your internet connection and try again.
                  </div>
                )}

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Crack Time</p>
                    <p className="font-semibold text-sm mt-0.5">{analysis.crackTime}</p>
                    <p className="text-xs text-muted-foreground">@ 10¹⁰/sec</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Entropy</p>
                    <p className="font-semibold text-sm mt-0.5">{analysis.entropy} bits</p>
                    <p className="text-xs text-muted-foreground">raw character pool</p>
                  </div>
                </div>
              </div>

              {/* Strength breakdown */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4">Strength Breakdown</h2>
                <div className="space-y-2">
                  {Object.entries(analysis.checks).map(([key, val]) => (
                    <div key={key}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        val.valid
                          ? "bg-success/10 border border-success/20"
                          : "bg-destructive/10 border border-destructive/20"
                      }`}>
                      {val.valid
                        ? <Shield  className="w-4 h-4 text-success shrink-0" />
                        : <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm">{val.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Best practices */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4">Best Practices</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    "Use at least 16 characters",
                    "Mix all 4 character types",
                    "Avoid common words & patterns",
                    "Never reuse passwords",
                    "Use a password manager",
                    "Enable two-factor authentication",
                    "Change after any breach alert",
                    "Use passphrases for memorability",
                  ].map((tip, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      {tip}
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

export default PasswordScan;

import { useState } from "react";
import {
  UserSearch, Search, ExternalLink, CheckCircle, XCircle,
  Loader2, AlertTriangle, HelpCircle, Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface CheckResult {
  found: boolean;
  detail?: string;
  link?: string;
  error?: boolean;
}

const LIVE_PLATFORMS: {
  name: string;
  category: string;
  emoji: string;
  check: (u: string) => Promise<CheckResult>;
}[] = [
  {
    name: "GitHub",
    category: "Developer",
    emoji: "🐙",
    check: async (u) => {
      try {
        const r = await fetch(`https://api.github.com/users/${encodeURIComponent(u)}`);
        if (r.status === 404) return { found: false };
        if (!r.ok) return { found: false, error: true };
        const d = await r.json();
        return {
          found: true,
          detail: `${d.public_repos} repos · ${d.followers} followers`,
          link: d.html_url,
        };
      } catch { return { found: false, error: true }; }
    },
  },
  {
    name: "Reddit",
    category: "Social",
    emoji: "🤖",
    check: async (u) => {
      try {
        const r = await fetch(`https://www.reddit.com/user/${encodeURIComponent(u)}/about.json`, {
          headers: { Accept: "application/json" },
        });
        if (r.status === 404) return { found: false };
        if (!r.ok) return { found: false, error: true };
        const d = await r.json();
        const karma = (d.data?.link_karma ?? 0) + (d.data?.comment_karma ?? 0);
        return {
          found: true,
          detail: `${karma.toLocaleString()} karma`,
          link: `https://reddit.com/u/${u}`,
        };
      } catch { return { found: false, error: true }; }
    },
  },
  {
    name: "GitLab",
    category: "Developer",
    emoji: "🦊",
    check: async (u) => {
      try {
        const r = await fetch(`https://gitlab.com/api/v4/users?username=${encodeURIComponent(u)}`);
        if (!r.ok) return { found: false, error: true };
        const d = await r.json();
        if (!Array.isArray(d) || d.length === 0) return { found: false };
        return {
          found: true,
          detail: d[0].name || u,
          link: `https://gitlab.com/${u}`,
        };
      } catch { return { found: false, error: true }; }
    },
  },
  {
    name: "HackerNews",
    category: "Developer",
    emoji: "🟠",
    check: async (u) => {
      try {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(u)}.json`);
        if (!r.ok) return { found: false, error: true };
        const d = await r.json();
        if (!d) return { found: false };
        return {
          found: true,
          detail: `${d.karma?.toLocaleString() ?? 0} karma`,
          link: `https://news.ycombinator.com/user?id=${u}`,
        };
      } catch { return { found: false, error: true }; }
    },
  },
  {
    name: "DEV.to",
    category: "Developer",
    emoji: "👩‍💻",
    check: async (u) => {
      try {
        const r = await fetch(`https://dev.to/api/users/by_username?url=${encodeURIComponent(u)}`);
        if (r.status === 404) return { found: false };
        if (!r.ok) return { found: false, error: true };
        const d = await r.json();
        return {
          found: true,
          detail: `${d.comments_count ?? 0} comments`,
          link: `https://dev.to/${u}`,
        };
      } catch { return { found: false, error: true }; }
    },
  },
  {
    name: "npm",
    category: "Developer",
    emoji: "📦",
    check: async (u) => {
      try {
        const r = await fetch(`https://registry.npmjs.org/-/v1/search?text=maintainer:${encodeURIComponent(u)}&size=1`);
        if (!r.ok) return { found: false, error: true };
        const d = await r.json();
        const count = d.total ?? 0;
        if (count === 0) return { found: false };
        return {
          found: true,
          detail: `${count} package${count !== 1 ? "s" : ""} published`,
          link: `https://www.npmjs.com/~${u}`,
        };
      } catch { return { found: false, error: true }; }
    },
  },
];

const MANUAL_PLATFORMS: { name: string; category: string; emoji: string; url: (u: string) => string }[] = [
  { name: "Twitter / X",  category: "Social",        emoji: "🐦", url: u => `https://x.com/${u}` },
  { name: "Instagram",    category: "Social",        emoji: "📸", url: u => `https://instagram.com/${u}` },
  { name: "TikTok",       category: "Social",        emoji: "🎵", url: u => `https://tiktok.com/@${u}` },
  { name: "Facebook",     category: "Social",        emoji: "👤", url: u => `https://facebook.com/${u}` },
  { name: "YouTube",      category: "Social",        emoji: "▶️", url: u => `https://youtube.com/@${u}` },
  { name: "LinkedIn",     category: "Professional",  emoji: "💼", url: u => `https://linkedin.com/in/${u}` },
  { name: "Pinterest",    category: "Social",        emoji: "📌", url: u => `https://pinterest.com/${u}` },
  { name: "Twitch",       category: "Gaming",        emoji: "🎮", url: u => `https://twitch.tv/${u}` },
  { name: "Steam",        category: "Gaming",        emoji: "🕹️", url: u => `https://steamcommunity.com/id/${u}` },
  { name: "Medium",       category: "Professional",  emoji: "✍️",  url: u => `https://medium.com/@${u}` },
  { name: "Behance",      category: "Professional",  emoji: "🎨", url: u => `https://behance.net/${u}` },
  { name: "Mastodon",     category: "Social",        emoji: "🦣", url: u => `https://mastodon.social/@${u}` },
  { name: "Spotify",      category: "Music",         emoji: "🎧", url: u => `https://open.spotify.com/user/${u}` },
];

const UsernameScan = () => {
  const [username, setUsername]     = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [liveResults, setLiveResults]     = useState<{ name: string; category: string; emoji: string; result: CheckResult | null }[]>([]);
  const [manualLinks, setManualLinks]     = useState<typeof MANUAL_PLATFORMS>([]);
  const [done, setDone]             = useState(false);
  const { saveScanResult } = useAuth();

  const handleScan = async () => {
    if (!username.trim()) return;
    const u = username.trim();

    setIsScanning(true);
    setDone(false);
    setLiveResults([]);
    setManualLinks([]);

    // Init live results as "pending"
    setLiveResults(LIVE_PLATFORMS.map(p => ({ name: p.name, category: p.category, emoji: p.emoji, result: null })));

    // Run all real checks in parallel, update each as it resolves
    const checks = LIVE_PLATFORMS.map(async (p, idx) => {
      setScanStatus(`Checking ${p.name}…`);
      const result = await p.check(u);
      setLiveResults(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], result };
        return next;
      });
      return result;
    });

    const results = await Promise.allSettled(checks);

    // Count real finds
    const foundCount = results.filter(
      r => r.status === "fulfilled" && r.value.found
    ).length;

    setManualLinks(MANUAL_PLATFORMS);

    saveScanResult("username", {
      username: u,
      platformsFound: foundCount,
      totalPlatforms: LIVE_PLATFORMS.length + MANUAL_PLATFORMS.length,
    });

    setScanStatus("");
    setIsScanning(false);
    setDone(true);
  };

  const foundCount  = liveResults.filter(r => r.result?.found).length;
  const checkedCount = liveResults.filter(r => r.result !== null).length;

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left panel ── */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <UserSearch className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Username Footprint</h1>
                  <p className="text-muted-foreground text-sm">
                    Live API checks + manual verify links
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Username</label>
                  <div className="relative">
                    <UserSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleScan()}
                      placeholder="Enter a username"
                      className="input-cyber w-full pl-12"
                    />
                  </div>
                </div>

                <button
                  onClick={handleScan}
                  disabled={isScanning || !username.trim()}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {isScanning ? (
                    <><Loader2 className="w-5 h-5 animate-spin" />Searching…</>
                  ) : (
                    <><Search className="w-5 h-5" />Search Username</>
                  )}
                </button>

                {isScanning && scanStatus && (
                  <p className="text-xs text-center text-muted-foreground animate-pulse">{scanStatus}</p>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="glass-card p-5 space-y-3">
              <h3 className="font-semibold text-sm">How it works</h3>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Zap className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <span><span className="text-success font-medium">Live check</span> - real API call, definitive result</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <HelpCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <span><span className="text-warning font-medium">Manual verify</span> - click to open the profile URL and check yourself (these platforms block browser-side requests)</span>
              </div>
            </div>

            {/* Summary */}
            {done && (
              <div className="glass-card p-5 animate-fade-in space-y-3">
                <h3 className="font-semibold text-sm">Live Check Summary</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Found on</span>
                  <span className="font-bold text-primary">{foundCount} / {checkedCount} platforms</span>
                </div>
                {foundCount > 0 && (
                  <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                    <p className="text-xs text-warning flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      This username can be linked across {foundCount} platform{foundCount !== 1 ? "s" : ""} to build a profile.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right panel ── */}
          {!done && !isScanning ? (
            <div className="lg:col-span-2 flex items-center justify-center">
              <div className="text-center glass-card p-12 w-full">
                <UserSearch className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Enter a Username</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  We'll run live API checks on developer and social platforms, then generate
                  direct profile links for platforms that don't allow browser-side lookups.
                </p>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 space-y-6">

              {/* Live API checks */}
              <div className="glass-card p-6 animate-fade-in">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-success" />
                  <h3 className="font-semibold">Live API Checks</h3>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Definitive results - no guessing
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {liveResults.map((p) => (
                    <div
                      key={p.name}
                      className={`p-4 rounded-lg border transition-all ${
                        p.result === null
                          ? "bg-muted/20 border-border/20 opacity-60"
                          : p.result.error
                          ? "bg-muted/30 border-border/30"
                          : p.result.found
                          ? "bg-success/10 border-success/30"
                          : "bg-muted/30 border-border/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{p.emoji}</span>
                          <div>
                            <p className="text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.category}</p>
                          </div>
                        </div>
                        {p.result === null ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : p.result.error ? (
                          <span className="text-xs text-muted-foreground">Unavailable</span>
                        ) : p.result.found ? (
                          <CheckCircle className="w-5 h-5 text-success shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      {p.result?.found && (
                        <div className="mt-2 pt-2 border-t border-success/20">
                          {p.result.detail && (
                            <p className="text-xs text-muted-foreground mb-1">{p.result.detail}</p>
                          )}
                          {p.result.link && (
                            <a
                              href={p.result.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              View Profile <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                      {p.result && !p.result.found && !p.result.error && (
                        <p className="text-xs text-muted-foreground mt-1">Not found</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Manual verify links */}
              {manualLinks.length > 0 && (
                <div className="glass-card p-6 animate-fade-in">
                  <div className="flex items-center gap-2 mb-1">
                    <HelpCircle className="w-5 h-5 text-warning" />
                    <h3 className="font-semibold">Manual Verify</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    These platforms block browser-side requests. Click each link to open the profile URL - if it loads a real profile, the username is taken.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {manualLinks.map((p) => (
                      <a
                        key={p.name}
                        href={p.url(username.trim())}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border/20 hover:border-primary/30 transition-all group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{p.emoji}</span>
                          <div>
                            <p className="text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">
                              {p.url(username.trim())}
                            </p>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsernameScan;

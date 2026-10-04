import { useState, useMemo } from "react";
import {
  Ghost,
  User,
  Mail,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  Trash2,
  Database,
  Globe,
  FileText,
  ChevronDown,
  ChevronUp,
  Shield,
  Info,
  Clock,
  Zap,
  Lock,
  Eye,
  TriangleAlert,
  Code,
  Music,
  Image,
  DollarSign,
  MessageSquare,
  Briefcase,
  Gamepad2,
  PenLine,
  Dumbbell,
  BookOpen,
  SlidersHorizontal,
} from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import ProgressBar from "@/components/common/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";


interface PlatformResult {
  id: string;
  name: string;
  cat: string;
  pStatus: "active" | "legacy" | "defunct";
  riskW: number;
  url: string;
  deleteUrl: string | null;
  deleteDiff: string;
  accountStatus: "found" | "not_found" | "unknown";
}

interface DeletionGuideEntry {
  id: string;
  name: string;
  category: string;
  platformStatus: string;
  deleteUrl: string | null;
  deleteDiff: string;
  riskWeight: number;
  profileUrl: string;
  steps: string[];
}

interface ScanResults {
  success: boolean;
  scanUsername: string;
  email: string | null;
  found: PlatformResult[];
  activeFound: PlatformResult[];
  legacyFound: PlatformResult[];
  notFound: Array<{ id: string; name: string; cat: string; pStatus: string }>;
  unknownCount: number;
  totalChecked: number;
  forgottenScore: number;
  webMentions: Array<{ title: string; url: string; snippet: string; domain: string }>;
  pasteResults: Array<{ title: string; url: string; snippet: string; domain: string }>;
  emailBreach: { found: number; fields: string[]; sources: string[] } | null;
  deletionGuide: DeletionGuideEntry[];
  categoryBreakdown: Array<{ cat: string; count: number }>;
  serpAPIUsed: boolean;
}


const CAT_META: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  Developer:     { icon: <Code       className="w-3.5 h-3.5" />, color: "text-primary",     bg: "bg-primary/10"     },
  Forum:         { icon: <MessageSquare className="w-3.5 h-3.5" />, color: "text-orange-500", bg: "bg-orange-500/10" },
  Social:        { icon: <User       className="w-3.5 h-3.5" />, color: "text-purple-500",  bg: "bg-purple-500/10"  },
  Writing:       { icon: <PenLine    className="w-3.5 h-3.5" />, color: "text-sky-500",     bg: "bg-sky-500/10"     },
  Identity:      { icon: <Shield     className="w-3.5 h-3.5" />, color: "text-destructive", bg: "bg-destructive/10" },
  Photos:        { icon: <Image      className="w-3.5 h-3.5" />, color: "text-pink-500",    bg: "bg-pink-500/10"    },
  Art:           { icon: <Zap        className="w-3.5 h-3.5" />, color: "text-yellow-500",  bg: "bg-yellow-500/10"  },
  Video:         { icon: <Eye        className="w-3.5 h-3.5" />, color: "text-secondary",   bg: "bg-secondary/10"   },
  Music:         { icon: <Music      className="w-3.5 h-3.5" />, color: "text-secondary",   bg: "bg-secondary/10"   },
  Gaming:        { icon: <Gamepad2   className="w-3.5 h-3.5" />, color: "text-green-500",   bg: "bg-green-500/10"   },
  Finance:       { icon: <DollarSign className="w-3.5 h-3.5" />, color: "text-destructive", bg: "bg-destructive/10" },
  Data:          { icon: <Database   className="w-3.5 h-3.5" />, color: "text-destructive", bg: "bg-destructive/10" },
  Professional:  { icon: <Briefcase  className="w-3.5 h-3.5" />, color: "text-primary",     bg: "bg-primary/10"     },
  Entertainment: { icon: <BookOpen   className="w-3.5 h-3.5" />, color: "text-muted-foreground", bg: "bg-muted/30"  },
  Fitness:       { icon: <Dumbbell   className="w-3.5 h-3.5" />, color: "text-muted-foreground", bg: "bg-muted/30"  },
  Education:     { icon: <BookOpen   className="w-3.5 h-3.5" />, color: "text-muted-foreground", bg: "bg-muted/30"  },
  DIY:           { icon: <Zap        className="w-3.5 h-3.5" />, color: "text-muted-foreground", bg: "bg-muted/30"  },
  Legacy:        { icon: <Clock      className="w-3.5 h-3.5" />, color: "text-warning",      bg: "bg-warning/10"    },
};

const getCatMeta = (cat: string) => CAT_META[cat] || CAT_META.Legacy;


function scoreLabel(score: number) {
  if (score >= 75) return { text: "Critical Exposure",     cls: "text-destructive" };
  if (score >= 55) return { text: "High Ghost Footprint",  cls: "text-orange-500"  };
  if (score >= 30) return { text: "Moderate Footprint",    cls: "text-warning"     };
  return { text: "Low Footprint", cls: "text-success" };
}

const DIFF_CONFIG = {
  Easy:   { cls: "badge-success",  label: "Easy"   },
  Medium: { cls: "badge-warning",  label: "Medium" },
  Hard:   { cls: "badge-danger",   label: "Hard"   },
  "N/A":  { cls: "text-xs px-2 py-0.5 rounded bg-muted/40 text-muted-foreground", label: "Defunct" },
};

const PSTATUS_CONFIG = {
  active:  { label: "Active",   cls: "bg-primary/10 text-primary border-primary/20"           },
  legacy:  { label: "Legacy",   cls: "bg-warning/10 text-warning border-warning/20"           },
  defunct: { label: "Defunct",  cls: "bg-destructive/10 text-destructive border-destructive/20" },
};


const PlatformCard = ({ platform, showDelete = false }: { platform: PlatformResult; showDelete?: boolean }) => {
  const meta    = getCatMeta(platform.cat);
  const psCfg   = PSTATUS_CONFIG[platform.pStatus];
  const isHighRisk = ["Finance", "Identity", "Data"].includes(platform.cat);

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${isHighRisk ? "bg-destructive/10 border-destructive/20" : platform.pStatus !== "active" ? "bg-warning/10 border-warning/20" : "bg-muted/30 border-border/20"}`}>
      <div className={`p-1.5 rounded-md ${meta.bg} ${meta.color} flex-shrink-0`}>{meta.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-sm">{platform.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded border ${psCfg.cls}`}>{psCfg.label}</span>
          {isHighRisk && <span className="badge-danger text-xs">High Risk</span>}
        </div>
        <p className="text-xs text-muted-foreground">{platform.cat}</p>
      </div>
      <a href={platform.url} target="_blank" rel="noopener noreferrer"
        className="text-primary hover:underline flex items-center gap-1 text-xs flex-shrink-0">
        View <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
};


const GhostScan = () => {
  const { saveScanResult } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults]   = useState<ScanResults | null>(null);
  const [error, setError]       = useState("");

  const [showNotFound,      setShowNotFound]      = useState(false);
  const [showAllActive,     setShowAllActive]      = useState(false);
  const [expandedGuide,     setExpandedGuide]      = useState<string | null>(null);
  const [activeTab,         setActiveTab]          = useState<"active" | "legacy" | "all">("active");
  const [filterPlatforms,   setFilterPlatforms]    = useState<Set<string>>(new Set());
  const [pickerOpen,        setPickerOpen]         = useState(false);
  const [platformSearch,    setPlatformSearch]     = useState("");

  const canScan = username.trim().length > 0 || email.trim().includes("@");

  const ALL_PLATFORMS: { name: string; cat: string }[] = [
    { name: "GitHub",        cat: "Developer"    }, { name: "GitLab",       cat: "Developer"    },
    { name: "npm",           cat: "Developer"    }, { name: "Bitbucket",    cat: "Developer"    },
    { name: "Replit",        cat: "Developer"    }, { name: "CodePen",      cat: "Developer"    },
    { name: "HackerNews",    cat: "Developer"    }, { name: "SourceForge",  cat: "Developer"    },
    { name: "Reddit",        cat: "Social"       }, { name: "Twitter / X",  cat: "Social"       },
    { name: "Instagram",     cat: "Social"       }, { name: "Facebook",     cat: "Social"       },
    { name: "Mastodon",      cat: "Social"       }, { name: "Pinterest",    cat: "Social"       },
    { name: "Snapchat",      cat: "Social"       }, { name: "Tumblr",       cat: "Forum"        },
    { name: "Ask.fm",        cat: "Forum"        }, { name: "Quora",        cat: "Forum"        },
    { name: "Steam",         cat: "Gaming"       }, { name: "Twitch",       cat: "Gaming"       },
    { name: "Roblox",        cat: "Gaming"       }, { name: "itch.io",      cat: "Gaming"       },
    { name: "Speedrun.com",  cat: "Gaming"       }, { name: "Xbox",         cat: "Gaming"       },
    { name: "Venmo",         cat: "Finance"      }, { name: "Cash App",     cat: "Finance"      },
    { name: "PayPal",        cat: "Finance"      }, { name: "Patreon",      cat: "Finance"      },
    { name: "Ko-fi",         cat: "Finance"      }, { name: "Kickstarter",  cat: "Finance"      },
    { name: "Gravatar",      cat: "Identity"     }, { name: "About.me",     cat: "Identity"     },
    { name: "Keybase",       cat: "Identity"     },
    { name: "Flickr",        cat: "Photos"       }, { name: "500px",        cat: "Photos"       },
    { name: "Imgur",         cat: "Photos"       }, { name: "VSCO",         cat: "Photos"       },
    { name: "DeviantArt",    cat: "Art"          }, { name: "ArtStation",   cat: "Art"          },
    { name: "Behance",       cat: "Art"          },
    { name: "Medium",        cat: "Writing"      }, { name: "Substack",     cat: "Writing"      },
    { name: "WordPress",     cat: "Writing"      }, { name: "Wattpad",      cat: "Writing"      },
    { name: "YouTube",       cat: "Video"        }, { name: "Vimeo",        cat: "Video"        },
    { name: "SoundCloud",    cat: "Music"        }, { name: "Last.fm",      cat: "Music"        },
    { name: "Bandcamp",      cat: "Music"        },
    { name: "LinkedIn",      cat: "Professional" }, { name: "Wellfound",    cat: "Professional" },
    { name: "MySpace",       cat: "Legacy"       }, { name: "Xanga",        cat: "Legacy"       },
    { name: "Friendster",    cat: "Legacy"       },
  ];

  const visiblePlatforms = useMemo(() =>
    platformSearch.trim()
      ? ALL_PLATFORMS.filter(p => p.name.toLowerCase().includes(platformSearch.toLowerCase()))
      : ALL_PLATFORMS,
  [platformSearch]);

  const groupedVisible = useMemo(() => {
    const groups: Record<string, string[]> = {};
    visiblePlatforms.forEach(p => {
      if (!groups[p.cat]) groups[p.cat] = [];
      groups[p.cat].push(p.name);
    });
    return groups;
  }, [visiblePlatforms]);

  const togglePlatform = (name: string) => {
    setFilterPlatforms(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const applyFilter = (items: PlatformResult[]) =>
    filterPlatforms.size === 0
      ? items
      : items.filter(p => filterPlatforms.has(p.name));

  const handleScan = async () => {
    setError("");
    setIsScanning(true);
    setResults(null);
    setActiveTab("active");

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/scan-ghost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim() || undefined,
          email:    email.trim()    || undefined,
        }),
      });

      let data: any;
      try { data = await res.json(); }
      catch { throw new Error("Backend returned unexpected response. Make sure the server is running on port 5000."); }

      if (!res.ok) throw new Error(data.error || "Scan failed");

      setResults(data);
      saveScanResult("ghost", {
        forgottenScore: data.forgottenScore,
        accountsFound:  data.found.length,
        scanUsername:   data.scanUsername,
      });
    } catch (err: any) {
      setError(err.message || "Scan failed. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const tabResults = results
    ? applyFilter(
        activeTab === "active" ? results.activeFound :
        activeTab === "legacy" ? results.legacyFound :
        results.found
      )
    : [];

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Left Panel ── */}
          <div className="space-y-6">
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Ghost className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Ghost Account Finder</h1>
                  <p className="text-muted-foreground text-sm">
                    Uncover forgotten accounts still exposing your identity
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Username / Handle
                    <span className="ml-2 text-xs text-primary">Checked across {53} platforms</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="text" value={username}
                      onChange={e => setUsername(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && canScan && !isScanning && handleScan()}
                      placeholder="your_username"
                      className="input-cyber w-full pl-10" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Email Address
                    <span className="ml-2 text-xs text-muted-foreground">Optional · adds breach check</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="email" value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="input-cyber w-full pl-10" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">
                      Focus on specific platforms
                      <span className="ml-2 text-xs text-muted-foreground font-normal">Optional</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setPickerOpen(o => !o)}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        pickerOpen || filterPlatforms.size > 0
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-muted/30 text-muted-foreground border-border hover:border-primary/40"
                      }`}
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      {filterPlatforms.size > 0 ? `${filterPlatforms.size} selected` : "Select platforms"}
                      {pickerOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Selected pills */}
                  {filterPlatforms.size > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[...filterPlatforms].map(name => (
                        <span key={name}
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {name}
                          <button type="button" onClick={() => togglePlatform(name)} className="hover:text-destructive">
                            <XCircle className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <button type="button" onClick={() => setFilterPlatforms(new Set())}
                        className="text-xs text-muted-foreground hover:text-destructive underline">
                        Clear all
                      </button>
                    </div>
                  )}

                  {/* Dropdown picker */}
                  {pickerOpen && (
                    <div className="rounded-xl border border-border bg-background shadow-lg overflow-hidden">
                      <div className="p-2 border-b border-border">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <input
                            type="text"
                            value={platformSearch}
                            onChange={e => setPlatformSearch(e.target.value)}
                            placeholder="Search platforms…"
                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-muted/40 border border-border focus:outline-none focus:border-primary/50"
                          />
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto p-2 space-y-3">
                        {Object.entries(groupedVisible).map(([cat, names]) => (
                          <div key={cat}>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 px-1">
                              {cat}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {names.map(name => {
                                const on = filterPlatforms.has(name);
                                return (
                                  <button key={name} type="button" onClick={() => togglePlatform(name)}
                                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                      on
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-muted/30 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                                    }`}>
                                    {name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {Object.keys(groupedVisible).length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">No platforms match "{platformSearch}"</p>
                        )}
                      </div>
                      <div className="p-2 border-t border-border flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {filterPlatforms.size > 0
                            ? `${filterPlatforms.size} of ${ALL_PLATFORMS.length} selected`
                            : `${ALL_PLATFORMS.length} platforms`}
                        </p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setFilterPlatforms(new Set(ALL_PLATFORMS.map(p => p.name)))}
                            className="text-xs text-primary hover:underline">Select all</button>
                          <button type="button" onClick={() => setFilterPlatforms(new Set())}
                            className="text-xs text-muted-foreground hover:text-destructive hover:underline">Clear</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {filterPlatforms.size > 0 && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Info className="w-3 h-3 flex-shrink-0" />
                      All 53 platforms are still scanned - this only filters what results are shown.
                    </p>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border/30 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Scans {53} platforms in parallel including developer, social, gaming, finance, and legacy sites.
                    For each account found, a direct deletion path is provided.
                  </p>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2 text-sm text-destructive">
                    <XCircle className="w-4 h-4 flex-shrink-0" />{error}
                  </div>
                )}

                <button onClick={handleScan} disabled={isScanning || !canScan}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isScanning
                    ? <><Loader2 className="w-5 h-5 animate-spin" />Scanning 53 platforms…</>
                    : <><Search className="w-5 h-5" />Find Ghost Accounts</>}
                </button>

                {isScanning && (
                  <div className="p-4 rounded-lg bg-muted/20 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Running parallel checks…</p>
                    {["Checking developer platforms (GitHub, GitLab, npm…)", "Checking social & forum platforms", "Checking gaming, creative & lifestyle platforms", "Checking finance & identity platforms", "Scanning legacy and defunct sites (MySpace, Xanga…)", "Querying breach databases"].map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin text-primary flex-shrink-0" />{s}
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-1">May take 10–15 seconds.</p>
                  </div>
                )}
              </div>
            </div>

            {/* What are ghost accounts? */}
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Ghost className="w-5 h-5 text-warning" />
                Why Ghost Accounts Are Dangerous
              </h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Ghost accounts are old, forgotten profiles that still exist on platforms you stopped using. They continue to expose your identity even when you're no longer active.</p>
                {[
                  { title: "Still Indexed",     desc: "Google continues to index old profiles, posts, and comments indefinitely after you stop using them." },
                  { title: "Data Brokers",       desc: "People-search sites aggregate old profile data and sell your username, email, and linked accounts as a packaged identity profile." },
                  { title: "Credential Reuse",   desc: "Old accounts with weak or reused passwords are prime targets for credential stuffing attacks using breach dumps." },
                  { title: "Identity Linkage",   desc: "Reusing the same username across platforms lets attackers link all your activity into a single profile - even from accounts you created a decade ago." },
                ].map((item, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/30">
                    <p className="font-medium text-foreground text-xs mb-1">{item.title}</p>
                    <p className="text-xs">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right Panel ── */}
          {!results && !isScanning ? (
            <div className="flex items-center justify-center">
              <div className="text-center glass-card p-12 w-full">
                <Ghost className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Uncover Your Digital Ghosts</h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-6">
                  Enter a username or email to scan 53 platforms - from GitHub and Reddit to MySpace and Xanga - and discover which forgotten accounts are still out there.
                </p>
                <div className="grid grid-cols-2 gap-2 text-left max-w-sm mx-auto">
                  {["53 platform checks", "Legacy & defunct sites", "Direct delete links", "Breach cross-reference", "Forgotten exposure score", "Step-by-step deletion guide"].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded bg-muted/20">
                      <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />{item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : results && (
            <div className="space-y-6 animate-fade-in">

              {/* ── Score Overview ── */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Forgotten Exposure Score</h2>
                    <p className={`text-sm font-medium mt-0.5 ${scoreLabel(results.forgottenScore).cls}`}>
                      {scoreLabel(results.forgottenScore).text}
                    </p>
                  </div>
                  <RiskGauge score={results.forgottenScore} size="sm" label="Forgotten" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Active Accounts",  value: results.activeFound.length,  warn: results.activeFound.length > 3,  desc: "still live" },
                    { label: "Legacy / Defunct",  value: results.legacyFound.length,  warn: results.legacyFound.length > 0,  desc: "ghost data" },
                    { label: "Paste / Leak",      value: results.pasteResults.length, warn: results.pasteResults.length > 0, desc: "indexed dumps" },
                    { label: "Breach Count",      value: results.emailBreach?.found ?? "-", warn: (results.emailBreach?.found || 0) > 0, desc: "breaches" },
                  ].map((s, i) => (
                    <div key={i} className={`p-3 rounded-lg text-center ${s.warn && s.value !== "-" && +s.value > 0 ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
                      <p className={`text-2xl font-bold ${s.warn && s.value !== "-" && +s.value > 0 ? "text-destructive" : ""}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-xs text-muted-foreground/60">{s.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Category breakdown */}
                {results.categoryBreakdown.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-border/20">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Accounts found by category</p>
                    {results.categoryBreakdown.slice(0, 5).map((item, i) => {
                      const meta = getCatMeta(item.cat);
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`p-1 rounded ${meta.bg} ${meta.color} flex-shrink-0`}>{meta.icon}</div>
                          <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{item.cat}</span>
                          <div className="flex-1"><ProgressBar value={Math.min((item.count / results.found.length) * 100, 100)} /></div>
                          <span className="text-xs font-medium w-4 text-right flex-shrink-0">{item.count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!results.serpAPIUsed && (
                  <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
                    <Info className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      SerpAPI not configured - platform HTTP checks are active but Google web search and Pastebin scan are unavailable.
                      Add <span className="font-mono text-foreground">SERPAPI_KEY</span> to <span className="font-mono text-foreground">backend/.env</span>.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Found Accounts ── */}
              {results.found.length > 0 && (
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2 flex-wrap">
                      <Ghost className="w-5 h-5 text-primary" />
                      Accounts Found
                      <span className="text-sm font-normal text-muted-foreground">
                        {filterPlatforms.size > 0
                          ? `${tabResults.length} shown / ${results.found.length} total`
                          : `(${results.found.length})`}
                      </span>
                      {filterPlatforms.size > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                          Filtered
                        </span>
                      )}
                    </h2>
                    <span className="badge-danger">{results.found.length} found</span>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 mb-4 p-1 rounded-lg bg-muted/30">
                    {([["active", `Active (${results.activeFound.length})`, results.activeFound.length],
                       ["legacy", `Legacy/Defunct (${results.legacyFound.length})`, results.legacyFound.length],
                       ["all",    `All (${results.found.length})`,                  results.found.length],
                    ] as const).map(([tab, label, count]) => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${activeTab === tab ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {activeTab === "legacy" && results.legacyFound.length === 0 ? (
                    <div className="p-4 rounded-lg bg-success/10 border border-success/20 flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                      <p className="text-sm">No legacy or defunct accounts found - no ghost data from old platforms.</p>
                    </div>
                  ) : tabResults.length === 0 ? (
                    <div className="p-4 rounded-lg bg-muted/30 text-sm text-muted-foreground text-center">No accounts in this category.</div>
                  ) : (
                    <div className="space-y-2">
                      {(showAllActive ? tabResults : tabResults.slice(0, 8)).map((p, i) => (
                        <PlatformCard key={i} platform={p} />
                      ))}
                      {tabResults.length > 8 && (
                        <button onClick={() => setShowAllActive(!showAllActive)}
                          className="flex items-center gap-1 text-sm text-primary hover:underline mt-1">
                          {showAllActive ? <><ChevronUp className="w-4 h-4" />Show less</> : <><ChevronDown className="w-4 h-4" />Show all {tabResults.length} accounts</>}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {results.found.length === 0 && (
                <div className="glass-card p-6">
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">No accounts found across {results.totalChecked} platforms.</p>
                      <p className="text-xs text-muted-foreground mt-0.5">This username has a low ghost footprint on checked platforms.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Paste / Leak Results ── */}
              {results.pasteResults.length > 0 && (
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-destructive" />
                    Paste & Leak Site Results
                    <span className="badge-danger">{results.pasteResults.length} found</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Your username appears in indexed paste documents - these may contain credential dumps, doxx files, or data exports from breached services.
                  </p>
                  <div className="space-y-2">
                    {results.pasteResults.map((p, i) => (
                      <div key={i} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium line-clamp-1">{p.title}</p>
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-destructive flex-shrink-0">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mb-1">{p.domain}</p>
                        {p.snippet && <p className="text-xs text-muted-foreground line-clamp-2">{p.snippet}</p>}
                      </div>
                    ))}
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
                    {results.webMentions.slice(0, 5).map((m, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/30">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium line-clamp-1">{m.title}</p>
                          <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-primary flex-shrink-0">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mb-1">{m.domain}</p>
                        {m.snippet && <p className="text-xs text-muted-foreground line-clamp-2">{m.snippet}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Breach Results ── */}
              {results.emailBreach && (
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    Breach Database Check
                  </h2>
                  {results.emailBreach.found > 0 ? (
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">Email Found in Breaches</span>
                          <span className="badge-danger">{results.emailBreach.found} breach{results.emailBreach.found > 1 ? "es" : ""}</span>
                        </div>
                        {results.emailBreach.fields.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {results.emailBreach.fields.map((f, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">{f}</span>
                            ))}
                          </div>
                        )}
                        {results.emailBreach.sources.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">Sources: {results.emailBreach.sources.join(", ")}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-success/10 border border-success/20 flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                      <p className="text-sm">Email not found in checked breach databases.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Not Found List ── */}
              {results.notFound.length > 0 && (
                <div className="glass-card p-6">
                  <button onClick={() => setShowNotFound(!showNotFound)}
                    className="w-full flex items-center justify-between text-left">
                    <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-success" />
                      {results.notFound.length} platforms where username was not found
                    </h2>
                    {showNotFound ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {showNotFound && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {results.notFound.map((p, i) => (
                        <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-success/10 text-success border border-success/20">
                          <CheckCircle className="w-3 h-3" />{p.name}
                        </span>
                      ))}
                      {results.unknownCount > 0 && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted/30 text-muted-foreground border border-border/20">
                          <AlertTriangle className="w-3 h-3" />{results.unknownCount} could not be checked
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Deletion Guide ── */}
              {results.deletionGuide.length > 0 && (() => {
                const visibleGuide = filterPlatforms.size === 0
                  ? results.deletionGuide
                  : results.deletionGuide.filter(e => filterPlatforms.has(e.name));
                if (visibleGuide.length === 0) return null;
                return (
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-primary" />
                    Account Deletion Guide
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Sorted by risk level. Follow these steps to delete each account and reduce your ghost footprint.
                  </p>
                  <div className="space-y-2">
                    {visibleGuide.map((entry, i) => {
                      const isOpen = expandedGuide === entry.id;
                      const psCfg  = PSTATUS_CONFIG[entry.platformStatus as keyof typeof PSTATUS_CONFIG] || PSTATUS_CONFIG.active;
                      const diffCfg = DIFF_CONFIG[entry.deleteDiff as keyof typeof DIFF_CONFIG] || DIFF_CONFIG.Medium;
                      const isHighRisk = ["Finance", "Identity", "Data"].includes(entry.category);

                      return (
                        <div key={i} className={`rounded-lg border overflow-hidden ${isHighRisk ? "bg-destructive/10 border-destructive/20" : entry.platformStatus !== "active" ? "bg-warning/10 border-warning/20" : "bg-muted/30 border-border/20"}`}>
                          <button className="w-full p-4 flex items-center gap-3 text-left"
                            onClick={() => setExpandedGuide(isOpen ? null : entry.id)}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="font-medium text-sm">{entry.name}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded border ${psCfg.cls}`}>{psCfg.label}</span>
                                <span className={diffCfg.cls}>{diffCfg.label}</span>
                                {isHighRisk && <span className="badge-danger text-xs">High Risk</span>}
                              </div>
                              <p className="text-xs text-muted-foreground">{entry.category}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {entry.deleteUrl && entry.deleteUrl !== "N/A" && (
                                <a href={entry.deleteUrl} target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="flex items-center gap-1 text-xs btn-primary py-1 px-2 rounded">
                                  Delete <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                            </div>
                          </button>

                          {isOpen && (
                            <div className="px-4 pb-4 pt-1 border-t border-border/20">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-medium text-muted-foreground">Steps to delete this account:</p>
                                <a href={entry.profileUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1">
                                  View profile <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                              <div className="space-y-2">
                                {entry.steps.map((step, j) => (
                                  <div key={j} className="flex items-start gap-2.5">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold mt-0.5">{j + 1}</span>
                                    <p className="text-sm text-muted-foreground leading-snug">{step}</p>
                                  </div>
                                ))}
                              </div>
                              {entry.platformStatus === "defunct" && (
                                <div className="mt-3 p-2.5 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
                                  <TriangleAlert className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />
                                  <p className="text-xs text-muted-foreground">This platform is defunct - direct deletion may no longer be possible, but your data may still be indexed.</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })()}

              {/* ── Recommendations ── */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  Reduce Your Ghost Footprint
                </h2>
                <div className="space-y-3">
                  {[
                    results.found.length > 0 && {
                      text: `You have ${results.found.length} active accounts tied to this username. Work through the Deletion Guide above, starting with Finance and Identity platforms.`,
                      priority: "high",
                    },
                    results.legacyFound.length > 0 && {
                      text: `${results.legacyFound.length} legacy or defunct account(s) found. Even on dead platforms, your data may remain indexed by Google for years.`,
                      priority: "high",
                    },
                    results.pasteResults.length > 0 && {
                      text: `Your username appears in ${results.pasteResults.length} paste document(s). Review each link immediately - if personal data is present, request removal and change any credentials exposed.`,
                      priority: "high",
                    },
                    results.emailBreach?.found && results.emailBreach.found > 0 && {
                      text: "Your email appeared in breaches. Change the password on every account tied to this email address and enable multi-factor authentication.",
                      priority: "high",
                    },
                    results.found.some(p => p.cat === "Finance") && {
                      text: "Finance accounts (Venmo, Cash App) found - these expose your real identity and transaction history. Delete or privatize immediately.",
                      priority: "high",
                    },
                    results.found.some(p => p.id === "gravatar") && {
                      text: "Gravatar links your email address to a public profile. It's used automatically on WordPress sites and comment systems, linking your email to your face/username.",
                      priority: "medium",
                    },
                    {
                      text: "Use a different username on each platform going forward. Inconsistent handles prevent cross-platform identity linkage.",
                      priority: "medium",
                    },
                    {
                      text: "Use JustDeleteMe (justdeleteme.xyz) as a directory to find deletion pages for any platforms not listed here.",
                      priority: "low",
                    },
                    {
                      text: "After deleting accounts, request Google removal of the old indexed URLs via the Google Search Console URL Removal Tool.",
                      priority: "low",
                    },
                  ]
                    .filter(Boolean)
                    .slice(0, 8)
                    .map((rec: any, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/20">
                        <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${rec.priority === "high" ? "text-amber-600" : rec.priority === "medium" ? "text-blue-500" : "text-muted-foreground"}`} />
                        <p className="text-sm flex-1">{rec.text}</p>
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
  );
};

export default GhostScan;

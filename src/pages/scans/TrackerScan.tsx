import { useState, useEffect, useRef } from "react";
import {
  Link2, Plus, Copy, Trash2, RefreshCw, Globe, Monitor,
  Smartphone, Tablet, MapPin, Wifi, Clock, Eye, Shield,
  AlertTriangle, CheckCircle, ChevronRight, ExternalLink,
  Loader2, X, Navigation, Crosshair,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BACKEND = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface Tracker {
  id: string;
  token: string;
  label: string;
  redirect_url: string;
  created_at: string;
  tracker_hits: { count: number }[];
}
interface Hit {
  id: string;
  ip: string;
  country: string | null;
  city: string | null;
  isp: string | null;
  browser: string;
  os: string;
  device: string;
  referer: string | null;
  user_agent: string;
  clicked_at: string;
  ip_lat: number | null;
  ip_lon: number | null;
  gps_lat: number | null;
  gps_lon: number | null;
  gps_accuracy: number | null;
  location_source: "gps" | "ip" | null;
}

const DEVICE_ICON: Record<string, typeof Monitor> = {
  Mobile: Smartphone,
  Tablet: Tablet,
  Desktop: Monitor,
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

const TrackerScan = () => {
  const { accessToken } = useAuth();
  const [trackers, setTrackers]       = useState<Tracker[]>([]);
  const [selected, setSelected]       = useState<Tracker | null>(null);
  const [hits, setHits]               = useState<Hit[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingHits, setLoadingHits] = useState(false);
  const [creating, setCreating]       = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [label, setLabel]             = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [copied, setCopied]           = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };

  const fetchTrackers = async () => {
    try {
      const res = await fetch(`${BACKEND}/tracker/list`, { headers: authHeaders });
      const data = await res.json();
      if (res.ok) setTrackers(data);
    } catch {}
    setLoadingList(false);
  };

  const fetchHits = async (token: string) => {
    setLoadingHits(true);
    try {
      const res = await fetch(`${BACKEND}/tracker/${token}/hits`, { headers: authHeaders });
      const data = await res.json();
      if (res.ok) setHits(data);
    } catch {}
    setLoadingHits(false);
  };

  useEffect(() => { fetchTrackers(); }, []);

  // Auto-refresh hits every 8 seconds when a tracker is selected
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selected) return;
    fetchHits(selected.token);
    pollRef.current = setInterval(() => fetchHits(selected.token), 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected]);

  const handleCreate = async () => {
    if (!label.trim()) { setError("Enter a label for this tracker"); return; }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/tracker/create`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ label: label.trim(), redirectUrl: redirectUrl.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTrackers(prev => [{ ...data, tracker_hits: [{ count: 0 }] }, ...prev]);
      setLabel("");
      setRedirectUrl("");
      setShowForm(false);
    } catch (err: any) {
      setError(err.message);
    }
    setCreating(false);
  };

  const handleDelete = async (token: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this tracker and all its hit data?")) return;
    await fetch(`${BACKEND}/tracker/${token}`, { method: "DELETE", headers: authHeaders });
    setTrackers(prev => prev.filter(t => t.token !== token));
    if (selected?.token === token) { setSelected(null); setHits([]); }
  };

  const copyLink = (token: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(trackingLink(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const trackingLink = (token: string) => `${window.location.origin}/t/${token}`;

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-6xl">

        {/* Header */}
        <div className="glass-card p-8 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Link2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">IP Tracker - Tracking Links</h1>
                <p className="text-muted-foreground text-sm">
                  Generate a link · Share it · Capture real IP, location, device & browser when clicked
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Tracker
            </button>
          </div>

          {/* Create form */}
          {showForm && (
            <div className="mt-6 p-5 rounded-xl bg-muted/20 border border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Create Tracking Link</p>
                <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Label *</label>
                  <input
                    type="text"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="e.g. Sent to John via WhatsApp"
                    className="input-cyber w-full text-sm"
                    maxLength={80}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Redirect URL <span className="text-muted-foreground/60">(optional - defaults to Google)</span>
                  </label>
                  <input
                    type="url"
                    value={redirectUrl}
                    onChange={e => setRedirectUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="input-cyber w-full text-sm"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCreate}
                  disabled={creating || !label.trim()}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : <><Plus className="w-4 h-4" />Generate Link</>}
                </button>
                <p className="text-xs text-muted-foreground">
                  The link captures IP + device data when clicked, then silently redirects.
                </p>
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { step: "1", text: "Create a tracker with a label" },
              { step: "2", text: "Copy the generated link" },
              { step: "3", text: "Send it via WhatsApp, email, or SMS" },
              { step: "4", text: "See IP, exact GPS, device & browser instantly" },
            ].map(s => (
              <div key={s.step} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">{s.step}</span>
                <p className="text-xs text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Trackers list */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Your Trackers</h2>
              <button onClick={fetchTrackers} className="text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {loadingList ? (
              <div className="glass-card p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
              </div>
            ) : trackers.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Link2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No trackers yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Create one above to get started.</p>
              </div>
            ) : (
              trackers.map(t => {
                const hitCount = t.tracker_hits?.[0]?.count ?? 0;
                const isActive = selected?.token === t.token;
                return (
                  <div
                    key={t.token}
                    onClick={() => setSelected(t)}
                    className={`glass-card p-4 cursor-pointer transition-all hover:border-primary/30 ${isActive ? "border-primary/40 bg-primary/5" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{t.label}</p>
                          {hitCount > 0 && (
                            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                              {hitCount} hit{hitCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                          /t/{t.token}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(t.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={e => copyLink(t.token, e)}
                          className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-primary"
                          title="Copy link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={e => handleDelete(t.token, e)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isActive ? "rotate-90 text-primary" : ""}`} />
                      </div>
                    </div>
                    {copied === t.token && (
                      <p className="text-xs text-success mt-2 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Link copied!
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Hits panel */}
          <div className="lg:col-span-3">
            {!selected ? (
              <div className="glass-card p-12 text-center h-full flex flex-col items-center justify-center">
                <Eye className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a Tracker</h3>
                <p className="text-sm text-muted-foreground">Click any tracker on the left to view captured hits in real-time.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected tracker header */}
                <div className="glass-card p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="font-semibold text-base">{selected.label}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Auto-refreshing every 8 seconds</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyLink(selected.token)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors text-sm font-medium"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copied === selected.token ? "Copied!" : "Copy Link"}
                      </button>
                      <a
                        href={trackingLink(selected.token)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-muted-foreground"
                        title="Open tracking link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div className="mt-3 p-3 rounded-lg bg-muted/20 border border-border/30">
                    <p className="text-xs text-muted-foreground mb-1">Tracking URL</p>
                    <p className="text-sm font-mono text-primary break-all">{trackingLink(selected.token)}</p>
                  </div>

                  <div className="mt-3 p-3 rounded-lg bg-muted/10 border border-border/20 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground">Redirects to: <span className="text-foreground">{selected.redirect_url}</span></p>
                  </div>
                </div>

                {/* Stats */}
                {hits.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Total Clicks", value: hits.length, color: "text-primary" },
                      { label: "Unique IPs",   value: new Set(hits.map(h => h.ip)).size, color: "text-foreground" },
                      { label: "Countries",    value: new Set(hits.map(h => h.country).filter(Boolean)).size, color: "text-foreground" },
                    ].map(s => (
                      <div key={s.label} className="glass-card p-3 text-center">
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Hits list */}
                <div className="glass-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/40 bg-muted/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">
                        {loadingHits ? "Loading…" : `${hits.length} Hit${hits.length !== 1 ? "s" : ""} Captured`}
                      </span>
                    </div>
                    <button onClick={() => fetchHits(selected.token)} className="text-muted-foreground hover:text-foreground">
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingHits ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  {hits.length === 0 && !loadingHits ? (
                    <div className="p-10 text-center">
                      <Shield className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-sm font-medium mb-1">No clicks yet</p>
                      <p className="text-xs text-muted-foreground">Share the tracking link - hits appear here automatically.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/20 max-h-[500px] overflow-y-auto">
                      {hits.map((hit, i) => {
                        const DevIcon = DEVICE_ICON[hit.device] || Monitor;
                        return (
                          <div key={hit.id} className={`p-4 hover:bg-muted/10 transition-colors ${i === 0 ? "bg-primary/5" : ""}`}>
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-muted/30 shrink-0">
                                <DevIcon className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="font-mono text-sm font-medium text-destructive">{hit.ip}</span>
                                  {hit.country && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {hit.city ? `${hit.city}, ` : ""}{hit.country}
                                    </span>
                                  )}
                                  {i === 0 && (
                                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Latest</span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Monitor className="w-3 h-3" />
                                    {hit.browser} · {hit.os} · {hit.device}
                                  </span>
                                  {hit.isp && (
                                    <span className="flex items-center gap-1">
                                      <Wifi className="w-3 h-3" />
                                      {hit.isp}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {timeAgo(hit.clicked_at)}
                                  </span>
                                </div>

                                {/* GPS coordinates - highest priority */}
                                {hit.gps_lat && hit.gps_lon ? (
                                  <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-success/10 border border-success/20">
                                    <Crosshair className="w-3.5 h-3.5 text-success shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-success">GPS Location</span>
                                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-success/20 text-success font-medium">
                                          {hit.gps_accuracy ? `±${Math.round(hit.gps_accuracy)}m` : "GPS"}
                                        </span>
                                      </div>
                                      <p className="text-xs font-mono text-success mt-0.5">
                                        {hit.gps_lat.toFixed(6)}°, {hit.gps_lon.toFixed(6)}°
                                      </p>
                                    </div>
                                    <a
                                      href={`https://www.google.com/maps?q=${hit.gps_lat},${hit.gps_lon}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-success/20 text-success text-xs hover:bg-success/30 transition-colors"
                                    >
                                      <Navigation className="w-3 h-3" />
                                      Maps
                                    </a>
                                  </div>
                                ) : hit.ip_lat && hit.ip_lon ? (
                                  <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
                                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-primary">IP Location</span>
                                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">~City level</span>
                                      </div>
                                      <p className="text-xs font-mono text-primary mt-0.5">
                                        {hit.ip_lat.toFixed(4)}°, {hit.ip_lon.toFixed(4)}°
                                      </p>
                                    </div>
                                    <a
                                      href={`https://www.google.com/maps?q=${hit.ip_lat},${hit.ip_lon}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-primary/20 text-primary text-xs hover:bg-primary/30 transition-colors"
                                    >
                                      <Navigation className="w-3 h-3" />
                                      Maps
                                    </a>
                                  </div>
                                ) : null}

                                {hit.referer && (
                                  <p className="text-xs text-muted-foreground mt-1 truncate">
                                    Referred from: {hit.referer}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Privacy notice */}
                <div className="p-3 rounded-lg bg-muted/20 border border-border/30 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Only use tracking links ethically and with consent. This tool is for security awareness and authorized testing only.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackerScan;

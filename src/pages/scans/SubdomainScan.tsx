import { useState } from "react";
import {
  Globe, Search, AlertTriangle, CheckCircle, Server, Loader2,
  Copy, ExternalLink, Shield, ShieldAlert, MapPin, Building,
  Wifi, Database, ChevronDown, ChevronUp, Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BACKEND = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface Subdomain {
  sub: string;
  ip: string | null;
}
interface ScanResult {
  domain: string;
  total: number;
  subdomains: Subdomain[];
  interesting: Subdomain[];
}
interface IPInfo {
  ip: string;
  version: string;
  location: { city: string; region: string; country: string; countryCode: string };
  network: { isp: string; org: string | null; as: string | null };
  privacy: {
    isVPN: boolean; isProxy: boolean; isTor: boolean; isHosting: boolean;
    vpnProvider: string | null; blacklistChecks: number;
    blacklistTrue: number; blacklistedOn: string[];
  };
  subdomains: string[];   // which subdomains share this IP
  error?: string;
}

const INTERESTING_RE = /admin|api|dev|staging|test|internal|vpn|mail|smtp|ftp|login|dashboard|portal|beta|old|legacy|backup|db|database|secure|auth|sso|cdn|static|jenkins|grafana|kibana|jira|confluence|gitlab|git|ci|build/i;

async function scanIPsBatched(ips: string[], onProgress: (done: number) => void): Promise<Record<string, IPInfo>> {
  const BATCH = 5;
  const results: Record<string, IPInfo> = {};
  let done = 0;
  for (let i = 0; i < ips.length; i += BATCH) {
    const batch = ips.slice(i, i + BATCH);
    await Promise.all(batch.map(async ip => {
      try {
        const res = await fetch(`${BACKEND}/scan-ip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ip }),
        });
        const data = await res.json();
        results[ip] = res.ok ? { ...data, subdomains: [] } : { ip, error: data.error, subdomains: [] } as any;
      } catch {
        results[ip] = { ip, error: "Unreachable", subdomains: [] } as any;
      }
      done++;
      onProgress(done);
    }));
  }
  return results;
}

const SubdomainScan = () => {
  const [domain, setDomain]         = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults]       = useState<ScanResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [filter, setFilter]         = useState<"all" | "interesting">("all");
  const [copied, setCopied]         = useState(false);

  const [isAnalyzingIPs, setIsAnalyzingIPs] = useState(false);
  const [ipProgress, setIpProgress]         = useState(0);
  const [ipTotal, setIpTotal]               = useState(0);
  const [ipData, setIpData]                 = useState<IPInfo[] | null>(null);
  const [expandedIP, setExpandedIP]         = useState<string | null>(null);

  const { saveScanResult } = useAuth();

  const handleScan = async () => {
    const clean = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    if (!clean || !clean.includes(".")) { setError("Enter a valid domain like example.com"); return; }
    setIsScanning(true);
    setResults(null);
    setIpData(null);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/scan-subdomains?domain=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setResults(data);
      saveScanResult("subdomain", { domain: data.domain, total: data.total, interesting: data.interesting.length, scannedAt: new Date().toISOString() });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAnalyzeIPs = async () => {
    if (!results) return;
    // Collect unique IPs
    const ipToSubs: Record<string, string[]> = {};
    for (const { sub, ip } of results.subdomains) {
      if (!ip) continue;
      if (!ipToSubs[ip]) ipToSubs[ip] = [];
      ipToSubs[ip].push(sub);
    }
    const uniqueIPs = Object.keys(ipToSubs);
    if (uniqueIPs.length === 0) { setError("No IPs resolved - nothing to analyze."); return; }

    setIsAnalyzingIPs(true);
    setIpData(null);
    setIpProgress(0);
    setIpTotal(uniqueIPs.length);

    const raw = await scanIPsBatched(uniqueIPs, done => setIpProgress(done));

    // Attach subdomain lists
    const infos: IPInfo[] = uniqueIPs.map(ip => ({ ...raw[ip], subdomains: ipToSubs[ip] }));
    // Sort: blacklisted first, then hosting, then rest
    infos.sort((a, b) => {
      const riskA = (a.privacy?.blacklistTrue ?? 0) * 10 + (a.privacy?.isHosting ? 2 : 0) + (a.privacy?.isVPN ? 1 : 0);
      const riskB = (b.privacy?.blacklistTrue ?? 0) * 10 + (b.privacy?.isHosting ? 2 : 0) + (b.privacy?.isVPN ? 1 : 0);
      return riskB - riskA;
    });
    setIpData(infos);
    setIsAnalyzingIPs(false);
  };

  const copyAll = () => {
    if (!results) return;
    const text = results.subdomains.map(s => s.ip ? `${s.sub}\t${s.ip}` : s.sub).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayed = results ? (filter === "interesting" ? results.interesting : results.subdomains) : [];

  // IP risk helpers
  const ipRiskLevel = (info: IPInfo) => {
    if (!info.privacy) return "unknown";
    if (info.privacy.blacklistTrue > 0) return "danger";
    if (info.privacy.isHosting) return "warning";
    if (info.privacy.isVPN || info.privacy.isProxy) return "info";
    return "clean";
  };
  const riskBadge: Record<string, string> = {
    danger:  "bg-destructive/10 text-destructive border-destructive/30",
    warning: "bg-warning/10 text-warning border-warning/30",
    info:    "bg-primary/10 text-primary border-primary/30",
    clean:   "bg-success/10 text-success border-success/30",
    unknown: "bg-muted/30 text-muted-foreground border-border",
  };
  const riskLabel: Record<string, string> = {
    danger: "Blacklisted", warning: "Datacenter", info: "VPN/Proxy", clean: "Clean", unknown: "Unknown",
  };

  const ipSummary = ipData ? {
    total:       ipData.length,
    blacklisted: ipData.filter(i => (i.privacy?.blacklistTrue ?? 0) > 0).length,
    hosting:     ipData.filter(i => i.privacy?.isHosting).length,
    clustered:   ipData.filter(i => i.subdomains.length > 1).length,
    clean:       ipData.filter(i => ipRiskLevel(i) === "clean").length,
  } : null;

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-5xl">

        {/* Search card */}
        <div className="glass-card p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-primary/10">
              <Globe className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Subdomain & IP Risk Scanner</h1>
              <p className="text-muted-foreground text-sm">
                Discover subdomains · Resolve IPs · Detect blacklisted & datacenter infrastructure
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !isScanning && handleScan()}
                placeholder="example.com"
                className="input-cyber w-full pl-12 font-mono"
              />
            </div>
            <button
              onClick={handleScan}
              disabled={isScanning || !domain}
              className="btn-primary flex items-center gap-2 px-6"
            >
              {isScanning ? <><Loader2 className="w-4 h-4 animate-spin" />Scanning…</> : <><Search className="w-4 h-4" />Scan</>}
            </button>
          </div>

          {error && <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">{error}</div>}

          {isScanning && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">Querying HackerTarget + crt.sh certificate transparency logs…</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full animate-pulse w-2/3" />
              </div>
            </div>
          )}
        </div>

        {/* Info cards - empty state */}
        {!results && !isScanning && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { icon: Globe,         label: "HackerTarget",    desc: "Active subdomain enumeration with IP resolution" },
              { icon: Shield,        label: "crt.sh",          desc: "SSL certificate logs reveal hidden subdomains" },
              { icon: AlertTriangle, label: "Risk Flagging",   desc: "Flags admin, api, dev, vpn and 20+ sensitive patterns" },
              { icon: Database,      label: "IP Intelligence", desc: "Blacklist check, hosting detection & geo per IP" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="glass-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">{label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-5 animate-fade-in">

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total Subdomains",   value: results.total,                                      color: "text-primary" },
                { label: "Sensitive",           value: results.interesting.length,                         color: results.interesting.length > 0 ? "text-warning" : "text-foreground" },
                { label: "IPs Resolved",        value: results.subdomains.filter(s => s.ip).length,        color: "text-foreground" },
                { label: "Unique IPs",          value: new Set(results.subdomains.map(s => s.ip).filter(Boolean)).size, color: "text-foreground" },
              ].map(s => (
                <div key={s.label} className="glass-card p-4 text-center">
                  <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Sensitive alert */}
            {results.interesting.length > 0 && (
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-warning">{results.interesting.length} sensitive subdomain{results.interesting.length > 1 ? "s" : ""} detected</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Patterns like admin, api, dev, staging and vpn may expose internal services to the public internet.</p>
                </div>
              </div>
            )}

            {/* Analyze IPs button */}
            {!ipData && !isAnalyzingIPs && (
              <button
                onClick={handleAnalyzeIPs}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all text-sm font-medium text-primary"
              >
                <Zap className="w-4 h-4" />
                Analyze IPs - check blacklists, hosting & geolocation for all {new Set(results.subdomains.map(s => s.ip).filter(Boolean)).size} resolved IPs
              </button>
            )}

            {/* IP analysis progress */}
            {isAnalyzingIPs && (
              <div className="glass-card p-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>Analyzing IPs… checking blacklists & geolocation</span>
                  </div>
                  <span className="font-medium text-primary">{ipProgress}/{ipTotal}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300 rounded-full"
                    style={{ width: `${ipTotal > 0 ? (ipProgress / ipTotal) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Running {Math.min(5, ipTotal)} IPs in parallel against 38 DNSBL servers + hosting detection</p>
              </div>
            )}

            {/* IP Analysis results */}
            {ipData && ipSummary && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">IP Intelligence Report</h2>
                </div>

                {/* IP summary stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Blacklisted",    value: ipSummary.blacklisted, color: ipSummary.blacklisted > 0 ? "text-destructive" : "text-foreground", bg: ipSummary.blacklisted > 0 ? "border-destructive/20" : "" },
                    { label: "Datacenter/CDN", value: ipSummary.hosting,     color: ipSummary.hosting > 0 ? "text-warning" : "text-foreground",        bg: ipSummary.hosting > 0 ? "border-warning/20" : "" },
                    { label: "IP Clusters",    value: ipSummary.clustered,   color: ipSummary.clustered > 0 ? "text-primary" : "text-foreground",      bg: "" },
                    { label: "Clean IPs",      value: ipSummary.clean,       color: "text-success",                                                    bg: "" },
                  ].map(s => (
                    <div key={s.label} className={`glass-card p-3 text-center border ${s.bg || "border-border/20"}`}>
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* IP cluster warning */}
                {ipSummary.clustered > 0 && (
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-3">
                    <Server className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-primary">{ipSummary.clustered} shared IP{ipSummary.clustered > 1 ? "s" : ""} - multiple subdomains on one server</p>
                      <p className="text-xs text-muted-foreground mt-0.5">A single vulnerability or blacklisting affects all subdomains sharing that IP.</p>
                    </div>
                  </div>
                )}

                {/* Per-IP cards */}
                <div className="space-y-3">
                  {ipData.map(info => {
                    const level = ipRiskLevel(info);
                    const isExpanded = expandedIP === info.ip;
                    return (
                      <div key={info.ip} className={`glass-card overflow-hidden border ${riskBadge[level].split(" ").find(c => c.startsWith("border")) || "border-border/20"}`}>
                        {/* IP row header */}
                        <button
                          onClick={() => setExpandedIP(isExpanded ? null : info.ip)}
                          className="w-full flex items-center gap-3 p-4 hover:bg-muted/20 transition-colors text-left"
                        >
                          <div className={`px-2 py-1 rounded-md text-xs font-medium border ${riskBadge[level]}`}>
                            {riskLabel[level]}
                          </div>
                          <span className="font-mono text-sm font-medium">{info.ip}</span>
                          {info.subdomains.length > 1 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              {info.subdomains.length} subdomains
                            </span>
                          )}
                          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                            {info.location && <span>{info.location.country}</span>}
                            {info.network?.isp && <span className="hidden sm:block truncate max-w-[150px]">{info.network.isp}</span>}
                            {info.privacy?.blacklistTrue > 0 && (
                              <span className="text-destructive font-medium">
                                {info.privacy.blacklistTrue} blacklists
                              </span>
                            )}
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </button>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-border/30 pt-4 space-y-4">
                            {info.error ? (
                              <p className="text-sm text-muted-foreground">Could not analyze: {info.error}</p>
                            ) : (
                              <>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {info.location && (
                                    <div className="p-3 rounded-lg bg-muted/30 flex items-start gap-2">
                                      <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-xs text-muted-foreground">Location</p>
                                        <p className="text-sm font-medium">{info.location.city || info.location.region}, {info.location.country}</p>
                                      </div>
                                    </div>
                                  )}
                                  {info.network?.isp && (
                                    <div className="p-3 rounded-lg bg-muted/30 flex items-start gap-2">
                                      <Building className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-xs text-muted-foreground">ISP / Org</p>
                                        <p className="text-sm font-medium">{info.network.isp}</p>
                                      </div>
                                    </div>
                                  )}
                                  <div className="p-3 rounded-lg bg-muted/30 flex items-start gap-2">
                                    <Wifi className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                    <div>
                                      <p className="text-xs text-muted-foreground">Flags</p>
                                      <p className="text-sm font-medium">
                                        {[
                                          info.privacy?.isVPN     && "VPN",
                                          info.privacy?.isProxy   && "Proxy",
                                          info.privacy?.isTor     && "Tor",
                                          info.privacy?.isHosting && "Datacenter",
                                        ].filter(Boolean).join(", ") || "None"}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Blacklist detail */}
                                {info.privacy?.blacklistTrue > 0 && (
                                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                    <div className="flex items-center gap-2 mb-2">
                                      <ShieldAlert className="w-4 h-4 text-destructive" />
                                      <span className="text-sm font-medium text-destructive">
                                        Listed on {info.privacy.blacklistTrue} of {info.privacy.blacklistChecks} DNSBL servers
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground font-mono">
                                      {info.privacy.blacklistedOn.slice(0, 5).join(" · ")}
                                      {info.privacy.blacklistedOn.length > 5 && ` +${info.privacy.blacklistedOn.length - 5} more`}
                                    </p>
                                  </div>
                                )}

                                {/* Subdomains on this IP */}
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    Subdomains on this IP ({info.subdomains.length})
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {info.subdomains.map(s => {
                                      const sensitive = INTERESTING_RE.test(s.replace("." + results.domain, ""));
                                      return (
                                        <div key={s} className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono ${sensitive ? "bg-warning/10 text-warning border border-warning/20" : "bg-muted/30 text-muted-foreground"}`}>
                                          {sensitive && <AlertTriangle className="w-3 h-3" />}
                                          {s}
                                          <a href={`https://${s}`} target="_blank" rel="noopener noreferrer" className="ml-1 opacity-60 hover:opacity-100">
                                            <ExternalLink className="w-2.5 h-2.5" />
                                          </a>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Subdomain list */}
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 bg-muted/10 flex items-center justify-between flex-wrap gap-2">
                <div className="flex gap-2">
                  {(["all", "interesting"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        filter === f ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {f === "all" ? `All (${results.total})` : `Sensitive (${results.interesting.length})`}
                    </button>
                  ))}
                </div>
                <button onClick={copyAll} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted/30 hover:bg-muted/50 text-xs transition-colors">
                  <Copy className="w-3 h-3" />
                  {copied ? "Copied!" : "Copy all"}
                </button>
              </div>

              <div className="px-4 py-2 border-b border-border/20 bg-muted/5 grid grid-cols-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span className="col-span-2">Subdomain</span>
                <span className="text-right">IP Address</span>
              </div>

              <div className="divide-y divide-border/20 max-h-[450px] overflow-y-auto">
                {displayed.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success/50" />
                    No sensitive subdomains found.
                  </div>
                ) : displayed.map(({ sub, ip }) => {
                  const interesting = INTERESTING_RE.test(sub.replace("." + results.domain, ""));
                  const ipLevel = ip && ipData ? ipRiskLevel(ipData.find(i => i.ip === ip)!) : null;
                  return (
                    <div key={sub} className={`grid grid-cols-3 items-center px-4 py-2.5 hover:bg-muted/20 transition-colors ${interesting ? "bg-warning/5" : ""}`}>
                      <div className="col-span-2 flex items-center gap-2 min-w-0">
                        {interesting
                          ? <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                          : <Server className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />}
                        <span className={`text-sm font-mono truncate ${interesting ? "text-warning" : ""}`}>{sub}</span>
                        <a href={`https://${sub}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        {ipLevel && ipLevel !== "clean" && ipLevel !== "unknown" && (
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${riskBadge[ipLevel]}`}>
                            {riskLabel[ipLevel]}
                          </span>
                        )}
                        <span className="text-xs font-mono text-muted-foreground">{ip || "-"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default SubdomainScan;

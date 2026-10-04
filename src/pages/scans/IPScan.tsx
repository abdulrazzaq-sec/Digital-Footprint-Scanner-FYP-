import { useState, useEffect } from "react";
import {
  Globe, Search, MapPin, Building, Shield, AlertTriangle,
  CheckCircle, XCircle, Loader2, Wifi, Eye, EyeOff,
} from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import { useAuth } from "@/contexts/AuthContext";

const BACKEND = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface IPResult {
  ip: string;
  version: string;
  location: {
    city: string;
    region: string;
    country: string;
    countryCode: string;
  };
  network: {
    isp: string;
    org: string | null;
    as: string | null;
    mobile: boolean;
  };
  privacy: {
    isVPN: boolean;
    isProxy: boolean;
    isTor: boolean;
    isHosting: boolean;
    vpnProvider: string | null;
    proxyType: string | null;
    blacklistChecks: number;
    blacklistTrue: number;
    blacklistedOn: string[];
  };
}

const IPScan = () => {
  const [ipAddress, setIpAddress]     = useState("");
  const [detectedIP, setDetectedIP]   = useState("");
  const [isScanning, setIsScanning]   = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults]         = useState<IPResult | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const { saveScanResult } = useAuth();

  const [webrtcStatus, setWebrtcStatus]     = useState<"safe"|"leaked"|"na">("na");
  const [webrtcLocalIPs, setWebrtcLocalIPs] = useState<string[]>([]);

  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then(r => r.json())
      .then(d => { setDetectedIP(d.ip); setIpAddress(d.ip); })
      .catch(() => setDetectedIP("Unable to detect"));
  }, []);

  async function getLocalIPs(): Promise<string[]> {
    return new Promise(resolve => {
      const ips = new Set<string>();
      const pc  = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel("");
      pc.onicecandidate = e => {
        if (!e.candidate) { resolve(Array.from(ips)); return; }
        const m = e.candidate.candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})|([a-f0-9:]+:+[a-f0-9]+)/g);
        if (m) m.forEach(ip => ips.add(ip));
      };
      pc.createOffer().then(o => pc.setLocalDescription(o)).catch(() => resolve([]));
      setTimeout(() => resolve(Array.from(ips)), 3000);
    });
  }

  const handleScan = async () => {
    if (!ipAddress) return;
    setIsScanning(true);
    setShowResults(false);
    setError(null);

    try {
      const localIPs = await getLocalIPs();
      setWebrtcLocalIPs(localIPs);
      setWebrtcStatus(
        ipAddress === detectedIP
          ? localIPs.includes(detectedIP) ? "leaked" : "safe"
          : "na"
      );

      const res  = await fetch(`${BACKEND}/scan-ip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: ipAddress }),
      });
      const data: IPResult = await res.json();
      if (!res.ok) throw new Error((data as any).error || "Scan failed");

      setResults(data);

      const score = data.privacy.blacklistTrue > 0
        ? Math.min(40 + data.privacy.blacklistTrue * 5, 100)
        : 0;

      saveScanResult("ip", { ip: data.ip, riskScore: score, location: data.location.city });
      setShowResults(true);
    } catch (err: any) {
      setError(err.message || "Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  const privacyScore = results
    ? results.privacy.blacklistTrue > 0
      ? Math.min(40 + results.privacy.blacklistTrue * 5, 100)
      : 0
    : 0;

  const isBlacklisted = (results?.privacy.blacklistTrue ?? 0) > 0;

  const PrivacyRow = ({
    icon: Icon, label, value, detected, detectedBad = false, sub,
  }: {
    icon: typeof Shield;
    label: string;
    value: string;
    detected: boolean;
    detectedBad?: boolean;
    sub?: string;
  }) => {
    const highlight = detected ? (detectedBad ? "bg-destructive/10 border border-destructive/20" : "bg-success/10 border border-success/20") : "bg-muted/30";
    const iconColor = detected ? (detectedBad ? "text-destructive" : "text-success") : "text-muted-foreground";
    const badgeCls  = detected ? (detectedBad ? "badge-danger" : "badge-success") : "badge-warning";
    return (
      <div className={`flex items-center justify-between p-4 rounded-lg ${highlight}`}>
        <div className="flex items-center gap-3 min-w-0">
          <Icon className={`w-5 h-5 shrink-0 ${iconColor}`} />
          <div className="min-w-0">
            <span className="text-sm font-medium">{label}</span>
            {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
          </div>
        </div>
        <span className={`${badgeCls} shrink-0 ml-3`}>{value}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left panel */}
          <div className="space-y-6">
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Globe className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">IP Privacy Scanner</h1>
                  <p className="text-muted-foreground text-sm">
                    VPN, proxy, Tor, location & blacklist detection
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Your detected IP</p>
                  <p className="text-xl font-mono font-bold text-primary">{detectedIP || "Detecting…"}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Or scan a different IP</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="text"
                      value={ipAddress}
                      onChange={e => setIpAddress(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleScan()}
                      placeholder="e.g. 185.38.150.213"
                      className="input-cyber w-full pl-12 font-mono"
                    />
                  </div>
                </div>

                <button
                  onClick={handleScan}
                  disabled={isScanning || !ipAddress}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {isScanning
                    ? <><Loader2 className="w-5 h-5 animate-spin" />Scanning…</>
                    : <><Search className="w-5 h-5" />Scan IP Address</>}
                </button>

                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    {error}
                  </div>
                )}
              </div>
            </div>

            {/* Detection sources info */}
            <div className="glass-card p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Detection sources</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>ip-api.com</span><span className="text-foreground">Geo + broad proxy/hosting</span></div>
                <div className="flex justify-between"><span>proxycheck.io</span><span className="text-foreground">VPN type classification</span></div>
                <div className="flex justify-between"><span>ISP name matching</span><span className="text-foreground">30+ known VPN providers</span></div>
                <div className="flex justify-between"><span>DNSBL ({results?.privacy.blacklistChecks ?? 38} servers)</span><span className="text-foreground">Spam / abuse blacklists</span></div>
                <div className="flex justify-between"><span>WebRTC</span><span className="text-foreground">Real IP leak test (browser)</span></div>
              </div>
            </div>
          </div>

          {/* Right panel */}
          {!showResults && !isScanning ? (
            <div className="flex items-center justify-center">
              <div className="text-center glass-card p-12 w-full">
                <Globe className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Click Scan to Analyze</h3>
                <p className="text-muted-foreground text-sm">
                  Checks for VPN, proxy, Tor, datacenter hosting, blacklists and WebRTC leaks.
                </p>
              </div>
            </div>
          ) : (
            showResults && results && (
              <div className="space-y-6 animate-fade-in">

                {/* IP overview */}
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-semibold">IP Information</h2>
                      <p className="text-sm text-muted-foreground font-mono">
                        {results.ip} ({results.version})
                      </p>
                    </div>
                    <RiskGauge score={privacyScore} size="sm" label="Risk" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Location</span>
                      </div>
                      <p className="text-sm">{results.location.city}, {results.location.region}</p>
                      <p className="text-xs text-muted-foreground">{results.location.country}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Building className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Network</span>
                      </div>
                      <p className="text-sm truncate" title={results.network.isp}>{results.network.isp}</p>
                      {results.network.as && (
                        <p className="text-xs text-muted-foreground">{results.network.as}</p>
                      )}
                      {results.network.mobile && (
                        <p className="text-xs text-warning mt-1">Mobile network</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Privacy analysis */}
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-4">Privacy Analysis</h2>
                  <div className="space-y-3">

                    <PrivacyRow
                      icon={Eye}
                      label="VPN Detected"
                      value={results.privacy.isVPN ? "Yes" : "No"}
                      detected={results.privacy.isVPN}
                      detectedBad={false}
                      sub={results.privacy.isVPN && results.privacy.vpnProvider
                        ? `Provider: ${results.privacy.vpnProvider}`
                        : results.privacy.isVPN ? "VPN active" : undefined}
                    />

                    <PrivacyRow
                      icon={Shield}
                      label="Proxy Detected"
                      value={results.privacy.isProxy
                        ? (results.privacy.proxyType || "Yes")
                        : "No"}
                      detected={results.privacy.isProxy}
                      detectedBad={false}
                    />

                    <PrivacyRow
                      icon={EyeOff}
                      label="Tor Exit Node"
                      value={results.privacy.isTor ? "Yes" : "No"}
                      detected={results.privacy.isTor}
                      detectedBad={false}
                    />

                    <PrivacyRow
                      icon={Building}
                      label="Datacenter / Hosting IP"
                      value={results.privacy.isHosting ? "Yes" : "No"}
                      detected={results.privacy.isHosting}
                      detectedBad={results.privacy.isHosting}
                      sub={results.privacy.isHosting ? "IP belongs to a cloud/VPS provider" : undefined}
                    />

                    <PrivacyRow
                      icon={Globe}
                      label="Blacklist Status"
                      value={isBlacklisted
                        ? `Listed (${results.privacy.blacklistTrue}/${results.privacy.blacklistChecks})`
                        : `Clean (0/${results.privacy.blacklistChecks})`}
                      detected={isBlacklisted}
                      detectedBad={isBlacklisted}
                      sub={isBlacklisted ? results.privacy.blacklistedOn.slice(0, 2).join(", ") + (results.privacy.blacklistedOn.length > 2 ? ` +${results.privacy.blacklistedOn.length - 2} more` : "") : undefined}
                    />

                  </div>
                </div>

                {/* Leak tests */}
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-4">Leak Tests</h2>
                  <div className="space-y-3">

                    <div className={`p-4 rounded-lg ${
                      webrtcStatus === "leaked"
                        ? "bg-destructive/10 border border-destructive/20"
                        : webrtcStatus === "safe"
                        ? "bg-success/10 border border-success/20"
                        : "bg-muted/30"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Wifi className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm">WebRTC Leak</span>
                        </div>
                        {webrtcStatus === "leaked" && (
                          <span className="badge-danger flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Leaked
                          </span>
                        )}
                        {webrtcStatus === "safe" && (
                          <span className="badge-success flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Secure
                          </span>
                        )}
                        {webrtcStatus === "na" && (
                          <span className="badge-warning">N/A</span>
                        )}
                      </div>
                      {webrtcStatus === "leaked" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Real IP exposed via WebRTC: {webrtcLocalIPs.join(", ")}
                        </p>
                      )}
                      {webrtcStatus === "na" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Scanning a different IP - WebRTC test only applies to your own IP.
                        </p>
                      )}
                    </div>

                  </div>
                </div>

                {/* Recommendations */}
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-4">Recommendations</h2>
                  <div className="space-y-3">
                    {[
                      !results.privacy.isVPN && {
                        text: "Use a VPN to mask your real IP address",
                        priority: "high",
                      },
                      results.privacy.isHosting && !results.privacy.isVPN && {
                        text: "This IP is a datacenter/hosting address - unusual for a personal connection",
                        priority: "medium",
                      },
                      isBlacklisted && {
                        text: `IP is on ${results.privacy.blacklistTrue} spam/abuse blacklist(s) - may affect email deliverability`,
                        priority: "high",
                      },
                      webrtcStatus === "leaked" && {
                        text: "Disable WebRTC in your browser - it's leaking your real IP",
                        priority: "high",
                      },
                      {
                        text: "Configure DNS over HTTPS (DoH) to prevent DNS leaks",
                        priority: "medium",
                      },
                      {
                        text: "Use Tor Browser for highly sensitive browsing",
                        priority: "low",
                      },
                    ].filter(Boolean).map((rec: any, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <AlertTriangle className={`w-4 h-4 shrink-0 ${
                          rec.priority === "high"   ? "text-amber-600" :
                          rec.priority === "medium" ? "text-blue-500"  : "text-muted-foreground"
                        }`} />
                        <span className="text-sm">{rec.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default IPScan;

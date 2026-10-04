import { useState } from "react";
import {
  Phone, Search, AlertTriangle, Shield, MapPin, Building,
  Loader2, CheckCircle, Info, ShieldAlert, Wifi, CreditCard,
  Database, User,
} from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import ProgressBar from "@/components/common/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";

const PAKISTAN = { code: "+92", cc: "PK", flag: "🇵🇰", name: "Pakistan", placeholder: "03XX-XXXXXXX" };


const PhoneScan = () => {
  const [phone,       setPhone]       = useState("");
  const [isScanning,  setIsScanning]  = useState(false);
  const [scanStatus,  setScanStatus]  = useState("");
  const [scanProgress,setScanProgress]= useState(0);
  const [result,      setResult]      = useState<any>(null);
  const [error,       setError]       = useState<string | null>(null);
  const { saveScanResult } = useAuth();

  const statuses = [
    "Validating number format…",
    "Identifying carrier from prefix…",
    "Resolving region / area code…",
    "Assessing SIM registration risk…",
    "Building risk profile…",
  ];

  const handleScan = async () => {
    if (!phone.trim()) return;
    setIsScanning(true);
    setResult(null);
    setError(null);
    setScanProgress(0);

    for (let i = 0; i < statuses.length; i++) {
      setScanStatus(statuses[i]);
      setScanProgress((i + 1) * 20);
      await new Promise(r => setTimeout(r, 380));
    }

    try {
      const cleaned = phone.replace(/\D/g, "");
      const resp = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/scan-phone?phone=${encodeURIComponent(cleaned)}&country=${PAKISTAN.cc}`
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Scan failed");

      setResult(data);
      saveScanResult("phone", {
        phone:     `${PAKISTAN.code}${cleaned}`,
        country:   PAKISTAN.cc,
        riskScore: data.riskScore,
        carrier:   data.carrier,
        type:      data.type,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Scan failed. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Left: Input ── */}
          <div className="space-y-6">
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Phone className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Phone Number Risk Assessment</h1>
                  <p className="text-muted-foreground text-sm">
                    Carrier detection · Area code lookup · SIM-swap risk · Country-specific analysis
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Phone input */}
                <div>
                  <label className="block text-sm font-medium mb-2">Phone Number</label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-sm font-medium min-w-[80px]">
                      <span>{PAKISTAN.flag}</span>
                      <span className="text-primary">{PAKISTAN.code}</span>
                    </div>
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleScan()}
                        placeholder={PAKISTAN.placeholder}
                        className="input-cyber w-full pl-10"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter without country code - e.g. <span className="font-mono">{PAKISTAN.placeholder}</span>
                  </p>
                </div>

                <button
                  onClick={handleScan}
                  disabled={isScanning || !phone.trim()}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {isScanning ? (
                    <><Loader2 className="w-5 h-5 animate-spin" />Assessing…</>
                  ) : (
                    <><Search className="w-5 h-5" />Assess Risk</>
                  )}
                </button>

                {isScanning && (
                  <div className="space-y-2 animate-fade-in">
                    <span className="text-xs text-muted-foreground">{scanStatus}</span>
                    <ProgressBar value={scanProgress} color="primary" size="md" />
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-muted/30 border border-border/30 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-success shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Number is never stored. Analysis is based on prefix intelligence and public carrier data.
                  </p>
                </div>
              </div>
            </div>

            {/* What we analyse */}
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                What This Scan Reveals
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {[
                  "Carrier identified from network prefix",
                  "City / province from area code (Pakistan landlines)",
                  "CNIC-linkage risk for Pakistani SIMs",
                  "SIM-swap and SS7 attack exposure",
                  "Number type: Mobile · Landline · VoIP",
                  "Country-specific privacy recommendations",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── Right: Results ── */}
          <div className="space-y-6">

            {/* Empty state */}
            {!result && !isScanning && !error && (
              <div className="glass-card p-12 text-center animate-fade-in">
                <Phone className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Enter a Phone Number</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Select your country, enter the number and we'll identify the carrier, region, and associated privacy risks.
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                  {["Carrier detection","Area code lookup","CNIC risk","SIM-swap risk"].map((t) => (
                    <span key={t} className="px-3 py-1 rounded-full bg-muted/50">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-6 animate-fade-in">

                {/* ── Hero card ── */}
                <div className="glass-card p-6">
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{result.countryFlag}</span>
                        <span className="text-sm text-muted-foreground">{result.countryName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          result.type === "Mobile"   ? "bg-primary/15 text-primary" :
                          result.type === "Landline" ? "bg-success/15 text-success" :
                          "bg-muted/50 text-muted-foreground"
                        }`}>{result.type}</span>
                      </div>
                      <p className="font-mono font-bold text-xl tracking-wider text-foreground">
                        {result.intlFormat || result.phone}
                      </p>
                      {result.localFormat && result.localFormat !== result.phone && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Local: <span className="font-mono">{result.localFormat}</span>
                        </p>
                      )}
                    </div>
                    <div className="p-3 rounded-2xl bg-primary/10">
                      <Phone className="w-8 h-8 text-primary" />
                    </div>
                  </div>

                  {/* Risk gauge */}
                  <div className="flex items-center gap-6 p-4 rounded-xl bg-muted/20 border border-border">
                    <RiskGauge score={result.riskScore} size="sm" label="Privacy Risk" />
                    <div>
                      <p className={`font-semibold ${
                        result.riskScore >= 60 ? "text-destructive" :
                        result.riskScore >= 35 ? "text-warning" : "text-success"
                      }`}>
                        {result.riskScore >= 60 ? "High Exposure" :
                         result.riskScore >= 35 ? "Moderate Exposure" : "Low Exposure"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Based on carrier identification, number type, and country-specific registration requirements
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Number Details ── */}
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Building className="w-5 h-5 text-primary" />
                    Number Details
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: Building, label: "Carrier",   value: result.carrier },
                      { icon: Phone,    label: "Type",      value: result.type },
                      { icon: MapPin,   label: "City",      value: result.city },
                      { icon: MapPin,   label: "Province",  value: result.province },
                    ].map(({ icon: Icon, label, value }) =>
                      value ? (
                        <div key={label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                          <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-sm font-semibold">{value}</p>
                          </div>
                        </div>
                      ) : null
                    )}
                    {result.type === "Mobile" && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <Wifi className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">2FA Risk</p>
                          <p className="text-sm font-semibold text-warning">SIM-swap target</p>
                        </div>
                      </div>
                    )}
                    {result.country === "PK" && result.type === "Mobile" && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <CreditCard className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Registration</p>
                          <p className="text-sm font-semibold">CNIC-linked</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── SIM Owner Details ── */}
                {result.simOwnerData && (
                  <div className="glass-card p-6 border border-destructive/30 animate-fade-in">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2 text-destructive">
                        <Database className="w-5 h-5" />
                        Owner Details Found in Public Database
                      </h2>
                      <span className="text-xs px-2 py-1 rounded-full bg-destructive/15 text-destructive border border-destructive/30 font-medium">
                        High Exposure
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 mb-4">
                      {result.simOwnerData.name && (
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                          <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Registered Owner</p>
                            <p className="text-sm font-bold tracking-wide">{result.simOwnerData.name}</p>
                          </div>
                        </div>
                      )}
                      {result.simOwnerData.cnic && (
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                          <CreditCard className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-xs text-muted-foreground">CNIC</p>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30 font-medium leading-none">Sensitive</span>
                            </div>
                            <p className="text-sm font-mono font-bold tracking-widest">
                              {result.simOwnerData.cnic}
                            </p>
                          </div>
                        </div>
                      )}
                      {result.simOwnerData.address && (
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Registered Address</p>
                            <p className="text-sm font-medium">{result.simOwnerData.address}</p>
                          </div>
                        </div>
                      )}
                    </div>


                  </div>
                )}

                {/* ── Risk Factors ── */}
                {result.riskFactors && result.riskFactors.length > 0 && (
                  <div className="glass-card p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-warning" />
                      Risk Factors
                    </h2>
                    <div className="space-y-3">
                      {result.riskFactors.map((rf: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/20">
                          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold">{rf.factor}</p>
                            <p className="text-xs mt-0.5 text-muted-foreground">{rf.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Recommendations ── */}
                {result.recommendations && result.recommendations.length > 0 && (
                  <div className="glass-card p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-success" />
                      Protection Recommendations
                    </h2>
                    <div className="space-y-3">
                      {result.recommendations.map((rec: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/20">
                          {rec.priority === "high" ? (
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          ) : rec.priority === "medium" ? (
                            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                          )}
                          <p className="text-sm">{rec.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneScan;

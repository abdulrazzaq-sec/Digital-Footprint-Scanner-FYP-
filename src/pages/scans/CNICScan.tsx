import { useState } from "react";
import { CreditCard, Search, Loader2, AlertTriangle, CheckCircle, XCircle, Phone, MapPin, User, Shield } from "lucide-react";
import ProgressBar from "@/components/common/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";

const BACKEND = import.meta.env.VITE_API_URL || "http://localhost:5000";

const CARRIER_COLORS: Record<string, string> = {
  Jazz:    "text-orange-400",
  Zong:    "text-blue-400",
  Telenor: "text-cyan-400",
  Ufone:   "text-green-400",
};

function formatCnic(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12, 13)}`;
}

const CNICScan = () => {
  const [cnicInput, setCnicInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const { saveScanResult } = useAuth();

  const handleInput = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 13);
    setCnicInput(formatCnic(digits));
  };

  const rawDigits = cnicInput.replace(/\D/g, "");
  const isValid = rawDigits.length === 13;

  const handleScan = async () => {
    if (!isValid) return;
    setIsScanning(true);
    setError(null);
    setResult(null);
    setScanProgress(0);

    const steps = [
      { msg: "Validating CNIC format…", pct: 25 },
      { msg: "Querying public SIM database…", pct: 60 },
      { msg: "Processing results…", pct: 90 },
    ];

    for (const step of steps) {
      setScanProgress(step.pct);
      await new Promise(r => setTimeout(r, 350));
    }

    try {
      const resp = await fetch(`${BACKEND}/scan-cnic?cnic=${rawDigits}`);
      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || "Lookup failed. Please try again.");
        setIsScanning(false);
        return;
      }

      setScanProgress(100);
      setResult(data);
      saveScanResult("cnic", {
        cnic:     data.cnic,
        found:    data.found,
        simCount: data.simCount ?? 0,
      });
    } catch {
      setError("Could not reach the server. Make sure the backend is running.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <CreditCard className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">CNIC Lookup</h1>
                  <p className="text-muted-foreground text-sm">Find SIMs registered to a Pakistani CNIC</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">CNIC Number</label>
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="text"
                      value={cnicInput}
                      onChange={e => handleInput(e.target.value)}
                      placeholder="XXXXX-XXXXXXX-X"
                      className="input-cyber w-full pl-12 font-mono tracking-wider"
                      maxLength={15}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {rawDigits.length}/13 digits {isValid && <span className="text-success">✓</span>}
                  </p>
                </div>

                <button
                  onClick={handleScan}
                  disabled={isScanning || !isValid}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Searching…
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Lookup CNIC
                    </>
                  )}
                </button>

                {isScanning && (
                  <div className="space-y-2 animate-fade-in">
                    <ProgressBar value={scanProgress} color="primary" size="md" />
                    <p className="text-xs text-center text-muted-foreground animate-pulse">
                      Querying public SIM registration database…
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
              </div>
            </div>

            {result && (
              <div className="glass-card p-5 animate-fade-in">
                <h3 className="font-semibold mb-3">Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Status</span>
                    {result.found ? (
                      <span className="flex items-center gap-1 text-success text-sm font-medium">
                        <CheckCircle className="w-4 h-4" /> Found
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground text-sm">
                        <XCircle className="w-4 h-4" /> Not found
                      </span>
                    )}
                  </div>
                  {result.found && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">SIMs registered</span>
                        <span className="text-2xl font-bold text-primary">{result.simCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">Owner</span>
                        <span className="text-sm font-medium">{result.ownerName}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-2">
            {!result && !isScanning ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center glass-card p-12 w-full">
                  <CreditCard className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Enter a CNIC</h3>
                  <p className="text-muted-foreground">
                    Enter a 13-digit Pakistani CNIC to find all SIM cards registered under it.
                  </p>
                </div>
              </div>
            ) : result && (
              <div className="space-y-6 animate-fade-in">

                {/* CNIC Header */}
                <div className="glass-card p-6">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">CNIC</p>
                      <p className="text-2xl font-mono font-bold text-primary tracking-widest">{result.cnic}</p>
                      {result.ownerName && (
                        <div className="flex items-center gap-2 mt-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-lg font-semibold">{result.ownerName}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {result.found ? (
                        <span className="badge-danger">
                          {result.simCount} SIM{result.simCount !== 1 ? "s" : ""} Found
                        </span>
                      ) : (
                        <span className="badge-success">No Records</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* SIM Cards */}
                {result.found && result.sims?.length > 0 && (
                  <div className="glass-card p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Phone className="w-5 h-5 text-primary" />
                      Registered SIM Cards ({result.simCount})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {result.sims.map((sim: any, i: number) => (
                        <div key={i} className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider">SIM #{i + 1}</span>
                            {sim.carrier && (
                              <span className={`text-sm font-semibold ${CARRIER_COLORS[sim.carrier] || "text-primary"}`}>
                                {sim.carrier}
                              </span>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="font-mono text-base font-bold tracking-wide">{sim.mobile || "-"}</span>
                            </div>

                            {sim.address && (
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                <span className="text-xs text-muted-foreground leading-relaxed">{sim.address}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Not found */}
                {!result.found && (
                  <div className="glass-card p-8 text-center">
                    <XCircle className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold mb-2">No Records Found</h3>
                    <p className="text-muted-foreground text-sm">
                      This CNIC does not appear in the public SIM registration database.
                    </p>
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

export default CNICScan;

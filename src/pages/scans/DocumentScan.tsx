import { useState, useRef } from "react";
import {
  FileText, Upload, Search, AlertTriangle, User, Building, Clock,
  Eye, X, File, Shield, ShieldAlert, ShieldCheck, MapPin, Camera,
  Hash, Info, ChevronDown, ChevronUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BACKEND = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface Threat {
  name: string;
  severity: "critical" | "high" | "medium" | "low";
  detail: string;
}
interface PrivacyRisk {
  type: string;
  detail: string;
  severity: "high" | "medium" | "low";
}
interface VtResult {
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  total: number;
  detectedBy: { engine: string; result: string; category: string }[];
  fileName?: string;
  fileType?: string;
  notFound?: boolean;
}
interface DocMeta {
  author?: string;
  lastSavedBy?: string;
  creator?: string;
  producer?: string;
  software?: string;
  company?: string;
  title?: string;
  subject?: string;
  keywords?: string;
  description?: string;
  created?: string;
  modified?: string;
  pageCount?: number;
  pages?: string;
  words?: string;
  slides?: string;
  revisions?: number;
  totalEditMinutes?: number;
  template?: string;
  camera?: string;
  gps?: { lat: number; lon: number };
  width?: number;
  height?: number;
  colorSpace?: string;
}
interface ScanResult {
  filename: string;
  fileType: string;
  fileSize: number;
  sha256: string;
  magicType: string;
  mimeMatch: boolean;
  meta: DocMeta;
  threats: Threat[];
  virusTotal: VtResult | null;
  privacyRisks: PrivacyRisk[];
  threatLevel: "Clean" | "Potentially Unsafe" | "Suspicious" | "Malicious";
  riskLevel: "Low" | "Medium" | "High";
}

function formatBytes(n: number) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}
function fmtDate(s?: string | null) {
  if (!s) return null;
  try { return new Date(s).toLocaleString(); } catch { return s; }
}
function fmtMinutes(m: number) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

const severityColor: Record<string, string> = {
  critical: "text-red-500 bg-red-500/10 border-red-500/30",
  high:     "text-destructive bg-destructive/10 border-destructive/20",
  medium:   "text-warning bg-warning/10 border-warning/20",
  low:      "text-muted-foreground bg-muted/30 border-border",
};
const severityBadge: Record<string, string> = {
  critical: "bg-red-500 text-white",
  high:     "bg-destructive text-white",
  medium:   "bg-warning text-white",
  low:      "bg-muted text-muted-foreground",
};

function ThreatBadge({ level }: { level: string }) {
  const map: Record<string, { icon: typeof Shield; cls: string }> = {
    Clean:            { icon: ShieldCheck, cls: "text-success bg-success/10 border-success/20" },
    "Potentially Unsafe": { icon: ShieldAlert, cls: "text-warning bg-warning/10 border-warning/20" },
    Suspicious:       { icon: ShieldAlert, cls: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
    Malicious:        { icon: ShieldAlert, cls: "text-red-500 bg-red-500/10 border-red-500/20" },
  };
  const { icon: Icon, cls } = map[level] || map["Clean"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-medium ${cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {level}
    </span>
  );
}

const DocumentScan = () => {
  const [isScanning, setIsScanning]   = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus]   = useState("");
  const [showResults, setShowResults] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [results, setResults]         = useState<ScanResult | null>(null);
  const [activeTab, setActiveTab]     = useState("metadata");
  const [vtExpanded, setVtExpanded]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { saveScanResult } = useAuth();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setShowResults(false);
      setResults(null);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setUploadedFile(file);
      setShowResults(false);
      setResults(null);
      setError(null);
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    setShowResults(false);
    setResults(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleScan = async () => {
    if (!uploadedFile) return;
    setIsScanning(true);
    setScanProgress(0);
    setError(null);
    setShowResults(false);

    const steps = [
      "Reading file structure...",
      "Extracting metadata...",
      "Checking document properties...",
      "Scanning for malware indicators...",
      "Querying VirusTotal...",
      "Building security report...",
    ];
    let step = 0;
    const ticker = setInterval(() => {
      setScanProgress(p => {
        const next = Math.min(p + 2, 90);
        step = Math.floor((next / 100) * steps.length);
        setScanStatus(steps[Math.min(step, steps.length - 1)]);
        return next;
      });
    }, 120);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      const res = await fetch(`${BACKEND}/analyze-document`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      clearInterval(ticker);
      if (!res.ok) throw new Error(data.error || "Analysis failed");

      setScanProgress(100);
      setScanStatus("Complete");
      setResults(data);
      const riskScore =
        data.threatLevel === "Malicious"          ? 90 :
        data.threatLevel === "Suspicious"         ? 70 :
        data.threatLevel === "Potentially Unsafe" ? 50 :
        data.riskLevel   === "High"               ? 40 :
        data.riskLevel   === "Medium"             ? 20 : 5;
      saveScanResult("document", {
        riskScore,
        threatLevel: data.threatLevel,
        riskLevel: data.riskLevel,
        risksFound: data.threats.length + (data.privacyRisks?.length ?? 0),
        vtIssues: data.virusTotal && !data.virusTotal.notFound
          ? data.virusTotal.malicious + data.virusTotal.suspicious
          : 0,
      });
      setShowResults(true);
    } catch (err: any) {
      clearInterval(ticker);
      setError(err.message || "Analysis failed");
    } finally {
      setIsScanning(false);
    }
  };

  const tabs = [
    { id: "metadata",  label: "Metadata" },
    { id: "malware",   label: "Malware" },
    { id: "privacy",   label: "Privacy Risks" },
    { id: "technical", label: "Technical" },
  ];

  const vtIssues = results?.virusTotal && !results.virusTotal.notFound
    ? results.virusTotal.malicious + results.virusTotal.suspicious
    : 0;

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left panel */}
          <div className="space-y-6">
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Document Analyzer</h1>
                  <p className="text-muted-foreground text-sm">
                    Real metadata extraction + malware detection
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {uploadedFile ? (
                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border">
                    <div className="flex items-center gap-3">
                      <File className="w-10 h-10 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{uploadedFile.name}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(uploadedFile.size)}</p>
                      </div>
                    </div>
                    <button onClick={clearFile} className="p-2 rounded-lg hover:bg-muted transition-colors ml-2 shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm font-medium mb-2">Drag & drop or click to upload</p>
                    <p className="text-xs text-muted-foreground mb-4">PDF, DOCX, XLSX, PPTX, Images - up to 25 MB</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {["PDF", "DOCX", "XLSX", "PPTX", "PNG", "JPG"].map(f => (
                        <span key={f} className="px-2 py-1 text-xs rounded bg-muted/50">{f}</span>
                      ))}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.tiff,.tif"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                )}

                <button
                  onClick={handleScan}
                  disabled={isScanning || !uploadedFile}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {isScanning ? (
                    <>
                      <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Analyze Document
                    </>
                  )}
                </button>

                {isScanning && (
                  <div className="space-y-3 animate-fade-in">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{scanStatus}</span>
                      <span className="font-medium">{scanProgress}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Files are processed on the server and immediately deleted after analysis.
                      VirusTotal checks use only the file hash - the file itself is never uploaded to VirusTotal.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* What we detect */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold mb-3">What gets detected</h3>
              <div className="space-y-2 text-xs text-muted-foreground">
                {[
                  ["PDF", "JavaScript, auto-execute actions, embedded executables, launch commands, embedded files"],
                  ["DOCX/XLSX/PPTX", "VBA macros, hidden slides, remote content links, embedded OLE objects"],
                  ["Images", "GPS location, camera/device model, owner name in EXIF"],
                  ["All files", "VirusTotal hash lookup (72+ antivirus engines), MIME type mismatch, author/organization in metadata"],
                ].map(([type, desc]) => (
                  <div key={type} className="flex gap-2">
                    <span className="font-medium text-foreground shrink-0">{type}:</span>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-6">
            {!showResults && !isScanning && (
              <div className="glass-card p-12 text-center animate-fade-in">
                <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Document Analyzed Yet</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Upload a document to extract real metadata and scan for malware.
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                  {["Real metadata", "Malware heuristics", "VirusTotal check", "Privacy risks"].map(t => (
                    <span key={t} className="px-3 py-1 rounded-full bg-muted/50">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {showResults && results && (
              <div className="space-y-4 animate-fade-in">

                {/* Header summary */}
                <div className="glass-card p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold truncate">{results.filename}</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {results.fileType} · {formatBytes(results.fileSize)}
                        {!results.mimeMatch && (
                          <span className="ml-2 text-red-500 font-medium">⚠ Type mismatch</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <ThreatBadge level={results.threatLevel} />
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        results.riskLevel === "High"   ? "bg-destructive/10 text-destructive" :
                        results.riskLevel === "Medium" ? "bg-warning/10 text-warning"         :
                                                         "bg-success/10 text-success"
                      }`}>
                        {results.riskLevel} Privacy Risk
                      </span>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className={`p-3 rounded-lg text-center ${
                      results.threats.some(t => t.severity === "critical" || t.severity === "high")
                        ? "bg-destructive/10 border border-destructive/20"
                        : "bg-muted/30"
                    }`}>
                      <p className="text-lg font-bold">{results.threats.length}</p>
                      <p className="text-xs text-muted-foreground">Threats</p>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${
                      vtIssues > 0 ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"
                    }`}>
                      <p className="text-lg font-bold">
                        {results.virusTotal?.notFound ? "N/A" : results.virusTotal ? `${vtIssues}/${results.virusTotal.total}` : "–"}
                      </p>
                      <p className="text-xs text-muted-foreground">VirusTotal</p>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${
                      results.privacyRisks.some(r => r.severity === "high")
                        ? "bg-warning/10 border border-warning/20"
                        : "bg-muted/30"
                    }`}>
                      <p className="text-lg font-bold">{results.privacyRisks.length}</p>
                      <p className="text-xs text-muted-foreground">Privacy</p>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="glass-card p-6">
                  <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-4">
                    {tabs.map(tab => {
                      let badge = 0;
                      if (tab.id === "malware")  badge = results.threats.length + vtIssues;
                      if (tab.id === "privacy")  badge = results.privacyRisks.length;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === tab.id
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted/50"
                          }`}
                        >
                          {tab.label}
                          {badge > 0 && (
                            <span className={`text-xs px-1.5 rounded-full ${
                              activeTab === tab.id ? "bg-white/20" : "bg-destructive text-white"
                            }`}>
                              {badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Metadata tab */}
                  {activeTab === "metadata" && (
                    <div className="space-y-3">
                      {[
                        { icon: User, label: "Author", val: results.meta.author },
                        { icon: User, label: "Last Saved By", val: results.meta.lastSavedBy },
                        { icon: Building, label: "Organization", val: results.meta.company },
                        { icon: FileText, label: "Title", val: results.meta.title },
                        { icon: FileText, label: "Subject", val: results.meta.subject },
                        { icon: FileText, label: "Keywords", val: results.meta.keywords },
                        { icon: FileText, label: "Software / Creator", val: results.meta.software || results.meta.creator },
                        { icon: FileText, label: "PDF Producer", val: results.meta.producer },
                        { icon: Clock, label: "Created", val: fmtDate(results.meta.created) },
                        { icon: Clock, label: "Modified", val: fmtDate(results.meta.modified) },
                        { icon: FileText, label: "Template", val: results.meta.template },
                        { icon: Camera, label: "Camera / Device", val: results.meta.camera },
                        { icon: MapPin, label: "GPS Location", val: results.meta.gps ? `${results.meta.gps.lat.toFixed(5)}°, ${results.meta.gps.lon.toFixed(5)}°` : null },
                      ].filter(row => row.val).map(({ icon: Icon, label, val }) => (
                        <div key={label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                          <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-sm font-medium break-words">{val}</p>
                          </div>
                        </div>
                      ))}
                      {!Object.values(results.meta).some(v => v !== null && v !== undefined) && (
                        <p className="text-sm text-muted-foreground text-center py-4">No metadata found in this file.</p>
                      )}
                    </div>
                  )}

                  {/* Malware tab */}
                  {activeTab === "malware" && (
                    <div className="space-y-4">
                      {/* VirusTotal section */}
                      <div className="rounded-lg border border-border overflow-hidden">
                        <button
                          onClick={() => setVtExpanded(!vtExpanded)}
                          className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary" />
                            <span className="font-medium text-sm">VirusTotal (72+ AV Engines)</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {results.virusTotal === null && (
                              <span className="text-xs text-muted-foreground">Key not configured</span>
                            )}
                            {results.virusTotal?.notFound && (
                              <span className="text-xs text-muted-foreground">Hash not in database</span>
                            )}
                            {results.virusTotal && !results.virusTotal.notFound && (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                vtIssues > 0 ? "bg-destructive text-white" : "bg-success/10 text-success"
                              }`}>
                                {vtIssues > 0 ? `${vtIssues} detected` : `Clean (${results.virusTotal.total} engines)`}
                              </span>
                            )}
                            {vtExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </button>
                        {vtExpanded && (
                          <div className="p-4 space-y-3">
                            {results.virusTotal === null && (
                              <p className="text-sm text-muted-foreground">
                                Add <code className="text-xs bg-muted px-1 rounded">VIRUSTOTAL_KEY</code> to your backend environment to enable hash-based AV scanning.
                                Free API key at <a href="https://www.virustotal.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">virustotal.com</a> (500 lookups/day).
                              </p>
                            )}
                            {results.virusTotal?.notFound && (
                              <p className="text-sm text-muted-foreground">
                                This file's SHA-256 has never been submitted to VirusTotal. That is neutral - not necessarily clean.
                              </p>
                            )}
                            {results.virusTotal && !results.virusTotal.notFound && (
                              <>
                                <div className="grid grid-cols-4 gap-2">
                                  {[
                                    { label: "Malicious", val: results.virusTotal.malicious, cls: results.virusTotal.malicious > 0 ? "text-red-500" : "" },
                                    { label: "Suspicious", val: results.virusTotal.suspicious, cls: results.virusTotal.suspicious > 0 ? "text-orange-500" : "" },
                                    { label: "Harmless", val: results.virusTotal.harmless, cls: "text-success" },
                                    { label: "Undetected", val: results.virusTotal.undetected, cls: "" },
                                  ].map(s => (
                                    <div key={s.label} className="p-2 rounded bg-muted/30 text-center">
                                      <p className={`text-lg font-bold ${s.cls}`}>{s.val}</p>
                                      <p className="text-xs text-muted-foreground">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                                {results.virusTotal.detectedBy.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold text-destructive">Detected by:</p>
                                    {results.virusTotal.detectedBy.map((d, i) => (
                                      <div key={i} className="flex items-center justify-between p-2 rounded bg-destructive/5 border border-destructive/10 text-xs">
                                        <span className="font-medium">{d.engine}</span>
                                        <span className="text-destructive">{d.result}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Heuristic threats */}
                      {results.threats.length === 0 && vtIssues === 0 ? (
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
                          <ShieldCheck className="w-5 h-5 text-success" />
                          <p className="text-sm text-success font-medium">No malware indicators detected</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-muted-foreground">Heuristic findings</p>
                          {results.threats.map((t, i) => (
                            <div key={i} className={`p-4 rounded-lg border ${severityColor[t.severity]}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase ${severityBadge[t.severity]}`}>
                                  {t.severity}
                                </span>
                                <span className="font-medium text-sm">{t.name}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{t.detail}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Privacy risks tab */}
                  {activeTab === "privacy" && (
                    <div className="space-y-3">
                      {results.privacyRisks.length === 0 ? (
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
                          <ShieldCheck className="w-5 h-5 text-success" />
                          <p className="text-sm text-success font-medium">No privacy risks found in metadata</p>
                        </div>
                      ) : results.privacyRisks.map((r, i) => (
                        <div key={i} className={`p-4 rounded-lg border ${severityColor[r.severity]}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className={`w-4 h-4 ${
                              r.severity === "high" ? "text-destructive" :
                              r.severity === "medium" ? "text-warning" : "text-muted-foreground"
                            }`} />
                            <span className="font-medium text-sm">{r.type}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{r.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Technical tab */}
                  {activeTab === "technical" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "File Type", val: results.fileType },
                          { label: "Magic Bytes", val: results.magicType?.toUpperCase() },
                          { label: "MIME Match", val: results.mimeMatch ? "Yes" : "No - mismatch!" },
                          { label: "Pages / Slides", val: results.meta.pages || results.meta.slides || results.meta.pageCount?.toString() },
                          { label: "Word Count", val: results.meta.words ? Number(results.meta.words).toLocaleString() : null },
                          { label: "Revisions", val: results.meta.revisions?.toString() },
                          { label: "Edit Time", val: results.meta.totalEditMinutes ? fmtMinutes(results.meta.totalEditMinutes) : null },
                          { label: "Image Size", val: (results.meta.width && results.meta.height) ? `${results.meta.width}×${results.meta.height}` : null },
                          { label: "Color Space", val: results.meta.colorSpace },
                        ].filter(r => r.val).map(({ label, val }) => (
                          <div key={label} className="p-3 rounded-lg bg-muted/30">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className={`text-sm font-medium ${label === "MIME Match" && !results.mimeMatch ? "text-destructive" : ""}`}>{val}</p>
                          </div>
                        ))}
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2 mb-1">
                          <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">SHA-256</p>
                        </div>
                        <p className="text-xs font-mono break-all text-muted-foreground">{results.sha256}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentScan;

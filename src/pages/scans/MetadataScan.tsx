import { useState, useRef } from "react";
import {
  FileSearch,
  Upload,
  X,
  Loader2,
  Info,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Camera,
  Calendar,
  User,
  Shield,
  Download,
  ChevronDown,
  ExternalLink,
  Hash,
  Settings,
  FileImage,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import ProgressBar from "@/components/common/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";


interface GPS {
  latitude: number;
  longitude: number;
  altitude: string | null;
  direction: string | null;
  speed: string | null;
  mapUrl: string;
}

interface ExtractedMetadata {
  gps: GPS | null;
  make: string | null;
  model: string | null;
  lens: string | null;
  serialNumber: string | null;
  dateTaken: string | null;
  dateModified: string | null;
  iso: number | null;
  shutterSpeed: string | null;
  aperture: string | null;
  focalLength: string | null;
  focalLength35: string | null;
  flash: string | null;
  whiteBalance: string | null;
  exposureMode: string | null;
  meteringMode: string | null;
  exposureProgram: string | null;
  artist: string | null;
  copyright: string | null;
  description: string | null;
  keywords: string | null;
  width: number | null;
  height: number | null;
  colorSpace: string | null;
  orientation: string | null;
  software: string | null;
  xResolution: string | null;
  yResolution: string | null;
  totalFields: number;
}

interface ScanResult {
  success: boolean;
  filename: string;
  fileSize: number;
  mimeType: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  extracted: ExtractedMetadata;
  rawFields: Record<string, string | number | boolean>;
  cleanImage: {
    base64: string;
    mimeType: string;
    size: number;
    filename: string;
  };
}


const formatBytes = (b: number): string => {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  return (b / (1024 * 1024)).toFixed(2) + " MB";
};

const SCAN_STATUSES = [
  "Reading file structure…",
  "Parsing EXIF headers…",
  "Extracting GPS coordinates…",
  "Analysing device information…",
  "Scanning for hidden fields…",
  "Computing privacy risk…",
  "Preparing clean image…",
];


const buildRiskItems = (ex: ExtractedMetadata) => [
  {
    label: "GPS Coordinates",
    value: ex.gps ? `${ex.gps.latitude}, ${ex.gps.longitude}` : null,
    level: "critical" as const,
    icon: MapPin,
  },
  {
    label: "Device Serial Number",
    value: ex.serialNumber,
    level: "high" as const,
    icon: Hash,
  },
  {
    label: "Author / Artist Name",
    value: ex.artist,
    level: "high" as const,
    icon: User,
  },
  {
    label: "Copyright Notice",
    value: ex.copyright,
    level: "medium" as const,
    icon: Shield,
  },
  {
    label: "Image Description",
    value: ex.description,
    level: "medium" as const,
    icon: Info,
  },
  {
    label: "Camera Model",
    value: ex.make ? `${ex.make} ${ex.model ?? ""}`.trim() : null,
    level: "low" as const,
    icon: Camera,
  },
  {
    label: "Date & Time Taken",
    value: ex.dateTaken,
    level: "low" as const,
    icon: Calendar,
  },
  {
    label: "Editing Software",
    value: ex.software,
    level: "low" as const,
    icon: Settings,
  },
];

const levelColor = (l: string) =>
  l === "critical" ? "text-destructive" : l === "high" ? "text-warning" : l === "medium" ? "text-secondary" : "text-muted-foreground";

const levelBadge = (l: string) =>
  l === "critical" ? "badge-danger" : l === "high" ? "badge-warning" : "bg-secondary/10 text-secondary border border-secondary/20 px-2 py-0.5 rounded-full text-xs font-medium";

const levelBarColor = (l: string): "destructive" | "warning" | "primary" => {
  if (l === "critical" || l === "high") return "destructive";
  if (l === "medium") return "warning";
  return "primary";
};


const MetaRow = ({ label, value }: { label: string; value: string | number | null }) =>
  value ? (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/15 last:border-0">
      <span className="text-sm text-muted-foreground flex-shrink-0 w-36">{label}</span>
      <span className="text-sm font-medium text-right break-all">{String(value)}</span>
    </div>
  ) : null;


const MetadataScan = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [results, setResults] = useState<ScanResult | null>(null);
  const [showRawFields, setShowRawFields] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { saveScanResult } = useAuth();

  const handleFile = (file: File) => {
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);
    setResults(null);
    setScanError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  };

  const clearImage = () => {
    setUploadedFile(null);
    setPreviewUrl(null);
    setResults(null);
    setScanError(null);
  };

  const handleScan = async () => {
    if (!uploadedFile) return;
    setIsScanning(true);
    setScanProgress(0);
    setScanError(null);
    setResults(null);
    setShowRawFields(false);

    let progress = 0;
    const ticker = setInterval(() => {
      if (progress < 85) {
        progress += 4 + Math.random() * 4;
        setScanProgress(Math.min(Math.floor(progress), 85));
        setScanStatus(SCAN_STATUSES[Math.floor(progress / 14)] ?? SCAN_STATUSES[SCAN_STATUSES.length - 1]);
      }
    }, 300);

    try {
      const formData = new FormData();
      formData.append("image", uploadedFile);

      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/scan-metadata`, {
        method: "POST",
        body: formData,
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          "Backend server is not responding. Make sure it is running on port 5000 and restart it if you recently updated the code."
        );
      }

      if (!res.ok) throw new Error(data.error || "Scan failed");

      setResults(data);
      saveScanResult("metadata", {
        filename: data.filename,
        riskScore: data.riskScore,
        riskLevel: data.riskLevel,
        hasGPS: !!data.extracted.gps,
        totalFields: data.extracted.totalFields,
      });
    } catch (err: any) {
      setScanError(err.message || "Scan failed. Please try again.");
    } finally {
      clearInterval(ticker);
      setScanProgress(100);
      setIsScanning(false);
    }
  };

  const handleDownloadClean = () => {
    if (!results?.cleanImage) return;
    const binary = atob(results.cleanImage.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: results.cleanImage.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = results.cleanImage.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const ex = results?.extracted;
  const riskItems = ex ? buildRiskItems(ex) : [];
  const foundRiskItems = riskItems.filter((i) => i.value);

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Left Panel ─────────────────────────────────────── */}
          <div className="space-y-6">
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <FileSearch className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Image Metadata Detector</h1>
                  <p className="text-muted-foreground text-sm">
                    Expose hidden EXIF data - GPS, device, timestamps and more
                  </p>
                </div>
              </div>

              {/* Upload area */}
              <div className="space-y-4">
                {previewUrl ? (
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-xl border border-border/30"
                    />
                    <button
                      onClick={clearImage}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-background transition-colors border border-border/30"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-background/80 text-xs font-mono">
                      {uploadedFile?.name} · {formatBytes(uploadedFile?.size ?? 0)}
                    </div>
                  </div>
                ) : (
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-xl p-10 text-center hover:border-primary/50 transition-colors cursor-pointer group"
                  >
                    <Upload className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3 group-hover:text-primary/60 transition-colors" />
                    <p className="text-sm font-medium mb-1">Drop image here or click to upload</p>
                    <p className="text-xs text-muted-foreground">JPEG · PNG · WebP · GIF - up to 10 MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
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
                    <><Loader2 className="w-5 h-5 animate-spin" />Analysing…</>
                  ) : (
                    <><FileSearch className="w-5 h-5" />Scan for Hidden Metadata</>
                  )}
                </button>

                {isScanning && (
                  <div className="space-y-2 animate-fade-in">
                    <ProgressBar value={scanProgress} color="primary" size="md" />
                    <p className="text-xs text-center text-muted-foreground animate-pulse">{scanStatus}</p>
                  </div>
                )}

                {scanError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive animate-fade-in">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{scanError}</span>
                  </div>
                )}
              </div>

              {/* Info box */}
              <div className="mt-6 p-4 rounded-lg bg-secondary/10 border border-secondary/20">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-secondary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-secondary">What gets checked</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Every field hidden inside your image - GPS coordinates, device serial, camera model,
                      timestamps, author name, copyright, editing history, and all other EXIF/XMP/IPTC tags.
                      The clean download removes all of it.
                    </p>
                  </div>
                </div>
              </div>

              <details className="mt-6 group">
                <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <span className="transition-transform group-open:rotate-90">▸</span>
                  Why metadata is dangerous
                </summary>
                <div className="mt-3 pl-4 text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc pl-4 space-y-1">
                    <li>GPS in a photo of your home broadcasts your exact address</li>
                    <li>Device serial numbers let attackers track a single device across thousands of posts</li>
                    <li>Timestamps map your daily routine over time</li>
                    <li>Social media platforms often strip EXIF - but direct file sharing does not</li>
                    <li>A year of photos can reveal your home, workplace, commute and habits</li>
                  </ul>
                </div>
              </details>
            </div>
          </div>

          {/* ── Right Panel ────────────────────────────────────── */}
          {!results && !isScanning && (
            <div className="flex items-center justify-center">
              <div className="text-center glass-card p-12 w-full">
                <FileSearch className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Image Analysed Yet</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Upload any photo to instantly reveal every hidden metadata field - and get a clean copy with it all removed.
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                  {["GPS location", "Device serial", "Camera model", "Timestamps", "Author name", "Editing software"].map((t) => (
                    <span key={t} className="px-3 py-1 rounded-full bg-muted/40">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {results && ex && (
            <div className="space-y-6 animate-fade-in">

              {/* ── Risk Overview ── */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Metadata Analysis</h2>
                    <p className="text-sm text-muted-foreground truncate max-w-[220px]">{results.filename}</p>
                  </div>
                  <span className={
                    results.riskScore >= 60 ? "badge-danger" :
                    results.riskScore >= 35 ? "badge-warning" : "badge-success"
                  }>
                    {results.riskScore >= 60 ? <><ShieldAlert className="w-3 h-3 mr-1" />High Risk</> :
                     results.riskScore >= 35 ? <><AlertTriangle className="w-3 h-3 mr-1" />Medium Risk</> :
                     <><ShieldCheck className="w-3 h-3 mr-1" />Low Risk</>}
                  </span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-5 p-3 rounded-lg bg-muted/20 border border-border/20">
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${ex.totalFields > 0 ? "text-warning" : "text-success"}`}>{ex.totalFields}</p>
                    <p className="text-xs text-muted-foreground">Fields found</p>
                  </div>
                  <div className="text-center border-x border-border/20">
                    <p className={`text-2xl font-bold ${ex.gps ? "text-destructive" : "text-success"}`}>{ex.gps ? "Yes" : "No"}</p>
                    <p className="text-xs text-muted-foreground">GPS embedded</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{formatBytes(results.fileSize - results.cleanImage.size)}</p>
                    <p className="text-xs text-muted-foreground">To be stripped</p>
                  </div>
                </div>

                <div className="flex items-start gap-6">
                  <RiskGauge score={results.riskScore} size="md" label="Privacy Risk" />
                  <div className="flex-1 space-y-2">
                    {riskItems.slice(0, 5).map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${levelColor(item.level)}`} />
                            <span className="text-xs text-muted-foreground">{item.label}</span>
                          </div>
                          {item.value ? (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                              item.level === "critical" ? "bg-destructive/15 text-destructive" :
                              item.level === "high" ? "bg-warning/15 text-warning" :
                              "bg-secondary/10 text-secondary"
                            }`}>Found</span>
                          ) : (
                            <span className="text-xs text-success flex items-center gap-0.5">
                              <CheckCircle className="w-3 h-3" />Clean
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {ex.totalFields === 0 && (
                  <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                    <ShieldCheck className="w-4 h-4 text-success flex-shrink-0" />
                    <p className="text-sm text-success">No metadata detected - this image is already clean.</p>
                  </div>
                )}
              </div>

              {/* ── GPS Location (critical warning) ── */}
              {ex.gps && (
                <div className="glass-card p-6 border border-destructive/40">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-destructive/10">
                      <MapPin className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-destructive">GPS Location Embedded</h3>
                      <p className="text-sm text-muted-foreground">Exact coordinates are hidden inside this image</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { label: "Latitude",  value: String(ex.gps.latitude) },
                      { label: "Longitude", value: String(ex.gps.longitude) },
                      ...(ex.gps.altitude  ? [{ label: "Altitude",  value: ex.gps.altitude  }] : []),
                      ...(ex.gps.direction ? [{ label: "Direction", value: ex.gps.direction }] : []),
                      ...(ex.gps.speed     ? [{ label: "Speed",     value: ex.gps.speed     }] : []),
                    ].map(({ label, value }) => (
                      <div key={label} className="p-2.5 rounded-lg bg-muted/20 border border-border/20">
                        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                        <p className="font-mono text-sm font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* OpenStreetMap embed - no API key required */}
                  <div className="rounded-xl overflow-hidden border border-destructive/20 mb-3">
                    <iframe
                      title="GPS Location from EXIF"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${ex.gps.longitude - 0.008},${ex.gps.latitude - 0.008},${ex.gps.longitude + 0.008},${ex.gps.latitude + 0.008}&layer=mapnik&marker=${ex.gps.latitude},${ex.gps.longitude}`}
                      width="100%"
                      height="220"
                      className="border-0 block"
                      loading="lazy"
                    />
                  </div>

                  <a
                    href={ex.gps.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-destructive hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Google Maps
                  </a>
                </div>
              )}

              {/* ── Metadata Breakdown ── */}
              {ex.totalFields > 0 && (
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-5">Hidden Metadata Details</h2>

                  <div className="space-y-6">
                    {/* Device & Camera */}
                    {(ex.make || ex.model || ex.lens || ex.serialNumber) && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Camera className="w-4 h-4 text-primary" />
                          <h3 className="text-sm font-semibold text-primary">Device & Camera</h3>
                        </div>
                        <div className="bg-muted/20 rounded-lg px-4 py-1 divide-y divide-border/10">
                          <MetaRow label="Camera" value={[ex.make, ex.model].filter(Boolean).join(" ")} />
                          <MetaRow label="Lens" value={ex.lens} />
                          {ex.serialNumber && (
                            <div className="flex items-start justify-between gap-4 py-2">
                              <span className="text-sm text-muted-foreground w-36 flex-shrink-0">Serial Number</span>
                              <span className="text-sm font-medium text-warning break-all text-right">
                                {ex.serialNumber}
                                <span className="ml-2 text-xs bg-warning/10 text-warning px-1.5 py-0.5 rounded">High Risk</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Date & Time */}
                    {(ex.dateTaken || ex.dateModified) && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar className="w-4 h-4 text-secondary" />
                          <h3 className="text-sm font-semibold text-secondary">Date & Time</h3>
                        </div>
                        <div className="bg-muted/20 rounded-lg px-4 py-1 divide-y divide-border/10">
                          <MetaRow label="Date Taken" value={ex.dateTaken} />
                          <MetaRow label="Last Modified" value={ex.dateModified} />
                        </div>
                      </div>
                    )}

                    {/* Camera Settings */}
                    {(ex.iso || ex.shutterSpeed || ex.aperture || ex.focalLength || ex.flash || ex.whiteBalance) && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Settings className="w-4 h-4 text-muted-foreground" />
                          <h3 className="text-sm font-semibold">Camera Settings</h3>
                        </div>
                        <div className="bg-muted/20 rounded-lg px-4 py-1 divide-y divide-border/10">
                          <MetaRow label="ISO" value={ex.iso} />
                          <MetaRow label="Shutter Speed" value={ex.shutterSpeed} />
                          <MetaRow label="Aperture" value={ex.aperture} />
                          <MetaRow label="Focal Length" value={ex.focalLength} />
                          <MetaRow label="35mm Equiv." value={ex.focalLength35} />
                          <MetaRow label="Flash" value={ex.flash} />
                          <MetaRow label="White Balance" value={ex.whiteBalance} />
                          <MetaRow label="Exposure Mode" value={ex.exposureMode} />
                          <MetaRow label="Metering Mode" value={ex.meteringMode} />
                        </div>
                      </div>
                    )}

                    {/* Author & Copyright */}
                    {(ex.artist || ex.copyright || ex.description || ex.keywords) && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <User className="w-4 h-4 text-warning" />
                          <h3 className="text-sm font-semibold text-warning">Author & Identity</h3>
                        </div>
                        <div className="bg-warning/5 border border-warning/15 rounded-lg px-4 py-1 divide-y divide-border/10">
                          <MetaRow label="Author / Artist" value={ex.artist} />
                          <MetaRow label="Copyright" value={ex.copyright} />
                          <MetaRow label="Description" value={ex.description} />
                          <MetaRow label="Keywords" value={ex.keywords} />
                        </div>
                      </div>
                    )}

                    {/* File Info */}
                    {(ex.width || ex.colorSpace || ex.software || ex.orientation) && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <FileImage className="w-4 h-4 text-muted-foreground" />
                          <h3 className="text-sm font-semibold">File Information</h3>
                        </div>
                        <div className="bg-muted/20 rounded-lg px-4 py-1 divide-y divide-border/10">
                          <MetaRow label="Dimensions" value={ex.width && ex.height ? `${ex.width} × ${ex.height} px` : null} />
                          <MetaRow label="Color Space" value={ex.colorSpace} />
                          <MetaRow label="Resolution" value={ex.xResolution} />
                          <MetaRow label="Orientation" value={ex.orientation} />
                          <MetaRow label="Software" value={ex.software} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── All Detected Fields (expandable) ── */}
              {Object.keys(results.rawFields).length > 0 && (
                <div className="glass-card p-6">
                  <button
                    onClick={() => setShowRawFields((s) => !s)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {showRawFields ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                      <h2 className="text-base font-semibold">All Detected Fields</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{Object.keys(results.rawFields).length} fields</span>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showRawFields ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  {showRawFields && (
                    <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-border/20 divide-y divide-border/10">
                      {Object.entries(results.rawFields).map(([key, value]) => (
                        <div key={key} className="flex items-start justify-between gap-4 px-3 py-2 hover:bg-muted/20">
                          <span className="font-mono text-xs text-muted-foreground flex-shrink-0 w-44">{key}</span>
                          <span className="font-mono text-xs text-right break-all">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Clean Image Download ── */}
              <div className="glass-card p-6 border border-success/25">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-success/10">
                    <Download className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Privacy-Safe Version Ready</h3>
                    <p className="text-sm text-muted-foreground">All metadata has been removed</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/20 mb-4">
                  <div className="text-center">
                    <p className="text-sm font-semibold">{formatBytes(results.fileSize)}</p>
                    <p className="text-xs text-muted-foreground">Original</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-success">{formatBytes(results.cleanImage.size)}</p>
                    <p className="text-xs text-muted-foreground">Clean</p>
                  </div>
                  <div className="text-center border-l border-border/30 pl-4">
                    <p className="text-sm font-semibold text-success">
                      -{formatBytes(results.fileSize - results.cleanImage.size)}
                    </p>
                    <p className="text-xs text-muted-foreground">Removed</p>
                  </div>
                </div>

                <button
                  onClick={handleDownloadClean}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download Clean Image
                </button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Safe to share - no hidden data remains
                </p>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MetadataScan;

import { useState, useRef } from "react";
import {
  Image as ImageIcon,
  Upload,
  Search,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  MapPin,
  X,
  Info,
  Globe,
  ShieldAlert,
  Users,
  Newspaper,
  HelpCircle,
} from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import { useAuth } from "@/contexts/AuthContext";


type Category = "social" | "news" | "adult" | "unknown";
type Engine   = "google" | "yandex" | "facecheck" | "google_images" | "bot";

interface VisualMatch {
  title:          string;
  link:           string;
  source:         string;
  thumbnail:      string;
  original?:      string;
  engine:         Engine;
  confidence:     number;
  category:       Category;
  faceVerified?:  boolean;
  faceConfidence?: number | null;
}

interface GoogleImageTile {
  title:     string;
  link:      string;
  source:    string;
  thumbnail: string;
  original:  string;
  engine:    "google_images";
  confidence: number;
  category:  Category;
}

interface Stats {
  total:   number;
  social:  number;
  news:    number;
  adult:   number;
  unknown: number;
}

interface Metadata {
  camera:      string | null;
  dateTaken:   string | null;
  software:    string | null;
  gps:         { latitude: number; longitude: number } | null;
  dimensions:  string | null;
  orientation: number | null;
}

interface BotMatch {
  title:     string;
  link:      string;
  source:    string;
  thumbnail: string;
  engine:    "bot";
  confidence: number;
  category:  Category;
}

interface ScanResults {
  bestGuessLabel:      string | null;
  visualMatches:       VisualMatch[];
  googleImageTiles:    GoogleImageTile[];
  botMatches:          BotMatch[];
  stats:               Stats;
  faceVerificationUsed?: boolean;
  faceVerifiedCount?:    number;
  metadata:         Metadata;
  riskScore:        number;
}

function MatchThumbnail({ match }: { match: VisualMatch }) {
  const [stage, setStage] = useState<"thumb" | "favicon" | "placeholder">(
    match.thumbnail ? "thumb" : "favicon"
  );

  const faviconUrl = match.source
    ? `https://www.google.com/s2/favicons?domain=${match.source}&sz=128`
    : null;

  if (stage === "thumb") {
    return (
      <img
        src={match.thumbnail}
        alt={match.title}
        className="w-full h-full object-cover"
        onError={() => setStage(faviconUrl ? "favicon" : "placeholder")}
      />
    );
  }

  if (stage === "favicon" && faviconUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-muted/20 p-2">
        <img
          src={faviconUrl}
          alt={match.source}
          className="w-10 h-10 object-contain rounded"
          onError={() => setStage("placeholder")}
        />
        <span className="text-xs text-muted-foreground text-center truncate w-full px-1">
          {match.source}
        </span>
      </div>
    );
  }

  const initial = (match.source || match.title || "?")[0].toUpperCase();
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-muted/30">
      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
        <span className="text-lg font-bold text-primary">{initial}</span>
      </div>
      <span className="text-xs text-muted-foreground truncate max-w-full px-2">
        {match.source || match.title}
      </span>
    </div>
  );
}

const ENGINE_LABEL: Record<Engine, string> = {
  google:        "Lens",
  yandex:        "Yandex",
  facecheck:     "Face",
  google_images: "Google",
  bot:           "Live",
};

function confidenceColor(score: number) {
  if (score >= 85) return "bg-destructive/80 text-white";
  if (score >= 70) return "bg-warning/80 text-white";
  return "bg-muted/70 text-muted-foreground";
}


function calcRisk(stats: Stats, hasGps: boolean): number {
  let score = 5;
  score += stats.social  *  3;   // expected - low weight
  score += stats.news    *  1;   // public figure / news - minimal weight
  score += stats.unknown * 10;   // unknown exposure - moderate
  score += stats.adult   * 30;   // adult site - very high
  if (hasGps) score += 12;
  return Math.min(Math.round(score), 95);
}


const CATEGORY_META: Record<Category, { label: string; color: string; icon: React.FC<{ className?: string }> }> = {
  social:  { label: "Social Media", color: "bg-blue-500/15 text-blue-400 border-blue-500/30",  icon: Users },
  news:    { label: "News / Media", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", icon: Newspaper },
  adult:   { label: "Adult Site",   color: "bg-destructive/20 text-destructive border-destructive/40", icon: ShieldAlert },
  unknown: { label: "Unknown",      color: "bg-muted/50 text-muted-foreground border-border",   icon: HelpCircle },
};

const SCAN_STATUSES = [
  "Uploading image temporarily…",
  "Hosting on secure server…",
  "Running Google Lens visual search…",
  "Running facial recognition scan…",
  "Searching adult & social platforms…",
  "Categorising matches by domain…",
  "Compiling results…",
];


const ImageScan = () => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile,  setUploadedFile]  = useState<File | null>(null);
  const [imageUrl,      setImageUrl]      = useState("");
  const [personName,    setPersonName]    = useState("");
  const [isDragging,    setIsDragging]    = useState(false);
  const [isScanning,    setIsScanning]    = useState(false);
  const [scanProgress,  setScanProgress]  = useState(0);
  const [scanStatus,    setScanStatus]    = useState("");
  const [scanError,     setScanError]     = useState<string | null>(null);
  const [results,       setResults]       = useState<ScanResults | null>(null);
  const [shownCount,      setShownCount]      = useState(9);
  const [activeFilter,    setActiveFilter]    = useState<Category | "faceVerified" | "all">("all");
  const [minConfidence,   setMinConfidence]   = useState(0); // default: show all
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { saveScanResult } = useAuth();


  const loadFile = (file: File) => {
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    setResults(null);
    setScanError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      loadFile(file);
    }
  };

  const clearImage = () => {
    setUploadedImage(null);
    setUploadedFile(null);
    setImageUrl("");
    setResults(null);
    setScanError(null);
  };

  const clearAll = () => {
    clearImage();
    setPersonName("");
  };


  const handleScan = async () => {
    if (!uploadedFile && !imageUrl.trim()) return;

    setIsScanning(true);
    setScanProgress(0);
    setScanError(null);
    setResults(null);
    setShownCount(9);
    setActiveFilter("all");
    setMinConfidence(0);

    let progress = 0;
    const ticker = setInterval(() => {
      if (progress < 88) {
        progress += Math.random() * 3;
        setScanProgress(Math.floor(progress));
        setScanStatus(SCAN_STATUSES[Math.floor(progress / 14)] ?? SCAN_STATUSES[SCAN_STATUSES.length - 1]);
      }
    }, 400);

    try {
      const formData = new FormData();
      if (uploadedFile) {
        formData.append("image", uploadedFile);
      } else {
        const resp = await fetch(imageUrl.trim());
        if (!resp.ok) throw new Error("Could not fetch image from that URL.");
        const blob = await resp.blob();
        formData.append("image", blob, "image.jpg");
      }
      if (personName.trim()) formData.append("name", personName.trim());

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);

      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/scan-image`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Server error (${response.status})`);

      const riskScore = calcRisk(data.stats, !!data.metadata?.gps);
      const finalResults: ScanResults = {
        ...data,
        riskScore,
        botMatches: data.botMatches ?? [],
      };
      setResults(finalResults);

      saveScanResult("image", {
        status:       riskScore >= 50 ? "warning" : "secure",
        matchesFound: data.stats.total,
        adultSites:   data.stats.adult,
        riskScore,
        scannedAt:    new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "Scan timed out (>2 min). Try a smaller image."
          : err instanceof Error ? err.message : "Scan failed. Please try again.";
      setScanError(msg);
    } finally {
      clearInterval(ticker);
      setScanProgress(100);
      setIsScanning(false);
    }
  };


  const filteredMatches = results
    ? results.visualMatches.filter((m) => {
        if (activeFilter === "faceVerified") return !!m.faceVerified;
        const categoryOk = activeFilter === "all" || m.category === activeFilter;
        const confidenceOk = m.category === "adult" || minConfidence === 0 || m.confidence >= minConfidence;
        return categoryOk && confidenceOk;
      })
    : [];


  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Left: Input ── */}
          <div className="space-y-6">
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <ImageIcon className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Reverse Image Search</h1>
                  <p className="text-muted-foreground text-sm">
                    Google Lens + Facial recognition - finds your image across the entire web
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {uploadedImage ? (
                  <div className="relative">
                    <img src={uploadedImage} alt="Preview" className="w-full h-48 object-cover rounded-xl" />
                    <button onClick={clearImage} className="absolute top-2 right-2 p-2 rounded-full bg-background/80 hover:bg-background transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Upload className={`w-12 h-12 mx-auto mb-4 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-sm font-medium mb-1">
                      {isDragging ? "Drop image here" : "Click or drag & drop an image"}
                    </p>
                    <p className="text-xs text-muted-foreground">JPEG · PNG · WEBP - up to 10 MB</p>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileUpload} className="hidden" />
                  </div>
                )}

                {!uploadedImage && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground">or paste a URL</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <input type="url" placeholder="https://example.com/photo.jpg" value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  </>
                )}

                {/* Optional name to boost name-based image search */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Person's name <span className="text-muted-foreground/60">(optional - improves search quality)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Smith"
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <button onClick={handleScan} disabled={isScanning || (!uploadedImage && !imageUrl.trim())}
                  className="btn-primary w-full flex items-center justify-center gap-2">
                  {isScanning ? (
                    <><div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />Scanning…</>
                  ) : (
                    <><Search className="w-5 h-5" />Search the Web</>
                  )}
                </button>

                {isScanning && (
                  <div className="space-y-2 animate-fade-in">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{scanStatus}</span>
                      <span className="font-medium">{scanProgress}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
                        style={{ width: `${scanProgress}%` }} />
                    </div>
                  </div>
                )}

                {scanError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive animate-fade-in">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{scanError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Search sources info */}
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                Search Sources
              </h3>
              <div className="space-y-2 text-sm">
                {[
                  { engine: "Google Cloud Vision", desc: "Official Google API - finds exact matches, pages, and similar images across the entire web" },
                  { engine: "Google Lens API",     desc: "Visual similarity search via SerpAPI" },
                  { engine: "Yandex Images",       desc: "Best engine for facial recognition in reverse image search" },
                  { engine: "FaceCheck.id",        desc: "Face-specific recognition - searches social, adult & forum sites" },
                  { engine: "EXIF Analysis",       desc: "GPS, camera model & date extracted from image file" },
                ].map(({ engine, desc }) => (
                  <div key={engine} className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <span><span className="font-medium">{engine}</span> - <span className="text-muted-foreground">{desc}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: Results ── */}
          <div className="space-y-6">

            {!results && !isScanning && !scanError && (
              <div className="glass-card p-12 text-center animate-fade-in">
                <ImageIcon className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Image Scanned Yet</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Upload a photo to find where it appears online, including social media, news, and adult sites.
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                  {["Google Lens AI", "Face recognition", "Adult site detection", "EXIF metadata"].map((t) => (
                    <span key={t} className="px-3 py-1 rounded-full bg-muted/50">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {results && (
              <div className="space-y-6 animate-fade-in">

                {/* ── Risk summary ── */}
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Scan Summary</h2>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      results.riskScore >= 60 ? "bg-destructive/20 text-destructive"
                      : results.riskScore >= 30 ? "bg-warning/20 text-warning"
                      : "bg-success/20 text-success"}`}>
                      {results.riskScore >= 60 ? "High Exposure"
                        : results.riskScore >= 30 ? "Moderate Exposure" : "Low Exposure"}
                    </span>
                  </div>

                  <div className="flex items-center gap-6 mb-5">
                    <RiskGauge score={results.riskScore} size="md" label="Exposure Risk" />
                    <div className="flex-1 grid grid-cols-2 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-muted/30">
                        <p className="text-xl font-bold">{results.stats.total}</p>
                        <p className="text-xs text-muted-foreground">Total matches</p>
                      </div>
                      <div className={`p-2 rounded-lg ${results.stats.adult > 0 ? "bg-destructive/10 border border-destructive/30" : "bg-muted/30"}`}>
                        <p className={`text-xl font-bold ${results.stats.adult > 0 ? "text-destructive" : ""}`}>{results.stats.adult}</p>
                        <p className="text-xs text-muted-foreground">Adult sites</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/30">
                        <p className="text-xl font-bold">{results.stats.social}</p>
                        <p className="text-xs text-muted-foreground">Social media</p>
                      </div>
                      {results.faceVerificationUsed ? (
                        <div className={`p-2 rounded-lg ${(results.faceVerifiedCount ?? 0) > 0 ? "bg-success/10 border border-success/30" : "bg-muted/30"}`}>
                          <p className={`text-xl font-bold ${(results.faceVerifiedCount ?? 0) > 0 ? "text-success" : ""}`}>{results.faceVerifiedCount ?? 0}</p>
                          <p className="text-xs text-muted-foreground">Face verified</p>
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-muted/30">
                          <p className="text-xl font-bold">{results.stats.unknown}</p>
                          <p className="text-xs text-muted-foreground">Unknown sites</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Engine sources used */}
                  <div className="flex flex-wrap gap-2 mb-1">
                    {[
                      { key: "vision",    label: "Google Vision" },
                      { key: "google",    label: "Google Lens" },
                      { key: "yandex",    label: "Yandex" },
                      { key: "facecheck", label: "FaceCheck.id" },
                    ].map(e => (
                      <span key={e.key} className={`text-xs px-2 py-0.5 rounded-full ${e.key === "vision" ? "bg-primary/20 text-primary border border-primary/30" : "bg-muted/50 text-muted-foreground"}`}>
                        {e.label} ✓
                      </span>
                    ))}
                    {results.faceVerificationUsed && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success border border-success/30">
                        Face Recognition ✓
                      </span>
                    )}
                  </div>

                  {/* Adult-site alert */}
                  {results.stats.adult > 0 && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-sm text-destructive">
                        <span className="font-semibold">Warning:</span> Your image was found on{" "}
                        {results.stats.adult} adult site{results.stats.adult > 1 ? "s" : ""}.
                        This may indicate non-consensual image sharing.
                      </p>
                    </div>
                  )}

                  {results.bestGuessLabel && (
                    <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-primary shrink-0" />
                      <p className="text-sm">
                        <span className="text-muted-foreground">Google identified: </span>
                        <span className="font-semibold">{results.bestGuessLabel}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* ── Google Vision Pages ── */}
                {results.botMatches && results.botMatches.length > 0 ? (
                  <div className="glass-card p-6 border border-primary/20">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Globe className="w-5 h-5 text-primary" />
                        Pages Where This Image Was Found
                      </h2>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-medium">
                        {results.botMatches.length} pages · Google Vision
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Every page Google's Vision API detected this image on - the most accurate source available.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {results.botMatches.map((match, i) => (
                        <a
                          key={i}
                          href={match.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`group relative rounded-xl overflow-hidden bg-muted/30 aspect-square block transition-all hover:ring-2 ${
                            match.category === "adult"
                              ? "ring-1 ring-destructive/40 hover:ring-destructive"
                              : "hover:ring-primary"
                          }`}
                          title={match.title || match.source}
                        >
                          {match.thumbnail ? (
                            <img
                              src={match.thumbnail}
                              alt={match.title}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted/40">
                              <Globe className="w-8 h-8 text-muted-foreground/40" />
                            </div>
                          )}
                          {/* Category badge */}
                          {match.category === "adult" && (
                            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-xs font-medium border backdrop-blur-sm bg-destructive/20 text-destructive border-destructive/40">
                              Adult
                            </div>
                          )}
                          {/* Source strip */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-2 py-1">
                            <p className="text-white text-xs truncate">{match.source || match.title}</p>
                          </div>
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/65 transition-colors flex flex-col items-center justify-center p-2 opacity-0 group-hover:opacity-100">
                            <ExternalLink className="w-5 h-5 text-white mb-1" />
                            <p className="text-white text-xs text-center font-medium leading-tight line-clamp-2">
                              {match.title || match.source}
                            </p>
                            <p className="text-white/70 text-xs mt-0.5 truncate max-w-full">{match.source}</p>
                            <p className="text-primary/90 text-xs mt-1 font-semibold">Live · {match.confidence}%</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : results.botMatches !== undefined && (
                  <div className="glass-card p-4 flex items-center gap-3 border border-muted/30">
                    <Info className="w-4 h-4 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Google Vision found no indexed pages for this image. This image may not have been published online yet.
                    </p>
                  </div>
                )}

                {/* ── Matches ── */}
                {results.visualMatches.length > 0 ? (
                  <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">Visual Matches</h2>
                      <span className="text-xs text-muted-foreground">
                        Showing {filteredMatches.length} of {results.stats.total}
                      </span>
                    </div>

                    {/* Confidence threshold slider */}
                    <div className="mb-4 p-3 rounded-lg bg-muted/20 border border-border">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium">Min. confidence</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${minConfidence === 0 ? "bg-muted/70 text-muted-foreground" : confidenceColor(minConfidence)}`}>
                          {minConfidence === 0 ? "All" : `${minConfidence}%+`}
                        </span>
                      </div>
                      <input
                        type="range" min={0} max={95} step={5}
                        value={minConfidence}
                        onChange={(e) => { setMinConfidence(+e.target.value); setShownCount(9); }}
                        className="w-full accent-primary h-1.5"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>All</span><span>50%</span><span>80%</span><span>95%</span>
                      </div>
                    </div>

                    {/* Category filter tabs */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {/* Face Verified filter - only shown when face recognition was used */}
                      {results.faceVerificationUsed && (results.faceVerifiedCount ?? 0) > 0 && (
                        <button
                          onClick={() => { setActiveFilter("faceVerified"); setShownCount(9); }}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 ${
                            activeFilter === "faceVerified"
                              ? "bg-success text-white border-success"
                              : "bg-success/10 text-success border-success/40 hover:border-success"
                          }`}
                        >
                          <CheckCircle className="w-3 h-3" />
                          Face Verified ({results.faceVerifiedCount})
                        </button>
                      )}
                      {(["all", "adult", "unknown", "social", "news"] as const).map((f) => {
                        const count = f === "all" ? results.stats.total : results.stats[f];
                        if (f !== "all" && count === 0) return null;
                        return (
                          <button
                            key={f}
                            onClick={() => { setActiveFilter(f); setShownCount(9); }}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                              activeFilter === f
                                ? f === "adult" ? "bg-destructive text-white border-destructive"
                                  : "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/30 border-border hover:border-primary/50"
                            }`}
                          >
                            {f === "all" ? `All (${count})` : `${CATEGORY_META[f].label} (${count})`}
                          </button>
                        );
                      })}
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      {filteredMatches.slice(0, shownCount).map((match, i) => {
                        const meta = CATEGORY_META[match.category];
                        const Icon = meta.icon;
                        return (
                          <a
                            key={i}
                            href={match.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`group relative rounded-xl overflow-hidden bg-muted/30 aspect-square block transition-all hover:ring-2 ${
                              match.category === "adult"
                                ? "ring-1 ring-destructive/40 hover:ring-destructive"
                                : "hover:ring-primary"
                            }`}
                            title={match.title || match.source}
                          >
                            {/* Thumbnail - always shows something */}
                            <MatchThumbnail match={match} />

                            {/* Category badge (always visible) */}
                            <div className={`absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium border backdrop-blur-sm ${meta.color}`}>
                              <Icon className="w-2.5 h-2.5" />
                              {match.category === "adult" ? "Adult" : ""}
                            </div>

                            {/* Face-verified badge */}
                            {match.faceVerified && (
                              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-success/90 text-white backdrop-blur-sm">
                                <CheckCircle className="w-2.5 h-2.5" />
                                Face
                              </div>
                            )}

                            {/* Confidence + engine badge */}
                            <div className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold backdrop-blur-sm ${confidenceColor(match.confidence)}`}>
                              {match.confidence}%
                            </div>

                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/65 transition-colors flex flex-col items-center justify-center p-2 opacity-0 group-hover:opacity-100">
                              <ExternalLink className="w-5 h-5 text-white mb-1" />
                              <p className="text-white text-xs text-center font-medium leading-tight line-clamp-2">
                                {match.title || match.source}
                              </p>
                              <p className="text-white/60 text-xs mt-0.5 truncate max-w-full">
                                {match.source}
                              </p>
                              <p className="text-white/80 text-xs mt-1 font-semibold">
                                {match.confidence}% · {ENGINE_LABEL[match.engine]}
                                {match.faceVerified ? " · Face ✓" : ""}
                              </p>
                            </div>
                          </a>
                        );
                      })}
                    </div>

                    {shownCount < filteredMatches.length && (
                      <button
                        onClick={() => setShownCount((n) => Math.min(n + 9, filteredMatches.length))}
                        className="mt-4 w-full btn-outline text-sm py-2 rounded-lg"
                      >
                        Load more ({filteredMatches.length - shownCount} remaining)
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="glass-card p-6 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-success shrink-0" />
                    <div>
                      <p className="font-medium text-sm">No matches found</p>
                      <p className="text-xs text-muted-foreground">
                        This image was not found on any indexed site.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Google Image Search Results ── */}
                {results.googleImageTiles && results.googleImageTiles.length > 0 && (
                  <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Globe className="w-5 h-5 text-primary" />
                        Google Image Search Results
                      </h2>
                      <span className="text-xs text-muted-foreground">
                        {results.googleImageTiles.length} images found
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Actual image files returned by Google's reverse image search - these are images from pages where Google matched your photo.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {results.googleImageTiles.map((tile, i) => (
                        <a
                          key={i}
                          href={tile.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative rounded-xl overflow-hidden bg-muted/30 aspect-square block transition-all hover:ring-2 hover:ring-primary"
                          title={tile.title || tile.source}
                        >
                          {tile.thumbnail ? (
                            <img
                              src={tile.thumbnail}
                              alt={tile.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const t = e.currentTarget;
                                if (tile.original && t.src !== tile.original) {
                                  t.src = tile.original;
                                } else {
                                  t.style.display = "none";
                                  const parent = t.parentElement;
                                  if (parent && !parent.querySelector(".img-fallback")) {
                                    const fb = document.createElement("div");
                                    fb.className = "img-fallback w-full h-full flex flex-col items-center justify-center gap-2 p-3";
                                    fb.innerHTML = `<svg class="w-8 h-8 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg><p class="text-xs text-center opacity-60 break-all leading-tight">${tile.source}</p>`;
                                    parent.appendChild(fb);
                                  }
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-muted/30 p-3">
                              <Globe className="w-8 h-8 text-muted-foreground/40" />
                              <p className="text-xs text-muted-foreground text-center break-all">{tile.source}</p>
                            </div>
                          )}
                          {/* Source badge */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-2 py-1">
                            <p className="text-white text-xs truncate">{tile.source}</p>
                          </div>
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex flex-col items-center justify-center p-2 opacity-0 group-hover:opacity-100">
                            <ExternalLink className="w-5 h-5 text-white mb-1" />
                            <p className="text-white text-xs text-center font-medium leading-tight line-clamp-2">
                              {tile.title || tile.source}
                            </p>
                            <p className="text-white/70 text-xs mt-0.5">{tile.source}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── EXIF Metadata ── */}
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5 text-primary" />
                    Image Metadata (EXIF)
                  </h2>
                  <div className="space-y-2">
                    {results.metadata.gps && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-destructive" />
                          <span className="font-medium text-sm text-destructive">GPS Location Embedded</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {results.metadata.gps.latitude}°, {results.metadata.gps.longitude}° ·{" "}
                          <a
                            href={`https://www.google.com/maps?q=${results.metadata.gps.latitude},${results.metadata.gps.longitude}`}
                            target="_blank" rel="noopener noreferrer"
                            className="underline hover:text-primary"
                          >
                            View on map
                          </a>
                        </p>
                      </div>
                    )}

                    {(
                      [
                        { label: "Camera",     value: results.metadata.camera },
                        { label: "Date Taken", value: results.metadata.dateTaken ? new Date(results.metadata.dateTaken).toLocaleString() : null },
                        { label: "Dimensions", value: results.metadata.dimensions },
                        { label: "Software",   value: results.metadata.software },
                      ] as { label: string; value: string | null }[]
                    ).filter((i) => i.value).map((item) => (
                      <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                        <span className="text-sm font-medium">{item.value}</span>
                      </div>
                    ))}

                    {!results.metadata.camera && !results.metadata.gps && !results.metadata.dateTaken && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 text-success">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span className="text-sm">No sensitive metadata in this image.</span>
                      </div>
                    )}
                  </div>
                  {results.metadata.gps && (
                    <p className="text-xs text-muted-foreground mt-4">
                      GPS coordinates reveal your physical location. Strip metadata before sharing photos.
                    </p>
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

export default ImageScan;

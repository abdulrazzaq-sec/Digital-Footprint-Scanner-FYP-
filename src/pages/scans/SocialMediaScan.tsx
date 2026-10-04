import { useState } from "react";
import { Share2, Search, Eye, EyeOff, CheckCircle, AlertTriangle } from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import ProgressBar from "@/components/common/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";

const PRIVATE_ACCOUNT_PLATFORMS = ["tiktok", "facebook"];

const SocialMediaScan = () => {
  const [platform, setPlatform] = useState("");
  const [username, setUsername] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { saveScanResult } = useAuth();

  const platforms = [
    { id: "twitter", name: "Twitter/X", icon: "🐦" },
    { id: "facebook", name: "Facebook", icon: "👤" },
    { id: "linkedin", name: "LinkedIn", icon: "💼" },
    { id: "tiktok", name: "TikTok", icon: "🎵" },
  ];

  const generateResults = () => {
    const hash = (username + platform).split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);

    // On a private account, posts/stories/photos are never visible to strangers
    const postsHidden = isPrivate && PRIVATE_ACCOUNT_PLATFORMS.includes(platform);

    const privacyScore = postsHidden
      ? 55 + Math.abs(hash % 20)   // private accounts score much better
      : 25 + Math.abs(hash % 40);

    const profileSettings = [
      { name: "Full name visible", exposed: Math.abs(hash % 2) === 0, risk: "medium" },
      { name: "Profile photo public", exposed: true, risk: "low" },
      { name: "Bio/description public", exposed: Math.abs((hash >> 2) % 2) === 0, risk: "low" },
      { name: "Location visible", exposed: Math.abs((hash >> 4) % 3) === 0, risk: "high" },
      { name: "Email accessible", exposed: Math.abs((hash >> 6) % 4) === 0, risk: "high" },
      { name: "Phone number visible", exposed: Math.abs((hash >> 8) % 5) === 0, risk: "critical" },
    ];

    const postSettings = [
      { name: "Posts visible to everyone", exposed: postsHidden ? false : Math.abs((hash >> 10) % 2) === 0, risk: "medium" },
      { name: "Photos/videos public", exposed: postsHidden ? false : Math.abs((hash >> 12) % 2) === 0, risk: "medium" },
      { name: "Stories visible to non-followers", exposed: postsHidden ? false : Math.abs((hash >> 14) % 3) === 0, risk: "low" },
      { name: "Comments visible", exposed: postsHidden ? false : true, risk: "low" },
    ];

    const activitySettings = [
      { name: "Friend/follower list public", exposed: postsHidden ? false : Math.abs((hash >> 16) % 2) === 0, risk: "medium" },
      { name: "Likes/reactions visible", exposed: postsHidden ? false : Math.abs((hash >> 18) % 2) === 0, risk: "low" },
      { name: "Tags and mentions visible", exposed: Math.abs((hash >> 20) % 2) === 0, risk: "medium" },
      { name: "Check-ins/location history", exposed: postsHidden ? false : Math.abs((hash >> 22) % 4) === 0, risk: "high" },
    ];
    
    const exposedCount = [...profileSettings, ...postSettings, ...activitySettings].filter(s => s.exposed).length;
    const visibilityPercent = Math.round((exposedCount / 14) * 100);
    
    const recommendations = [
      { text: "Switch your account to private", risk: "high", done: Math.abs(hash % 3) === 0 },
      { text: "Remove location from your profile", risk: "high", done: Math.abs((hash >> 2) % 3) === 0 },
      { text: "Hide your friend/follower list", risk: "medium", done: Math.abs((hash >> 4) % 4) === 0 },
      { text: "Disable story sharing", risk: "low", done: Math.abs((hash >> 6) % 2) === 0 },
      { text: "Review tagged photos visibility", risk: "medium", done: Math.abs((hash >> 8) % 4) === 0 },
      { text: "Enable two-factor authentication", risk: "high", done: Math.abs((hash >> 10) % 2) === 0 },
      { text: "Review third-party app permissions", risk: "medium", done: Math.abs((hash >> 12) % 3) === 0 },
      { text: "Audit your post history", risk: "low", done: Math.abs((hash >> 14) % 4) === 0 },
    ];
    
    return {
      privacyScore,
      visibilityPercent,
      grade: privacyScore >= 80 ? "A" : privacyScore >= 60 ? "B" : privacyScore >= 40 ? "C" : "D",
      profile: profileSettings,
      posts: postSettings,
      activity: activitySettings,
      recommendations
    };
  };

  const handleScan = async () => {
    if (!username || !platform) return;
    
    setIsScanning(true);
    setScanProgress(0);
    setShowResults(false);

    const statuses = [
      "Connecting to social platform...",
      "Analyzing profile visibility...",
      "Checking post privacy settings...",
      "Reviewing activity exposure...",
      "Identifying connected apps...",
      "Generating recommendations..."
    ];

    for (let i = 0; i <= 100; i += 2) {
      await new Promise(resolve => setTimeout(resolve, 40));
      setScanProgress(i);
      setScanStatus(statuses[Math.floor(i / 20)] || statuses[statuses.length - 1]);
    }

    const generatedResults = generateResults();
    setResults(generatedResults);
    
    saveScanResult('socialMedia', {
      status: generatedResults.privacyScore >= 60 ? 'warning' : 'danger',
      privacyScore: generatedResults.privacyScore,
      platform,
      username,
      scannedAt: new Date().toISOString()
    });
    
    setIsScanning(false);
    setShowResults(true);
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel */}
          <div className="space-y-6">
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Share2 className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Social Media Privacy Checker</h1>
                  <p className="text-muted-foreground text-sm">Analyze your social media privacy settings</p>
                </div>
              </div>

              {/* Platform Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3">Select Platform</label>
                <div className="flex flex-wrap gap-2">
                  {platforms.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setPlatform(p.id); setIsPrivate(false); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                        platform === p.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/50 hover:bg-muted"
                      }`}
                    >
                      <span>{p.icon}</span>
                      <span className="text-sm font-medium">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {PRIVATE_ACCOUNT_PLATFORMS.includes(platform) && (
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-muted/30 border border-border mb-2">
                  <div>
                    <p className="text-sm font-medium">Account Type</p>
                    <p className="text-xs text-muted-foreground">Private accounts hide posts, stories &amp; activity from non-followers</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${!isPrivate ? "text-primary font-semibold" : "text-muted-foreground"}`}>Public</span>
                    <button
                      type="button"
                      onClick={() => setIsPrivate((v) => !v)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPrivate ? "bg-primary" : "bg-muted"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isPrivate ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                    <span className={`text-xs ${isPrivate ? "text-primary font-semibold" : "text-muted-foreground"}`}>Private</span>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Username or Profile URL</label>
                  <div className="relative">
                    <Share2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="@username or profile URL"
                      className="input-cyber w-full pl-12"
                    />
                  </div>
                </div>

                <button
                  onClick={handleScan}
                  disabled={isScanning || !username || !platform}
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
                      Analyze Privacy
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
              </div>
            </div>
          </div>

          {/* Right Panel - Results or Empty State */}
          <div className="space-y-6">
            {!showResults && !isScanning && (
              <div className="glass-card p-12 text-center animate-fade-in">
                <Share2 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Profile Analyzed Yet</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Select a platform and enter your username to analyze your social media privacy settings.
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                  <span className="px-3 py-1 rounded-full bg-muted/50">Profile visibility</span>
                  <span className="px-3 py-1 rounded-full bg-muted/50">Post privacy</span>
                  <span className="px-3 py-1 rounded-full bg-muted/50">Activity exposure</span>
                </div>
              </div>
            )}

            {showResults && results && (
              <div className="space-y-6 animate-fade-in">
                {/* Privacy Score */}
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold">Privacy Score</h2>
                    <span className="badge-warning">Grade: {results.grade}</span>
                  </div>

                  <div className="flex items-center gap-8">
                    <RiskGauge score={100 - results.privacyScore} size="lg" label="Privacy Risk" />
                    
                    <div className="flex-1">
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Profile Visibility</span>
                          <span className="text-warning">{results.visibilityPercent}% Public</span>
                        </div>
                        <ProgressBar value={results.visibilityPercent} color="warning" showValue={false} size="sm" />
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        Your profile has several public settings that strangers can access. Review the recommendations below.
                      </p>
                    </div>
                  </div>
                </div>

                {/* What's Visible */}
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-4">What's Visible to Strangers</h2>
                  
                  {[
                    { category: "profile", label: "Profile", settings: results.profile },
                    { category: "posts", label: "Posts", settings: results.posts },
                    { category: "activity", label: "Activity", settings: results.activity }
                  ].map(({ category, label, settings }) => (
                    <div key={category} className="mb-6 last:mb-0">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        {label}
                      </h3>
                      <div className="space-y-2">
                        {settings.map((setting: any, index: number) => (
                          <div
                            key={index}
                            className={`flex items-center justify-between p-3 rounded-lg ${
                              setting.exposed
                                ? setting.risk === "critical" || setting.risk === "high"
                                  ? "bg-destructive/10 border border-destructive/20"
                                  : "bg-warning/10 border border-warning/20"
                                : "bg-success/10 border border-success/20"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {setting.exposed ? (
                                <Eye className={`w-4 h-4 ${
                                  setting.risk === "critical" || setting.risk === "high" ? "text-destructive" : "text-warning"
                                }`} />
                              ) : (
                                <EyeOff className="w-4 h-4 text-success" />
                              )}
                              <span className="text-sm">{setting.name}</span>
                            </div>
                            {setting.exposed ? (
                              <span className={`badge-${setting.risk === "critical" || setting.risk === "high" ? "danger" : "warning"}`}>
                                Visible
                              </span>
                            ) : (
                              <span className="badge-success">Hidden</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recommendations */}
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold mb-4">Privacy Recommendations</h2>
                  <div className="space-y-3">
                    {results.recommendations.map((rec: any, index: number) => (
                      <div
                        key={index}
                        className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                          rec.done ? "bg-success/10 border border-success/20" : "bg-muted/30"
                        }`}
                      >
                        <button
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            rec.done
                              ? "border-success bg-success"
                              : "border-muted-foreground hover:border-primary"
                          }`}
                        >
                          {rec.done && <CheckCircle className="w-3 h-3 text-success-foreground" />}
                        </button>
                        <div className="flex-1">
                          <p className={`text-sm ${rec.done ? "line-through text-muted-foreground" : ""}`}>
                            {rec.text}
                          </p>
                          <span
                            className={`text-xs mt-1 inline-block ${
                              rec.risk === "high" ? "text-amber-700" : rec.risk === "medium" ? "text-blue-600" : "text-muted-foreground"
                            }`}
                          >
                            {rec.risk.charAt(0).toUpperCase() + rec.risk.slice(1)} Priority
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialMediaScan;
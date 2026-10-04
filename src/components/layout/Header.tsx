import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Shield, Menu, ChevronDown, User, LogOut, FileText,
  Mail, Key, UserSearch, Phone, Image, FileText as DocIcon,
  Globe, Monitor, AlertTriangle, Crosshair,
  FileSearch, Lock, Fingerprint, EyeOff, Ghost, Wifi, CreditCard, ArrowRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";

const scanCategories = [
  {
    label: "Identity & Personal",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    hoverBg: "group-hover:bg-blue-500/20",
    dot: "bg-blue-400",
    links: [
      { path: "/scan/email",    label: "Email Breach Scanner",  icon: Mail,        desc: "Check breached databases" },
      { path: "/scan/password", label: "Password Analyzer",     icon: Key,         desc: "Strength & leak check" },
      { path: "/scan/username", label: "Username Mapper",       icon: UserSearch,  desc: "Cross-platform search" },
      { path: "/scan/phone",    label: "Phone Risk Assessment", icon: Phone,       desc: "Carrier & exposure info" },
      { path: "/scan/cnic",     label: "CNIC Lookup",           icon: CreditCard,  desc: "ID document exposure" },
    ],
  },
  {
    label: "Digital Presence",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    hoverBg: "group-hover:bg-emerald-500/20",
    dot: "bg-emerald-400",
    links: [
      { path: "/scan/image",        label: "Profile Image Search",    icon: Image,    desc: "Reverse image lookup" },
      { path: "/scan/metadata",     label: "Image Metadata Detector", icon: FileSearch, desc: "EXIF & hidden data" },
      { path: "/scan/document",     label: "Document Analyzer",       icon: DocIcon,  desc: "Metadata & malware scan" },
      { path: "/scan/ghost",        label: "Ghost Account Finder",    icon: Ghost,    desc: "Forgotten accounts" },
      { path: "/scan/doxxing",      label: "Doxxing Vulnerability",   icon: EyeOff,   desc: "Public exposure risk" },
    ],
  },
  {
    label: "Network & Device",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    hoverBg: "group-hover:bg-orange-500/20",
    dot: "bg-orange-400",
    links: [
      { path: "/scan/ip",          label: "IP Privacy Scanner",       icon: Globe,    desc: "VPN, proxy & location" },
      { path: "/scan/fingerprint", label: "Device Fingerprint",       icon: Monitor,  desc: "Browser tracking risk" },
      { path: "/scan/network",     label: "Network Exposure Scanner", icon: Wifi,     desc: "Open ports & services" },
      { path: "/scan/session",     label: "Session & Cookie Analyzer",icon: Lock,     desc: "Auth token exposure" },
      { path: "/scan/subdomain",   label: "Subdomain Scanner",        icon: Globe,    desc: "Discover hidden subdomains" },
    ],
  },
  {
    label: "Threats & Awareness",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    hoverBg: "group-hover:bg-rose-500/20",
    dot: "bg-rose-400",
    links: [
      { path: "/scan/phishing",          label: "Phishing Quiz",          icon: AlertTriangle, desc: "Test your awareness" },
      { path: "/scan/phishing-profiler", label: "Phishing Vulnerability", icon: Crosshair,     desc: "Attack surface analysis" },
      { path: "/scan/tracker",           label: "IP Tracker Links",        icon: Globe,         desc: "Capture IP when link clicked" },
    ],
  },
];

// Flat list for mobile
const allScanLinks = scanCategories.flatMap(c => c.links);

const Header = ({ onMenuOpen }: { onMenuOpen: () => void }) => {
  const [scansOpen, setScansOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[70px] bg-background/80 backdrop-blur-xl border-b border-border/30 shadow-lg shadow-background/20">
      <div className="container mx-auto px-4 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Logo */}
          <Link to={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
            <div className="relative">
              <Shield className="w-7 h-7 sm:w-9 sm:h-9 text-primary transition-all duration-300 group-hover:scale-110" />
              <div className="absolute inset-0 bg-primary/30 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-base sm:text-xl font-bold tracking-tight">
              <span className="hidden sm:inline bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">Digital Footprint </span>
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Scanner</span>
            </span>
          </Link>

          {/* Desktop Navigation - Only show if authenticated */}
          {isAuthenticated && (
            <nav className="hidden lg:flex items-center gap-1">
              <Link
                to="/dashboard"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isActive("/dashboard")
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                Dashboard
              </Link>

              {/* Scans Mega Dropdown */}
              <DropdownMenu open={scansOpen} onOpenChange={setScansOpen}>
                <DropdownMenuTrigger className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 outline-none ${
                  location.pathname.startsWith("/scan")
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}>
                  Scans
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  className="w-[720px] p-0 overflow-hidden rounded-xl border-0"
                  style={{
                    background: "rgba(255,255,255,0.85)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: "1px solid rgba(201,168,76,0.2)",
                    boxShadow: "0 20px 60px -10px rgba(27,42,74,0.18), 0 4px 20px -4px rgba(27,42,74,0.1), inset 0 1px 0 rgba(255,255,255,0.8)",
                  }}
                  align="center"
                  sideOffset={8}
                >
                  {/* Header bar */}
                  <div className="px-5 py-3 flex items-center justify-between" style={{ background: "rgba(27,42,74,0.04)", borderBottom: "1px solid rgba(201,168,76,0.15)" }}>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" style={{ color: "#C9A84C" }} />
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1B2A4A" }}>Security Scans</span>
                    </div>
                    <span className="text-xs" style={{ color: "#6b7a99" }}>{allScanLinks.length} tools available</span>
                  </div>

                  {/* Categories grid */}
                  <div className="grid grid-cols-2 gap-0" style={{ borderRight: "none" }}>
                    {scanCategories.map((cat, i) => (
                      <div key={cat.label} className="p-4" style={{ borderRight: i % 2 === 0 ? "1px solid rgba(27,42,74,0.08)" : "none", borderBottom: i < 2 ? "1px solid rgba(27,42,74,0.08)" : "none" }}>
                        {/* Category header */}
                        <div className="flex items-center gap-2 mb-3 px-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                          <span className={`text-[11px] font-semibold uppercase tracking-widest ${cat.color}`}>
                            {cat.label}
                          </span>
                        </div>

                        {/* Links */}
                        <div className="space-y-0.5">
                          {cat.links.map((link) => {
                            const active = location.pathname === link.path;
                            return (
                              <Link
                                key={link.path}
                                to={link.path}
                                onClick={() => setScansOpen(false)}
                                className={`group flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all duration-150 ${
                                  active ? `${cat.bg} ${cat.color}` : `${cat.color}`
                                }`}
                                style={!active ? { color: "#4a5568" } : {}}
                                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(27,42,74,0.05)"; }}
                                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                              >
                                <div className={`shrink-0 p-1.5 rounded-md transition-colors ${cat.bg} ${cat.hoverBg}`}>
                                  <link.icon className={`w-3.5 h-3.5 ${cat.color}`} />
                                </div>
                                <div className="min-w-0">
                                  <p className={`text-xs font-medium leading-tight ${active ? cat.color : ""}`} style={!active ? { color: "#1B2A4A" } : {}}>
                                    {link.label}
                                  </p>
                                  <p className="text-[11px] leading-tight mt-0.5 truncate" style={{ color: "#6b7a99" }}>
                                    {link.desc}
                                  </p>
                                </div>
                                {active && <span className={`ml-auto w-1 h-1 rounded-full shrink-0 ${cat.dot}`} />}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-2.5 flex items-center justify-between" style={{ background: "rgba(27,42,74,0.03)", borderTop: "1px solid rgba(201,168,76,0.15)" }}>
                    <span className="text-xs" style={{ color: "#6b7a99" }}>Select a scan to get started</span>
                    <Link
                      to="/dashboard"
                      onClick={() => setScansOpen(false)}
                      className="flex items-center gap-1 text-xs font-medium hover:underline"
                      style={{ color: "#C9A84C" }}
                    >
                      View dashboard <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <Link
                to="/report"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isActive("/report")
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                Reports
              </Link>

              <Link
                to="/about"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isActive("/about")
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                Help
              </Link>
            </nav>
          )}

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/50 transition-all duration-300 outline-none">
                    <div className="relative">
                      <img
                        src={user?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=default"}
                        alt="User avatar"
                        className="w-8 h-8 rounded-full border-2 border-border"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-background" />
                    </div>
                    <span className="hidden sm:block text-sm font-medium max-w-[100px] truncate">
                      {user?.name || "User"}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 p-1 rounded-xl border-0"
                    style={{
                      background: "rgba(255,255,255,0.9)",
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      border: "1px solid rgba(201,168,76,0.2)",
                      boxShadow: "0 16px 40px -8px rgba(27,42,74,0.18), 0 4px 16px -4px rgba(27,42,74,0.1), inset 0 1px 0 rgba(255,255,255,0.9)",
                    }}
                  >
                    <div className="px-3 py-3 mb-1 rounded-lg" style={{ borderBottom: "1px solid rgba(27,42,74,0.08)" }}>
                      <p className="text-sm font-semibold" style={{ color: "#1B2A4A" }}>{user?.name}</p>
                      <p className="text-xs truncate" style={{ color: "#6b7a99" }}>{user?.email}</p>
                    </div>
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2 text-sm transition-colors" style={{ color: "#1B2A4A" }}>
                        <User className="w-4 h-4" style={{ color: "#C9A84C" }} />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/report" className="flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2 text-sm transition-colors" style={{ color: "#1B2A4A" }}>
                        <FileText className="w-4 h-4" style={{ color: "#C9A84C" }} />
                        My Reports
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator style={{ backgroundColor: "rgba(27,42,74,0.08)" }} />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2 text-sm"
                      style={{ color: "#b91c1c" }}
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="btn-primary py-2 px-5 text-sm"
                >
                  Sign Up
                </Link>
              </>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={onMenuOpen}
              className="lg:hidden p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-300"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

    </header>
  );
};

export default Header;

import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  X, Shield, User, LogOut, HelpCircle,
  Mail, Key, UserSearch, Phone, CreditCard,
  Image, FileSearch, FileText as DocIcon, Ghost, EyeOff,
  Globe, Monitor, Wifi, Lock, AlertTriangle, Crosshair,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const scanCategories = [
  {
    label: "Identity & Personal",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    dot: "bg-blue-400",
    links: [
      { path: "/scan/email",    label: "Email Breach Scanner",  icon: Mail       },
      { path: "/scan/password", label: "Password Analyzer",     icon: Key        },
      { path: "/scan/username", label: "Username Mapper",       icon: UserSearch },
      { path: "/scan/phone",    label: "Phone Risk Assessment", icon: Phone      },
      { path: "/scan/cnic",     label: "CNIC Lookup",           icon: CreditCard },
    ],
  },
  {
    label: "Digital Presence",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    dot: "bg-emerald-400",
    links: [
      { path: "/scan/image",    label: "Profile Image Search",    icon: Image      },
      { path: "/scan/metadata", label: "Image Metadata Detector", icon: FileSearch },
      { path: "/scan/document", label: "Document Analyzer",       icon: DocIcon    },
      { path: "/scan/ghost",    label: "Ghost Account Finder",    icon: Ghost      },
      { path: "/scan/doxxing",  label: "Doxxing Vulnerability",   icon: EyeOff     },
    ],
  },
  {
    label: "Network & Device",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    dot: "bg-orange-400",
    links: [
      { path: "/scan/ip",          label: "IP Privacy Scanner",        icon: Globe   },
      { path: "/scan/fingerprint", label: "Device Fingerprint",        icon: Monitor },
      { path: "/scan/network",     label: "Network Exposure Scanner",  icon: Wifi    },
      { path: "/scan/session",     label: "Session & Cookie Analyzer", icon: Lock    },
      { path: "/scan/subdomain",   label: "Subdomain Scanner",         icon: Globe   },
    ],
  },
  {
    label: "Threats & Awareness",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    dot: "bg-rose-400",
    links: [
      { path: "/scan/phishing",          label: "Phishing Quiz",          icon: AlertTriangle },
      { path: "/scan/phishing-profiler", label: "Phishing Vulnerability", icon: Crosshair     },
      { path: "/scan/tracker",           label: "IP Tracker Links",        icon: Globe         },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate("/");
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-72 bg-card border-r border-border/30 transition-transform duration-300 ease-in-out lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-[70px] border-b border-border/30 shrink-0">
          <Link
            to={isAuthenticated ? "/dashboard" : "/"}
            onClick={onClose}
            className="flex items-center gap-2"
          >
            <Shield className="w-7 h-7 text-primary" />
            <span className="text-base font-bold">
              <span className="text-foreground/80">Digital </span>
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Scanner</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto py-3 px-3">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-3 transition-colors ${
                  isActive("/dashboard")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                Dashboard
              </Link>

              {scanCategories.map((cat) => (
                <div key={cat.label} className="mb-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cat.dot}`} />
                    <span className={`text-[10px] font-semibold uppercase tracking-widest ${cat.color}`}>
                      {cat.label}
                    </span>
                  </div>
                  {cat.links.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={onClose}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive(link.path)
                          ? `${cat.bg} ${cat.color} font-medium`
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <div className={`shrink-0 p-1 rounded-md ${cat.bg}`}>
                        <link.icon className={`w-3.5 h-3.5 ${cat.color}`} />
                      </div>
                      <span className="text-xs leading-tight">{link.label}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <div className="space-y-3 mt-2">
              <Link
                to="/login"
                onClick={onClose}
                className="block w-full text-center py-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm"
              >
                Login
              </Link>
              <Link
                to="/signup"
                onClick={onClose}
                className="btn-primary block w-full text-center"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* Bottom user actions */}
        {isAuthenticated && (
          <div className="shrink-0 border-t border-border/30 p-3 space-y-1">
            <Link
              to="/profile"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <User className="w-4 h-4 shrink-0" />
              Profile
            </Link>
            <Link
              to="/about"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <HelpCircle className="w-4 h-4 shrink-0" />
              Help
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Logout
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;

import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-card/50 border-t border-border/30 py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <Shield className="w-8 h-8 text-primary" />
              <span className="text-xl font-bold">
                Digital Footprint <span className="text-primary">Scanner</span>
              </span>
            </Link>
            <p className="text-muted-foreground text-sm max-w-md mb-6">
              Find out what the internet knows about you and take back control of your digital identity.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Quick Links</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Link to="/report" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                My Reports
              </Link>
              <Link to="/profile" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Profile
              </Link>
              <Link to="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                About Us
              </Link>
            </nav>
          </div>

          {/* Security Scans */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Security Scans</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/scan/email" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Email Breach Check
              </Link>
              <Link to="/scan/password" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Password Analyzer
              </Link>
              <Link to="/scan/username" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Username Mapper
              </Link>
              <Link to="/scan/phishing" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Phishing Test
              </Link>
            </nav>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/30 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Digital Footprint Scanner. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Terms of Service
            </Link>
            <Link to="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

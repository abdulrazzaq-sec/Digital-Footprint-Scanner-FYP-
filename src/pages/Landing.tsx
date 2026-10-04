import { Link } from "react-router-dom";
import {
  Shield,
  Gauge,
  CheckCircle,
  Brain,
  FileText,
  Lock,
  RefreshCw,
  ArrowRight,
  ChevronRight,
  UserPlus,
  Search,
  ClipboardCheck,
  ShieldCheck,
  Zap,
  Users,
  Database,
  Globe,
  Fingerprint,
  Mail,
} from "lucide-react";
import ParticleBackground from "@/components/common/ParticleBackground";
import { useAuth } from "@/contexts/AuthContext";

const Landing = () => {
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: Gauge,
      title: "Real-Time Scanning",
      description:
        "Instant analysis of your online presence across multiple databases",
    },
    {
      icon: CheckCircle,
      title: "11+ Security Checks",
      description:
        "16 scan types covering your full digital exposure",
    },
    {
      icon: Brain,
      title: "AI-Powered Insights",
      description:
        "Smart risk assessment and personalized security predictions",
    },
    {
      icon: FileText,
      title: "Clear Reports",
      description: "Get clear, step-by-step guidance to protect yourself",
    },
    {
      icon: Lock,
      title: "Privacy First",
      description: "Your data never leaves our secure encrypted system",
    },
    {
      icon: RefreshCw,
      title: "Always Updated",
      description:
        "Latest threat intelligence and breach data from global sources",
    },
  ];

  const steps = [
    {
      step: "01",
      title: "Enter Your Information",
      description:
        "Provide your email, username, or other details you want to analyze. Your data is processed securely and never stored without permission.",
      icon: UserPlus,
      color: "from-green-500 to-emerald-600",
    },
    {
      step: "02",
      title: "AI Analyzes Your Footprint",
      description:
        "Our AI-powered system scans across 20+ databases, social platforms, and breach archives to find every trace of your digital presence.",
      icon: Search,
      color: "from-blue-500 to-cyan-600",
    },
    {
      step: "03",
      title: "Get Comprehensive Report",
      description:
        "Receive a detailed risk assessment with easy-to-understand scores, visual breakdowns, and personalized insights about your exposure.",
      icon: ClipboardCheck,
      color: "from-purple-500 to-violet-600",
    },
    {
      step: "04",
      title: "Take Action & Stay Protected",
      description:
        "Follow our step-by-step recommendations to lock down your privacy, remove exposed data, and continuously monitor your security.",
      icon: ShieldCheck,
      color: "from-orange-500 to-red-600",
    },
  ];

  const scanTypes = [
    {
      icon: Mail,
      title: "Email Breach Detection",
      description:
        "Check if your email has been compromised in known data breaches",
    },
    {
      icon: Lock,
      title: "Password Strength Analysis",
      description:
        "Evaluate your password security with real-time strength scoring",
    },
    {
      icon: Users,
      title: "Username Footprint Mapping",
      description: "Discover where your username appears across platforms",
    },
    {
      icon: Globe,
      title: "Social Media Privacy Audit",
      description: "Analyze your social media exposure and privacy settings",
    },
    {
      icon: Fingerprint,
      title: "Device Fingerprint Analysis",
      description: "See how trackable your browser and device are online",
    },
    {
      icon: Database,
      title: "Dark Web Monitoring",
      description: "Scan for your data on dark web marketplaces and forums",
    },
  ];

  return (
    <div className="landing-theme min-h-screen bg-background overflow-hidden">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-[70px] bg-background/60 backdrop-blur-xl border-b border-border/20">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <Shield className="w-9 h-9 text-primary" />
            <span className="text-xl font-bold tracking-tight">
              Digital Footprint <span className="text-primary">Scanner</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn-primary py-2 px-5 text-sm">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Login
                </Link>
                <Link to="/signup" className="btn-primary py-2 px-5 text-sm">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center hero-gradient pt-[70px]">
        <ParticleBackground />

        {/* Cyber Grid */}
        <div className="absolute inset-0 cyber-grid opacity-50" />

        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-8 animate-fade-in">
              <Shield className="w-4 h-4" />
              Trusted by security-conscious users
            </div>

            {/* Heading */}
            <h1
              className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-in"
              style={{ animationDelay: "0.1s" }}
            >
              Discover Your{" "}
              <span className="text-primary text-glow">Digital Footprint</span>
            </h1>

            {/* Subheading */}
            <p
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in"
              style={{ animationDelay: "0.2s" }}
            >
              See what the internet knows about you before hackers do. Protect
              your identity with 16 security scans built to catch real threats.
            </p>

            {/* CTAs */}
            <div
              className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in"
              style={{ animationDelay: "0.3s" }}
            >
              <Link
                to="/signup"
                className="btn-primary inline-flex items-center justify-center gap-2 group"
              >
                Start Free Scan
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Floating Shield Animation */}
            <div
              className="mt-20 relative animate-fade-in"
              style={{ animationDelay: "0.4s" }}
            >
              <div className="relative w-64 h-64 mx-auto">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full blur-3xl animate-pulse-slow" />
                <div className="relative z-10 w-full h-full flex items-center justify-center">
                  <Shield className="w-32 h-32 text-primary animate-float" />
                </div>
                {/* Orbiting dots */}
                <div className="absolute inset-0 animate-spin-slow">
                  <div className="absolute top-0 left-1/2 w-3 h-3 bg-primary rounded-full -translate-x-1/2 shadow-lg shadow-primary/50" />
                  <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-secondary rounded-full -translate-x-1/2 shadow-lg shadow-secondary/50" />
                  <div className="absolute left-0 top-1/2 w-2 h-2 bg-primary rounded-full -translate-y-1/2 shadow-lg shadow-primary/50" />
                  <div className="absolute right-0 top-1/2 w-3 h-3 bg-secondary rounded-full -translate-y-1/2 shadow-lg shadow-secondary/50" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-subtle">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-primary rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Complete Security <span className="text-primary">Analysis</span>
            </h2>
            <p className="text-muted-foreground">
              Every tool built to find real exposure and tell you what to do about it.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="glass-card-hover p-6 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section - Redesigned */}
      <section className="py-24 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-card/20 to-background" />
        <div className="absolute inset-0 cyber-grid opacity-20" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              How{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                Digital Footprint Scanner
              </span>{" "}
              Works
            </h2>
            <p className="text-lg text-muted-foreground">
              Secure your digital presence in four simple steps
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {steps.map((step, index) => (
                <div
                  key={step.step}
                  className="relative animate-fade-in group"
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  {/* Card */}
                  <div className="glass-card p-8 h-full hover:border-primary/30 transition-all duration-500 hover:-translate-y-2">
                    {/* Step number */}
                    <div
                      className={`absolute -top-4 -right-4 w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-2xl font-bold text-white shadow-lg`}
                    >
                      {step.step}
                    </div>

                    {/* Icon */}
                    <div
                      className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} p-4 mb-6 shadow-lg`}
                    >
                      <step.icon className="w-full h-full text-white" />
                    </div>

                    {/* Content */}
                    <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  {/* Connecting line (hidden on mobile, shown between cards on desktop) */}
                  {index < 3 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What We Scan Section */}
      <section className="py-24 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Comprehensive <span className="text-primary">Security Scans</span>
            </h2>
            <p className="text-muted-foreground">
              Our toolkit covers every aspect of your digital presence
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {scanTypes.map((scan, index) => (
              <div
                key={scan.title}
                className="glass-card p-6 hover:border-primary/30 transition-all duration-500 hover:-translate-y-1 group animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 group-hover:from-primary/30 group-hover:to-secondary/30 transition-all">
                    <scan.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{scan.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {scan.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              to="/signup"
              className="btn-primary inline-flex items-center gap-2 group"
            >
              Start Your Free Scan
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="glass-card p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Secure & Private</h3>
                <p className="text-sm text-muted-foreground">
                  End-to-end encryption ensures your data stays protected. We
                  never store your passwords or sensitive credentials.
                </p>
              </div>
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Instant Results</h3>
                <p className="text-sm text-muted-foreground">
                  Get comprehensive analysis in seconds, not hours. Our
                  optimized scanning engine delivers fast, accurate results.
                </p>
              </div>
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <RefreshCw className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Always Up-to-Date</h3>
                <p className="text-sm text-muted-foreground">
                  Our databases are continuously updated with the latest breach
                  information and security intelligence.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 hero-gradient opacity-50" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center glass-card p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Protect Your{" "}
              <span className="text-primary">Digital Identity</span>?
            </h2>
            <p className="text-muted-foreground mb-8">
              Start your free security scan today and discover what the internet
              knows about you.
            </p>
            <Link
              to="/signup"
              className="btn-primary inline-flex items-center gap-2 group"
            >
              Get Started Free
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card/50 border-t border-border/30 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <span className="font-bold">Digital Footprint Scanner</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link
                to="/about"
                className="hover:text-primary transition-colors"
              >
                About
              </Link>
              <Link
                to="/privacy"
                className="hover:text-primary transition-colors"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="hover:text-primary transition-colors"
              >
                Terms
              </Link>
              <Link
                to="/contact"
                className="hover:text-primary transition-colors"
              >
                Contact
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Digital Footprint Scanner. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

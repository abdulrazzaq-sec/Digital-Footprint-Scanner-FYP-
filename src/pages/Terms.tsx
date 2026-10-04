import { Shield, FileText, AlertTriangle, Scale, Ban, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

const Terms = () => {
  const sections = [
    {
      icon: FileText,
      title: "Acceptance of Terms",
      content: "By accessing or using Digital Footprint Scanner, you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not access our service. We reserve the right to update these terms at any time, and continued use constitutes acceptance of any modifications."
    },
    {
      icon: Shield,
      title: "Service Description",
      content: "Digital Footprint Scanner provides security analysis tools including email breach checking, password strength analysis, digital footprint mapping, and privacy assessments. Our scans check publicly available databases and perform non-invasive analysis. We do not guarantee the detection of all security threats or data breaches."
    },
    {
      icon: AlertTriangle,
      title: "User Responsibilities",
      content: "You agree to use our service only for lawful purposes and in accordance with these terms. You must not use the service to scan data you don't own or have permission to analyze. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account."
    },
    {
      icon: Ban,
      title: "Prohibited Uses",
      content: "You may not use our service to: attempt to gain unauthorized access to any systems, harass or harm others, distribute malware or malicious content, violate any applicable laws or regulations, or use automated systems to access the service without permission. Violations may result in immediate account termination."
    },
    {
      icon: Scale,
      title: "Limitation of Liability",
      content: "Digital Footprint Scanner is provided 'as is' without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service. Our total liability shall not exceed the amount you paid for the service in the past 12 months."
    },
    {
      icon: RefreshCw,
      title: "Modifications & Termination",
      content: "We reserve the right to modify, suspend, or discontinue any part of the service at any time. We may terminate or suspend your account for violations of these terms. Upon termination, your right to use the service ceases immediately, though certain provisions of these terms will survive."
    }
  ];

  return (
    <div className="landing-theme min-h-screen bg-background">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-[70px] bg-background/60 backdrop-blur-xl border-b border-border/20">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <Shield className="w-9 h-9 text-primary" />
            <span className="text-xl font-bold tracking-tight">
              Digital Footprint <span className="text-primary">Scanner</span>
            </span>
          </Link>
          <Link to="/" className="btn-secondary py-2 px-5 text-sm">
            Back to Home
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 pt-[100px] pb-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <Scale className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
            <p className="text-muted-foreground">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          {/* Introduction */}
          <div className="glass-card p-8 mb-8">
            <p className="text-muted-foreground leading-relaxed">
              Welcome to Digital Footprint Scanner. These terms govern your use of our security scanning 
              platform. Please read them carefully before using our services. By using our platform, 
              you acknowledge that you have read, understood, and agree to be bound by these terms.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-6">
            {sections.map((section, index) => (
              <div key={index} className="glass-card p-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <section.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold">{section.title}</h2>
                </div>
                <p className="text-muted-foreground leading-relaxed">{section.content}</p>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div className="glass-card p-8 mt-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Questions about these terms?</h3>
            <p className="text-muted-foreground mb-4">
              Our legal team is happy to clarify any provisions.
            </p>
            <Link to="/contact" className="btn-primary inline-flex items-center gap-2">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
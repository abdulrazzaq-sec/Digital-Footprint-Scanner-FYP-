import { Shield, Lock, Eye, Database, Server, FileCheck } from "lucide-react";
import { Link } from "react-router-dom";

const Privacy = () => {
  const sections = [
    {
      icon: Database,
      title: "Data Collection",
      content: [
        "We collect only the information you voluntarily provide for scanning purposes (email addresses, usernames, etc.).",
        "Scan data is processed in real-time and not permanently stored unless you create an account.",
        "We do not sell, rent, or share your personal information with third parties for marketing purposes."
      ]
    },
    {
      icon: Lock,
      title: "Data Security",
      content: [
        "All data transmissions are encrypted using industry-standard TLS 1.3 encryption.",
        "Scan results are encrypted at rest using AES-256 encryption.",
        "We implement strict access controls and regular security audits to protect your data."
      ]
    },
    {
      icon: Eye,
      title: "Data Usage",
      content: [
        "Your scan data is used solely to provide security analysis and recommendations.",
        "Aggregated, anonymized data may be used to improve our detection algorithms.",
        "We never access your accounts or passwords - we only check against known breach databases."
      ]
    },
    {
      icon: Server,
      title: "Data Retention",
      content: [
        "Guest scan data is automatically deleted after 24 hours.",
        "Registered users can delete their scan history at any time from their profile.",
        "Upon account deletion, all associated data is permanently removed within 30 days."
      ]
    },
    {
      icon: FileCheck,
      title: "Your Rights",
      content: [
        "You have the right to access, correct, or delete your personal data at any time.",
        "You can opt-out of any non-essential communications.",
        "You can request a complete export of your data in a portable format."
      ]
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
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          {/* Introduction */}
          <div className="glass-card p-8 mb-8">
            <p className="text-muted-foreground leading-relaxed">
              This policy explains how we collect, use, and protect your information when you use Digital Footprint Scanner. You have full control over your data at all times.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-6">
            {sections.map((section, index) => (
              <div key={index} className="glass-card p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <section.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold">{section.title}</h2>
                </div>
                <ul className="space-y-4">
                  {section.content.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <p className="text-muted-foreground">{item}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div className="glass-card p-8 mt-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Questions about our privacy practices?</h3>
            <p className="text-muted-foreground mb-4">
              We're here to help. Reach out to our privacy team.
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

export default Privacy;
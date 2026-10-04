import { Link } from "react-router-dom";
import { Shield, Lock, CheckCircle, ChevronDown, ArrowRight } from "lucide-react";
import { useState } from "react";

const About = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const features = [
    { title: "Email Breach Detection", description: "Scan your email against 12B+ breached records" },
    { title: "Password Analysis", description: "Real-time strength testing and breach checking" },
    { title: "Username Mapping", description: "Discover your presence across 20+ platforms" },
    { title: "Social Media Privacy", description: "Analyze what's visible to strangers" },
    { title: "Phone Number Risk", description: "Check for spam associations and breaches" },
    { title: "Image Reverse Search", description: "Find unauthorized uses of your photos" },
    { title: "Document Metadata", description: "Reveal hidden information in your files" },
    { title: "IP Privacy Analysis", description: "Test for DNS and WebRTC leaks" },
    { title: "Device Fingerprinting", description: "Measure your online trackability" },
    { title: "Phishing Awareness", description: "Test your ability to spot scams" },
  ];

  const faqs = [
    {
      question: "Is my data stored?",
      answer: "No. We never store your personal data. All scans are performed in real-time and results are only shown to you. Your passwords, emails, and other sensitive information are hashed and never logged.",
    },
    {
      question: "How accurate are the results?",
      answer: "Our breach detection has a 98% accuracy rate, powered by the Have I Been Pwned database and other threat intelligence sources. Results are updated in real-time as new breaches are discovered.",
    },
    {
      question: "Is this tool legal?",
      answer: "Yes, absolutely. Digital Footprint Scanner only checks publicly available databases and performs non-invasive scans. We don't access any private accounts or systems without your explicit permission.",
    },
    {
      question: "Can I delete my data?",
      answer: "Since we don't store your personal data, there's nothing to delete. Your scan results are only displayed during your session and are not saved to any database.",
    },
    {
      question: "How often should I scan?",
      answer: "We recommend running a full security scan at least once a month, or whenever you hear about a major data breach. You can also enable automatic alerts for new breaches.",
    },
    {
      question: "What do the risk scores mean?",
      answer: "Risk scores range from 0-100. Scores below 30 indicate low risk, 30-60 is medium risk, 60-80 is high risk, and above 80 is critical. The score considers multiple factors including breach severity and data exposure.",
    },
  ];

  const techStack = [
    { name: "React", icon: "⚛️" },
    { name: "TypeScript", icon: "📘" },
    { name: "Tailwind CSS", icon: "🎨" },
    { name: "Vite", icon: "⚡" },
  ];

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Hero */}
        <div className="glass-card p-12 text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4">About Digital Footprint Scanner</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Find out what the internet knows about you and take steps to protect it.
          </p>
        </div>

        {/* Mission */}
        <div className="glass-card p-8 mb-8">
          <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
          <p className="text-muted-foreground mb-4">
            In today's digital age, our personal information is scattered across the internet-often 
            without our knowledge or consent. Data breaches, social media over-sharing, and sophisticated 
            tracking techniques put our privacy and security at risk every day.
          </p>
          <p className="text-muted-foreground">
            Digital Footprint Scanner was built to give you a clear picture of what information about you is publicly exposed, and the tools to do something about it.
          </p>
        </div>

        {/* Features Grid */}
        <div className="glass-card p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">What We Offer</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{feature.title}</p>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy & Ethics */}
        <div className="glass-card p-8 mb-8 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-8 h-8 text-primary" />
            <h2 className="text-2xl font-bold">Privacy & Ethics</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">No Data Storage</h3>
              <p className="text-sm text-muted-foreground">
                Your sensitive information is never stored. All scans are performed in real-time.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">End-to-End Security</h3>
              <p className="text-sm text-muted-foreground">
                All data is encrypted in transit. We use industry-standard security protocols.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">GDPR Compliant</h3>
              <p className="text-sm text-muted-foreground">
                We respect your privacy rights and comply with international privacy regulations.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Transparent Practices</h3>
              <p className="text-sm text-muted-foreground">
                We're open about what we do and how we do it. No hidden agendas.
              </p>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="glass-card p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Built With</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {techStack.map((tech) => (
              <div key={tech.name} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/30">
                <span className="text-2xl">{tech.icon}</span>
                <span className="font-medium">{tech.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQs */}
        <div className="glass-card p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-border/30 rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <span className="font-medium">{faq.question}</span>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${
                    openFaq === index ? "rotate-180" : ""
                  }`} />
                </button>
                {openFaq === index && (
                  <div className="px-4 pb-4 animate-fade-in">
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="glass-card p-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Secure Your Digital Footprint?</h2>
          <p className="text-muted-foreground mb-8">
            Start your free security scan today and discover what the internet knows about you.
          </p>
          <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2">
            Start Your Free Scan
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </div>
  );
};

export default About;

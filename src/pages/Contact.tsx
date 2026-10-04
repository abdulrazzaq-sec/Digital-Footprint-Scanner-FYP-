import { useState } from "react";
import { Shield, Mail, MessageSquare, Clock, Send, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const BACKEND = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const resp = await fetch(`${BACKEND}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!resp.ok) throw new Error("Server error");
      setIsSubmitted(true);
      toast({ title: "Message sent!", description: "We'll get back to you within 24-48 hours." });
    } catch {
      toast({ title: "Failed to send", description: "Please try again shortly.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    {
      icon: Mail,
      title: "Email Us",
      detail: "support@dfscanner.com",
      description: "For general inquiries and support"
    },
    {
      icon: MessageSquare,
      title: "Live Chat",
      detail: "Available 9AM - 6PM EST",
      description: "Quick answers from our team"
    },
    {
      icon: Clock,
      title: "Response Time",
      detail: "Within 24-48 hours",
      description: "Usually a few hours on weekdays"
    }
  ];

  const faqs = [
    {
      question: "How do I delete my scan data?",
      answer: "You can delete all your scan data from your Profile page under the 'Settings' tab. Click 'Delete All Scan Data' in the Danger Zone."
    },
    {
      question: "Is my data shared with third parties?",
      answer: "No, we never sell or share your personal data with third parties. Your privacy is our top priority."
    },
    {
      question: "How accurate are the breach scans?",
      answer: "Our scans check against multiple breach databases updated regularly. Results are accurate but not exhaustive - treat them as a starting point, not a guarantee."
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
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Get in Touch</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Have questions about our security tools or need help with your account? 
              We're here to help you protect your digital identity.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="glass-card p-8">
                <h2 className="text-xl font-semibold mb-6">Send us a message</h2>
                
                {isSubmitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-success" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Message Sent!</h3>
                    <p className="text-muted-foreground mb-6">
                      Thank you for reaching out. We'll get back to you within 24-48 hours.
                    </p>
                    <button 
                      onClick={() => {
                        setIsSubmitted(false);
                        setFormData({ name: "", email: "", subject: "", message: "" });
                      }}
                      className="btn-secondary"
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium mb-2">Your Name</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="John Doe"
                          className="input-cyber w-full"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Email Address</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="john@example.com"
                          className="input-cyber w-full"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Subject</label>
                      <select 
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="input-cyber w-full"
                        required
                      >
                        <option value="">Select a topic</option>
                        <option value="data_removal">Data Removal Request</option>
                        <option value="general">General Inquiry</option>
                        <option value="support">Technical Support</option>
                        <option value="privacy">Privacy Concerns</option>
                        <option value="feedback">Feedback & Suggestions</option>
                        <option value="partnership">Partnership Opportunities</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Message</label>
                      <textarea
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="How can we help you?"
                        rows={5}
                        className="input-cyber w-full resize-none"
                        required
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send Message
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Contact Info Sidebar */}
            <div className="space-y-6">
              {contactInfo.map((info, index) => (
                <div key={index} className="glass-card p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <info.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">{info.title}</h3>
                  </div>
                  <p className="text-primary font-medium mb-1">{info.detail}</p>
                  <p className="text-sm text-muted-foreground">{info.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* FAQs */}
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {faqs.map((faq, index) => (
                <div key={index} className="glass-card p-6">
                  <h3 className="font-semibold mb-2">{faq.question}</h3>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
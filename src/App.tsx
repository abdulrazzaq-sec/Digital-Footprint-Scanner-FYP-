import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import AppLayout from "./components/layout/AppLayout";
import EmailScan from "./pages/scans/EmailScan";
import PasswordScan from "./pages/scans/PasswordScan";
import UsernameScan from "./pages/scans/UsernameScan";
import PhoneScan from "./pages/scans/PhoneScan";
import ImageScan from "./pages/scans/ImageScan";
import DocumentScan from "./pages/scans/DocumentScan";
import IPScan from "./pages/scans/IPScan";
import FingerprintScan from "./pages/scans/FingerprintScan";
import PhishingScan from "./pages/scans/PhishingScan";
import PhishingProfiler from "./pages/scans/PhishingProfiler";
import MetadataScan from "./pages/scans/MetadataScan";
import SessionScan from "./pages/scans/SessionScan";
import DoxxingScan from "./pages/scans/DoxxingScan";
import GhostScan from "./pages/scans/GhostScan";
import NetworkScan from "./pages/scans/NetworkScan";
import CNICScan from "./pages/scans/CNICScan";
import SubdomainScan from "./pages/scans/SubdomainScan";
import TrackerScan from "./pages/scans/TrackerScan";
import Report from "./pages/Report";
import Profile from "./pages/Profile";
import About from "./pages/About";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/scan/email" element={<EmailScan />} />
              <Route path="/scan/password" element={<PasswordScan />} />
              <Route path="/scan/username" element={<UsernameScan />} />
              <Route path="/scan/phone" element={<PhoneScan />} />
              <Route path="/scan/image" element={<ImageScan />} />
              <Route path="/scan/document" element={<DocumentScan />} />
              <Route path="/scan/ip" element={<IPScan />} />
              <Route path="/scan/fingerprint" element={<FingerprintScan />} />
              <Route path="/scan/phishing" element={<PhishingScan />} />
              <Route path="/scan/phishing-profiler" element={<PhishingProfiler />} />
              <Route path="/scan/metadata" element={<MetadataScan />} />
              <Route path="/scan/session" element={<SessionScan />} />
              <Route path="/scan/doxxing" element={<DoxxingScan />} />
              <Route path="/scan/ghost" element={<GhostScan />} />
              <Route path="/scan/network" element={<NetworkScan />} />
              <Route path="/scan/cnic" element={<CNICScan />} />
              <Route path="/scan/subdomain" element={<SubdomainScan />} />
              <Route path="/scan/tracker" element={<TrackerScan />} />
              <Route path="/report" element={<Report />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/about" element={<About />} />
            </Route>
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

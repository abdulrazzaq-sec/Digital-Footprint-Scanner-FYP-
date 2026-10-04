import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import { MessageSquare } from "lucide-react";

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="landing-theme min-h-screen flex flex-col bg-background cyber-grid">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header onMenuOpen={() => setSidebarOpen(true)} />
      <main className="flex-1 pt-[70px]">
        <Outlet />
      </main>
      <Footer />
      <Link
        to="/contact"
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all duration-300 hover:scale-105"
      >
        <MessageSquare className="w-4 h-4" />
        <span className="text-sm font-medium">Contact Us</span>
      </Link>
    </div>
  );
};

export default AppLayout;

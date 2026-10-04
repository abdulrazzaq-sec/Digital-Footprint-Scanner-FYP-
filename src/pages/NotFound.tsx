import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Shield, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background cyber-grid">
      <div className="text-center px-4">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-8">
          <Shield className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-muted-foreground mb-8">Page not found</p>
        <Link to="/" className="btn-primary inline-flex items-center gap-2">
          <Home className="w-4 h-4" />
          Go Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;

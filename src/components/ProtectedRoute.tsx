import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Shield } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          {/* Spinning golden ring */}
          <div className="relative w-16 h-16">
            <div
              className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
              style={{ borderTopColor: "#C9A84C", borderRightColor: "#C9A84C33" }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Shield className="w-7 h-7" style={{ color: "#C9A84C" }} />
            </div>
          </div>
          <p className="text-sm font-medium" style={{ color: "#6b7a99" }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

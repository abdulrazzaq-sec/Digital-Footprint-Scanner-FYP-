import { Link } from "react-router-dom";
import { LucideIcon, ArrowRight, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface ScanCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
  status?: "not_scanned" | "scanned" | "issues_found" | "warning";
  lastScanned?: string;
  quickStats?: string;
  riskScore?: number;
}

const ScanCard = ({
  title,
  description,
  icon: Icon,
  path,
  status = "not_scanned",
  lastScanned,
  quickStats,
  riskScore,
}: ScanCardProps) => {
  const getStatusBadge = () => {
    switch (status) {
      case "scanned":
        return (
          <span className="badge-success flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Secure
          </span>
        );
      case "issues_found":
        return (
          <span className="badge-danger flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Issues Found
          </span>
        );
      case "warning":
        return (
          <span className="badge-warning flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Warning
          </span>
        );
      default:
        return (
          <span className="badge-info flex items-center gap-1">
            Not Scanned
          </span>
        );
    }
  };

  const getRiskColor = () => {
    if (!riskScore) return "text-muted-foreground";
    if (riskScore < 30) return "text-success";
    if (riskScore < 60) return "text-warning";
    return "text-destructive";
  };

  return (
    <Link to={path} className="scan-card group">
      <div className="flex items-start justify-between">
        <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        {getStatusBadge()}
      </div>

      <div className="flex-1">
        <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/30">
        <div className="flex flex-col">
          {quickStats && (
            <span className={`text-sm font-medium ${getRiskColor()}`}>{quickStats}</span>
          )}
          {lastScanned && (
            <span className="text-xs text-muted-foreground">
              Last: {new Date(lastScanned).toLocaleDateString()}
            </span>
          )}
          {!lastScanned && !quickStats && (
            <span className="text-xs text-muted-foreground">Ready to scan</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          {status === "not_scanned" ? "Scan Now" : "View Results"}
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
};

export default ScanCard;

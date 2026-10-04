import { Calendar, Database, AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useState } from "react";

interface BreachCardProps {
  name: string;
  date: string | null;
  domain: string | null;
  records: number | null;
  dataTypes: string[];
  severity: "low" | "medium" | "high" | "critical";
  description: string;
}

const BreachCard = ({
  name,
  date,
  domain,
  records,
  dataTypes,
  severity,
  description,
}: BreachCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getSeverityBadge = () => {
    switch (severity) {
      case "critical":
        return <span className="badge-danger">Critical</span>;
      case "high":
        return <span className="badge-danger">High</span>;
      case "medium":
        return <span className="badge-warning">Medium</span>;
      default:
        return <span className="badge-success">Low</span>;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + "B";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(0) + "K";
    return num.toString();
  };

  const formatDate = (d: string | null) => {
    if (!d) return "Date unknown";
    if (/^\d{4}$/.test(d)) return d;
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return d;
    return parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  return (
    <div className="glass-card p-4 hover:border-destructive/30 transition-all duration-300">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">{name}</h4>
              <p className="text-sm text-muted-foreground">{domain}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(date)}
            </div>
            <div className="flex items-center gap-1">
              <Database className="w-4 h-4" />
              {records && records > 0 ? formatNumber(records) + " records" : "Records not disclosed"}
            </div>
            {getSeverityBadge()}
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {dataTypes.map((type) => (
              <span
                key={type}
                className="px-2 py-1 text-xs rounded-md bg-muted/50 text-muted-foreground border border-border/30"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-4 h-4" />
            Hide Details
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            More Info
          </>
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border/30 animate-fade-in">
          <p className="text-sm text-muted-foreground mb-3">{description}</p>
          {domain && (
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-secondary hover:text-secondary/80 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Visit {domain}
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default BreachCard;

import { useMemo } from "react";

interface RiskGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  label?: string;
}

const RiskGauge = ({ score, size = "md", showLabel = true, label }: RiskGaugeProps) => {
  const dimensions = {
    sm: { width: 100, height: 100, strokeWidth: 8 },
    md: { width: 160, height: 160, strokeWidth: 10 },
    lg: { width: 220, height: 220, strokeWidth: 12 },
  };

  const { width, height, strokeWidth } = dimensions[size];
  const radius = (width - strokeWidth) / 2;
  const circumference = radius * Math.PI;
  const progress = (score / 100) * circumference;

  const { color, riskLevel, bgClass } = useMemo(() => {
    if (score < 30) return { color: "hsl(153, 100%, 50%)", riskLevel: "Low Risk", bgClass: "text-success" };
    if (score < 60) return { color: "hsl(32, 100%, 50%)", riskLevel: "Medium Risk", bgClass: "text-warning" };
    if (score < 80) return { color: "hsl(0, 72%, 51%)", riskLevel: "High Risk", bgClass: "text-destructive" };
    return { color: "hsl(0, 72%, 51%)", riskLevel: "Critical", bgClass: "text-destructive" };
  }, [score]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width, height }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="transform -rotate-90"
        >
          {/* Background arc */}
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={0}
            className="opacity-30"
          />
          {/* Progress arc */}
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className="transition-all duration-1000 ease-out"
            style={{
              filter: `drop-shadow(0 0 8px ${color})`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-bold ${bgClass} ${
              size === "lg" ? "text-4xl" : size === "md" ? "text-3xl" : "text-2xl"
            }`}
          >
            {score}
          </span>
          {showLabel && (
            <span className="text-xs text-muted-foreground mt-1">
              {label || riskLevel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default RiskGauge;

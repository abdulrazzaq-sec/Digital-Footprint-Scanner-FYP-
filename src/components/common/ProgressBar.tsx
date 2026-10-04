interface ProgressBarProps {
  value: number;
  max?: number;
  color?: "primary" | "success" | "warning" | "destructive" | "secondary" | "auto";
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  label?: string;
  animated?: boolean;
}

const ProgressBar = ({
  value,
  max = 100,
  color = "auto",
  size = "md",
  showValue = true,
  label,
  animated = true,
}: ProgressBarProps) => {
  const percentage = Math.min((value / max) * 100, 100);

  const getColor = () => {
    if (color !== "auto") return color;
    if (percentage < 30) return "success";
    if (percentage < 60) return "warning";
    return "destructive";
  };

  const colorClasses = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    secondary: "bg-secondary",
  };

  const glowClasses = {
    primary: "shadow-[0_0_10px_hsl(var(--primary)/0.5)]",
    success: "shadow-[0_0_10px_hsl(var(--success)/0.5)]",
    warning: "shadow-[0_0_10px_hsl(var(--warning)/0.5)]",
    destructive: "shadow-[0_0_10px_hsl(var(--destructive)/0.5)]",
    secondary: "shadow-[0_0_10px_hsl(var(--secondary)/0.5)]",
  };

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  const currentColor = getColor();

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-sm text-muted-foreground">{label}</span>}
          {showValue && (
            <span className="text-sm font-medium text-foreground">{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      <div className={`progress-bar ${sizeClasses[size]}`}>
        <div
          className={`progress-bar-fill ${colorClasses[currentColor]} ${glowClasses[currentColor]} ${
            animated ? "transition-all duration-1000 ease-out" : ""
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;

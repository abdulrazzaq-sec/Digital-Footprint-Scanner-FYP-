import { useEffect, useState, useRef } from "react";
import { LucideIcon } from "lucide-react";

interface StatCounterProps {
  value: number;
  label: string;
  suffix?: string;
  prefix?: string;
  icon?: LucideIcon;
  duration?: number;
}

const StatCounter = ({
  value,
  label,
  suffix = "",
  prefix = "",
  icon: Icon,
  duration = 2000,
}: StatCounterProps) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isVisible, value, duration]);

  const formatNumber = (num: number) => {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1) + "B";
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  return (
    <div ref={ref} className="stat-card animate-fade-in">
      {Icon && (
        <div className="mx-auto mb-3 p-3 rounded-xl bg-primary/10 w-fit">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      )}
      <div className="text-3xl md:text-4xl font-bold text-primary text-glow mb-2">
        {prefix}
        {formatNumber(count)}
        {suffix}
      </div>
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
};

export default StatCounter;

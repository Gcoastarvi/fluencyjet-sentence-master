import { cn } from "@/lib/utils";

interface XPCircleProps {
  xp: number;
  maxXp?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export default function XPCircle({
  xp,
  maxXp = 1000,
  size = "md",
  showLabel = true,
  className,
}: XPCircleProps) {
  const percentage = Math.min((xp / maxXp) * 100, 100);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <div className={cn("relative", sizeClasses[size], className)} data-testid="xp-circle">
      <svg className="w-full h-full -rotate-90">
        <circle
          cx="50%"
          cy="50%"
          r="45%"
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="8"
        />
        <circle
          cx="50%"
          cy="50%"
          r="45%"
          fill="none"
          stroke="hsl(var(--chart-3))"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-serif font-bold text-foreground", textSizes[size])}>
          {xp}
        </span>
        {showLabel && <span className="text-xs text-muted-foreground">XP</span>}
      </div>
    </div>
  );
}

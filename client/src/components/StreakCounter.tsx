import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakCounterProps {
  days: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function StreakCounter({
  days,
  size = "md",
  className,
}: StreakCounterProps) {
  const sizeClasses = {
    sm: { container: "gap-1", icon: "w-5 h-5", text: "text-lg" },
    md: { container: "gap-2", icon: "w-7 h-7", text: "text-2xl" },
    lg: { container: "gap-3", icon: "w-9 h-9", text: "text-3xl" },
  };

  return (
    <div
      className={cn(
        "flex items-center",
        sizeClasses[size].container,
        className
      )}
      data-testid="streak-counter"
    >
      <Flame
        className={cn(
          sizeClasses[size].icon,
          "text-chart-3 fill-chart-3 animate-pulse"
        )}
      />
      <span className={cn("font-serif font-bold", sizeClasses[size].text)}>
        {days}
      </span>
      <span className="text-sm text-muted-foreground">
        {days === 1 ? "day" : "days"}
      </span>
    </div>
  );
}

import { Card } from "@/components/ui/card";
import { Trophy, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface BadgeDisplayProps {
  name: string;
  description: string;
  isUnlocked: boolean;
  icon?: React.ReactNode;
  earnedAt?: string;
  onClick?: () => void;
  className?: string;
}

export default function BadgeDisplay({
  name,
  description,
  isUnlocked,
  icon,
  earnedAt,
  onClick,
  className,
}: BadgeDisplayProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover-elevate active-elevate-2 p-6",
        !isUnlocked && "grayscale opacity-40",
        className
      )}
      onClick={onClick}
      data-testid={`badge-${name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center",
            isUnlocked
              ? "bg-gradient-to-br from-primary to-chart-2 text-white shadow-lg"
              : "bg-muted text-muted-foreground"
          )}
        >
          {icon || <Trophy className="w-8 h-8" />}
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-lg flex items-center justify-center gap-2">
            {name}
            {!isUnlocked && <Lock className="w-4 h-4" />}
          </h3>
          <p className="text-sm text-muted-foreground">{description}</p>
          {isUnlocked && earnedAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Earned on {earnedAt}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Lock, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface LessonCardProps {
  title: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  completionPercentage: number;
  isLocked?: boolean;
  isPremium?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function LessonCard({
  title,
  difficulty,
  completionPercentage,
  isLocked = false,
  isPremium = false,
  onClick,
  className,
}: LessonCardProps) {
  const difficultyColors = {
    beginner: "bg-chart-1 text-white",
    intermediate: "bg-chart-2 text-white",
    advanced: "bg-chart-4 text-white",
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover-elevate active-elevate-2",
        isLocked && "opacity-60",
        className
      )}
      onClick={!isLocked ? onClick : undefined}
      data-testid={`lesson-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
        {isLocked && <Lock className="w-4 h-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Badge className={difficultyColors[difficulty]}>
            {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
          </Badge>
          {isPremium && !isLocked && (
            <Badge variant="outline" className="text-chart-3 border-chart-3">
              Premium
            </Badge>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{completionPercentage}%</span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

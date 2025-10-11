import { Card } from "@/components/ui/card";
import XPCircle from "./XPCircle";
import StreakCounter from "./StreakCounter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface DashboardHeaderProps {
  username: string;
  xp: number;
  streak: number;
  maxXp?: number;
}

export default function DashboardHeader({
  username,
  xp,
  streak,
  maxXp = 1000,
}: DashboardHeaderProps) {
  const initials = username
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card className="p-6" data-testid="dashboard-header">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <Avatar className="w-20 h-20">
          <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {username}!
          </h1>
          <p className="text-muted-foreground">
            Keep up the great work with your English learning journey
          </p>
        </div>

        <div className="flex items-center gap-8">
          <XPCircle xp={xp} maxXp={maxXp} size="lg" />
          <div className="h-20 w-px bg-border" />
          <StreakCounter days={streak} size="lg" />
        </div>
      </div>
    </Card>
  );
}

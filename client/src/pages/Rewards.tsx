import BadgeDisplay from "@/components/BadgeDisplay";
import { Trophy, Star, Flame, Award, Target, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function Rewards() {
  const badges = [
    {
      name: "First Steps",
      description: "Complete your first lesson",
      isUnlocked: true,
      icon: <Star className="w-8 h-8" />,
      earnedAt: "Oct 5, 2025",
    },
    {
      name: "Quick Learner",
      description: "Complete 5 lessons",
      isUnlocked: true,
      icon: <Award className="w-8 h-8" />,
      earnedAt: "Oct 8, 2025",
    },
    {
      name: "Week Warrior",
      description: "Maintain a 7-day streak",
      isUnlocked: true,
      icon: <Flame className="w-8 h-8" />,
      earnedAt: "Oct 11, 2025",
    },
    {
      name: "Dedicated Student",
      description: "Complete 20 lessons",
      isUnlocked: false,
      icon: <Target className="w-8 h-8" />,
    },
    {
      name: "Master Learner",
      description: "Complete 50 lessons",
      isUnlocked: false,
      icon: <Trophy className="w-8 h-8" />,
    },
    {
      name: "Elite Scholar",
      description: "Maintain a 30-day streak",
      isUnlocked: false,
      icon: <Crown className="w-8 h-8" />,
    },
  ];

  const nextBadge = {
    name: "Dedicated Student",
    progress: 23,
    target: 20,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">Rewards & Badges</h1>
          <p className="text-muted-foreground">
            Track your achievements and unlock new badges
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Next Badge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Target className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">{nextBadge.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Complete 20 lessons
                  </p>
                </div>
              </div>
              <span className="text-2xl font-bold font-serif">
                {nextBadge.progress}/{nextBadge.target}
              </span>
            </div>
            <Progress value={(nextBadge.progress / nextBadge.target) * 100} className="h-2" />
          </CardContent>
        </Card>

        <div>
          <h2 className="text-2xl font-bold mb-6">All Badges</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {badges.map((badge) => (
              <BadgeDisplay
                key={badge.name}
                name={badge.name}
                description={badge.description}
                isUnlocked={badge.isUnlocked}
                icon={badge.icon}
                earnedAt={badge.earnedAt}
                onClick={() => console.log(`${badge.name} clicked`)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

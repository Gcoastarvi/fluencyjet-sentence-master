import DashboardHeader from "@/components/DashboardHeader";
import StatCard from "@/components/StatCard";
import LessonCard from "@/components/LessonCard";
import { Award, Calendar, Target, TrendingUp, ArrowRight, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  const recentLessons = [
    { title: "Basic Greetings", difficulty: "beginner" as const, completion: 100 },
    { title: "Daily Conversations", difficulty: "intermediate" as const, completion: 65 },
    { title: "Common Phrases", difficulty: "beginner" as const, completion: 80 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <DashboardHeader username="Arun Kumar" xp={750} streak={15} maxXp={1000} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total XP" value="1,250" icon={Award} iconColor="text-chart-3" />
          <StatCard title="Current Streak" value="15" icon={Calendar} iconColor="text-chart-1" />
          <StatCard title="Lessons Completed" value="23" icon={Target} iconColor="text-primary" />
          <StatCard title="Accuracy" value="87%" icon={TrendingUp} iconColor="text-chart-2" />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Button data-testid="button-daily-challenge" className="hover-elevate active-elevate-2">
              <Trophy className="w-4 h-4 mr-2" />
              Daily Challenge
            </Button>
            <Button variant="outline" data-testid="button-continue-learning" className="hover-elevate active-elevate-2">
              Continue Learning
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Recent Lessons</h2>
            <Button variant="ghost" data-testid="button-view-all">
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentLessons.map((lesson) => (
              <LessonCard
                key={lesson.title}
                title={lesson.title}
                difficulty={lesson.difficulty}
                completionPercentage={lesson.completion}
                onClick={() => console.log(`${lesson.title} clicked`)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

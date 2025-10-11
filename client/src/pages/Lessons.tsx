import { useState } from "react";
import LessonCard from "@/components/LessonCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const allLessons = [
  { title: "Basic Greetings", difficulty: "beginner" as const, completion: 100, locked: false, premium: false },
  { title: "Introducing Yourself", difficulty: "beginner" as const, completion: 90, locked: false, premium: false },
  { title: "Common Phrases", difficulty: "beginner" as const, completion: 80, locked: false, premium: false },
  { title: "Daily Conversations", difficulty: "intermediate" as const, completion: 65, locked: false, premium: false },
  { title: "Shopping & Markets", difficulty: "intermediate" as const, completion: 40, locked: false, premium: false },
  { title: "Travel & Directions", difficulty: "intermediate" as const, completion: 20, locked: false, premium: false },
  { title: "Business English", difficulty: "advanced" as const, completion: 0, locked: true, premium: true },
  { title: "Professional Writing", difficulty: "advanced" as const, completion: 0, locked: true, premium: true },
  { title: "Academic English", difficulty: "advanced" as const, completion: 0, locked: true, premium: true },
];

type Difficulty = "all" | "beginner" | "intermediate" | "advanced";

export default function Lessons() {
  const [filter, setFilter] = useState<Difficulty>("all");

  const filteredLessons = filter === "all" 
    ? allLessons 
    : allLessons.filter(lesson => lesson.difficulty === filter);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">Practice Lessons</h1>
          <p className="text-muted-foreground">
            Master English sentence construction with interactive lessons
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            data-testid="filter-all"
            className="hover-elevate active-elevate-2"
          >
            All Lessons
          </Button>
          <Button
            variant={filter === "beginner" ? "default" : "outline"}
            onClick={() => setFilter("beginner")}
            data-testid="filter-beginner"
            className="hover-elevate active-elevate-2"
          >
            Beginner
          </Button>
          <Button
            variant={filter === "intermediate" ? "default" : "outline"}
            onClick={() => setFilter("intermediate")}
            data-testid="filter-intermediate"
            className="hover-elevate active-elevate-2"
          >
            Intermediate
          </Button>
          <Button
            variant={filter === "advanced" ? "default" : "outline"}
            onClick={() => setFilter("advanced")}
            data-testid="filter-advanced"
            className="hover-elevate active-elevate-2"
          >
            Advanced
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLessons.map((lesson) => (
            <LessonCard
              key={lesson.title}
              title={lesson.title}
              difficulty={lesson.difficulty}
              completionPercentage={lesson.completion}
              isLocked={lesson.locked}
              isPremium={lesson.premium}
              onClick={() => console.log(`${lesson.title} clicked`)}
            />
          ))}
        </div>

        {filteredLessons.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No lessons found for this filter</p>
          </div>
        )}
      </div>
    </div>
  );
}

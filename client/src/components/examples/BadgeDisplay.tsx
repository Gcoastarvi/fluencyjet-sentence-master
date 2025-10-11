import BadgeDisplay from "../BadgeDisplay";
import { Trophy, Star, Flame } from "lucide-react";

export default function BadgeDisplayExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      <BadgeDisplay
        name="First Steps"
        description="Complete your first lesson"
        isUnlocked={true}
        icon={<Star className="w-8 h-8" />}
        earnedAt="Oct 10, 2025"
        onClick={() => console.log("First Steps clicked")}
      />
      <BadgeDisplay
        name="Week Warrior"
        description="Maintain a 7-day streak"
        isUnlocked={true}
        icon={<Flame className="w-8 h-8" />}
        earnedAt="Oct 11, 2025"
        onClick={() => console.log("Week Warrior clicked")}
      />
      <BadgeDisplay
        name="Master Learner"
        description="Complete 50 lessons"
        isUnlocked={false}
        icon={<Trophy className="w-8 h-8" />}
        onClick={() => console.log("Master Learner clicked")}
      />
    </div>
  );
}

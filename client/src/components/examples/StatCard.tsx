import StatCard from "../StatCard";
import { Award, Calendar, Target, TrendingUp } from "lucide-react";

export default function StatCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
      <StatCard title="Total XP" value="1,250" icon={Award} iconColor="text-chart-3" />
      <StatCard title="Current Streak" value="15" icon={Calendar} iconColor="text-chart-1" />
      <StatCard title="Lessons Completed" value="23" icon={Target} iconColor="text-primary" />
      <StatCard title="Accuracy" value="87%" icon={TrendingUp} iconColor="text-chart-2" />
    </div>
  );
}

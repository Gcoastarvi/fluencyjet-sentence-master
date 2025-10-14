import { useEffect, useState } from "react";
import LessonCard from "@/components/LessonCard";
import LockBadge from "@/components/LockBadge";

export default function Dashboard() {
  const [lessons, setLessons] = useState([]);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    fetch("/api/lessons")
      .then((r) => r.json())
      .then((data) => setLessons(data));
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h2 className="text-2xl font-semibold text-center text-indigo-700">
        Your Dashboard
      </h2>
      <p className="text-center text-gray-500">
        Earn XP by completing lessons daily!
      </p>
      <LockBadge hasAccess={hasAccess} />

      <div className="grid gap-4">
        {lessons.map((l, i) => (
          <LessonCard
            key={i}
            lesson={l}
            locked={!hasAccess && i > 2}
            onSelect={() => alert("Lesson Opened!")}
          />
        ))}
      </div>
    </div>
  );
}

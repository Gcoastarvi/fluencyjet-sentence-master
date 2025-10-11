import LessonCard from "../LessonCard";

export default function LessonCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      <LessonCard
        title="Basic Greetings"
        difficulty="beginner"
        completionPercentage={100}
        onClick={() => console.log("Basic Greetings clicked")}
      />
      <LessonCard
        title="Daily Conversations"
        difficulty="intermediate"
        completionPercentage={45}
        onClick={() => console.log("Daily Conversations clicked")}
      />
      <LessonCard
        title="Business English"
        difficulty="advanced"
        completionPercentage={0}
        isPremium
        isLocked
      />
    </div>
  );
}

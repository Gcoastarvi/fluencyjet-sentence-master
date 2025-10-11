import StreakCounter from "../StreakCounter";

export default function StreakCounterExample() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <StreakCounter days={5} size="sm" />
      <StreakCounter days={15} size="md" />
      <StreakCounter days={30} size="lg" />
    </div>
  );
}

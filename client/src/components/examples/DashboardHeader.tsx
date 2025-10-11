import DashboardHeader from "../DashboardHeader";

export default function DashboardHeaderExample() {
  return (
    <div className="p-6">
      <DashboardHeader username="Arun Kumar" xp={750} streak={15} maxXp={1000} />
    </div>
  );
}

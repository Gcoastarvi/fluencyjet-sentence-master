import XPCircle from "../XPCircle";

export default function XPCircleExample() {
  return (
    <div className="flex flex-wrap gap-8 p-6 items-center">
      <XPCircle xp={250} maxXp={500} size="sm" />
      <XPCircle xp={750} maxXp={1000} size="md" />
      <XPCircle xp={1200} maxXp={2000} size="lg" />
    </div>
  );
}

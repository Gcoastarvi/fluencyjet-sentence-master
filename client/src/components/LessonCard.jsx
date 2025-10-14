export default function LessonCard({ lesson, locked, onSelect }) {
  return (
    <div
      onClick={() => !locked && onSelect(lesson)}
      className={`p-4 rounded-2xl shadow cursor-pointer ${
        locked ? "bg-gray-100 text-gray-400" : "bg-white hover:shadow-md"
      }`}
    >
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{lesson.title}</h3>
        {locked && (
          <span className="text-xs bg-gray-300 px-2 py-1 rounded">Locked</span>
        )}
      </div>
      <p className="text-sm mt-1">{lesson.description}</p>
    </div>
  );
}

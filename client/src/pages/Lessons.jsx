// client/src/pages/Lessons.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "@/hooks/useApi";

export default function Lessons() {
  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState([]);
  const [error, setError] = useState("");

  async function loadLessons() {
    try {
      setLoading(true);

      const data = await apiRequest("/api/lessons");
      if (!data?.ok) throw new Error(data.message);

      setLessons(data.lessons);
    } catch (err) {
      setError("Failed to load lessons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLessons();
  }, []);

  if (loading)
    return (
      <div className="text-center text-xl text-indigo-600 mt-20">
        Loading lessons…
      </div>
    );

  if (error)
    return (
      <div className="text-center text-xl text-red-600 mt-20">{error}</div>
    );

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6 mt-6">
      <h1 className="text-3xl font-bold text-indigo-700 text-center">
        Lessons
      </h1>

      <div className="space-y-4">
        {lessons.map((l) => (
          <div
            key={l.id}
            className="p-4 bg-white shadow rounded-xl flex items-center justify-between"
          >
            <div>
              <p className="text-lg font-semibold">{l.title}</p>
              <p className="text-sm text-gray-500">{l.description}</p>
            </div>

            {l.is_locked ? (
              <button className="px-4 py-2 bg-gray-300 text-gray-600 rounded-full cursor-not-allowed">
                🔒 Locked
              </button>
            ) : (
              <Link
                to={`/lessons/${l.id}`}
                className="px-4 py-2 bg-indigo-600 text-white rounded-full hover:scale-105 transition"
              >
                Start →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  getLessons,
  createLesson,
  updateLesson,
  deleteLesson,
} from "../api/adminApi";
import { useNavigate } from "react-router-dom";

export default function AdminLessons() {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);

  const [formData, setFormData] = useState({
    slug: "",
    title: "",
    description: "",
    difficulty: "beginner",
    isLocked: false,
  });

  const navigate = useNavigate();

  const loadLessons = async () => {
    try {
      const res = await getLessons();
      if (res.data.ok) {
        setLessons(res.data.lessons);
      }
    } catch (err) {
      console.error("Failed loading lessons:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLessons();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingLesson) {
        await updateLesson(editingLesson.id, formData);
      } else {
        await createLesson(formData);
      }

      setShowForm(false);
      setEditingLesson(null);
      setFormData({
        slug: "",
        title: "",
        description: "",
        difficulty: "beginner",
        isLocked: false,
      });

      loadLessons();
    } catch (err) {
      console.error("Lesson save failed:", err);
    }
  };

  const handleEdit = (lesson) => {
    setEditingLesson(lesson);
    setFormData({
      slug: lesson.slug,
      title: lesson.title,
      description: lesson.description || "",
      difficulty: lesson.difficulty,
      isLocked: lesson.isLocked,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this lesson?")) return;

    try {
      await deleteLesson(id);
      loadLessons();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  if (loading) return <p className="p-4">Loading lessons...</p>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Admin Lessons</h1>
        <button
          onClick={() => {
            setEditingLesson(null);
            setShowForm(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Create Lesson
        </button>
      </div>

      {/* FORM PANEL */}
      {showForm && (
        <div className="bg-white shadow p-4 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingLesson ? "Edit Lesson" : "Create New Lesson"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Slug"
              className="border p-2 w-full"
              value={formData.slug}
              onChange={(e) =>
                setFormData({ ...formData, slug: e.target.value })
              }
              required
            />

            <input
              type="text"
              placeholder="Title"
              className="border p-2 w-full"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
            />

            <textarea
              placeholder="Description"
              className="border p-2 w-full"
              rows="3"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />

            <select
              className="border p-2 w-full"
              value={formData.difficulty}
              onChange={(e) =>
                setFormData({ ...formData, difficulty: e.target.value })
              }
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isLocked}
                onChange={(e) =>
                  setFormData({ ...formData, isLocked: e.target.checked })
                }
              />
              Is Locked?
            </label>

            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Save Lesson
            </button>

            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="ml-4 px-4 py-2 text-gray-600"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* LESSON TABLE */}
      <div className="bg-white shadow p-4 rounded-lg">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2 border">ID</th>
              <th className="p-2 border">Slug</th>
              <th className="p-2 border">Title</th>
              <th className="p-2 border">Difficulty</th>
              <th className="p-2 border">Locked?</th>
              <th className="p-2 border">Quizzes</th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>

          <tbody>
            {lessons.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-2 border">{l.id}</td>
                <td className="p-2 border">{l.slug}</td>
                <td className="p-2 border">{l.title}</td>
                <td className="p-2 border">{l.difficulty}</td>
                <td className="p-2 border">{l.isLocked ? "Yes" : "No"}</td>
                <td className="p-2 border">{l._count?.quizzes || 0}</td>

                <td className="p-2 border">
                  <button
                    onClick={() => handleEdit(l)}
                    className="text-blue-600 mr-3"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleDelete(l.id)}
                    className="text-red-600"
                  >
                    Delete
                  </button>

                  <button
                    onClick={() => navigate(`/admin/quizzes/${l.id}`)}
                    className="ml-3 text-purple-600"
                  >
                    Manage Quizzes →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

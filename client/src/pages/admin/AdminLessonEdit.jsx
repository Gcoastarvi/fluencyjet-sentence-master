import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/api/apiClient";

export default function AdminLessonEdit() {
  const { lessonId } = useParams();
  const idNum = Number(lessonId);
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");

        if (!Number.isFinite(idNum)) throw new Error("Invalid lesson id");

        const res = await api.get(`/admin/lessons/${idNum}`);
        const data = res?.data ?? res;

        if (!data?.ok) throw new Error(data?.error || "Failed to load lesson");

        setTitle(data.lesson?.title || "");
        setDescription(data.lesson?.description || "");
      } catch (e) {
        setError(e?.message || "Failed to load lesson");
      } finally {
        setLoading(false);
      }
    })();
  }, [idNum]);

  const updateLesson = async (e) => {
    e.preventDefault();

    try {
      const res = await api.put(`/admin/lessons/${idNum}`, { title, description });

      if (res.data.ok) {
        alert("Lesson updated successfully!");
        navigate("/admin/lessons");
      }
    } catch (err) {
      console.error("Lesson update failed:", err);
    }
  };

  if (loading) return <div className="p-6">Loading lesson…</div>;

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-purple-700">Edit Lesson</h1>

      <form onSubmit={updateLesson} className="space-y-4">
        <input
          type="text"
          className="w-full border p-2 rounded"
          value={title}
          placeholder="Lesson Title"
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="w-full border p-2 rounded"
          rows="4"
          value={description}
          placeholder="Lesson Description"
          onChange={(e) => setDescription(e.target.value)}
        />

        <button
          type="submit"
          className="bg-purple-600 text-white px-6 py-2 rounded"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}

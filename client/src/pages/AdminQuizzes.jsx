import { useEffect, useState } from "react";
import { api } from "../api";
import { useNavigate, useParams } from "react-router-dom";

export default function AdminQuizzes() {
  const { lessonId } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [newQ, setNewQ] = useState({ ta: "", en: "" });
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      const res = await api.get(`/admin/quizzes/${lessonId}`);
      if (res.data.ok) {
        setLesson(res.data.lesson);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load quiz questions");
    }
  }

  async function addQuestion() {
    if (!newQ.ta || !newQ.en) return alert("Both fields required");

    try {
      setLoading(true);
      await api.post(`/admin/quizzes/${lessonId}/add`, newQ);
      setNewQ({ ta: "", en: "" });
      load();
    } catch (err) {
      alert("Failed to add question");
    } finally {
      setLoading(false);
    }
  }

  async function deleteQuestion(id) {
    if (!confirm("Delete this question?")) return;

    try {
      await api.delete(`/admin/quizzes/${id}/delete`);
      load();
    } catch (err) {
      alert("Failed to delete question");
    }
  }

  useEffect(() => {
    load();
  }, [lessonId]);

  if (!lesson) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center">Loading lesson…</div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold text-indigo-700">
        Manage Quiz — {lesson.title}
      </h2>

      {/* ADD FORM */}
      <div className="p-4 bg-white shadow rounded space-y-3">
        <h3 className="font-semibold text-lg">Add New Question</h3>

        <input
          className="border p-2 w-full rounded"
          placeholder="Tamil sentence"
          value={newQ.ta}
          onChange={(e) => setNewQ({ ...newQ, ta: e.target.value })}
        />

        <input
          className="border p-2 w-full rounded"
          placeholder="English translation"
          value={newQ.en}
          onChange={(e) => setNewQ({ ...newQ, en: e.target.value })}
        />

        <button
          onClick={addQuestion}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:scale-105 transition"
          disabled={loading}
        >
          {loading ? "Adding…" : "Add Question"}
        </button>
      </div>

      {/* LIST */}
      <div className="bg-white shadow rounded p-4">
        <h3 className="font-semibold mb-3 text-lg">Existing Questions</h3>

        {lesson.questions.length === 0 && (
          <p className="text-gray-500">No questions added yet.</p>
        )}

        <ul className="space-y-3">
          {lesson.questions.map((q) => (
            <li
              key={q.id}
              className="border rounded p-3 flex justify-between items-center"
            >
              <div>
                <p className="text-sm">
                  <b>TA:</b> {q.ta}
                </p>
                <p className="text-sm">
                  <b>EN:</b> {q.en}
                </p>
              </div>

              <button
                onClick={() => deleteQuestion(q.id)}
                className="text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => navigate("/admin/lessons")}
        className="text-indigo-600 underline"
      >
        ← Back to Lessons
      </button>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import api from "../api";

export default function AdminLessons() {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [form, setForm] = useState({
    id: null,
    title: "",
    description: "",
    content: "",
    difficulty: "easy",
    order: 1,
    is_locked: false,
  });

  const [isEditing, setIsEditing] = useState(false);

  // Load lessons
  async function loadLessons() {
    try {
      setLoading(true);
      const res = await api.get("/admin/lessons/all");
      if (res.data.ok) setLessons(res.data.lessons);
    } catch (err) {
      console.error("Load lessons error:", err);
      alert("Failed to load lessons");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadLessons();
  }, []);

  // Reset form
  function resetForm() {
    setForm({
      id: null,
      title: "",
      description: "",
      content: "",
      difficulty: "easy",
      order: 1,
      is_locked: false,
    });
    setIsEditing(false);
  }

  // Submit form
  async function handleSubmit(e) {
    e.preventDefault();

    try {
      if (isEditing) {
        // UPDATE
        const res = await api.put(`/admin/lessons/${form.id}`, form);
        if (res.data.ok) {
          alert("Lesson updated");
          resetForm();
          loadLessons();
        }
      } else {
        // CREATE
        const res = await api.post("/admin/lessons", form);
        if (res.data.ok) {
          alert("Lesson created");
          resetForm();
          loadLessons();
        }
      }
    } catch (err) {
      console.error("Save lesson error:", err);
      alert("Failed to save lesson");
    }
  }

  // Edit a lesson
  function startEdit(lesson) {
    setIsEditing(true);
    setForm({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      content: lesson.content,
      difficulty: lesson.difficulty,
      order: lesson.order,
      is_locked: lesson.is_locked,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Delete
  async function deleteLesson(id) {
    if (!window.confirm("Delete this lesson?")) return;

    try {
      const res = await api.delete(`/admin/lessons/${id}`);
      if (res.data.ok) {
        alert("Deleted successfully");
        loadLessons();
      }
    } catch (err) {
      console.error("Delete lesson error:", err);
      alert("Delete failed");
    }
  }

  // Reorder
  async function updateOrder() {
    const orderedIds = lessons.map((l) => l.id);
    try {
      const res = await api.patch("/admin/lessons/reorder", { orderedIds });
      if (res.data.ok) alert("Reordered successfully");
    } catch (err) {
      console.error("Reorder error:", err);
      alert("Reorder failed");
    }
  }

  // Move lesson
  function moveLesson(index, direction) {
    const newList = [...lessons];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newList.length) return;

    const temp = newList[index];
    newList[index] = newList[newIndex];
    newList[newIndex] = temp;

    // Re-assign order numbers
    newList.forEach((l, i) => (l.order = i + 1));
    setLessons(newList);
  }

  /* UI */
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4 text-purple-700">
        Admin Lesson Manager
      </h1>

      {/* FORM */}
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow p-4 rounded border mb-6"
      >
        <h2 className="text-xl font-bold mb-3">
          {isEditing ? "Edit Lesson" : "Create Lesson"}
        </h2>

        <input
          className="border p-2 w-full mb-2"
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />

        <textarea
          className="border p-2 w-full mb-2"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <textarea
          className="border p-2 w-full mb-2"
          placeholder="Content"
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
        />

        <select
          className="border p-2 w-full mb-2"
          value={form.difficulty}
          onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
        >
          <option>easy</option>
          <option>medium</option>
          <option>hard</option>
        </select>

        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={form.is_locked}
            onChange={(e) => setForm({ ...form, is_locked: e.target.checked })}
          />
          Locked?
        </label>

        <button
          className="bg-purple-600 text-white px-4 py-2 rounded"
          type="submit"
        >
          {isEditing ? "Update Lesson" : "Create Lesson"}
        </button>

        {isEditing && (
          <button
            type="button"
            className="ml-3 bg-gray-400 text-white px-4 py-2 rounded"
            onClick={resetForm}
          >
            Cancel Edit
          </button>
        )}
      </form>

      {/* LESSON LIST */}
      <h2 className="text-xl font-bold mb-3">Existing Lessons</h2>

      {loading ? (
        <p>Loading...</p>
      ) : lessons.length === 0 ? (
        <p>No lessons yet.</p>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson, index) => (
            <div
              key={lesson.id}
              className="border p-3 rounded shadow-sm bg-white"
            >
              <div className="flex justify-between mb-2">
                <strong>
                  {lesson.order}. {lesson.title}
                </strong>
                <div>
                  <button
                    className="mr-2 text-blue-600"
                    onClick={() => startEdit(lesson)}
                  >
                    Edit
                  </button>
                  <button
                    className="mr-2 text-red-600"
                    onClick={() => deleteLesson(lesson.id)}
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => moveLesson(index, -1)}
                    className="mr-1 px-2 py-1 bg-gray-200 rounded"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveLesson(index, +1)}
                    className="px-2 py-1 bg-gray-200 rounded"
                  >
                    ↓
                  </button>
                </div>
              </div>
              <p className="text-sm opacity-70">{lesson.description}</p>
            </div>
          ))}

          <button
            onClick={updateOrder}
            className="mt-4 bg-green-600 text-white px-4 py-2 rounded"
          >
            Save Reorder
          </button>
        </div>
      )}
    </div>
  );
}

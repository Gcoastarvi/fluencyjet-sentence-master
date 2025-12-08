// client/src/pages/admin/AdminLessonCreate.jsx
import React, { useState } from "react";
import { adminApi } from "../../api/apiClient";
import ProtectedAdminRoute from "../../components/ProtectedAdminRoute";

const AdminLessonCreateInner = () => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setIsSaving(true);
    try {
      await createLesson({ title, description });
      alert("Lesson created successfully!");
      setTitle("");
      setDescription("");
    } catch (err) {
      console.error("Failed to create lesson", err);
      setError(err.message || "Failed to create lesson");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Create New Lesson</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-100 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter lesson title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Description (optional)
          </label>
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description of the lesson"
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSaving ? "Creating..." : "Create Lesson"}
        </button>
      </form>
    </div>
  );
};

export default function AdminLessonCreate() {
  return (
    <ProtectedAdminRoute>
      <AdminLessonCreateInner />
    </ProtectedAdminRoute>
  );
}

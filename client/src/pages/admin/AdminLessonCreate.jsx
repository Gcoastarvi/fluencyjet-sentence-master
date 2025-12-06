import React, { useState } from "react";
import API from "../../api/apiClient";

const AdminLessonCreate = () => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const token = localStorage.getItem("adminToken");

  const handleCreateLesson = async (e) => {
    e.preventDefault();

    try {
      const res = await API.post(
        "/api/admin/lessons",
        { title, description },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      alert("Lesson created successfully!");
      setTitle("");
      setDescription("");
    } catch (err) {
      console.error("Error creating lesson:", err);
      alert("Failed to create lesson.");
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Create New Lesson</h2>

      <form onSubmit={handleCreateLesson} className="space-y-4">
        <input
          type="text"
          placeholder="Lesson Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 w-full rounded"
          required
        />

        <textarea
          placeholder="Lesson Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border p-2 w-full rounded"
          rows="4"
          required
        />

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Create Lesson
        </button>
      </form>
    </div>
  );
};

export default AdminLessonCreate;

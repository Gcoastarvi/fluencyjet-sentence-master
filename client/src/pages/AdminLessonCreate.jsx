import React, { useState } from "react";
import API from "../api/apiClient";

const AdminLessonCreate = () => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const token = localStorage.getItem("adminToken");

  const createLesson = async (e) => {
    e.preventDefault();

    try {
      const res = await API.post(
        "/api/admin/lessons",
        { title, description },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (res.data.ok) {
        alert("Lesson created!");
        window.location.href = "/admin/lessons";
      }
    } catch (err) {
      console.error("Lesson create failed:", err);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-purple-700">
        Add New Lesson
      </h1>

      <form onSubmit={createLesson} className="space-y-4">
        <input
          type="text"
          placeholder="Lesson Title"
          className="w-full border p-2 rounded"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          placeholder="Lesson Description"
          className="w-full border p-2 rounded"
          rows="4"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <button
          type="submit"
          className="bg-purple-600 text-white px-6 py-2 rounded"
        >
          Create
        </button>
      </form>
    </div>
  );
};

export default AdminLessonCreate;

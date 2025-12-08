import React, { useState, useEffect } from "react";
import {
  getLesson,
  updateLesson,
  deleteLesson,
} from "../../api/adminApi";
import { useParams, useNavigate } from "react-router-dom";

const AdminLessonEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("fj_admin_token");

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const res = await API.get(`/api/admin/lessons/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.ok) {
          setTitle(res.data.lesson.title);
          setDescription(res.data.lesson.description);
        }
      } catch (err) {
        console.error("Failed to load lesson:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLesson();
  }, [id]);

  const updateLesson = async (e) => {
    e.preventDefault();

    try {
      const res = await API.put(
        `/api/admin/lessons/${id}`,
        { title, description },
        { headers: { Authorization: `Bearer ${token}` } },
      );

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
};

export default AdminLessonEdit;

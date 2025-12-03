import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getQuizById, updateQuiz, deleteQuiz } from "../api/adminApi";
import ProtectedAdminRoute from "../components/ProtectedAdminRoute";

function AdminQuizEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [quiz, setQuiz] = useState({
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    answer: "",
    explanation: "",
  });

  useEffect(() => {
    async function loadQuiz() {
      try {
        const res = await getQuizById(id);
        if (res.ok) {
          setQuiz(res.quiz);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to load quiz");
      } finally {
        setLoading(false);
      }
    }

    loadQuiz();
  }, [id]);

  function handleChange(e) {
    setQuiz({ ...quiz, [e.target.name]: e.target.value });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await updateQuiz(id, quiz);
      if (res.ok) {
        alert("Quiz updated successfully!");
        navigate("/admin/quizzes");
      } else {
        alert(res.message || "Failed to update quiz");
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this quiz?")) return;

    try {
      const res = await deleteQuiz(id);
      if (res.ok) {
        alert("Quiz deleted!");
        navigate("/admin/quizzes");
      } else {
        alert("Error deleting quiz");
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    }
  }

  if (loading) return <p>Loading quiz…</p>;

  return (
    <ProtectedAdminRoute>
      <div className="admin-container">
        <h1>Edit Quiz</h1>

        <div className="form-block">
          <label>Question</label>
          <textarea
            name="question"
            value={quiz.question}
            onChange={handleChange}
          ></textarea>

          <label>Option A</label>
          <input
            type="text"
            name="optionA"
            value={quiz.optionA}
            onChange={handleChange}
          />

          <label>Option B</label>
          <input
            type="text"
            name="optionB"
            value={quiz.optionB}
            onChange={handleChange}
          />

          <label>Option C</label>
          <input
            type="text"
            name="optionC"
            value={quiz.optionC}
            onChange={handleChange}
          />

          <label>Option D</label>
          <input
            type="text"
            name="optionD"
            value={quiz.optionD}
            onChange={handleChange}
          />

          <label>Correct Answer (A/B/C/D)</label>
          <input
            type="text"
            name="answer"
            value={quiz.answer}
            onChange={handleChange}
          />

          <label>Explanation</label>
          <textarea
            name="explanation"
            value={quiz.explanation}
            onChange={handleChange}
          ></textarea>
        </div>

        <div className="admin-actions">
          <button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>

          <button
            onClick={handleDelete}
            style={{ background: "red", color: "white" }}
          >
            Delete Quiz
          </button>

          <button onClick={() => navigate("/admin/quizzes")}>
            Back to Quizzes
          </button>
        </div>
      </div>
    </ProtectedAdminRoute>
  );
}

export default AdminQuizEdit;

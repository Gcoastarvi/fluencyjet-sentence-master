import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getQuizById, updateQuiz, deleteQuiz } from "../api/adminApi";
import ProtectedAdminRoute from "../components/ProtectedAdminRoute";

export default function AdminQuizEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // LOCAL STATE FOR FORM
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("beginner");
  const [questions, setQuestions] = useState([]);

  // -------------------------------------
  // FETCH QUIZ DATA
  // -------------------------------------
  useEffect(() => {
    async function fetchQuiz() {
      try {
        const response = await getQuizById(id);
        if (response.ok) {
          const q = response.quiz;

          setQuiz(q);
          setTitle(q.title || "");
          setDescription(q.description || "");
          setDifficulty(q.difficulty || "beginner");
          setQuestions(q.questions || []);
        }
      } catch (err) {
        console.error("Error fetching quiz:", err);
      }
      setLoading(false);
    }
    fetchQuiz();
  }, [id]);

  // -------------------------------------
  // ADD NEW QUESTION
  // -------------------------------------
  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        text: "",
        options: ["", "", "", ""],
        correctIndex: 0,
      },
    ]);
  };

  // -------------------------------------
  // UPDATE QUESTION TEXT
  // -------------------------------------
  const updateQuestionText = (index, value) => {
    const updated = [...questions];
    updated[index].text = value;
    setQuestions(updated);
  };

  // -------------------------------------
  // UPDATE OPTION TEXT
  // -------------------------------------
  const updateOptionText = (qIndex, optIndex, value) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex] = value;
    setQuestions(updated);
  };

  // -------------------------------------
  // UPDATE CORRECT OPTION
  // -------------------------------------
  const updateCorrectOption = (qIndex, value) => {
    const updated = [...questions];
    updated[qIndex].correctIndex = Number(value);
    setQuestions(updated);
  };

  // -------------------------------------
  // DELETE QUESTION
  // -------------------------------------
  const removeQuestion = (index) => {
    const updated = [...questions];
    updated.splice(index, 1);
    setQuestions(updated);
  };

  // -------------------------------------
  // SAVE CHANGES
  // -------------------------------------
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title,
        description,
        difficulty,
        questions,
      };

      const res = await updateQuiz(id, payload);
      if (res.ok) {
        alert("Quiz updated successfully!");
        navigate("/admin/quizzes");
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Error saving quiz");
    }
    setSaving(false);
  };

  // -------------------------------------
  // DELETE QUIZ
  // -------------------------------------
  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      "Are you sure? This cannot be undone.",
    );
    if (!confirmDelete) return;

    try {
      await deleteQuiz(id);
      alert("Quiz deleted.");
      navigate("/admin/quizzes");
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-6">Loading quiz...</div>;

  return (
    <ProtectedAdminRoute>
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Edit Quiz</h1>

        {/* QUIZ GENERAL FIELDS */}
        <div className="space-y-4 mb-8">
          <div>
            <label className="font-semibold">Title</label>
            <input
              className="w-full p-2 border rounded"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Quiz title"
            />
          </div>

          <div>
            <label className="font-semibold">Description</label>
            <textarea
              className="w-full p-2 border rounded"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short quiz description"
            />
          </div>

          <div>
            <label className="font-semibold">Difficulty</label>
            <select
              className="p-2 border rounded"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        {/* QUESTIONS */}
        <h2 className="text-xl font-bold mb-2">Questions</h2>

        {questions.map((q, i) => (
          <div key={i} className="border p-4 mb-4 rounded bg-gray-50">
            <div className="flex justify-between">
              <p className="font-semibold">Question {i + 1}</p>
              <button
                className="text-red-600 text-sm"
                onClick={() => removeQuestion(i)}
              >
                Remove
              </button>
            </div>

            <input
              className="w-full p-2 border rounded mt-2"
              placeholder="Question text"
              value={q.text}
              onChange={(e) => updateQuestionText(i, e.target.value)}
            />

            {/* OPTIONS */}
            <div className="mt-3 space-y-2">
              {q.options.map((opt, j) => (
                <div key={j} className="flex items-center gap-3">
                  <input
                    className="flex-1 p-2 border rounded"
                    placeholder={`Option ${j + 1}`}
                    value={opt}
                    onChange={(e) => updateOptionText(i, j, e.target.value)}
                  />

                  <input
                    type="radio"
                    checked={q.correctIndex === j}
                    onChange={() => updateCorrectOption(i, j)}
                  />
                  <span className="text-sm">Correct</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ADD QUESTION BUTTON */}
        <button
          className="mt-2 mb-6 px-4 py-2 bg-blue-600 text-white rounded"
          onClick={addQuestion}
        >
          + Add Question
        </button>

        {/* SAVE + DELETE */}
        <div className="flex gap-4">
          <button
            className="px-4 py-2 bg-green-600 text-white rounded"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>

          <button
            className="px-4 py-2 bg-red-600 text-white rounded"
            onClick={handleDelete}
          >
            Delete Quiz
          </button>
        </div>
      </div>
    </ProtectedAdminRoute>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAllQuizzes, createQuiz, deleteQuiz } from "../api/adminApi";
import ProtectedAdminRoute from "../components/ProtectedAdminRoute";

export default function AdminQuizzes() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const lessonId = params.get("lessonId");

  const [lessonTitle, setLessonTitle] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newQuiz, setNewQuiz] = useState({
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "",
  });

  // -----------------------------
  // LOAD QUIZZES FOR THIS LESSON
  // -----------------------------
  async function load() {
    try {
      setLoading(true);
      const res = await getAllQuizzes(lessonId);

      if (res.data.ok) {
        setLessonTitle(res.data.lesson.title);
        setQuestions(res.data.lesson.quizzes);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load quizzes");
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------
  // ADD QUIZ
  // -----------------------------
  async function handleCreate() {
    if (!newQuiz.question || !newQuiz.correctAnswer) {
      return alert("Question & correct answer are required.");
    }

    try {
      await createQuiz({ ...newQuiz, lessonId });
      setNewQuiz({
        question: "",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctAnswer: "",
      });
      load();
    } catch (err) {
      console.error(err);
      alert("Failed to create quiz");
    }
  }

  // -----------------------------
  // DELETE QUIZ
  // -----------------------------
  async function handleDelete(id) {
    if (!window.confirm("Delete this quiz?")) return;

    try {
      await deleteQuiz(id);
      load();
    } catch (err) {
      console.error(err);
      alert("Failed to delete quiz");
    }
  }

  useEffect(() => {
    if (!lessonId) return;
    load();
  }, [lessonId]);

  if (loading)
    return <div className="p-6 text-xl text-gray-600">Loading quizzes…</div>;

  return (
    <ProtectedAdminRoute>
      <div className="p-6 max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-blue-700">
          Manage Quizzes — {lessonTitle}
        </h1>

        {/* Add quiz card */}
        <div className="bg-white shadow p-6 rounded-lg space-y-4">
          <h2 className="text-xl font-semibold">Add New Quiz Question</h2>

          <input
            className="border p-2 w-full rounded"
            placeholder="Question"
            value={newQuiz.question}
            onChange={(e) =>
              setNewQuiz({ ...newQuiz, question: e.target.value })
            }
          />

          <div className="grid grid-cols-2 gap-4">
            <input
              className="border p-2 rounded"
              placeholder="Option A"
              value={newQuiz.optionA}
              onChange={(e) =>
                setNewQuiz({ ...newQuiz, optionA: e.target.value })
              }
            />

            <input
              className="border p-2 rounded"
              placeholder="Option B"
              value={newQuiz.optionB}
              onChange={(e) =>
                setNewQuiz({ ...newQuiz, optionB: e.target.value })
              }
            />

            <input
              className="border p-2 rounded"
              placeholder="Option C"
              value={newQuiz.optionC}
              onChange={(e) =>
                setNewQuiz({ ...newQuiz, optionC: e.target.value })
              }
            />

            <input
              className="border p-2 rounded"
              placeholder="Option D"
              value={newQuiz.optionD}
              onChange={(e) =>
                setNewQuiz({ ...newQuiz, optionD: e.target.value })
              }
            />
          </div>

          <input
            className="border p-2 w-full rounded"
            placeholder="Correct Answer (A/B/C/D)"
            value={newQuiz.correctAnswer}
            onChange={(e) =>
              setNewQuiz({ ...newQuiz, correctAnswer: e.target.value })
            }
          />

          <button
            onClick={handleCreate}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Add Quiz
          </button>
        </div>

        {/* Existing quizzes */}
        <div className="bg-white shadow p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">
            Existing Quiz Questions
          </h2>

          {questions.length === 0 ? (
            <p className="text-gray-500">No quiz questions added.</p>
          ) : (
            <ul className="space-y-4">
              {questions.map((q) => (
                <li
                  key={q.id}
                  className="border p-4 rounded-lg flex justify-between items-start"
                >
                  <div className="space-y-1">
                    <p>
                      <b>Q:</b> {q.question}
                    </p>
                    <p>A: {q.optionA}</p>
                    <p>B: {q.optionB}</p>
                    <p>C: {q.optionC}</p>
                    <p>D: {q.optionD}</p>
                    <p className="font-bold text-green-600">
                      Correct: {q.correctAnswer}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDelete(q.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={() => navigate("/admin/lessons")}
          className="text-indigo-600 underline"
        >
          ← Back to Lessons
        </button>
      </div>
    </ProtectedAdminRoute>
  );
}

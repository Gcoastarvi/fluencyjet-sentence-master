import { useEffect, useState } from "react";
import { getLessons, getQuiz, createQuiz, updateQuiz } from "../api/adminApi";
import { useNavigate, useParams } from "react-router-dom";

export default function AdminQuizForm() {
  const { id } = useParams();
  const editing = Boolean(id);

  const navigate = useNavigate();

  const [lessons, setLessons] = useState([]);
  const [form, setForm] = useState({
    lessonId: "",
    question: "",
    answer: "",
    explanation: "",
    difficulty: "easy",
  });

  const loadLessons = async () => {
    const res = await getLessons();
    if (res.data.ok) {
      setLessons(res.data.lessons);
    }
  };

  const loadQuiz = async () => {
    if (!editing) return;

    const res = await getQuiz(id);
    if (res.data.ok) {
      setForm({
        lessonId: res.data.quiz.lessonId,
        question: res.data.quiz.question,
        answer: res.data.quiz.answer,
        explanation: res.data.quiz.explanation || "",
        difficulty: res.data.quiz.difficulty,
      });
    }
  };

  useEffect(() => {
    loadLessons();
    loadQuiz();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editing) {
        await updateQuiz(id, form);
      } else {
        await createQuiz(form);
      }

      navigate("/admin/quizzes");
    } catch (err) {
      console.error("Quiz save failed:", err);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        {editing ? "Edit Quiz" : "Create Quiz"}
      </h1>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <select
          className="border p-2 w-full"
          value={form.lessonId}
          onChange={(e) =>
            setForm({ ...form, lessonId: Number(e.target.value) })
          }
          required
        >
          <option value="">Select Lesson</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>

        <textarea
          className="border p-2 w-full"
          rows="3"
          placeholder="Question"
          value={form.question}
          onChange={(e) => setForm({ ...form, question: e.target.value })}
          required
        />

        <input
          type="text"
          className="border p-2 w-full"
          placeholder="Correct Answer"
          value={form.answer}
          onChange={(e) => setForm({ ...form, answer: e.target.value })}
          required
        />

        <textarea
          className="border p-2 w-full"
          rows="3"
          placeholder="Explanation (optional)"
          value={form.explanation}
          onChange={(e) => setForm({ ...form, explanation: e.target.value })}
        />

        <select
          className="border p-2 w-full"
          value={form.difficulty}
          onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>

        <button className="bg-green-600 text-white px-4 py-2 rounded">
          Save Quiz
        </button>
      </form>
    </div>
  );
}

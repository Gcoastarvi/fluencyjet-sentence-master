import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/apiClient";

export default function DiagnosticStart() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);

  // answersMap: { [questionId]: selectedOption }
  const [answersMap, setAnswersMap] = useState({});

  // --------------------------------------------------
  // Load diagnostic quiz
  // --------------------------------------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const res = await api.get("/diagnostic/quiz");
        if (!res.ok) {
          throw new Error(res.error || "Failed to load diagnostic quiz");
        }

        // Support both shapes:
        // 1) { questions: [...] }
        // 2) [...]
        const qs = Array.isArray(res.data)
          ? res.data
          : res.data?.questions || [];

        if (!alive) return;
        setQuestions(qs);
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "Failed to load diagnostic quiz");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const q = questions[idx];
  const selected = q ? answersMap[q.questionId] : "";

  function selectOption(value) {
    if (!q) return;
    setAnswersMap((prev) => ({ ...prev, [q.questionId]: value }));
  }

  function next() {
    if (idx < questions.length - 1) {
      setIdx((p) => p + 1);
    }
  }

  function back() {
    if (idx > 0) {
      setIdx((p) => p - 1);
    }
  }

  // --------------------------------------------------
  // Submit diagnostic
  // --------------------------------------------------
  async function submit() {
    try {
      setErr("");

      // Convert map -> array
      const answers = Object.entries(answersMap).map(
        ([questionId, answer]) => ({
          questionId: Number(questionId),
          answer,
        }),
      );

      if (answers.length === 0) {
        setErr("Please answer at least 1 question.");
        return;
      }

      const payload = {
        anonId: `web-${Date.now()}`,
        answers,
      };

      const res = await api.post("/diagnostic/submit", payload);
      if (!res.ok) {
        throw new Error(res.error || "Submission failed");
      }

      // Persist result for result page
      sessionStorage.setItem("diagnosticResult", JSON.stringify(res.data));

      navigate("/diagnostic/result");
    } catch (e) {
      setErr(e.message || "Submission failed");
    }
  }

  // --------------------------------------------------
  // Render states
  // --------------------------------------------------
  if (loading) {
    return <div style={{ padding: 20 }}>Loading diagnostic…</div>;
  }

  if (err) {
    return <div style={{ padding: 20, color: "red" }}>{err}</div>;
  }

  if (!q) {
    return <div style={{ padding: 20 }}>No questions found.</div>;
  }

  return (
    <div style={{ padding: 20, maxWidth: 760, margin: "0 auto" }}>
      <h2>Diagnostic Quiz</h2>

      <div style={{ marginTop: 10, opacity: 0.7 }}>
        Question {idx + 1} / {questions.length}
      </div>

      <div style={{ marginTop: 18, fontSize: 18, fontWeight: 600 }}>
        {q.question}
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {(q.options || []).map((opt) => (
          <label
            key={opt}
            style={{
              border: "1px solid #ddd",
              padding: 12,
              borderRadius: 10,
              cursor: "pointer",
              background: selected === opt ? "#f2f7ff" : "white",
            }}
          >
            <input
              type="radio"
              name={`q-${q.questionId}`}
              value={opt}
              checked={selected === opt}
              onChange={() => selectOption(opt)}
              style={{ marginRight: 10 }}
            />
            {opt}
          </label>
        ))}
      </div>

      {q.tag ? (
        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>
          Tag: {q.tag}
        </div>
      ) : null}

      <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
        <button onClick={back} disabled={idx === 0}>
          Back
        </button>

        {idx < questions.length - 1 ? (
          <button onClick={next} disabled={!selected}>
            Next
          </button>
        ) : (
          <button onClick={submit} disabled={!selected}>
            Submit
          </button>
        )}
      </div>
    </div>
  );
}

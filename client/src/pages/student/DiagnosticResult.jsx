import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function normalizeLevel(level) {
  return (level || "").toString().trim().toUpperCase();
}

function levelMessage(level) {
  switch (normalizeLevel(level)) {
    case "BEGINNER":
      return {
        title: "Beginner",
        subtitle:
          "You understand some English, but building sentences is still difficult. We’ll make it simple and automatic.",
        promise:
          "In 7 days, you’ll be able to form daily-use sentences confidently.",
      };
    case "INTERMEDIATE":
      return {
        title: "Intermediate",
        subtitle:
          "You can speak some English, but grammar and sentence flow break under pressure. We’ll fix your foundations fast.",
        promise:
          "In 7 days, you’ll speak with smoother sentences and fewer mistakes.",
      };
    case "ADVANCED":
      return {
        title: "Advanced",
        subtitle:
          "You’re doing well. Now it’s about speed, accuracy, and natural sentence flow in real situations.",
        promise:
          "In 7 days, you’ll sound more natural and confident in conversations.",
      };
    default:
      return {
        title: level || "Your Level",
        subtitle:
          "We’ll personalize your practice based on your result and help you improve quickly.",
        promise: "Start the next step to improve your sentence-making.",
      };
  }
}

function weaknessLabel(w) {
  const x = (w || "").toString().trim().toLowerCase();
  if (!x) return null;
  if (x.includes("tense"))
    return { label: "Tenses", fix: "Past/Present/Future clarity" };
  if (x.includes("preposition"))
    return { label: "Prepositions", fix: "in / on / at usage" };
  if (x.includes("grammar"))
    return { label: "Grammar", fix: "Basic correctness" };
  if (x.includes("sentence"))
    return { label: "Sentence Flow", fix: "Natural word order" };
  return { label: w, fix: "Targeted improvement" };
}

export default function DiagnosticResult() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("diagnosticResult");
      if (!raw) return;
      setResult(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const score = result?.score ?? null;
  const level = result?.level ?? "";
  const weaknesses = result?.weaknesses ?? [];

  const primaryWeakness = useMemo(() => {
    if (Array.isArray(weaknesses) && weaknesses.length > 0)
      return weaknesses[0];
    if (typeof weaknesses === "string" && weaknesses.trim())
      return weaknesses.trim();
    return "";
  }, [weaknesses]);

  const lvl = levelMessage(level);
  const wk = weaknessLabel(primaryWeakness);

  if (!result) {
    return (
      <div style={{ padding: 20, maxWidth: 860, margin: "0 auto" }}>
        <h2>Your Result</h2>
        <p style={{ opacity: 0.8 }}>
          No result found. Please take the diagnostic quiz first.
        </p>
        <button onClick={() => navigate("/diagnostic")}>
          Go to Diagnostic Quiz
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 980, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 6 }}>Your Result</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 16,
          marginTop: 16,
        }}
      >
        {/* Result summary */}
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 14,
            padding: 18,
            background: "white",
          }}
        >
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.65 }}>Score</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{score}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.65 }}>Level</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                {normalizeLevel(level)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.65 }}>Main Weakness</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {wk?.label || "—"}
              </div>
              {wk?.fix ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Focus: {wk.fix}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Meaning + next step */}
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 14,
            padding: 18,
            background: "white",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            {lvl.title} — what this means
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 14,
              lineHeight: 1.5,
              opacity: 0.9,
            }}
          >
            {lvl.subtitle}
          </div>

          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "#f6f7ff",
              border: "1px solid #e7e9ff",
            }}
          >
            <div style={{ fontWeight: 800 }}>Your next step (recommended)</div>
            <div style={{ marginTop: 6, opacity: 0.9 }}>
              Start the <b>7-Day Sentence Path</b> designed for your level.
              {wk?.label ? (
                <>
                  {" "}
                  We’ll focus on <b>{wk.label}</b> first and fix it fast.
                </>
              ) : null}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
              {lvl.promise}
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => navigate("/free-quiz")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #6a5cff",
                  background: "#6a5cff",
                  color: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Start 7-Day Sentence Path
              </button>

              <a
                href="https://wa.me/"
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "white",
                  color: "#111",
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Join WhatsApp Practice
              </a>

              <button
                onClick={() => navigate("/diagnostic")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Retake Diagnostic
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              Tip: Consistency beats perfection. Do 10 minutes/day for 7 days.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

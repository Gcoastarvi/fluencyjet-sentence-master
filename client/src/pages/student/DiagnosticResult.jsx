export default function DiagnosticResult() {
  const raw = sessionStorage.getItem("diagnosticResult");
  const result = raw ? JSON.parse(raw) : null;

  if (!result) return <div style={{ padding: 20 }}>No result found.</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Your Result</h2>
      <p>
        <b>Score:</b> {result.score}
      </p>
      <p>
        <b>Level:</b> {result.level}
      </p>
      <p>
        <b>Weaknesses:</b> {(result.weaknesses || []).join(", ") || "None"}
      </p>
    </div>
  );
}

import { useState } from "react";
import { API_BASE } from "@/lib/api";

export default function AdminUpload() {
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return setMsg("Please select a CSV file.");
    setMsg("");
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/admin/upload-csv`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) setMsg(`✅ ${data.message}`);
      else setMsg(`❌ ${data.message || "Upload failed"}`);
    } catch (err) {
      console.error(err);
      setMsg("⚠️ Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow rounded-xl space-y-4">
      <h2 className="text-2xl font-bold text-indigo-700 text-center">
        Admin CSV Upload
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files[0])}
          className="block w-full border border-gray-300 rounded p-2"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white font-semibold py-2 rounded hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "Uploading..." : "Upload CSV"}
        </button>
      </form>

      {msg && (
        <p
          className={`text-center font-medium ${msg.startsWith("✅") ? "text-green-600" : "text-red-600"}`}
        >
          {msg}
        </p>
      )}

      <p className="text-xs text-gray-500 text-center">
        CSV Format: <code>ta,en</code> (Tamil, English)
      </p>
    </div>
  );
}

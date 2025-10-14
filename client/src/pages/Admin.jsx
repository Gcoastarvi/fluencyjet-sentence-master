import { useState } from "react";

export default function Admin() {
  const [email, setEmail] = useState("");
  const [hasAccess, setHasAccess] = useState(true);
  const [message, setMessage] = useState("");

  async function toggleAccess() {
    const res = await fetch("/api/admin/toggle-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, hasAccess }),
    });
    const data = await res.json();
    if (data.id) setMessage("✅ Updated successfully!");
    else setMessage("❌ User not found");
  }

  return (
    <div className="max-w-md mx-auto p-6 text-center">
      <h2 className="text-2xl font-semibold text-indigo-700 mb-4">
        Admin Panel
      </h2>
      <input
        className="w-full border rounded p-2 mb-3"
        placeholder="User email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <label className="block mb-3">
        <input
          type="checkbox"
          checked={hasAccess}
          onChange={(e) => setHasAccess(e.target.checked)}
          className="mr-2"
        />
        Grant Access
      </label>
      <button
        onClick={toggleAccess}
        className="bg-violet-600 text-white px-4 py-2 rounded"
      >
        Update
      </button>
      {message && <p className="mt-3">{message}</p>}
    </div>
  );
}

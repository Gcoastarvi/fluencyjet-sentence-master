import { useState } from "react";

export default function SignupModal({ visible, close, onAuth }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || "";

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const url =
        mode === "signup"
          ? `${API_BASE}/api/auth/signup`
          : `${API_BASE}/api/auth/login`;

      const body =
        mode === "signup" ? { name, email, password } : { email, password };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.message || "Authentication failed");
        return;
      }

      if (data?.token) {
        localStorage.setItem("fj_token", data.token);
        onAuth?.(data.user);
        close();
        alert("Logged in successfully!");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-80 p-6 rounded-2xl shadow-xl">
        <h2 className="text-xl font-semibold text-center mb-3">
          {mode === "signup" ? "Create Account" : "Welcome Back"}
        </h2>

        <div className="flex justify-center gap-3 mb-4">
          <button
            className={`px-3 py-1 rounded ${
              mode === "signup"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700"
            }`}
            onClick={() => setMode("signup")}
          >
            Sign Up
          </button>

          <button
            className={`px-3 py-1 rounded ${
              mode === "login"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700"
            }`}
            onClick={() => setMode("login")}
          >
            Login
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <input
              className="w-full border rounded p-2"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}

          <input
            type="email"
            className="w-full border rounded p-2"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            className="w-full border rounded p-2"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            disabled={loading}
            className="w-full bg-purple-600 text-white py-2 rounded-full"
          >
            {loading ? "Please wait…" : mode === "signup" ? "Create Account" : "Login"}
          </button>
        </form>

        <button
          onClick={close}
          className="mt-3 text-sm text-gray-500 text-center w-full"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

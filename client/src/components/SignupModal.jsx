import { useState } from "react";
import { signupUser, loginUser } from "@/api/apiClient";

export default function SignupModal({ visible, close, onAuth }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let data;

      if (mode === "signup") {
        data = await signupUser({ name, email, password });
      } else {
        data = await loginUser({ email, password });
      }

      // apiClient already throws on non-200
      if (data?.token) {
        setToken(data.token);
        onAuth?.(data);
        close();
      } else {
        setError("Authentication failed");
      }
    } catch (err) {
      setError(err?.message || "Authentication failed");
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
            type="button"
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
            type="button"
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
              required
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

          {error && <p className="text-red-600 text-sm text-center">{error}</p>}

          <button
            disabled={loading}
            className="w-full bg-purple-600 text-white py-2 rounded-full disabled:opacity-60"
          >
            {loading
              ? "Please wait…"
              : mode === "signup"
                ? "Create Account"
                : "Login"}
          </button>
        </form>

        <button
          type="button"
          onClick={close}
          className="mt-3 text-sm text-gray-500 text-center w-full"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

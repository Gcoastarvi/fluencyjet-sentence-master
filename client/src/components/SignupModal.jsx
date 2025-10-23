// client/src/SignupModal.jsx
import { useState } from "react";

export default function SignupModal({ onSignup }) {
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState("signup"); // "signup" | "login"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // If VITE_API_URL is set (prod), use it; otherwise use same-origin (dev proxy)
  const API_BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}`
    : "";

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
        alert(data?.message || "Request failed");
        setLoading(false);
        return;
      }

      // Expecting { token, user }
      if (data?.token && data?.user) {
        // store token for authenticated calls
        localStorage.setItem("fj_token", data.token);
        // bubble up user info to app if needed
        onSignup?.(data.user);
        alert(mode === "signup" ? "Signup successful!" : "Login successful!");
        setShow(false);
      } else {
        alert("Unexpected response. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="px-4 py-2 bg-indigo-600 text-white rounded-full shadow hover:scale-105 transition"
      >
        Sign Up / Login
      </button>

      {show && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl w-80 shadow-lg">
            <h2 className="text-xl font-semibold mb-3 text-center">
              {mode === "signup" ? "Join FluencyJet" : "Welcome back"}
            </h2>

            {/* Toggle */}
            <div className="flex justify-center gap-3 mb-3 text-sm">
              <button
                className={`px-3 py-1 rounded ${mode === "signup" ? "bg-indigo-600 text-white" : "bg-gray-100"}`}
                onClick={() => setMode("signup")}
              >
                Sign Up
              </button>
              <button
                className={`px-3 py-1 rounded ${mode === "login" ? "bg-indigo-600 text-white" : "bg-gray-100"}`}
                onClick={() => setMode("login")}
              >
                Login
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "signup" && (
                <input
                  className="w-full border rounded p-2"
                  placeholder="Name"
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

              <button
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-2 rounded disabled:opacity-60"
              >
                {loading
                  ? "Please wait..."
                  : mode === "signup"
                    ? "Create Account"
                    : "Login"}
              </button>
            </form>

            <button
              onClick={() => setShow(false)}
              className="mt-3 text-sm text-gray-500 w-full"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

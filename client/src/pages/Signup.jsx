// client/src/pages/Signup.jsx
import { useState, useEffect } from "react";
import { signupUser, loginUser } from "../api";
import { autoRedirectIfLoggedIn } from "@/utils/authRedirect";

export default function Signup() {
  // 🔁 Auto-redirect if already logged in
  useEffect(() => {
    autoRedirectIfLoggedIn();
  }, []);

  // 🧩 State management
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // ⚡ Handle form submission
  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      if (mode === "signup") {
        // 🔹 API call for signup
        const res = await signupUser({ name, email, password });
        console.log("Signup response:", res.data);

        if (res.data?.token) {
          localStorage.setItem("token", res.data.token);
          localStorage.setItem("userName", res.data?.name || name || "Learner"); // ✅ add this line
          setMsg("Signup successful! Redirecting...");
          setTimeout(() => (window.location.href = "/dashboard"), 1000);
        } else {
          setMsg(res.data?.message || "Signup complete. Please log in.");
        }
      } else {
        // 🔹 API call for login
        const res = await loginUser({ email, password });
        console.log("Login response:", res.data);

        if (res.data?.token) {
          localStorage.setItem("token", res.data.token);
          localStorage.setItem("userName", res.data?.name || "Learner"); // ✅ add this line
          setMsg("Login successful! Redirecting...");
          setTimeout(() => (window.location.href = "/dashboard"), 1000);
        } else {
          setMsg(res.data?.message || "Login successful!");
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      const apiMsg =
        err.response?.data?.message ||
        err.message ||
        "Network error. Please try again.";
      setMsg(apiMsg);
    } finally {
      setLoading(false);
    }
  }

  // 🧱 UI Rendering
  return (
    <div className="flex flex-col items-center mt-16">
      <h2 className="text-3xl font-bold text-indigo-700 mb-4">
        Join FluencyJet
      </h2>

      {/* Mode toggle (Signup / Login) */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setMode("signup")}
          className={`px-4 py-2 rounded ${
            mode === "signup"
              ? "bg-indigo-600 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          Sign Up
        </button>
        <button
          onClick={() => setMode("login")}
          className={`px-4 py-2 rounded ${
            mode === "login"
              ? "bg-indigo-600 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          Login
        </button>
      </div>

      {/* Auth form */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 bg-white p-6 rounded-xl shadow-md"
      >
        {mode === "signup" && (
          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border p-2 rounded"
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border p-2 rounded"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border p-2 rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-70"
        >
          {loading ? "Please wait..." : mode === "signup" ? "Sign Up" : "Login"}
        </button>
      </form>

      {/* Status message */}
      {msg && (
        <p
          className={`mt-4 text-sm text-center px-4 ${
            msg.toLowerCase().includes("error") ||
            msg.toLowerCase().includes("failed") ||
            msg.toLowerCase().includes("network")
              ? "text-red-600"
              : "text-green-600"
          }`}
        >
          {msg}
        </p>
      )}
    </div>
  );
}

// client/src/pages/Signup.jsx
import { useState } from "react";
import { signupUser, loginUser } from "../api";

export default function Signup() {
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const res = await signupUser({ name, email, password });
        console.log("Signup response:", res.data);

        if (res.data?.token) {
          localStorage.setItem("token", res.data.token);
          setMsg("Signup successful! Redirecting...");
          setTimeout(() => (window.location.href = "/dashboard"), 1000);
        } else {
          setMsg(res.data?.message || "Signup complete. Please log in.");
        }
      } else {
        const res = await loginUser({ email, password });
        console.log("Login response:", res.data);

        if (res.data?.token) {
          localStorage.setItem("token", res.data.token);
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

  return (
    <div className="flex flex-col items-center mt-16">
      <h2 className="text-3xl font-bold text-indigo-700 mb-4">
        Join FluencyJet
      </h2>

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

      {msg && (
        <p
          className={`mt-4 text-sm ${
            msg.toLowerCase().includes("error") ||
            msg.toLowerCase().includes("failed")
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

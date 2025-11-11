// client/src/pages/Login.jsx
import { useEffect, useState } from "react";
import { loginUser } from "../api";
import { autoRedirectIfLoggedIn } from "../utils/authRedirect";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // ✅ Auto redirect if token already valid
  useEffect(() => {
    autoRedirectIfLoggedIn();
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const res = await loginUser({ email, password });
      if (res.data?.token) {
        localStorage.setItem("token", res.data.token);
        if (res.data?.expiresAt) {
          localStorage.setItem("tokenExpiry", res.data.expiresAt);
        }

        localStorage.setItem("userName", res.data?.name || "Learner"); // ✅ add this
        setMsg("Login successful! Redirecting...");
        setTimeout(() => (window.location.href = "/dashboard"), 1000);
      } else {
        setMsg(res.data?.message || "Login successful!");
      }
    } catch (err) {
      console.error("Login failed:", err);
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

      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm space-y-4 bg-white p-6 rounded-xl shadow-md"
      >
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
          {loading ? "Please wait..." : "Login"}
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

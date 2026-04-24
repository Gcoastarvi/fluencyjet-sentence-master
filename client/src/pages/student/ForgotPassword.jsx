import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/apiClient";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await api.post("/auth/forgot-password", {
        email: email.trim(),
      });

      const data = res?.data ?? res;

      if (!data?.ok) {
        setError(data?.message || "Unable to send reset link.");
        return;
      }

      setMessage(
        data?.message ||
          "If an account exists for that email, reset instructions have been sent.",
      );
    } catch (err) {
      console.error("Forgot password request failed:", err);
      setError("Unable to process your request right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">
          Reset your password
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Enter your email and we’ll send reset instructions.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
          </div>

          {message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>

          <div className="text-center text-sm text-slate-600">
            <Link
              className="font-semibold text-indigo-700 hover:underline"
              to="/login"
            >
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

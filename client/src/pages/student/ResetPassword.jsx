import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/api/apiClient";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Reset link is invalid.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/auth/reset-password", {
        token,
        password,
      });

      const data = res?.data ?? res;

      if (!data?.ok) {
        setError(data?.message || "Unable to reset password.");
        return;
      }

      setMessage(data?.message || "Password updated successfully.");
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (err) {
      console.error("Reset password failed:", err);
      setError("Reset failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">
          Choose a new password
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Enter a new password to regain access to your account.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              New Password
            </label>
            <div className="mt-1 relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-20 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500 hover:text-slate-700"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Confirm Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
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
            {loading ? "Resetting..." : "Reset password"}
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

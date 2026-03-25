// client/src/pages/student/Signup.jsx
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signupUser } from "../../api/apiClient";

export default function Signup() {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const rawNext = searchParams.get("next") || "/dashboard";
  const next =
    typeof rawNext === "string" && rawNext.startsWith("/")
      ? rawNext
      : "/dashboard";

  const [name, setName] = useState(searchParams.get("name") || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      };

      const res = await signupUser(payload);

      if (!res?.ok) {
        setError(res?.message || "Signup failed");
        setLoading(false);
        return;
      }

      // 🚀 HYPER-SPEED HOOK: Automatic Login
      // If your API returns a token, save it and teleport them instantly.
      if (res.token) {
        localStorage.setItem("token", res.token);
        // Using window.location.href forces a clean state for the new user
        window.location.href = next;
      } else {
        // Fallback: If no token, go to the pre-filled login page we built
        navigate(
          `/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`,
          { replace: true },
        );
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }
  // 🗑️ (Note: Delete the old 'const handleSignup = ...' block entirely)

  return (
    <div className="min-h-[70vh] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Create Account</h2>
        <p className="mt-1 text-sm text-slate-600">
          Create a free account to start practicing.
        </p>

        {/* 🤝 THE TRUST HOOK: Coach Aravind Welcome */}
        <div className="flex items-center gap-4 bg-indigo-50 p-4 rounded-2xl mb-2 border border-indigo-100 mt-6">
          <div className="relative flex-shrink-0">
            {/* 🤝 Trust Hook Avatar Update */}
            <img
              src="/avatar-fallback.png"
              className="h-12 w-12 rounded-full border-2 border-white shadow-sm object-cover bg-indigo-100"
              alt="Coach Aravind"
            />
            <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-emerald-500 rounded-full border-2 border-white"></div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-tighter text-indigo-600">
              Secure Your Spot
            </p>
            <p className="text-xs font-bold text-slate-700 leading-tight">
              "Great choice! I've prepared your first lesson. Just enter your
              email to start."
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Create a password"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:opacity-95 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Creating…" : "Sign Up"}
          </button>

          {/* ✅ VALIDATION HOOK: Social Proof */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <img
                  key={i}
                  src={`https://i.pravatar.cc/100?img=${i + 10}`}
                  className="h-6 w-6 rounded-full border-2 border-white"
                  alt="User"
                />
              ))}
              <div className="h-6 w-6 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center text-[8px] font-bold text-white">
                +1k
              </div>
            </div>
            <p className="text-[10px] font-medium text-slate-500">
              Join{" "}
              <span className="font-bold text-slate-700">1,240+ students</span>{" "}
              from Tamil Nadu today.
            </p>
          </div>

          <div className="text-center text-sm text-slate-600">
            Already have an account?{" "}
            <a
              className="font-semibold text-indigo-700 hover:underline"
              href="/login"
            >
              Login
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

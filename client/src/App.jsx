// client/src/App.jsx
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Paywall from "@/pages/Paywall";
import Admin from "@/pages/Admin";
import Leaderboard from "@/pages/Leaderboard";
import TypingQuiz from "@/pages/TypingQuiz";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ProtectedRoute from "@/components/ProtectedRoute";
import { testHealth } from "@/api/testConnection";
import { logoutAndRedirect } from "@/utils/authRedirect";

export default function App() {
  const [userName, setUserName] = useState(null);

  // ✅ Load user info from localStorage (or from /api/auth/me in the future)
  useEffect(() => {
    testHealth();
    try {
      const storedUser = localStorage.getItem("userName");
      const token = localStorage.getItem("token");

      if (token && storedUser) setUserName(storedUser);
      else if (token && !storedUser) {
        // fallback: decode or placeholder if userName not cached
        setUserName("Learner");
      }
    } catch {
      setUserName(null);
    }
  }, []);

  const isLoggedIn = !!localStorage.getItem("token");

  return (
    <BrowserRouter>
      <div className="max-w-4xl mx-auto p-4">
        {/* 🏷️ Header */}
        <header className="flex flex-wrap justify-between items-center mb-4 gap-3">
          <Link to="/" className="font-bold text-xl text-indigo-700">
            FluencyJet Sentence Master
          </Link>

          {/* 🧭 Navigation */}
          <nav className="flex flex-wrap gap-3 text-sm md:text-base items-center">
            <Link to="/dashboard" className="hover:underline">
              Dashboard
            </Link>
            <Link to="/leaderboard" className="hover:underline">
              Leaderboard
            </Link>
            <Link to="/typing-quiz" className="hover:underline">
              Typing Quiz
            </Link>
            <Link to="/paywall" className="hover:underline">
              Paywall
            </Link>
            <Link to="/admin" className="hover:underline">
              Admin
            </Link>

            {/* 👇 Conditional Buttons */}
            {!isLoggedIn ? (
              <>
                <Link
                  to="/login"
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
                >
                  Sign Up
                </Link>
              </>
            ) : (
              <>
                <span className="text-gray-600 text-sm">
                  Welcome, <b>{userName || "Learner"}</b>
                </span>
                <button
                  onClick={logoutAndRedirect}
                  className="text-sm bg-red-500 text-white px-3 py-1 rounded-full hover:opacity-90"
                >
                  Logout
                </button>
              </>
            )}
          </nav>
        </header>

        {/* 🔀 Routes */}
        <Routes>
          <Route path="/" element={<Home />} />
          {/* ✅ Protected Pages */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <Leaderboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/typing-quiz"
            element={
              <ProtectedRoute>
                <TypingQuiz />
              </ProtectedRoute>
            }
          />
          <Route
            path="/paywall"
            element={
              <ProtectedRoute>
                <Paywall />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />

          {/* Public Pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

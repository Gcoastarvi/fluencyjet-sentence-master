// client/src/App.jsx
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

// Core pages
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Paywall from "@/pages/Paywall";
import Admin from "@/pages/Admin";
import AdminXP from "./pages/AdminXP";
import AdminUserDetail from "./pages/AdminUserDetail";
import Leaderboard from "@/pages/Leaderboard";
import TypingQuiz from "@/pages/TypingQuiz";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ProtectedRoute from "@/components/ProtectedRoute";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import AdminQuizzes from "./pages/AdminQuizzes";
import AdminAnalytics from "./pages/AdminAnalytics.jsx";

// Lessons
import Lessons from "@/pages/Lessons";
import LessonDetail from "@/pages/LessonDetail";
import LessonQuiz from "@/pages/LessonQuiz";

// Practice (New)
import Practice from "@/pages/Practice";

// Utility
import { testHealth } from "@/api/testConnection";
import { logoutAndRedirect } from "@/utils/authRedirect";
import { getDisplayName } from "@/utils/displayName";

export default function App() {
  const [userName, setUserName] = useState(null);

  useEffect(() => {
    testHealth();

    try {
      const stored = localStorage.getItem("userName");
      const token = localStorage.getItem("token");

      if (token && stored) setUserName(stored);
      else if (token && !stored) setUserName("Learner");
    } catch {
      setUserName(null);
    }
  }, []);

  const isLoggedIn = !!localStorage.getItem("token");
  const name = getDisplayName({ name: userName });

  return (
    <BrowserRouter>
      <div className="max-w-4xl mx-auto p-4">
        {/* HEADER */}
        <header className="flex flex-wrap justify-between items-center mb-4 gap-3">
          <Link to="/" className="font-bold text-xl text-indigo-700">
            FluencyJet Sentence Master
          </Link>

          <nav className="flex flex-wrap gap-3 text-sm md:text-base items-center">
            <Link to="/dashboard" className="hover:underline">
              Dashboard
            </Link>
            <Link to="/lessons" className="hover:underline">
              Lessons
            </Link>
            <Link to="/leaderboard" className="hover:underline">
              Leaderboard
            </Link>
            <Link to="/typing-quiz" className="hover:underline">
              Typing Quiz
            </Link>
            <Link to="/practice" className="hover:underline">
              Practice
            </Link>
            <Link to="/paywall" className="hover:underline">
              Paywall
            </Link>
            <Link to="/admin" className="hover:underline">
              Admin
            </Link>

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
                  Welcome, <b>{name}</b>
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

        {/* ROUTES */}
        <Routes>
          {/* PUBLIC */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* PROTECTED CORE */}
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
            path="/practice"
            element={
              <ProtectedRoute>
                <Practice />
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
              <ProtectedAdminRoute>
                <Admin />
              </ProtectedAdminRoute>
            }
          />

          <Route
            path="/admin/xp"
            element={
              <ProtectedAdminRoute>
                <AdminXP />
              </ProtectedAdminRoute>
            }
          />

          <Route
            path="/admin/user/:id"
            element={
              <ProtectedAdminRoute>
                <AdminUserDetail />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <ProtectedAdminRoute>
                <AdminAnalytics />
              </ProtectedAdminRoute>
            }
          />

          {/* LESSONS */}
          <Route
            path="/lessons"
            element={
              <ProtectedRoute>
                <Lessons />
              </ProtectedRoute>
            }
          />

          <Route
            path="/lessons/:id"
            element={
              <ProtectedRoute>
                <LessonDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/lessons/:id/start"
            element={
              <ProtectedRoute>
                <LessonQuiz />
              </ProtectedRoute>
            }
          />

          {/* ADMIN → QUIZ MANAGEMENT */}
          <Route
            path="/admin/lessons/:lessonId/quizzes"
            element={
              <ProtectedAdminRoute>
                <AdminQuizzes />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute>
                <AdminAnalytics />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

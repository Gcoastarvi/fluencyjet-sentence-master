// client/src/App.jsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Paywall from "@/pages/Paywall";
import Admin from "@/pages/Admin";
import Leaderboard from "@/pages/Leaderboard";
import TypingQuiz from "@/pages/TypingQuiz";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ProtectedRoute from "@/components/ProtectedRoute"; // ✅ Added
import { testHealth } from "@/api/testConnection";

export default function App() {
  // 🧠 Test backend connection once on load
  useEffect(() => {
    testHealth();
  }, []);

  return (
    <BrowserRouter>
      <div className="max-w-4xl mx-auto p-4">
        {/* 🏷️ Header */}
        <header className="flex flex-wrap justify-between items-center mb-4 gap-3">
          <Link to="/" className="font-bold text-xl text-indigo-700">
            FluencyJet Sentence Master
          </Link>

          {/* 🧭 Navigation */}
          <nav className="flex flex-wrap gap-3 text-sm md:text-base">
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
          </nav>
        </header>

        {/* 🔀 Routes */}
        <Routes>
          <Route path="/" element={<Home />} />

          {/* ✅ Protected routes (require login) */}
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

          {/* 🧾 Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

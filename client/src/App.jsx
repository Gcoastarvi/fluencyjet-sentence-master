// client/src/App.jsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Paywall from "@/pages/Paywall";
import Admin from "@/pages/Admin";
import Leaderboard from "@/pages/Leaderboard";
import TypingQuiz from "@/pages/TypingQuiz";
import { testHealth } from "@/api/testConnection"; // ✅ Import connection test

export default function App() {
  // 🧠 Test API health when app loads
  useEffect(() => {
    testHealth();
  }, []);

  return (
    <BrowserRouter>
      <div className="max-w-3xl mx-auto p-4">
        {/* 🏷️ Header */}
        <header className="flex justify-between items-center mb-4">
          <Link to="/" className="font-bold text-xl text-indigo-700">
            FluencyJet Sentence Master
          </Link>

          {/* 🧭 Navigation */}
          <nav className="flex gap-3">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/leaderboard">Leaderboard</Link>
            <Link to="/typing-quiz">Typing Quiz</Link>
            <Link to="/paywall">Paywall</Link>
            <Link to="/admin">Admin</Link>
          </nav>
        </header>

        {/* 🔀 Routes */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/typing-quiz" element={<TypingQuiz />} />
          <Route path="/paywall" element={<Paywall />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

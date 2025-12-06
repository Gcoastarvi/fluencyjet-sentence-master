// client/src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// ---------- Layouts ----------
import Navbar from "./components/Navbar";

// ---------- Route Guards ----------
import ProtectedRoute from "./components/ProtectedRoute";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";

// ---------- Student Pages ----------
import Home from "./pages/student/Home";
import Dashboard from "./pages/student/Dashboard";
import Lessons from "./pages/student/Lessons";
import LessonDetail from "./pages/student/LessonDetail";
import LessonQuiz from "./pages/student/LessonQuiz";
import TypingQuiz from "./pages/student/TypingQuiz";
import Leaderboard from "./pages/student/Leaderboard";
import Practice from "./pages/student/Practice";
import Login from "./pages/student/Login";
import Signup from "./pages/student/Signup";
import Paywall from "./pages/student/Paywall";

// ---------- Admin Pages ----------
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminLessons from "./pages/admin/AdminLessons";
import AdminLessonCreate from "./pages/admin/AdminLessonCreate";
import AdminLessonEdit from "./pages/admin/AdminLessonEdit";
import AdminQuizzes from "./pages/admin/AdminQuizzes";
import AdminQuizForm from "./pages/admin/AdminQuizForm";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminXP from "./pages/admin/AdminXP";

export default function App() {
  return (
    <Router>
      {/* Navbar appears on ALL pages except Admin Login */}
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="*" element={<Navbar />} />
      </Routes>

      <Routes>
        {/* ---------- PUBLIC ROUTES ---------- */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* ---------- STUDENT PROTECTED ROUTES ---------- */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

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
          path="/lessons/:id/quiz"
          element={
            <ProtectedRoute>
              <LessonQuiz />
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
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <Leaderboard />
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

        {/* ---------- ADMIN AUTH ROUTE ---------- */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* ---------- ADMIN PROTECTED ROUTES ---------- */}
        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <AdminDashboard />
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedAdminRoute>
              <AdminDashboard />
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedAdminRoute>
              <AdminUsers />
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin/users/:id"
          element={
            <ProtectedAdminRoute>
              <AdminUserDetail />
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin/lessons"
          element={
            <ProtectedAdminRoute>
              <AdminLessons />
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin/lessons/create"
          element={
            <ProtectedAdminRoute>
              <AdminLessonCreate />
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin/lessons/:id"
          element={
            <ProtectedAdminRoute>
              <AdminLessonEdit />
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin/quizzes"
          element={
            <ProtectedAdminRoute>
              <AdminQuizzes />
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin/quizzes/create"
          element={
            <ProtectedAdminRoute>
              <AdminQuizForm />
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

        <Route
          path="/admin/xp"
          element={
            <ProtectedAdminRoute>
              <AdminXP />
            </ProtectedAdminRoute>
          }
        />

        {/* ---------- FALLBACK ---------- */}
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  );
}

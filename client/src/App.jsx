import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useParams,
  useLocation,
} from "react-router-dom";

import { useEffect } from "react";

import Navbar from "./components/Navbar";
import { AuthProvider } from "./context/AuthContext";

// Student pages
import Home from "./pages/student/Home.jsx";
import Dashboard from "./pages/student/Dashboard.jsx";
import LessonDetail from "./pages/student/LessonDetail.jsx";
import LessonQuiz from "./pages/student/LessonQuiz.jsx";
import Leaderboard from "./pages/student/Leaderboard.jsx";
import Login from "./pages/student/Login.jsx";
import Signup from "./pages/student/Signup.jsx";
import Practice from "./pages/student/Practice.jsx";
import TypingQuiz from "./pages/student/TypingQuiz.jsx";
import SentencePractice from "./pages/student/SentencePractice.jsx";
import Paywall from "./pages/student/Paywall.jsx";
import Checkout from "./pages/student/Checkout.jsx";
import BeginnerLessons from "./pages/student/BeginnerLessons";
import IntermediateLessons from "./pages/student/IntermediateLessons";
import LevelCheck from "./pages/student/LevelCheck";

// Admin pages
import Admin from "./pages/admin/Admin.jsx";
import AdminLogin from "./pages/admin/AdminLogin.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminLessons from "./pages/admin/AdminLessons.jsx";
import AdminLessonCreate from "./pages/admin/AdminLessonCreate.jsx";
import AdminLessonEdit from "./pages/admin/AdminLessonEdit.jsx";
import AdminQuizzes from "./pages/admin/AdminQuizzes.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";
import AdminUserDetail from "./pages/admin/AdminUserDetail.jsx";
import AdminXP from "./pages/admin/AdminXP.jsx";
import AdminAnalytics from "./pages/admin/AdminAnalytics.jsx";

// Route guards
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute.jsx";

function MainLayout() {
  return (
    <>
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
    </>
  );
}

const TRACK_KEY = "fj_track";

function inferTrackFromPath(pathname) {
  if (pathname.startsWith("/b/")) return "beginner";
  if (pathname.startsWith("/i/")) return "intermediate";
  return null;
}

function writeTrackToStorage(track) {
  try {
    if (track === "beginner" || track === "intermediate") {
      localStorage.setItem(TRACK_KEY, track);
    }
  } catch {}
}

function TrackSync() {
  const location = useLocation();

  useEffect(() => {
    const inferred = inferTrackFromPath(location.pathname);
    if (inferred) writeTrackToStorage(inferred);
  }, [location.pathname]);

  return null;
}

function readTrackFromStorage() {
  // 1) Primary: fj_track set by /level-check
  try {
    const t = localStorage.getItem(TRACK_KEY);
    if (t === "intermediate" || t === "beginner") return t;
  } catch {}

  // 2) Secondary: user.track (if you store it)
  try {
    const raw = localStorage.getItem("user");
    const u = raw ? JSON.parse(raw) : null;
    const t = String(u?.track || "").toLowerCase();
    if (t === "intermediate" || t === "beginner") return t;
  } catch {}

  // 3) Fallback: old plan logic
  try {
    const raw = localStorage.getItem("user");
    const u = raw ? JSON.parse(raw) : null;
    const plan = String(u?.plan || "").toLowerCase();
    if (plan.includes("inter")) return "intermediate";
  } catch {}

  return "beginner";
}

function LessonsRedirect() {
  const track = readTrackFromStorage();
  const target = track === "intermediate" ? "/i/lessons" : "/b/lessons";
  return <Navigate to={target} replace />;
}

function LessonRedirect() {
  const { lessonId } = useParams();

  const track = readTrackFromStorage();
  const base = track === "intermediate" ? "/i" : "/b";
  const diff = track === "intermediate" ? "intermediate" : "beginner";

  return (
    <Navigate
      to={`${base}/lesson/${encodeURIComponent(
        lessonId,
      )}?difficulty=${encodeURIComponent(diff)}`}
      replace
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Admin login (no Navbar) */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* All other pages share Navbar */}
          <Route element={<MainLayout />}>
            {/* Public */}
            <Route index element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signin" element={<Navigate to="/login" replace />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/paywall" element={<Paywall />} />
            <Route path="/level-check" element={<LevelCheck />} />

            {/* keep diagnostic as alias → level-check */}
            <Route
              path="/diagnostic"
              element={<Navigate to="/level-check" replace />}
            />
            <Route
              path="/diagnostic/result"
              element={<Navigate to="/level-check" replace />}
            />

            {/* lessons redirect based on fj_track */}
            <Route path="/lessons" element={<LessonsRedirect />} />

            {/* legacy route (IMPORTANT) */}
            <Route path="/lesson/:lessonId" element={<LessonRedirect />} />

            {/* practice entry (redirect only). Actual practice is protected below */}
            <Route
              path="/practice"
              element={<Navigate to="/practice/reorder" replace />}
            />

            {/* Student-protected */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quiz/:lessonId"
              element={
                <ProtectedRoute>
                  <LessonQuiz />
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
              path="/typing-quiz"
              element={
                <ProtectedRoute>
                  <TypingQuiz />
                </ProtectedRoute>
              }
            />
            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              }
            />
            {/* Admin-protected (unchanged) */}
            <Route
              path="/admin"
              element={
                <ProtectedAdminRoute>
                  <Admin />
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
              path="/admin/lessons"
              element={
                <ProtectedAdminRoute>
                  <AdminLessons />
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/lessons/new"
              element={
                <ProtectedAdminRoute>
                  <AdminLessonCreate />
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/lessons/:lessonId"
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
              path="/admin/users"
              element={
                <ProtectedAdminRoute>
                  <AdminUsers />
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/users/:userId"
              element={
                <ProtectedAdminRoute>
                  <AdminUserDetail />
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
              path="/admin/analytics"
              element={
                <ProtectedAdminRoute>
                  <AdminAnalytics />
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/b/lessons"
              element={
                <ProtectedRoute>
                  <BeginnerLessons />
                </ProtectedRoute>
              }
            />
            <Route
              path="/i/lessons"
              element={
                <ProtectedRoute>
                  <IntermediateLessons />
                </ProtectedRoute>
              }
            />
            <Route
              path="/b/lesson/:lessonId"
              element={
                <ProtectedRoute>
                  <LessonDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/i/lesson/:lessonId"
              element={
                <ProtectedRoute>
                  <LessonDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/practice/:mode"
              element={
                <ProtectedRoute>
                  <SentencePractice />
                </ProtectedRoute>
              }
            />
            <Route
              path="/practice/audio"
              element={
                <ProtectedRoute>
                  <SentencePractice />
                </ProtectedRoute>
              }
            />
            {/* Fallback */}
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

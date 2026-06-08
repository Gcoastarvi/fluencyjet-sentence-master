// client/src/App.jsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useParams,
  useLocation,
} from "react-router-dom";

import { useEffect, lazy, Suspense } from "react";

import Navbar from "./components/Navbar";
import { AuthProvider } from "./context/AuthContext";
import SmartSignup from "./pages/student/SmartSignup";
import Activation from "./pages/student/Activation";

// Route guards
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute.jsx";
import RouteTracker from "./components/RouteTracker";

function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-yellow-400" />
        <p className="text-lg font-bold">Loading FluencyJet...</p>
        <p className="mt-1 text-sm text-white/60">
          Preparing your practice page
        </p>
      </div>
    </div>
  );
}

// Student pages - lazy loaded
const Home = lazy(() => import("./pages/Home"));
const Webinar = lazy(() => import("./pages/Webinar"));
const Dashboard = lazy(() => import("./pages/student/Dashboard.jsx"));
const LessonDetail = lazy(() => import("./pages/student/LessonDetail.jsx"));
const LessonQuiz = lazy(() => import("./pages/student/LessonQuiz.jsx"));
const Leaderboard = lazy(() => import("./pages/student/Leaderboard.jsx"));
const Login = lazy(() => import("./pages/student/Login.jsx"));
const Signup = lazy(() => import("./pages/student/Signup.jsx"));
const Practice = lazy(() => import("./pages/student/Practice.jsx"));
const TypingQuiz = lazy(() => import("./pages/student/TypingQuiz.jsx"));
const SentencePractice = lazy(
  () => import("./pages/student/SentencePractice.jsx"),
);
const Paywall = lazy(() => import("./pages/student/Paywall.jsx"));
const Checkout = lazy(() => import("./pages/student/Checkout.jsx"));
const LevelCheck = lazy(() => import("./pages/student/LevelCheck"));
const Upgrade = lazy(() => import("./pages/student/Upgrade"));
const LessonList = lazy(() => import("./pages/student/LessonList"));
const Profile = lazy(() => import("./pages/student/Profile"));
const Settings = lazy(() => import("./pages/student/Settings"));
const ForgotPassword = lazy(() => import("./pages/student/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/student/ResetPassword"));

// Admin pages - lazy loaded
const Admin = lazy(() => import("./pages/admin/Admin.jsx"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin.jsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.jsx"));
const AdminLessons = lazy(() => import("./pages/admin/AdminLessons.jsx"));
const AdminLessonCreate = lazy(
  () => import("./pages/admin/AdminLessonCreate.jsx"),
);
const AdminLessonEdit = lazy(() => import("./pages/admin/AdminLessonEdit.jsx"));
const AdminQuizzes = lazy(() => import("./pages/admin/AdminQuizzes.jsx"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers.jsx"));
const AdminUserDetail = lazy(() => import("./pages/admin/AdminUserDetail.jsx"));
const AdminXP = lazy(() => import("./pages/admin/AdminXP.jsx"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics.jsx"));
const CurriculumManager = lazy(() => import("./pages/admin/CurriculumManager"));

// Legal pages - lazy loaded
const About = lazy(() => import("./pages/legal/About"));
const Contact = lazy(() => import("./pages/legal/Contact"));
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const RefundPolicy = lazy(() => import("./pages/legal/RefundPolicy"));
const Disclaimer = lazy(() => import("./pages/legal/Disclaimer"));

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
        <RouteTracker />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Admin login (no Navbar) */}
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* All other pages share Navbar */}
            <Route element={<MainLayout />}>
              {/* Public */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/signin"
                element={<Navigate to="/login" replace />}
              />
              <Route path="/signup" element={<Signup />} />
              <Route path="/smart-signup" element={<SmartSignup />} />
              <Route path="/activation" element={<Activation />} />
              <Route path="/webinar" element={<Webinar />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/paywall" element={<Paywall />} />
              <Route path="/level-check" element={<LevelCheck />} />
              <Route path="/upgrade" element={<Upgrade />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin/curriculum" element={<CurriculumManager />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/refund-policy" element={<RefundPolicy />} />
              <Route path="/disclaimer" element={<Disclaimer />} />
              {/* 🛡️ UNIFIED LESSON HUB ROUTES */}
              <Route
                path="/b/lessons"
                element={
                  <ProtectedRoute>
                    <LessonList difficulty="basic" />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/i/lessons"
                element={
                  <ProtectedRoute>
                    <LessonList difficulty="intermediate" />
                  </ProtectedRoute>
                }
              />

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
              {/* 📖 Updated Individual Lesson Routes */}
              <Route
                path="/b/lesson/:lessonId"
                element={
                  <ProtectedRoute>
                    <LessonDetail difficulty="beginner" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/i/lesson/:lessonId"
                element={
                  <ProtectedRoute>
                    <LessonDetail difficulty="intermediate" />
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
              {/* Fallback */}
              <Route path="*" element={<Home />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}
// Build Reset: 2026-03-18

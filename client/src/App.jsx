import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

// Components
import Navbar from "./components/Navbar";

// Student Pages
import Dashboard from "./pages/student/Dashboard";
import Lessons from "./pages/student/Lessons";
import LessonDetail from "./pages/student/LessonDetail";
import LessonQuiz from "./pages/student/LessonQuiz";
import Leaderboard from "./pages/student/Leaderboard";
import TypingQuiz from "./pages/student/TypingQuiz";
import Practice from "./pages/student/Practice";
import Paywall from "./pages/student/Paywall";
import Login from "./pages/student/Login";
import Signup from "./pages/student/Signup";

// Admin Pages
import AdminLogin from "./pages/admin/AdminLogin";
import Admin from "./pages/admin/Admin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLessons from "./pages/admin/AdminLessons";
import AdminLessonCreate from "./pages/admin/AdminLessonCreate";
import AdminLessonEdit from "./pages/admin/AdminLessonEdit";
import AdminQuizzes from "./pages/admin/AdminQuizzes";
import AdminQuizForm from "./pages/admin/AdminQuizForm";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminXP from "./pages/admin/AdminXP";

// Route Protection
import ProtectedRoute from "./components/ProtectedRoute";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";

function LayoutWrapper({ children }) {
  const location = useLocation();
  const hideNavbar = location.pathname.startsWith("/admin/login");

  return (
    <>
      {!hideNavbar && <Navbar />}
      {children}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <LayoutWrapper>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Admin Login */}
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* Student Protected Routes */}
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

            {/* Admin Protected Routes */}
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
              path="/admin/lessons/create"
              element={
                <ProtectedAdminRoute>
                  <AdminLessonCreate />
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/admin/lessons/edit/:id"
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
          </Routes>
        </LayoutWrapper>
      </Router>
    </AuthProvider>
  );
}

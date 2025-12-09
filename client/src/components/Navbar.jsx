import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { isAuthenticated, logout, loading } = useAuth();
  const navigate = useNavigate();

  function handleLoginClick() {
    navigate("/login");
  }

  function handleLogoutClick() {
    logout();
    alert("Logged out successfully!");
    navigate("/", { replace: true });
  }

  return (
    <nav className="flex items-center justify-between px-6 py-4 shadow-sm bg-white">
      <Link to="/" className="text-2xl font-bold text-purple-700">
        FluencyJet <span className="font-normal">Sentence Master</span>
      </Link>

      <div className="flex gap-6 text-lg items-center">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/lessons">Lessons</Link>
        <Link to="/leaderboard">Leaderboard</Link>
        <Link to="/typing-quiz">Typing Quiz</Link>
        <Link to="/practice">Practice</Link>
        <Link to="/paywall">Paywall</Link>
        <Link to="/admin">Admin</Link>

        {!loading && (
          <>
            {!isAuthenticated ? (
              <button
                onClick={handleLoginClick}
                className="px-4 py-2 bg-purple-600 text-white rounded-full shadow"
              >
                Login
              </button>
            ) : (
              <button
                onClick={handleLogoutClick}
                className="px-4 py-2 bg-gray-800 text-white rounded-full shadow"
              >
                Logout
              </button>
            )}
          </>
        )}
      </div>
    </nav>
  );
}

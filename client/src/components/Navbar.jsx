import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // ✅ LOADING GUARD — THIS IS THE KEY
  if (loading) {
    return (
      <nav className="flex items-center px-6 py-4 shadow-sm bg-white">
        <span className="text-purple-700 font-bold text-xl">
          FluencyJet Sentence Master
        </span>
      </nav>
    );
  }

  const isAdmin = user?.role === "ADMIN";

  function handleLoginClick() {
    navigate("/login");
  }

  function handleLogoutClick() {
    logout();
    navigate("/", { replace: true });
  }

return (
  <nav className="w-full bg-white shadow-sm overflow-x-hidden">
    <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="text-xl sm:text-2xl font-bold text-purple-700 leading-tight"
        >
          FluencyJet <span className="font-normal">Sentence Master</span>
        </Link>

        {/* Navigation */}
        <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap pb-1 sm:pb-0">
          {!isAuthenticated && (
            <>
              <Link to="/practice" className="text-sm sm:text-base hover:text-purple-600">
                Free Quiz
              </Link>
              <button
                onClick={handleLoginClick}
                className="shrink-0 px-4 py-2 bg-purple-600 text-white rounded-full shadow text-sm sm:text-base"
              >
                Login
              </button>
            </>
          )}

          {isAuthenticated && (
            <>
              <Link className="text-sm sm:text-base" to="/dashboard">Dashboard</Link>
              <Link className="text-sm sm:text-base" to="/lessons">Lessons</Link>
              <Link className="text-sm sm:text-base" to="/practice">Practice</Link>
              <Link className="text-sm sm:text-base" to="/leaderboard">Leaderboard</Link>

              <Link
                to="/paywall"
                className="shrink-0 px-4 py-2 bg-yellow-400 text-black rounded-full font-semibold text-sm sm:text-base"
              >
                Upgrade
              </Link>

              {isAdmin && <Link className="text-sm sm:text-base" to="/admin">Admin</Link>}

              <button
                onClick={handleLogoutClick}
                className="shrink-0 px-4 py-2 bg-gray-800 text-white rounded-full shadow text-sm sm:text-base"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  </nav>
);
} 
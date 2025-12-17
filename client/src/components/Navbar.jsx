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
    <nav className="flex items-center justify-between px-6 py-4 shadow-sm bg-white">
      {/* Logo */}
      <Link to="/" className="text-2xl font-bold text-purple-700">
        FluencyJet <span className="font-normal">Sentence Master</span>
      </Link>

      {/* Navigation */}
      <div className="flex gap-6 text-lg items-center">
        {!isAuthenticated && (
          <>
            <Link to="/practice" className="hover:text-purple-600">
              Free Quiz
            </Link>
            <button
              onClick={handleLoginClick}
              className="px-4 py-2 bg-purple-600 text-white rounded-full shadow"
            >
              Login
            </button>
          </>
        )}

        {isAuthenticated && (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/lessons">Lessons</Link>
            <Link to="/practice">Practice</Link>
            <Link to="/leaderboard">Leaderboard</Link>

            {/* Upgrade CTA (launch-safe even if paywall is removed) */}
            <Link
              to="/paywall"
              className="px-4 py-2 bg-yellow-400 text-black rounded-full font-semibold"
            >
              Upgrade
            </Link>

            {isAdmin && <Link to="/admin">Admin</Link>}

            <button
              onClick={handleLogoutClick}
              className="px-4 py-2 bg-gray-800 text-white rounded-full shadow"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

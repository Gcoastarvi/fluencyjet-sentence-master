import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        FluencyJet Sentence Master
      </Link>

      <div className="nav-links">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/lessons">Lessons</Link>
        <Link to="/leaderboard">Leaderboard</Link>
        <Link to="/typing-quiz">Typing Quiz</Link>
        <Link to="/practice">Practice</Link>
        <Link to="/paywall">Paywall</Link>

        {/* Show Admin link only if user is admin */}
        {user?.isAdmin && <Link to="/admin">Admin</Link>}

        {/* Authentication area */}
        {user ? (
          <>
            <span>Welcome, {user.name}</span>
            <button onClick={logout} className="logout-btn">
              Logout
            </button>
          </>
        ) : (
          <Link to="/login">Login</Link>
        )}
      </div>
    </nav>
  );
}

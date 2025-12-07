import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="nav-left">
        <Link to="/" className="logo">
          FluencyJet Sentence Master
        </Link>
      </div>

      <div className="nav-links">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/lessons">Lessons</Link>
        <Link to="/leaderboard">Leaderboard</Link>
        <Link to="/typing-quiz">Typing Quiz</Link>
        <Link to="/practice">Practice</Link>
        <Link to="/paywall">Paywall</Link>

        {user?.isAdmin && (
          <Link to="/admin">Admin</Link>
        )}
      </div>

      <div className="nav-right">
        {user ? (
          <button onClick={logout} className="logout-btn">Logout</button>
        ) : (
          <Link to="/login" className="login-btn">Login</Link>
        )}
      </div>
    </nav>
  );
}

import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="w-full bg-white shadow px-6 py-3 flex items-center justify-between">
      <Link to="/" className="text-xl font-bold text-purple-600">
        FluencyJet Sentence Master
      </Link>

      <div className="flex gap-6 text-gray-700">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/lessons">Lessons</Link>
        <Link to="/leaderboard">Leaderboard</Link>
        <Link to="/typing-quiz">Typing Quiz</Link>
        <Link to="/practice">Practice</Link>
        <Link to="/paywall">Paywall</Link>
        <Link to="/admin">Admin</Link>
        <Link to="/login" className="font-semibold text-purple-700">
          Login
        </Link>
      </div>
    </nav>
  );
}

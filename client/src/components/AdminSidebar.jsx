// client/src/components/AdminSidebar.jsx
import { NavLink, useNavigate } from "react-router-dom";

export default function AdminSidebar() {
  const navigate = useNavigate();

  const linkStyle =
    "block px-6 py-3 rounded-md font-medium text-gray-700 hover:bg-gray-200";
  const activeStyle =
    "block px-6 py-3 rounded-md font-semibold bg-purple-600 text-white";

  function handleAdminLogout() {
    localStorage.removeItem("fj_admin_token");
    navigate("/admin/login");
  }

  return (
    <aside className="w-64 bg-white shadow-md border-r h-screen flex flex-col">
      <div className="p-6 text-2xl font-bold text-purple-600">Admin Panel</div>

      <nav className="mt-4 space-y-1 flex-1">
        <NavLink
          to="/admin"
          end
          className={({ isActive }) => (isActive ? activeStyle : linkStyle)}
        >
          Dashboard
        </NavLink>

        <NavLink
          to="/admin/users"
          className={({ isActive }) => (isActive ? activeStyle : linkStyle)}
        >
          Users
        </NavLink>

        <NavLink
          to="/admin/quizzes"
          className={({ isActive }) => (isActive ? activeStyle : linkStyle)}
        >
          Quizzes
        </NavLink>

        <NavLink
          to="/admin/xp"
          className={({ isActive }) => (isActive ? activeStyle : linkStyle)}
        >
          XP Logs
        </NavLink>
      </nav>

      <div className="p-6 border-t">
        <button
          onClick={handleAdminLogout}
          className="w-full py-2 rounded-md border border-red-500 text-red-600 font-semibold hover:bg-red-50 transition"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}

import { NavLink } from "react-router-dom";

export default function AdminSidebar() {
  const linkStyle =
    "block px-6 py-3 rounded-md font-medium text-gray-700 hover:bg-gray-200";
  const activeStyle =
    "block px-6 py-3 rounded-md font-semibold bg-purple-600 text-white";

  return (
    <aside className="w-64 bg-white shadow-md border-r h-screen">
      <div className="p-6 text-2xl font-bold text-purple-600">Admin Panel</div>

      <nav className="mt-4 space-y-1">
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
    </aside>
  );
}

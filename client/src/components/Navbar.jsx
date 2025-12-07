import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  const closeMenu = () => setIsOpen(false);

  const navLinkClass = ({ isActive }) =>
    isActive ? "nav-link nav-link-active" : "nav-link";

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/dashboard" className="logo" onClick={closeMenu}>
          <span className="logo-primary">FluencyJet</span>{" "}
          <span className="logo-secondary">Sentence Master</span>
        </Link>

        {/* Hamburger (mobile) */}
        <button
          className="nav-toggle"
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-label="Toggle navigation"
        >
          <span />
          <span />
          <span />
        </button>

        {/* Links */}
        <nav className={`nav-items ${isOpen ? "nav-open" : ""}`}>
          <div className="nav-links">
            <NavLink
              to="/dashboard"
              className={navLinkClass}
              onClick={closeMenu}
            >
              Dashboard
            </NavLink>
            <NavLink to="/lessons" className={navLinkClass} onClick={closeMenu}>
              Lessons
            </NavLink>
            <NavLink
              to="/leaderboard"
              className={navLinkClass}
              onClick={closeMenu}
            >
              Leaderboard
            </NavLink>
            <NavLink
              to="/typing-quiz"
              className={navLinkClass}
              onClick={closeMenu}
            >
              Typing Quiz
            </NavLink>
            <NavLink
              to="/practice"
              className={navLinkClass}
              onClick={closeMenu}
            >
              Practice
            </NavLink>
            <NavLink to="/paywall" className={navLinkClass} onClick={closeMenu}>
              Paywall
            </NavLink>
            <NavLink to="/admin" className={navLinkClass} onClick={closeMenu}>
              Admin
            </NavLink>
          </div>

          <div className="nav-actions">
            {user ? (
              <>
                <span className="nav-user-label">
                  {user.name || user.email || "Learner"}
                </span>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="btn btn-primary btn-small"
                onClick={closeMenu}
              >
                Login
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

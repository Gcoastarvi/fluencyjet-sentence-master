import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

// IMPORTANT: change this to match your real token key, see note below.
const AUTH_TOKEN_KEY = "token"; // or "accessToken" / "authToken" etc.

export default function Navbar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  // Hide navbar on admin login page
  if (location.pathname.startsWith("/admin/login")) {
    return null;
  }

  // helper: check login status from localStorage
  const checkLoggedIn = () => {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      setLoggedIn(!!token);
    } catch {
      setLoggedIn(false);
    }
  };

  // On first load
  useEffect(() => {
    checkLoggedIn();
  }, []);

  // When route changes: close mobile menu + recheck login
  useEffect(() => {
    setIsOpen(false);
    checkLoggedIn();
  }, [location.pathname]);

  // Also respond if localStorage is changed from another tab
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === AUTH_TOKEN_KEY) {
        setLoggedIn(!!e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleLogout = () => {
    try {
      // remove the token (and add more keys if you use them)
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // ignore
    }
    setLoggedIn(false);
    window.location.href = "/login";
  };

  return (
    <header className="fj-nav-wrapper">
      <nav className="fj-navbar">
        {/* Brand */}
        <Link to="/" className="fj-navbar-logo">
          <span className="fj-brand-main">FluencyJet</span>{" "}
          <span className="fj-brand-sub">Sentence Master</span>
        </Link>

        {/* Mobile hamburger */}
        <button
          className="fj-navbar-toggle"
          onClick={() => setIsOpen((o) => !o)}
          aria-label="Toggle navigation"
        >
          <span />
          <span />
        </button>

        {/* Links */}
        <div className={`fj-navbar-links ${isOpen ? "fj-open" : ""}`}>
          <Link to="/dashboard" className="fj-nav-link">
            Dashboard
          </Link>
          <Link to="/lessons" className="fj-nav-link">
            Lessons
          </Link>
          <Link to="/leaderboard" className="fj-nav-link">
            Leaderboard
          </Link>
          <Link to="/typing-quiz" className="fj-nav-link">
            Typing Quiz
          </Link>
          <Link to="/practice" className="fj-nav-link">
            Practice
          </Link>
          <Link to="/paywall" className="fj-nav-link">
            Paywall
          </Link>
          <Link to="/admin" className="fj-nav-link">
            Admin
          </Link>

          {/* Right side: Login / Logout */}
          {!loggedIn ? (
            <Link to="/login" className="fj-nav-cta">
              Login
            </Link>
          ) : (
            <button
              type="button"
              className="fj-nav-cta fj-nav-logout"
              onClick={handleLogout}
            >
              Logout
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}

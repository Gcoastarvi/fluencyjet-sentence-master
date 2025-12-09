// client/src/context/AuthContext.jsx

import { createContext, useContext, useState, useEffect } from "react";
import jwtDecode from "jwt-decode";

// -------------------------
// CONTEXT + HOOK
// -------------------------
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

// -------------------------
// PROVIDER (named + default export)
// -------------------------
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Decode and store user from token
  function decodeAndSetUser(token) {
    try {
      const decoded = jwtDecode(token);
      setUser(decoded);
    } catch (err) {
      console.error("Token decode failed:", err);
      setUser(null);
    }
  }

  // Hydrate from localStorage on first load
  useEffect(() => {
    const token = localStorage.getItem("fj_token");
    if (token) decodeAndSetUser(token);
    setLoading(false);
  }, []);

  // Login function
  async function login(email, password) {
    try {
      const API_BASE =
        import.meta.env.VITE_API_BASE_URL ||
        "https://fluencyjet-sentence-master-production-de09.up.railway.app/api";

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const raw = await res.text();
      let data;

      try {
        data = JSON.parse(raw);
      } catch (e) {
        console.error("NON-JSON LOGIN RESPONSE:", raw);
        return false;
      }

      if (!res.ok || !data.token) {
        console.error("Login failed:", data);
        return false;
      }

      localStorage.setItem("fj_token", data.token);
      decodeAndSetUser(data.token);

      return true;
    } catch (err) {
      console.error("Login request failed:", err);
      return false;
    }
  }

  // Logout function
  function logout() {
    localStorage.removeItem("fj_token");
    setUser(null);
  }

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Also export as default so existing imports still work
export default AuthProvider;

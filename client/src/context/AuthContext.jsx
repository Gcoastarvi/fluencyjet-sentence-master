// client/src/context/AuthContext.jsx

import { createContext, useContext, useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";

// -------------------------
// CONTEXT + HOOK
// -------------------------
const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

// -------------------------
// PROVIDER
// -------------------------
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // -------------------------
  // Decode and restore user
  // -------------------------
  function decodeAndSetUser(token) {
    try {
      const decoded = jwtDecode(token);
      setUser(decoded);
    } catch (err) {
      console.error("Token decode failed:", err);
      setUser(null);
    }
  }

  // -------------------------
  // Hydrate token on load
  // -------------------------
  useEffect(() => {
    const token = localStorage.getItem("fj_token");
    if (token) decodeAndSetUser(token);
    setLoading(false);
  }, []);

  // -------------------------
  // LOGIN FUNCTION
  // -------------------------
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

  // -------------------------
  // LOGOUT FUNCTION
  // -------------------------
  function logout() {
    localStorage.removeItem("fj_token");
    setUser(null);
  }

  // -------------------------
  // EXPORT VALUES
  // -------------------------
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

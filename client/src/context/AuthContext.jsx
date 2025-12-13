// client/src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { loginUser } from "../api/apiClient";

const AuthContext = createContext(null);

function decodeUserFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    return payload; // { id, iat, exp, ... }
  } catch (err) {
    console.error("Failed to decode JWT payload", err);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔁 Load token on app start
  useEffect(() => {
    const stored = localStorage.getItem("fj_token");
    if (stored) {
      setToken(stored);
      setUser(decodeUserFromToken(stored));
    }
    setLoading(false);
  }, []);

  // 🔐 Unified login used by ALL student login flows
  async function login(email, password) {
    try {
      const data = await loginUser({ email, password });
      if (!data?.token) {
        console.error("Login success but no token in response:", data);
        return false;
      }

      localStorage.setItem("fj_token", data.token);
      setToken(data.token);
      setUser(decodeUserFromToken(data.token));

      return true;
    } catch (err) {
      console.error("Login request failed:", err);
      return false;
    }
  }

  function logout() {
    localStorage.removeItem("fj_token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // Hydrate from localStorage on first load
  useEffect(() => {
    try {
      const raw = localStorage.getItem("fj_user");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setUser(parsed);
      }
    } catch (err) {
      console.error("Failed to read user from localStorage", err);
    }
  }, []);

  const login = (userData, token) => {
    setUser(userData);
    try {
      localStorage.setItem("fj_user", JSON.stringify(userData));
      if (token) {
        localStorage.setItem("token", token);
      }
    } catch (err) {
      console.error("Failed to persist auth state", err);
    }
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem("fj_user");
      localStorage.removeItem("token");
    } catch (err) {
      console.error("Failed to clear auth state", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
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

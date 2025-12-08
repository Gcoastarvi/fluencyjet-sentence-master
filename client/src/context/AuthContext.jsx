import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null); // decoded payload (id, email, etc.)
  const [loading, setLoading] = useState(true);

  // ---- Helper: decode + basic validation (exp) ----
  function decodeAndSetUser(jwt) {
    try {
      const parts = jwt.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid JWT structure");
      }

      const payloadJson = atob(parts[1]);
      const payload = JSON.parse(payloadJson);

      // Optional exp check (standard JWT exp in seconds)
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        throw new Error("Token expired");
      }

      setToken(jwt);
      setUser(payload);
    } catch (err) {
      console.error("Failed to decode/validate JWT", err);
      // If anything goes wrong, treat as logged-out
      localStorage.removeItem("fj_token");
      setToken(null);
      setUser(null);
    }
  }

  // ---- Initial hydration on app load ----
  useEffect(() => {
    const saved = localStorage.getItem("fj_token");
    if (saved) {
      decodeAndSetUser(saved);
    } else {
      setToken(null);
      setUser(null);
    }
    setLoading(false);
  }, []);

  // ---- Public: login used by popup + (historically) route login ----
  async function login(email, password) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.token) {
        console.error("Login failed:", data);
        return false;
      }

      localStorage.setItem("fj_token", data.token);
      decodeAndSetUser(data.token);
      return true;
    } catch (err) {
      console.error("Login request failed", err);
      return false;
    }
  }

  // ---- Public: logout ----
  function logout() {
    localStorage.removeItem("fj_token");
    setToken(null);
    setUser(null);
  }

  // ---- Public: helper if some external code writes fj_token manually ----
  function hydrateFromStorage() {
    const saved = localStorage.getItem("fj_token");
    if (saved) {
      decodeAndSetUser(saved);
    } else {
      logout();
    }
  }

  const value = {
    token,
    user,
    loading,
    login,
    logout,
    hydrateFromStorage,
    isAuthenticated: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

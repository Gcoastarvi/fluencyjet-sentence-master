import { createContext, useContext, useEffect, useState } from "react";
import { loginUser, signupUser, me } from "../api/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(
    () => localStorage.getItem("token") || null,
  );
  const [loading, setLoading] = useState(true);

  // 🔐 Fetch user ONLY when token exists
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await me(token);

        if (res?.ok && res.user) {
          setUser(res.user);
        } else {
          logout();
        }
      } catch (err) {
        console.error("Auth check failed", err);
        logout();
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [token]);

  async function login(email, password) {
    const res = await loginUser({ email, password });

    if (res.ok && res.token) {
      localStorage.setItem("token", res.token);
      setToken(res.token); // 🔑 triggers useEffect AFTER token exists
      return { ok: true };
    }

    return { ok: false, message: res.message };
  }

  async function signup(name, email, password) {
    const res = await signupUser({ name, email, password });

    if (res.ok && res.token) {
      localStorage.setItem("token", res.token);
      setToken(res.token);
      return { ok: true };
    }

    return { ok: false, message: res.message };
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        signup,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

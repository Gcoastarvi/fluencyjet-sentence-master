import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginUser, getMe } from "@/api/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  // ✅ SESSION HYDRATION (restore login on refresh)
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await getMe();
      if (cancelled) return;

      if (res?.ok) {
        setUser({
          email: res.data.email,
          plan: res.data.plan || "FREE",
        });
      } else {
        localStorage.removeItem("token");
        setUser(null);
      }

      setLoading(false);
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  function persist(nextToken, nextUser) {
    if (nextToken) localStorage.setItem("token", nextToken);
    else localStorage.removeItem("token");

    if (nextUser) localStorage.setItem("user", JSON.stringify(nextUser));
    else localStorage.removeItem("user");
  }

  function logout() {
    setToken("");
    setUser(null);
    persist("", null);
  }

  const login = async (email, password) => {
    const res = await loginUser(email, password);

    if (!res?.ok || !res?.data?.token) {
      throw new Error(res?.data?.message || "Login failed");
    }

    const nextUser = {
      email: res.data.email,
      plan: res.data.plan || "FREE",
    };

    setToken(res.data.token);
    setUser(nextUser);

    localStorage.setItem("token", res.data.token);
    localStorage.setItem("user", JSON.stringify(nextUser));

    return res;
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: !!user, // ✅ ADD THIS
      login,
      logout,
      setUser,
      setToken,
    }),
    [token, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

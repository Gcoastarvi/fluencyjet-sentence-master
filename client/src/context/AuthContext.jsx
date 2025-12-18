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

  async function login(email, password) {
    const res = await loginUser(email, password);

    if (!res?.ok || !res?.token) {
      throw new Error(res?.message || "Login failed");
    }

    const nextUser = res.user || {
      email: res.email,
      plan: res.plan || "FREE",
    };

    setToken(res.token);
    setUser(nextUser);
    persist(res.token, nextUser);

    return res;
  }

  // ✅ RESTORE SESSION (THIS WAS BROKEN EARLIER)
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const storedToken = localStorage.getItem("token");
        if (!storedToken) {
          if (!cancelled) setLoading(false);
          return;
        }

        const me = await getMe();
        if (!cancelled && me?.ok && me?.user) {
          setToken(storedToken);
          setUser(me.user);
          persist(storedToken, me.user);
        } else {
          logout();
        }
      } catch {
        logout();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

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

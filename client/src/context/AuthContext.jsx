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

    const token = res?.data?.token;
    if (!res?.ok || !token) {
      throw new Error(res?.data?.message || "Login failed");
    }

    // token already stored by apiClient, but keeping it safe:
    localStorage.setItem("token", token);

    setUser({
      email: res.data.email,
      plan: res.data.plan || "FREE",
    });

    return res;
  };

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

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginUser, getMe } from "@/api/apiClient";

const AuthContext = createContext(null);

/**
 * Normalize API responses because different callers may return:
 * 1) { ok: true, data: { token, email, plan } }
 * 2) { ok: true, token, email, plan }
 * 3) { ok: true, data: { ok, token, email, plan } }  (double-wrapped)
 */
function pickPayload(res) {
  if (!res) return { ok: false, data: null, message: "No response" };

  // If res.data exists, prefer it as payload
  const p1 = res.data && typeof res.data === "object" ? res.data : null;

  // Sometimes data itself contains { ok, token, ... }
  const p2 =
    p1 && typeof p1.data === "object" && p1.data !== null ? p1.data : null;

  const payload = p2 || p1 || res;

  const ok =
    typeof res.ok === "boolean"
      ? res.ok
      : typeof payload.ok === "boolean"
        ? payload.ok
        : true;

  const message =
    payload.message || res.message || (ok ? "" : "Request failed");

  return { ok, data: payload, message };
}

function safeJsonParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(() =>
    safeJsonParse(localStorage.getItem("user")),
  );
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

  // ✅ SESSION HYDRATION (restore login on refresh)
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const storedToken = localStorage.getItem("token");
      if (!storedToken) {
        if (!cancelled) setLoading(false);
        return;
      }

      // Keep state token aligned with localStorage
      setToken(storedToken);

      const res = await getMe();
      const { ok, data } = pickPayload(res);

      if (cancelled) return;

      if (ok && data?.email) {
        const nextUser = {
          email: data.email,
          plan: data.plan || "FREE",
        };
        setUser(nextUser);
        persist(storedToken, nextUser);
      } else {
        // invalid/expired token
        logout();
      }

      setLoading(false);
    }

    hydrate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    const res = await loginUser(email, password);
    const { ok, data, message } = pickPayload(res);

    // Accept token from multiple shapes
    const nextToken =
      data?.token || data?.accessToken || res?.token || res?.accessToken || "";

    if (!ok || !nextToken) {
      throw new Error(message || "Login failed");
    }

    const nextUser = {
      email: data?.email || email,
      plan: data?.plan || "FREE",
    };

    setToken(nextToken);
    setUser(nextUser);
    persist(nextToken, nextUser);

    return res;
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: !!token && !!user,
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

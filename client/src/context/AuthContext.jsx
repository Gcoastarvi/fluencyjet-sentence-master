// client/src/context/AuthContext.jsx
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

    restoreSession();
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

  // ✅ Keep OLD signature support: login(email, password) returns backend response
  async function login(email, password) {
    const res = await loginUser(email, password); // expects { ok:true, token, user?/email/plan... }
    if (!res?.ok || !res?.token)
      throw new Error(res?.message || "Login failed");

    const nextUser = res.user || { email: res.email, plan: res.plan || "FREE" };

    setToken(res.token);
    setUser(nextUser);
    persist(res.token, nextUser);

    return res;
  }

  // ✅ Restore session on refresh
  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem("token");
        if (!stored) {
          setLoading(false);
          return;
        }

        // validate token + get latest plan
        const me = await getMe(); // must succeed if token valid
        if (me?.ok && me?.user) {
          setToken(stored);
          setUser(me.user);
          persist(stored, me.user);
        } else {
          logout();
        }
      } catch (e) {
        logout();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ token, user, loading, login, logout, setUser, setToken }),
    [token, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

// client/src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginUser, me as meApi } from "../api/apiClient"; // ✅ correct path

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { email, plan }
  const [token, setToken] = useState(null); // jwt string
  const [loading, setLoading] = useState(true);

  // Boot session from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (!savedToken) {
      setLoading(false);
      return;
    }

    // ✅ me() reads token from localStorage (apiClient adds Authorization header)
    meApi()
      .then((res) => {
        // res should look like: { ok:true, email, plan }
        if (res?.ok) {
          setToken(savedToken);
          setUser({ email: res.email, plan: res.plan || "FREE" });
        } else {
          localStorage.removeItem("token");
          setToken(null);
          setUser(null);
        }
      })
      .catch(() => {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    try {
      const res = await loginUser({ email, password });
      if (!res?.ok || !res?.token) return { ok: false };

      localStorage.setItem("token", res.token);
      setToken(res.token);
      setUser({ email: res.email, plan: res.plan || "FREE" });

      return { ok: true };
    } catch (err) {
      console.error("Login failed", err);
      return { ok: false };
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
    setToken(null);
  }

  // ✅ Needed for Paywall.jsx (you currently do const { plan, setPlan } = useAuth())
  const plan = user?.plan || "FREE";
  const setPlan = (nextPlan) =>
    setUser((u) =>
      u ? { ...u, plan: nextPlan } : { email: "", plan: nextPlan },
    );

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      isAuthenticated: !!user,
      plan,
      setPlan,
    }),
    [user, token, loading, plan],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

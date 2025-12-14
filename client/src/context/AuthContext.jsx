// client/src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { loginUser, me } from "../api/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("FREE");
  const [xpCapReached, setXpCapReached] = useState(false);

  // 🔁 Load token on app start (SERVER-VERIFIED)
  useEffect(() => {
    async function initAuth() {
      const storedToken = localStorage.getItem("fj_token");

      if (!storedToken) {
        setLoading(false);
        return;
      }

      setToken(storedToken);

      try {
        const data = await me(storedToken); // 🔐 server verification
        setUser(data.user);
        // Sync plan from server user if available
        if (data.user?.plan || data.user?.tier_level) {
          const serverPlan = data.user.plan || data.user.tier_level;
          setPlan(serverPlan);
          localStorage.setItem("fj_plan", serverPlan);
        }
      } catch (err) {
        console.error("Auth hydration failed, clearing token:", err);
        localStorage.removeItem("fj_token");
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    const storedPlan = localStorage.getItem("fj_plan");
    if (storedPlan) {
      setPlan(storedPlan);
    }

    initAuth();
  }, []);

  // 🔐 Login (used by Login.jsx)
  async function login(email, password) {
    try {
      const data = await loginUser({ email, password });

      if (!data?.token) {
        console.error("Login succeeded but token missing:", data);
        return false;
      }

      localStorage.setItem("fj_token", data.token);
      setToken(data.token);

      // immediately hydrate user from server
      const meData = await me(data.token);
      setUser(meData.user);
      // Sync plan from server user if available
      if (meData.user?.plan || meData.user?.tier_level) {
        const serverPlan = meData.user.plan || meData.user.tier_level;
        setPlan(serverPlan);
        localStorage.setItem("fj_plan", serverPlan);
      }

      return true;
    } catch (err) {
      console.error("Login failed:", err);
      return false;
    }
  }

  function logout() {
    localStorage.removeItem("fj_token");
    localStorage.removeItem("fj_plan");
    setToken(null);
    setUser(null);
    setPlan("FREE");
    setXpCapReached(false);
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        plan,
        setPlan,
        loading,
        login,
        logout,
        isAuthenticated: !!token,
        xpCapReached,
        setXpCapReached,
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

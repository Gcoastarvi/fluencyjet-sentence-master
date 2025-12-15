import { createContext, useContext, useEffect, useState } from "react";
import { loginUser, me } from "../api/apiClient";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  // Restore session
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (!savedToken) {
      setLoading(false);
      return;
    }

    me(savedToken)
      .then((res) => {
        if (res.ok) {
          setUser(res);
          setToken(savedToken);
        } else {
          localStorage.removeItem("token");
        }
      })
      .catch(() => {
        localStorage.removeItem("token");
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    try {
      const res = await loginUser({ email, password });

      if (!res.ok || !res.token) {
        return { ok: false };
      }

      localStorage.setItem("token", res.token);
      setToken(res.token);
      setUser({
        email: res.email,
        plan: res.plan,
      });

      navigate("/dashboard"); // 🔑 REQUIRED
      return { ok: true };
    } catch (err) {
      console.error("AuthContext login error:", err);
      return { ok: false };
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
    setToken(null);
    navigate("/login");
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        loading,
        isAuthenticated: !!user,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

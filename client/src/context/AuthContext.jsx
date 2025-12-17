import { createContext, useContext, useEffect, useState } from "react";
import api from "@/api/apiClient";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    getMe()
      .then((res) => {
        if (res?.ok === false) {
          setUser(null);
        } else {
          setUser(res.user || res);
        }
      })
      .catch(() => {
        // IMPORTANT: do NOT redirect here
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const logout = () => {
    localStorage.removeItem("fj_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

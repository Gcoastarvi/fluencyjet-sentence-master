// client/src/components/ProtectedAdminRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiFetchWithAuth } from "@/utils/fetch";

export default function ProtectedAdminRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    async function checkRole() {
      try {
        const res = await apiFetchWithAuth("/api/auth/me");

        if (res.ok && res.user?.role === "admin") {
          setAllowed(true);
        }
      } catch (err) {
        console.error("Admin check failed", err);
      }
      setLoading(false);
    }
    checkRole();
  }, []);

  if (loading)
    return <div className="p-6 text-center">Checking admin access…</div>;

  if (!allowed) return <Navigate to="/dashboard" replace />;

  return children;
}

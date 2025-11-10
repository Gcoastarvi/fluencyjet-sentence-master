// client/src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";

/**
 * ✅ ProtectedRoute Component
 * Ensures only authenticated users can access secure routes.
 * Redirects to /login if no valid token is found.
 */
export default function ProtectedRoute({ children }) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

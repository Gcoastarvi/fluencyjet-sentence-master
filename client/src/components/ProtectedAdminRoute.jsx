// client/src/components/ProtectedAdminRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedAdminRoute({ children }) {
  const token = localStorage.getItem("fj_admin_token");

  return token ? children : <Navigate to="/admin/login" replace />;
}

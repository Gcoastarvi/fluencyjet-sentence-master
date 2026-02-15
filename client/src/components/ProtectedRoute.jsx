// client/src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { getToken } from "@/utils/tokenStore";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = getToken();

  if (!token) {
    const next = `${location.pathname}${location.search || ""}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return children;
}

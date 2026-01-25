// client/src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

navigate(
  `/login?next=${encodeURIComponent(location.pathname + location.search)}`,
  { replace: true },
);

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null; // or a loader

  if (!user) return <Navigate to="/login" replace />;

  return children;
}

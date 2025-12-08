import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  const location = useLocation();

  // Still hydrating auth state
  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  // Source of truth: context token, with localStorage as a safety net
  const storedToken = token || localStorage.getItem("fj_token");

  if (!storedToken) {
    // Not authenticated → go to login route
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }} // so we can redirect back after login
      />
    );
  }

  // Authenticated → allow access
  return children;
}

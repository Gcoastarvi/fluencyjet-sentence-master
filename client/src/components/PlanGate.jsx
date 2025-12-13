// client/src/components/PlanGate.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PlanGate({ required = "PRO", children }) {
  const { plan, loading } = useAuth();

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  const allowed = plan === "LIFETIME" || plan === required;

  if (!allowed) {
    return <Navigate to="/paywall" replace />;
  }

  return children;
}

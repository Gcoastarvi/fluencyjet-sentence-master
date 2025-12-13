// client/src/components/PlanGate.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PlanGate({ required = "PRO", children }) {
  const { user } = useAuth();

  // Assume FREE if not set
  const plan = user?.plan || "FREE";

  const allowed = plan === "LIFETIME" || plan === required;

  if (!allowed) {
    return <Navigate to="/paywall" replace />;
  }

  return children;
}

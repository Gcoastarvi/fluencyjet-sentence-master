import { useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";

export default function Login() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If already logged in, go straight to dashboard (or original target)
  useEffect(() => {
    if (isAuthenticated) {
      const redirectTo = location.state?.from?.pathname || "/dashboard";
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, location, navigate]);

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      <p className="mb-4 text-lg">
        We&apos;ve moved to a single, easy login method.
      </p>
      <p className="mb-6">
        Please use the <strong>Login</strong> button at the top-right corner of
        this page to sign in. It will open the FluencyJet login popup and, once
        you&apos;re logged in, you can access your{" "}
        <strong>Dashboard, Lessons, Leaderboard</strong>, and all other pages.
      </p>

      <button
        onClick={() => navigate("/")}
        className="px-4 py-2 bg-purple-600 text-white rounded shadow"
      >
        Go to Home
      </button>
    </div>
  );
}

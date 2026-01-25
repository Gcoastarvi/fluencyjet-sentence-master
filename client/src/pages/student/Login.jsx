import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const navigate = useNavigate(); // ✅ DEFINE IT
  const { login } = useAuth();
  const [searchParams] = useSearchParams();

  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") || "/dashboard";
  navigate(next, { replace: true });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await login(email.trim(), password);

      if (!res?.ok) {
        setError("Invalid email or password");
        return;
      }

      // ✅ SUCCESS → redirect
      navigate("/dashboard");
    } catch (err) {
      console.error("Login failed", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <h2 className="title">Student Login</h2>

      <form onSubmit={handleSubmit} noValidate>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="error-text">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

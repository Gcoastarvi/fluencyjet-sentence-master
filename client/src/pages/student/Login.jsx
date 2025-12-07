import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiClient.post("/auth/login", form);
      const { token, user } = res.data;

      login(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
        },
        token,
      );

      navigate("/dashboard");
    } catch (err) {
      console.error("Login failed", err);
      const msg =
        err?.response?.data?.message ||
        "Login failed. Please check your email and password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Login to FluencyJet</h1>
        <p className="auth-subtitle">
          Welcome back! Enter your details to continue your fluency journey.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-label">
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="auth-input"
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="auth-label">
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="auth-input"
              placeholder="••••••••"
              required
            />
          </label>

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="auth-footer">
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="auth-link">
            Create one now
          </Link>
        </p>
      </div>
    </div>
  );
}

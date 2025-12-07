import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/apiClient";

export default function AdminLogin() {
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
      const res = await apiClient.post("/admin/auth/login", form);
      const { token } = res.data;

      localStorage.setItem("adminToken", token);
      navigate("/admin/dashboard");
    } catch (err) {
      console.error("Admin login failed", err);
      const msg =
        err?.response?.data?.message || "Invalid admin credentials.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Admin Login</h1>

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
              placeholder="admin@example.com"
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
      </div>
    </div>
  );
}

// client/src/pages/student/Login.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../../api/apiClient";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const response = await loginUser(email, password);

      if (!response?.token) {
        setError(response.message || "Invalid credentials");
        return;
      }

      // Save token
      localStorage.setItem("token", response.token);

      navigate("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="container">
      <h2 className="title">Student Login</h2>

      <form onSubmit={handleSubmit} className="form">
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn">
          Login
        </button>
      </form>
    </div>
  );
}

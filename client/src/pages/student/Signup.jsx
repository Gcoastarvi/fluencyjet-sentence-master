// client/src/pages/student/Signup.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signupUser } from "../../api/apiClient";

export default function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const res = await signupUser({ name, email, password });

      if (!res?.ok) {
        setError(res.message || "Signup failed");
        return;
      }

      navigate("/login");
    } catch (err) {
      console.error("Signup error:", err);
      setError(err.message || "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="container">
      <h2 className="title">Create Account</h2>

      <form onSubmit={handleSubmit} className="form">
        <label>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />

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
          Sign Up
        </button>
      </form>
    </div>
  );
}

import { useState } from "react";
import { loginUser } from "../../api/apiClient";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await loginUser({ email, password });

      if (!res.ok) {
        setError(res.message || "Invalid credentials");
        return;
      }

      setToken(res.token);
      setUser(res.user);

      navigate("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError("Something went wrong");
    }
  };

  return (
    <div className="login-container">
      <h2>Student Login</h2>

      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p style={{ color: "red" }}>{error}</p>}

        <button type="submit">Login</button>
      </form>
    </div>
  );
}

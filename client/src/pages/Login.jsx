import React, { useState } from "react";
import { loginUser } from "../api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    try {
      const response = await loginUser({ email, password });
      console.log("Logged in:", response.data);
      setMessage("✅ Login successful!");

      // Optionally save token
      localStorage.setItem("token", response.data.token);

      // Redirect or show Dashboard
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Login failed:", err.response?.data || err.message);
      setMessage("❌ Login failed. Please check your credentials.");
    }
  }

  return (
    <div className="flex flex-col items-center p-6">
      <h1 className="text-2xl font-semibold mb-4">Login</h1>
      <form onSubmit={handleLogin} className="flex flex-col gap-3 w-80">
        <input
          type="email"
          placeholder="Email"
          className="border p-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="border p-2 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          Sign In
        </button>
      </form>
      {message && <p className="mt-4">{message}</p>}
    </div>
  );
}

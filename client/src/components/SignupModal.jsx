import { useState } from "react";

export default function SignupModal({ onSignup }) {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    if (data.id) {
      alert("Signup successful!");
      setShow(false);
      onSignup(data);
    } else alert("Signup failed");
  }

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="px-4 py-2 bg-indigo-600 text-white rounded-full shadow hover:scale-105 transition"
      >
        Sign Up / Login
      </button>
      {show && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl w-80 shadow-lg">
            <h2 className="text-xl font-semibold mb-3 text-center">
              Join FluencyJet
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                className="w-full border rounded p-2"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="w-full border rounded p-2"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                className="w-full border rounded p-2"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button className="w-full bg-indigo-600 text-white py-2 rounded">
                Submit
              </button>
            </form>
            <button
              onClick={() => setShow(false)}
              className="mt-3 text-sm text-gray-500 w-full"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

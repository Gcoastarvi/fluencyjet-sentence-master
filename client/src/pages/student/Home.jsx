// client/src/pages/Home.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SignupModal from "@/components/SignupModal";

export default function Home() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if a JWT token exists in localStorage
    const token = localStorage.getItem("fj_token");
    if (token) {
      // Decode basic info (optional) or mark as logged in
      setUser({ token });
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem("fj_token");
    setUser(null);
    alert("Logged out successfully!");
  }

  return (
    <div className="max-w-xl mx-auto text-center space-y-6 mt-10">
      <h1 className="text-3xl font-bold text-indigo-700">
        FluencyJet Sentence Master
      </h1>

      <p className="text-gray-600">
        Build English sentences from Tamil prompts — the fun way!
      </p>

      {/* Conditional UI */}
      {!user ? (
        <>
          {/* If no user token → show signup/login modal */}
          <SignupModal onSignup={(u) => setUser(u)} />
        </>
      ) : (
        <>
          {/* If user logged in → show dashboard + logout */}
          <div className="space-y-4">
            <p className="text-green-600 font-semibold">You’re logged in! 🎉</p>
            <Link
              to="/dashboard"
              className="block bg-violet-600 text-white py-2 rounded-full hover:scale-105 transition"
            >
              Continue to Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="block w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Logout
            </button>
          </div>
        </>
      )}
    </div>
  );
}

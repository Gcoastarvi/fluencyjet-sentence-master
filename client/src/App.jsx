import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Paywall from "@/pages/Paywall";
import Admin from "@/pages/Admin";

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-3xl mx-auto p-4">
        <header className="flex justify-between items-center mb-4">
          <Link to="/" className="font-bold text-xl text-indigo-700">
            FluencyJet Sentence Master
          </Link>
          <nav className="flex gap-3">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/paywall">Paywall</Link>
            <Link to="/admin">Admin</Link>
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/paywall" element={<Paywall />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

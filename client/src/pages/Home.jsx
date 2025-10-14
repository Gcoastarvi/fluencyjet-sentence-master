import SignupModal from "@/components/SignupModal";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="max-w-xl mx-auto text-center space-y-5 mt-10">
      <h1 className="text-3xl font-bold text-indigo-700">
        FluencyJet Sentence Master
      </h1>
      <p className="text-gray-600">
        Build English sentences from Tamil prompts — the fun way!
      </p>
      <SignupModal onSignup={() => {}} />
      <Link
        to="/dashboard"
        className="block bg-violet-600 text-white py-2 rounded-full hover:scale-105 transition"
      >
        Continue to Dashboard
      </Link>
    </div>
  );
}

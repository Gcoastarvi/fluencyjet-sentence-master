export default function Paywall() {
  return (
    <div className="max-w-md mx-auto text-center p-6">
      <h2 className="text-2xl font-bold text-indigo-700 mb-3">
        Unlock All Lessons
      </h2>
      <p className="text-gray-600 mb-6">
        Join the full course to access all sentence-building modules and daily
        XP tracking.
      </p>
      <button className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white px-6 py-3 rounded-full">
        Proceed to Payment
      </button>
    </div>
  );
}

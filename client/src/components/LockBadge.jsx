export default function LockBadge({ hasAccess }) {
  return (
    <div className="text-center mt-2">
      {hasAccess ? (
        <span className="text-green-600 font-semibold">Unlocked ✅</span>
      ) : (
        <span className="text-rose-600 font-semibold">Locked 🔒</span>
      )}
    </div>
  );
}

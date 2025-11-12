export function getDisplayName(user) {
  if (!user) {
    const lsName = localStorage.getItem("userName");
    return lsName || "Learner";
  }
  return (
    user.name || user.username || localStorage.getItem("userName") || "Learner"
  );
}

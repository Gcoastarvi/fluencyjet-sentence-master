export function getMemoryScoreBand(score, isAdvanced = false) {
  if (score === null || score === undefined || score === "") return null;
  const value = Number(score);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;

  const bridge = isAdvanced
    ? "Your score shows WHERE you are. Now see HOW to improve it."
    : "Your score shows WHERE your child is. Now see HOW to improve it.";

  if (value < 40) {
    return {
      title: "NEEDS A BOOST",
      message: isAdvanced
        ? "You are studying, but too much is getting forgotten before it is needed. The good news: memory can be trained."
        : "Your child is studying, but too much is getting forgotten before it is needed. The good news: memory can be trained.",
      bridge,
    };
  }
  if (value < 70) {
    return {
      title: "GOOD START",
      message: isAdvanced
        ? "Some things are sticking. Some are getting lost. With the right memory method, you can remember more and recall it faster."
        : "Some things are sticking. Some are getting lost. With the right memory method, your child can remember more and recall it faster.",
      bridge,
    };
  }
  return {
    title: "STRONG START",
    message: isAdvanced
      ? "You already have a strong start. Now the goal is to make memory faster, stronger and more reliable for tests and exams."
      : "Your child already has a strong start. Now the goal is to make memory faster, stronger and more reliable for tests and exams.",
    bridge,
  };
}

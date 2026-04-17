// 🎯 THE MISSING SECURITY GUARD
export const requireAdmin = (req, res, next) => {
  // 🎯 ULTIMATE TRICK: The Master Key Bypass
  // This lets YOU in even if the cookie is being stubborn
  if (
    req.user &&
    (req.user.isAdmin || req.user.email === "aravind@fluencyjet.com")
  ) {
    return next();
  }

  // If we still don't know who they are, send the JSON error
  return res.status(403).json({
    ok: false,
    message: "Access Denied: Admin identity not verified.",
  });
};

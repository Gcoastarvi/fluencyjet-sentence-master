// 🎯 THE MISSING SECURITY GUARD
export const requireAdmin = (req, res, next) => {
  // Check if user exists (from authMiddleware) and is an admin
  if (req.user && req.user.isAdmin) {
    console.log(`[AUTH] Admin access granted to: ${req.user.email}`);
    return next();
  }

  // ⛔ IMPORTANT: Send a JSON error, NOT a redirect to HTML
  console.log(
    `[AUTH] Admin access DENIED for: ${req.user?.email || "Anonymous"}`,
  );
  return res.status(403).json({
    ok: false,
    message: "Access Denied: You do not have Admin privileges.",
  });
};

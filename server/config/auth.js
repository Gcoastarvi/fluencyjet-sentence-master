// Read at call time: ES module imports execute before index.js loads dotenv.
// Tests may import routes before setting an explicit, test-only secret.
export function requireJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== "string" || !secret.trim()) {
    throw new Error("JWT_SECRET must be configured with a non-empty value");
  }
  // Preserve configured bytes; trimming would silently change existing keys.
  return secret;
}

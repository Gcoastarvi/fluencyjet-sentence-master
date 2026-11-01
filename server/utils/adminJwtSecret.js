const LEGACY_FALLBACK = "fluencyjet_secret_2025";

export function getAdminJwtSecret(environment = process.env) {
  const secret = environment?.JWT_SECRET;

  if (
    typeof secret !== "string" ||
    secret.trim().length < 32 ||
    secret === LEGACY_FALLBACK
  ) {
    return null;
  }

  return secret;
}

// client/src/lib/api.js
// ✅ Centralized API base configuration
// Works both locally (Replit dev) and in Railway production

export const API_BASE =
  import.meta.env.MODE === "development"
    ? "http://localhost:8080"
    : "https://api.fluencyjet.com";

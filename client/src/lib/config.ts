// src/lib/config.js or src/lib/api.js
export const API_BASE =
  import.meta.env.MODE === "development"
    ? "http://localhost:8080"
    : "https://api.fluencyjet.com";

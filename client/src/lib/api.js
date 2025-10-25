// Central API base used everywhere in the client app
export const API_BASE =
  import.meta.env.MODE === "development"
    ? "http://localhost:8080"
    : "https://fluencyjet-sentence-master-production.up.railway.app";

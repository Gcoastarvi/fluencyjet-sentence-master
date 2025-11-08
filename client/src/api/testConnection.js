import apiClient from "./apiClient";

export const testHealth = async () => {
  try {
    const res = await apiClient.get("/api/health");
    console.log("✅ Backend Connected:", res.data);
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
  }
};

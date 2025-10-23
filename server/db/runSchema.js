import dotenv from "dotenv";
import pool from "./index.js";

dotenv.config();

const sql = `
CREATE TABLE IF NOT EXISTS user_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  xp INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_active DATE,
  badges TEXT[] DEFAULT '{}'
);
`;

(async () => {
  try {
    await pool.query(sql);
    console.log("✅ user_progress table created successfully!");
  } catch (err) {
    console.error("❌ Error creating table:", err.message);
  } finally {
    await pool.end();
  }
})();

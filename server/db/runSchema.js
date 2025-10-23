import dotenv from "dotenv";
import pool from "./index.js";
dotenv.config();

const sql = `
CREATE TABLE IF NOT EXISTS user_xp_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL,
  source TEXT,               -- e.g., typing/dragdrop/cloze/bonus
  created_at TIMESTAMP DEFAULT NOW()
);

-- helpful indexes
CREATE INDEX IF NOT EXISTS idx_user_xp_log_user ON user_xp_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_xp_log_time ON user_xp_log(created_at);
`;

(async () => {
  try {
    await pool.query(sql);
    console.log("✅ user_xp_log created/verified");
  } catch (e) {
    console.error("❌ Schema error:", e.message);
  } finally {
    await pool.end();
  }
})();

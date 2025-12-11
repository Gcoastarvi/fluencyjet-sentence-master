// server/db/index.js
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool
  .connect()
  .then((client) => {
    console.log("✅ Connected to PostgreSQL successfully!");
    client.release();
  })
  .catch((err) => console.error("❌ DB connection error:", err));

export default pool;

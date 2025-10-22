// server/db/init.js
import pool from "./index.js";

const createAndVerifyTables = async () => {
  const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    has_access BOOLEAN DEFAULT FALSE,
    xp INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    last_login DATE,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,
    lesson_id INTEGER,
    question_text TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    difficulty VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    lesson_id INTEGER,
    xp_earned INTEGER DEFAULT 0,
    completed_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS badges (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    criteria TEXT,
    icon VARCHAR(255)
  );

  CREATE TABLE IF NOT EXISTS user_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    badge_id INTEGER REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT NOW()
  );
  `;

  try {
    console.log("🚀 Creating tables...");
    await pool.query(schema);
    console.log("✅ Tables created successfully!\n");

    console.log("🔍 Verifying created tables...");
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log("📋 Tables in database:");
    result.rows.forEach((row) => console.log(" -", row.table_name));
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    pool.end();
  }
};

createAndVerifyTables();

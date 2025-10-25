import pool from "./index.js";

async function fixSchema() {
  try {
    console.log("🔧 Connecting to database...");

    await pool.query(`
      ALTER TABLE IF EXISTS user_progress ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
      ALTER TABLE IF EXISTS user_progress ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0;
      ALTER TABLE IF EXISTS user_progress ADD COLUMN IF NOT EXISTS badges TEXT[] DEFAULT '{}';
      ALTER TABLE IF EXISTS user_progress ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT NOW();
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_xp_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        xp INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ✅ Add missing 'type' column if it doesn’t exist
    await pool.query(`
      ALTER TABLE IF EXISTS user_xp_log
      ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'general';
    `);

    // ✅ Add unique constraint for ON CONFLICT logic
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'user_progress_user_id_key'
        ) THEN
          ALTER TABLE user_progress ADD CONSTRAINT user_progress_user_id_key UNIQUE (user_id);
        END IF;
      END $$;
    `);

    console.log("✅ Schema fixed successfully!");

    const { rows } = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_xp_log'
      ORDER BY ordinal_position;
    `);

    console.log("📋 user_xp_log columns:");
    rows.forEach((r) => console.log(`- ${r.column_name} (${r.data_type})`));
  } catch (err) {
    console.error("❌ Error fixing schema:", err.message);
  } finally {
    await pool.end();
  }
}

fixSchema();

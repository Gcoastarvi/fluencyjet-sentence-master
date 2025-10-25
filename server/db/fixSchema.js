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
        type TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ✅ Add unique constraint so ON CONFLICT works
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'user_progress_user_id_key'
        ) THEN
          ALTER TABLE user_progress ADD CONSTRAINT user_progress_user_id_key UNIQUE (user_id);
        END IF;
      END $$;
    `);

    console.log("✅ Schema fixed successfully!");

    // ✅ Verification log
    const { rows } = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_progress'
      ORDER BY ordinal_position;
    `);

    console.log("📋 user_progress columns:");
    rows.forEach((r) => console.log(`- ${r.column_name} (${r.data_type})`));

    const { rows: constraints } = await pool.query(`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conrelid = 'user_progress'::regclass;
    `);

    console.log("🔒 Constraints:");
    constraints.forEach((c) => console.log(`- ${c.conname} (${c.contype})`));
  } catch (err) {
    console.error("❌ Error fixing schema:", err.message);
  } finally {
    await pool.end();
  }
}

fixSchema();

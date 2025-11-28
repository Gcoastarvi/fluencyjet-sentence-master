// server/db/resetSchema.js
import fs from "fs";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Client } = pg;

async function reset() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔄 Connecting to database...");
    await client.connect();

    const schemaPath = path.join(process.cwd(), "server", "db", "schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf8");

    console.log("🧨 Dropping ALL existing tables...");
    await client.query(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    console.log("📦 Creating fresh schema...");
    await client.query(sql);

    console.log("🎉 SUCCESS — Database fully recreated!");
  } catch (err) {
    console.error("❌ ERROR:", err);
  } finally {
    await client.end();
    console.log("🔌 Connection closed");
  }
}

reset();

import pkg from "pg";
const { Pool } = pkg;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function resetDatabase() {
  const adminPool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "postgres",
    port: 5432,
  });

  try {
    console.log("🗑️ Dropping existing database if it exists...");
    await adminPool.query(`DROP DATABASE IF EXISTS ${process.env.DB_NAME}`);

    console.log("🆕 Creating new database...");
    await adminPool.query(`CREATE DATABASE ${process.env.DB_NAME}`);

    console.log(`👤 Granting privileges to ${process.env.DB_USER} user...`);
    await adminPool.query(
      `GRANT ALL PRIVILEGES ON DATABASE ${process.env.DB_NAME} TO ${process.env.DB_USER}`,
    );

    const adminSnustalkPool = new Pool({
      user: "postgres",
      host: "localhost",
      database: process.env.DB_NAME,
      port: 5432,
    });

    console.log("🔑 Granting schema permissions...");
    await adminSnustalkPool.query(`GRANT ALL ON SCHEMA public TO ${process.env.DB_USER}`);
    await adminSnustalkPool.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${process.env.DB_USER}`,
    );
    await adminSnustalkPool.end();

    const userPool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    });

    console.log("📝 Initializing database schema...");
    const schemaPath = path.join(__dirname, "sql", "session-table.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    await userPool.query(schema);

    console.log("✅ Database reset and initialized successfully!");
    await userPool.end();
  } catch (error) {
    console.error("❌ Error during database reset:", error);
    process.exit(1);
  } finally {
    await adminPool.end();
  }
}

resetDatabase().catch(console.error);
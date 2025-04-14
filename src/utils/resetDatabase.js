import pkg from "pg";
const { Pool } = pkg;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function resetDatabase() {
  // Connect as postgres user to perform administrative tasks
  const adminPool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "postgres",
    port: 5432,
  });

  try {
    console.log("🗑️ Dropping existing database if it exists...");
    await adminPool.query("DROP DATABASE IF EXISTS snustalk");

    console.log("🆕 Creating new database...");
    await adminPool.query("CREATE DATABASE snustalk");

    console.log("👤 Granting privileges to keiran user...");
    await adminPool.query(
      "GRANT ALL PRIVILEGES ON DATABASE snustalk TO keiran",
    );

    // Connect to the new database as postgres to set up schema permissions
    const adminSnustalkPool = new Pool({
      user: "postgres",
      host: "localhost",
      database: "snustalk",
      port: 5432,
    });

    console.log("🔑 Granting schema permissions...");
    await adminSnustalkPool.query("GRANT ALL ON SCHEMA public TO keiran");
    await adminSnustalkPool.query(
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO keiran",
    );
    await adminSnustalkPool.end();

    // Switch to connecting as keiran to the new database
    const userPool = new Pool({
      user: "keiran",
      host: "localhost",
      database: "snustalk",
      password: "clara",
      port: 5432,
    });

    // Read and execute the schema file
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

// Run the reset function
resetDatabase().catch(console.error);

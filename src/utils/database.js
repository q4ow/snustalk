import pkg from "pg";
const { Pool } = pkg;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  user: process.env.DB_USER || "keiran",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "snustalk",
  password: process.env.DB_PASSWORD || "clara",
  port: parseInt(process.env.DB_PORT || "5432"),
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

const initDb = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log("✅ Connected to PostgreSQL database");

    const sqlPath = path.join(__dirname, "sql", "session-table.sql");
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL file not found at ${sqlPath}`);
    }
    await client.query(fs.readFileSync(sqlPath, "utf8"));
    console.log("✅ Database tables initialized");
  } catch (error) {
    console.error("❌ Database initialization error:", error);
    if (error.code === "28000") {
      console.error(`
Database connection failed. Please check:
1. PostgreSQL is running
2. User '${process.env.DB_USER}' exists
3. Password is correct
4. Database '${process.env.DB_NAME}' exists
5. User has proper permissions

Try running these commands as postgres superuser:
CREATE DATABASE snustalk;
CREATE USER keiran WITH PASSWORD 'clara';
GRANT ALL PRIVILEGES ON DATABASE snustalk TO keiran;
\\c snustalk
GRANT ALL ON SCHEMA public TO keiran;
`);
    }
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
};

await initDb().catch((err) => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});

export const db = {
  async saveTicketSettings(guildId, settings) {
    await pool.query(
      "INSERT INTO guild_settings (guild_id, ticket_settings) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET ticket_settings = $2",
      [guildId, settings],
    );
  },

  async getTicketSettings(guildId) {
    const result = await pool.query(
      "SELECT ticket_settings FROM guild_settings WHERE guild_id = $1",
      [guildId],
    );
    return result.rows[0]?.ticket_settings;
  },

  async saveTicketClaim(channelId, moderatorId) {
    await pool.query(
      "INSERT INTO ticket_claims (channel_id, moderator_id) VALUES ($1, $2) ON CONFLICT (channel_id) DO UPDATE SET moderator_id = $2",
      [channelId, moderatorId],
    );
  },

  async removeTicketClaim(channelId) {
    await pool.query("DELETE FROM ticket_claims WHERE channel_id = $1", [
      channelId,
    ]);
  },

  async getTicketClaim(channelId) {
    const result = await pool.query(
      "SELECT moderator_id FROM ticket_claims WHERE channel_id = $1",
      [channelId],
    );
    return result.rows[0]?.moderator_id;
  },

  async addTicketAction(channelId, action) {
    await pool.query(
      "INSERT INTO ticket_actions (channel_id, action) VALUES ($1, $2)",
      [channelId, action],
    );
  },

  async getTicketActions(channelId) {
    const result = await pool.query(
      "SELECT action, timestamp FROM ticket_actions WHERE channel_id = $1 ORDER BY timestamp",
      [channelId],
    );
    return result.rows.map((row) => ({
      action: row.action,
      timestamp: row.timestamp.toLocaleString(),
    }));
  },

  async clearTicketActions(channelId) {
    await pool.query("DELETE FROM ticket_actions WHERE channel_id = $1", [
      channelId,
    ]);
  },

  async getTicketCounter(guildId) {
    const result = await pool.query(
      "SELECT ticket_counter FROM guild_settings WHERE guild_id = $1",
      [guildId],
    );
    return result.rows[0]?.ticket_counter || { counter: 0 };
  },

  async updateTicketCounter(guildId, counter) {
    await pool.query(
      "INSERT INTO guild_settings (guild_id, ticket_counter) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET ticket_counter = $2",
      [guildId, { counter }],
    );
  },

  async createTicket(ticketData) {
    const result = await pool.query(
      `INSERT INTO tickets (channel_id, guild_id, creator_id, ticket_number, ticket_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        ticketData.channelId,
        ticketData.guildId,
        ticketData.creatorId,
        ticketData.ticketNumber,
        ticketData.ticketType,
      ],
    );
    return result.rows[0].id;
  },

  async closeTicket(channelId, closedBy) {
    const result = await pool.query(
      `UPDATE tickets 
       SET status = 'closed', closed_at = CURRENT_TIMESTAMP, closed_by = $2
       WHERE channel_id = $1
       RETURNING id`,
      [channelId, closedBy],
    );
    return result.rows[0]?.id;
  },

  async getTicketInfo(channelId) {
    const result = await pool.query(
      `SELECT * FROM tickets WHERE channel_id = $1`,
      [channelId],
    );
    return result.rows[0];
  },

  async addTicketMessage(ticketId, message) {
    await pool.query(
      `INSERT INTO ticket_messages (ticket_id, author_id, content)
       VALUES ($1, $2, $3)`,
      [ticketId, message.authorId, message.content],
    );
  },

  async getTicketMessages(ticketId) {
    const result = await pool.query(
      `SELECT * FROM ticket_messages 
       WHERE ticket_id = $1 
       ORDER BY sent_at ASC`,
      [ticketId],
    );
    return result.rows;
  },

  async getGuildTickets(guildId, status = null) {
    const query = status
      ? "SELECT * FROM tickets WHERE guild_id = $1 AND status = $2 ORDER BY created_at DESC"
      : "SELECT * FROM tickets WHERE guild_id = $1 ORDER BY created_at DESC";
    const params = status ? [guildId, status] : [guildId];
    const result = await pool.query(query, params);
    return result.rows;
  },

  async ensureUser(userId, userData = {}) {
    try {
      const result = await pool.query(
        `INSERT INTO users (id, discord_id, username) 
         VALUES ($1, $1, $2)
         ON CONFLICT (id) DO UPDATE 
         SET username = COALESCE($2, users.username),
             updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [userId, userData.username || "Unknown User"],
      );

      console.log(
        `✅ User ${userId} ${result.command === "INSERT" ? "created" : "updated"}`,
      );
      return result.rows[0];
    } catch (error) {
      console.error("❌ Error ensuring user:", error);
      throw new Error("Failed to create/update user");
    }
  },

  async addModAction(guildId, action) {
    await pool.query(
      "INSERT INTO mod_actions (guild_id, action) VALUES ($1, $2)",
      [guildId, action],
    );
    return true;
  },

  async getModActions(guildId) {
    const result = await pool.query(
      "SELECT action FROM mod_actions WHERE guild_id = $1",
      [guildId],
    );
    return result.rows.map((row) => row.action);
  },

  async removeModAction(guildId, actionId, type) {
    const result = await pool.query(
      "DELETE FROM mod_actions WHERE guild_id = $1 AND action->>.id = $2 AND action->>.type = $3",
      [guildId, actionId, type],
    );
    return result.rowCount > 0;
  },

  async saveAutomodSettings(guildId, settings) {
    await pool.query(
      "INSERT INTO automod_settings (guild_id, settings) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET settings = $2",
      [guildId, settings],
    );
  },

  async getAutomodSettings(guildId) {
    const result = await pool.query(
      "SELECT settings FROM automod_settings WHERE guild_id = $1",
      [guildId],
    );
    return result.rows[0]?.settings;
  },
};

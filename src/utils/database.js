import pkg from "pg";
const { Pool } = pkg;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabasePool {
  constructor() {
    this.pool = null;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000;
  }

  async connect() {
    if (this.pool) return this.pool;

    try {
      this.pool = new Pool({
        user: process.env.DB_USER || "keiran",
        host: process.env.DB_HOST || "localhost",
        database: process.env.DB_NAME || "snustalk",
        password: process.env.DB_PASSWORD || "clara",
        port: parseInt(process.env.DB_PORT || "5432"),
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        maxUses: 7500,
      });

      const client = await this.pool.connect();
      client.release();
      console.log("✅ Connected to PostgreSQL database");
      this.connectionRetries = 0;
      return this.pool;
    } catch (error) {
      console.error("❌ Database connection error:", error);

      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        console.log(`Retrying connection in ${this.retryDelay / 1000} seconds... (Attempt ${this.connectionRetries}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect();
      }

      if (error.code === "28000") {
        console.error(`
Database connection failed. Please check:
1. PostgreSQL is running
2. User '${process.env.DB_USER}' exists
3. Password is correct
4. Database '${process.env.DB_NAME}' exists
5. User has proper permissions

Try running these commands as postgres superuser:
CREATE DATABASE ${process.env.DB_NAME};
CREATE USER ${process.env.DB_USER} WITH PASSWORD '${process.env.DB_PASSWORD}';
GRANT ALL PRIVILEGES ON DATABASE ${process.env.DB_NAME} TO ${process.env.DB_USER};
\\c ${process.env.DB_NAME}
GRANT ALL ON SCHEMA public TO ${process.env.DB_USER};
`);
      }
      throw error;
    }
  }

  async query(text, params = []) {
    const pool = await this.connect();
    const start = Date.now();
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn('Slow query detected:', { text, duration, rows: result.rowCount });
      }
      return result;
    } catch (error) {
      if (error.code === '40P01') {
        console.warn('Deadlock detected, retrying query...');
        await new Promise(resolve => setTimeout(resolve, 100));
        return this.query(text, params);
      }
      throw error;
    }
  }

  async getClient() {
    const pool = await this.connect();
    const client = await pool.connect();
    const query = client.query.bind(client);
    const release = client.release.bind(client);

    const timeout = setTimeout(() => {
      console.error('A client has been checked out for too long.');
      console.error(`The last executed query on this client was: ${client.lastQuery}`);
    }, 5000);

    client.query = (...args) => {
      client.lastQuery = args;
      return query(...args);
    };

    client.release = () => {
      clearTimeout(timeout);
      client.query = query;
      client.release = release;
      return release();
    };

    return client;
  }

  async transaction(callback) {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async end() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async createReactionRoles(messageId, channelId, roles) {
    try {
      await this.query(
        `INSERT INTO reaction_roles (message_id, channel_id, roles_data)
         VALUES ($1, $2, $3)`,
        [messageId, channelId, JSON.stringify(roles)]
      );
    } catch (error) {
      console.error("Error creating reaction roles:", error);
      throw error;
    }
  }

  async getReactionRole(messageId, roleId) {
    try {
      const result = await this.query(
        `SELECT roles_data FROM reaction_roles WHERE message_id = $1`,
        [messageId]
      );
      if (!result.rows || result.rows.length === 0) return null;
      const rolesData = result.rows[0].roles_data;
      const roles = typeof rolesData === "string" ? JSON.parse(rolesData) : rolesData;
      return roles.find(r => r.id === roleId) || null;
    } catch (error) {
      console.error("Error getting reaction role:", error);
      throw error;
    }
  }
}

const dbPool = new DatabasePool();

const initDb = async () => {
  try {
    const sqlPath = path.join(__dirname, "sql", "session-table.sql");
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL file not found at ${sqlPath}`);
    }

    await dbPool.query(fs.readFileSync(sqlPath, "utf8"));
    console.log("✅ Database tables initialized");
  } catch (error) {
    console.error("❌ Database initialization error:", error);
    throw error;
  }
};

await initDb().catch((err) => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});

export const db = {
  async withTransaction(callback) {
    return dbPool.transaction(callback);
  },

  async saveTicketSettings(guildId, settings) {
    try {
      await dbPool.query(
        "INSERT INTO guild_settings (guild_id, ticket_settings) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET ticket_settings = $2",
        [guildId, settings],
      );
    } catch (error) {
      console.error(`Error saving ticket settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async getTicketSettings(guildId) {
    try {
      const result = await dbPool.query(
        "SELECT ticket_settings FROM guild_settings WHERE guild_id = $1",
        [guildId],
      );
      return result.rows[0]?.ticket_settings;
    } catch (error) {
      console.error(`Error getting ticket settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async saveTicketClaim(channelId, moderatorId) {
    try {
      await dbPool.query(
        "INSERT INTO ticket_claims (channel_id, moderator_id) VALUES ($1, $2) ON CONFLICT (channel_id) DO UPDATE SET moderator_id = $2",
        [channelId, moderatorId],
      );
    } catch (error) {
      console.error(`Error saving ticket claim for channel ${channelId}:`, error);
      throw error;
    }
  },

  async removeTicketClaim(channelId) {
    try {
      await dbPool.query("DELETE FROM ticket_claims WHERE channel_id = $1", [
        channelId,
      ]);
    } catch (error) {
      console.error(`Error removing ticket claim for channel ${channelId}:`, error);
      throw error;
    }
  },

  async getTicketClaim(channelId) {
    try {
      const result = await dbPool.query(
        "SELECT moderator_id FROM ticket_claims WHERE channel_id = $1",
        [channelId],
      );
      return result.rows[0]?.moderator_id;
    } catch (error) {
      console.error(`Error getting ticket claim for channel ${channelId}:`, error);
      throw error;
    }
  },

  async addTicketAction(channelId, action) {
    try {
      const actionObject = {
        text: action,
        timestamp: new Date().toISOString()
      };

      await dbPool.query(
        "INSERT INTO ticket_actions (channel_id, action) VALUES ($1, $2)",
        [channelId, JSON.stringify(actionObject)]
      );
      return true;
    } catch (error) {
      console.error(`Error adding ticket action for channel ${channelId}:`, error);
      throw error;
    }
  },

  async getTicketActions(channelId) {
    try {
      const result = await dbPool.query(
        "SELECT action, timestamp FROM ticket_actions WHERE channel_id = $1 ORDER BY timestamp",
        [channelId],
      );
      return result.rows.map((row) => ({
        action: row.action,
        timestamp: row.timestamp.toLocaleString(),
      }));
    } catch (error) {
      console.error(`Error getting ticket actions for channel ${channelId}:`, error);
      throw error;
    }
  },

  async clearTicketActions(channelId) {
    try {
      await dbPool.query("DELETE FROM ticket_actions WHERE channel_id = $1", [
        channelId,
      ]);
    } catch (error) {
      console.error(`Error clearing ticket actions for channel ${channelId}:`, error);
      throw error;
    }
  },

  async getTicketCounter(guildId) {
    try {
      const result = await dbPool.query(
        "SELECT ticket_counter FROM guild_settings WHERE guild_id = $1",
        [guildId],
      );
      return result.rows[0]?.ticket_counter || { counter: 0 };
    } catch (error) {
      console.error(`Error getting ticket counter for guild ${guildId}:`, error);
      throw error;
    }
  },

  async updateTicketCounter(guildId, counter) {
    try {
      await dbPool.query(
        "INSERT INTO guild_settings (guild_id, ticket_counter) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET ticket_counter = $2",
        [guildId, { counter }],
      );
    } catch (error) {
      console.error(`Error updating ticket counter for guild ${guildId}:`, error);
      throw error;
    }
  },

  async createTicket(ticketData) {
    try {
      const result = await dbPool.query(
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
    } catch (error) {
      console.error(`Error creating ticket for channel ${ticketData.channelId}:`, error);
      throw error;
    }
  },

  async closeTicket(ticketId, closedBy) {
    try {
      const result = await dbPool.query(
        `UPDATE tickets 
             SET closed_by = $2, 
                 closed_at = CURRENT_TIMESTAMP,
                 status = 'CLOSED'
             WHERE id = $1
             RETURNING id`,
        [ticketId, closedBy]
      );

      return result.rows[0]?.id;
    } catch (error) {
      console.error(`Error closing ticket ${ticketId}:`, error);
      throw error;
    }
  },

  async getTicketInfo(ticketId) {
    try {
      const result = await dbPool.query(
        `SELECT t.*, 
                    tc.moderator_id as claimed_by,
                    u.discord_id as creator_id,
                    u.username as creator_name
             FROM tickets t
             LEFT JOIN ticket_claims tc ON t.channel_id = tc.channel_id
             LEFT JOIN users u ON t.creator_id = u.discord_id
             WHERE t.id = $1`,
        [ticketId]
      );

      return result.rows[0];
    } catch (error) {
      console.error(`Error getting ticket info for ticket ${ticketId}:`, error);
      throw error;
    }
  },

  async addTicketMessage(ticketId, message) {
    try {
      await dbPool.query(
        `INSERT INTO ticket_messages (ticket_id, author_id, content)
         VALUES ($1, $2, $3)`,
        [ticketId, message.authorId, message.content],
      );
    } catch (error) {
      console.error(`Error adding ticket message for ticket ${ticketId}:`, error);
      throw error;
    }
  },

  async getTicketMessages(ticketId) {
    try {
      const result = await dbPool.query(
        `SELECT * FROM ticket_messages 
         WHERE ticket_id = $1 
         ORDER BY sent_at ASC`,
        [ticketId],
      );
      return result.rows;
    } catch (error) {
      console.error(`Error getting ticket messages for ticket ${ticketId}:`, error);
      throw error;
    }
  },

  async getGuildTickets(guildId, status = null) {
    try {
      const query = status
        ? "SELECT * FROM tickets WHERE guild_id = $1 AND status = $2 ORDER BY created_at DESC"
        : "SELECT * FROM tickets WHERE guild_id = $1 ORDER BY created_at DESC";
      const params = status ? [guildId, status] : [guildId];
      const result = await dbPool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error(`Error getting tickets for guild ${guildId}:`, error);
      throw error;
    }
  },

  async ensureUser(userId, userData = {}) {
    try {
      const result = await dbPool.query(
        `INSERT INTO users (discord_id, username) 
             VALUES ($1, $2)
             ON CONFLICT (discord_id) 
             DO UPDATE SET 
                username = COALESCE($2, users.username),
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
        [userId, userData.username || "Unknown User"]
      );

      if (!result.rows[0]) {
        throw new Error('Failed to create/update user');
      }

      console.log(`✅ User ${userId} ${result.command === "INSERT" ? "created" : "updated"}`);
      return result.rows[0];
    } catch (error) {
      console.error("❌ Error ensuring user:", error);
      throw error;
    }
  },

  async addModAction(guildId, action) {
    try {
      await dbPool.query(
        "INSERT INTO mod_actions (guild_id, action) VALUES ($1, $2)",
        [guildId, action],
      );
      return true;
    } catch (error) {
      console.error(`Error adding mod action for guild ${guildId}:`, error);
      throw error;
    }
  },

  async getModActions(guildId) {
    try {
      const result = await dbPool.query(
        "SELECT action FROM mod_actions WHERE guild_id = $1",
        [guildId],
      );
      return result.rows.map((row) => row.action);
    } catch (error) {
      console.error(`Error getting mod actions for guild ${guildId}:`, error);
      throw error;
    }
  },

  async removeModAction(guildId, actionId, type) {
    try {
      const result = await dbPool.query(
        "DELETE FROM mod_actions WHERE guild_id = $1 AND action->>.id = $2 AND action->>.type = $3",
        [guildId, actionId, type],
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error(`Error removing mod action for guild ${guildId}:`, error);
      throw error;
    }
  },

  async saveAutomodSettings(guildId, settings) {
    try {
      await dbPool.query(
        "INSERT INTO automod_settings (guild_id, settings) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET settings = $2",
        [guildId, settings],
      );
    } catch (error) {
      console.error(`Error saving automod settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async getAutomodSettings(guildId) {
    try {
      const result = await dbPool.query(
        "SELECT settings FROM automod_settings WHERE guild_id = $1",
        [guildId],
      );
      return result.rows[0]?.settings;
    } catch (error) {
      console.error(`Error getting automod settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async saveTypingScore(userId, wpm, accuracy, testDuration) {
    try {
      await dbPool.query(
        `
          INSERT INTO typing_scores 
              (user_id, top_wpm, accuracy, test_duration, total_tests, average_wpm, last_submission) 
          VALUES ($1, $2, $3, $4, 1, $2, CURRENT_TIMESTAMP)
          ON CONFLICT (user_id) DO UPDATE SET 
              top_wpm = GREATEST(typing_scores.top_wpm, $2),
              accuracy = CASE 
                  WHEN typing_scores.top_wpm < $2 THEN $3 
                  ELSE typing_scores.accuracy 
              END,
              test_duration = CASE 
                  WHEN typing_scores.top_wpm < $2 THEN $4 
                  ELSE typing_scores.test_duration 
              END,
              total_tests = typing_scores.total_tests + 1,
              average_wpm = ((typing_scores.average_wpm * typing_scores.total_tests) + $2) / (typing_scores.total_tests + 1),
              last_submission = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
      `,
        [userId, wpm, accuracy, testDuration],
      );
    } catch (error) {
      console.error(`Error saving typing score for user ${userId}:`, error);
      throw error;
    }
  },

  async getTypingScore(userId) {
    try {
      const result = await dbPool.query(
        "SELECT top_wpm FROM typing_scores WHERE user_id = $1",
        [userId],
      );
      return result.rows[0]?.top_wpm || null;
    } catch (error) {
      console.error(`Error getting typing score for user ${userId}:`, error);
      throw error;
    }
  },

  async getTypingLeaderboard(limit = 10) {
    try {
      const result = await dbPool.query(
        "SELECT user_id, top_wpm FROM typing_scores ORDER BY top_wpm DESC, last_updated ASC LIMIT $1",
        [limit],
      );
      return result.rows;
    } catch (error) {
      console.error(`Error getting typing leaderboard:`, error);
      throw error;
    }
  },

  async getLoggingSettings(guildId, logType = null) {
    try {
      if (logType) {
        const result = await dbPool.query(
          'SELECT * FROM logging_settings WHERE guild_id = $1 AND log_type = $2',
          [guildId, logType]
        );
        return result.rows[0];
      } else {
        const result = await dbPool.query(
          'SELECT * FROM logging_settings WHERE guild_id = $1',
          [guildId]
        );
        return result.rows;
      }
    } catch (error) {
      console.error(`Error getting logging settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async updateLoggingSettings(guildId, logType, settings) {
    try {
      const { channel_id, allowed_roles = [], ping_roles = [], enabled = true } = settings;

      await dbPool.query(
        `INSERT INTO logging_settings (guild_id, log_type, channel_id, allowed_roles, ping_roles, enabled, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (guild_id, log_type) 
         DO UPDATE SET 
           channel_id = $3,
           allowed_roles = $4,
           ping_roles = $5,
           enabled = $6,
           updated_at = CURRENT_TIMESTAMP`,
        [guildId, logType, channel_id, allowed_roles, ping_roles, enabled]
      );
    } catch (error) {
      console.error(`Error updating logging settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async deleteLoggingSettings(guildId, logType) {
    try {
      await dbPool.query(
        'DELETE FROM logging_settings WHERE guild_id = $1 AND log_type = $2',
        [guildId, logType]
      );
    } catch (error) {
      console.error(`Error deleting logging settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async createGiveaway(data) {
    try {
      const result = await dbPool.query(
        `INSERT INTO giveaways 
        (guild_id, channel_id, message_id, host_id, prize, description, winner_count, ends_at, requirements) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          data.guild_id,
          data.channel_id,
          data.message_id,
          data.host_id,
          data.prize,
          data.description,
          data.winner_count,
          data.ends_at,
          data.requirements
        ]
      );
      return result.rows[0].id;
    } catch (error) {
      console.error(`Error creating giveaway:`, error);
      throw error;
    }
  },

  async getGiveaway(id) {
    try {
      const result = await dbPool.query(
        'SELECT * FROM giveaways WHERE id = $1',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      console.error(`Error getting giveaway with id ${id}:`, error);
      throw error;
    }
  },

  async getEndedGiveaways() {
    try {
      const result = await dbPool.query(
        'SELECT id FROM giveaways WHERE ended = false AND ends_at <= NOW()'
      );
      return result.rows;
    } catch (error) {
      console.error(`Error getting ended giveaways:`, error);
      throw error;
    }
  },

  async endGiveaway(id) {
    try {
      await dbPool.query(
        'UPDATE giveaways SET ended = true WHERE id = $1',
        [id]
      );
    } catch (error) {
      console.error(`Error ending giveaway with id ${id}:`, error);
      throw error;
    }
  },

  async enterGiveaway(giveawayId, userId) {
    try {
      await dbPool.query(
        'INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [giveawayId, userId]
      );
    } catch (error) {
      console.error(`Error entering giveaway with id ${giveawayId} for user ${userId}:`, error);
      throw error;
    }
  },

  async getGiveawayEntries(giveawayId) {
    try {
      const result = await dbPool.query(
        'SELECT user_id FROM giveaway_entries WHERE giveaway_id = $1',
        [giveawayId]
      );
      return result.rows;
    } catch (error) {
      console.error(`Error getting giveaway entries for giveaway with id ${giveawayId}:`, error);
      throw error;
    }
  },

  async blacklistUser(giveawayId, userId) {
    try {
      await dbPool.query(
        'UPDATE giveaways SET blacklisted_users = array_append(blacklisted_users, $1) WHERE id = $2',
        [userId, giveawayId]
      );
      await dbPool.query(
        'DELETE FROM giveaway_entries WHERE giveaway_id = $1 AND user_id = $2',
        [giveawayId, userId]
      );
    } catch (error) {
      console.error(`Error blacklisting user ${userId} from giveaway with id ${giveawayId}:`, error);
      throw error;
    }
  },

  async getGiveawayByMessageId(messageId, guildId) {
    try {
      const result = await dbPool.query(
        'SELECT id FROM giveaways WHERE message_id = $1 AND guild_id = $2',
        [messageId, guildId]
      );
      return result.rows[0];
    } catch (error) {
      console.error(`Error getting giveaway by message id ${messageId} and guild id ${guildId}:`, error);
      throw error;
    }
  },

  async getGuildSettings(guildId) {
    try {
      const result = await dbPool.query(
        "SELECT channel_ids, role_ids, api_keys, external_links FROM guild_settings WHERE guild_id = $1",
        [guildId],
      );
      return result.rows[0] || {
        channel_ids: {},
        role_ids: {},
        api_keys: {},
        external_links: {},
      };
    } catch (error) {
      console.error(`Error getting guild settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async updateGuildSettings(guildId, settings) {
    try {
      const { channel_ids, role_ids, api_keys, external_links } = settings;

      await dbPool.query(
        `INSERT INTO guild_settings 
         (guild_id, channel_ids, role_ids, api_keys, external_links)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (guild_id) 
         DO UPDATE SET 
           channel_ids = COALESCE($2, guild_settings.channel_ids),
           role_ids = COALESCE($3, guild_settings.role_ids),
           api_keys = COALESCE($4, guild_settings.api_keys),
           external_links = COALESCE($5, guild_settings.external_links)`,
        [guildId, channel_ids, role_ids, api_keys, external_links],
      );
    } catch (error) {
      console.error(`Error updating guild settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async getChannelId(guildId, channelType) {
    try {
      const result = await dbPool.query(
        "SELECT channel_ids->$2 as channel_id FROM guild_settings WHERE guild_id = $1",
        [guildId, channelType],
      );
      return result.rows[0]?.channel_id;
    } catch (error) {
      console.error(`Error getting channel id for guild ${guildId} and channel type ${channelType}:`, error);
      throw error;
    }
  },

  async getRoleId(guildId, roleType) {
    try {
      const result = await dbPool.query(
        "SELECT role_ids->$2 as role_id FROM guild_settings WHERE guild_id = $1",
        [guildId, roleType],
      );
      return result.rows[0]?.role_id;
    } catch (error) {
      console.error(`Error getting role id for guild ${guildId} and role type ${roleType}:`, error);
      throw error;
    }
  },

  async getApiKey(guildId, keyName) {
    try {
      const result = await dbPool.query(
        "SELECT api_keys->$2 as api_key FROM guild_settings WHERE guild_id = $1",
        [guildId, keyName],
      );
      return result.rows[0]?.api_key;
    } catch (error) {
      console.error(`Error getting API key for guild ${guildId} and key name ${keyName}:`, error);
      throw error;
    }
  },

  async getExternalLink(guildId, linkName) {
    try {
      const result = await dbPool.query(
        "SELECT external_links->$2 as link FROM guild_settings WHERE guild_id = $1",
        [guildId, linkName],
      );
      return result.rows[0]?.link;
    } catch (error) {
      console.error(`Error getting external link for guild ${guildId} and link name ${linkName}:`, error);
      throw error;
    }
  },

  async generateApiKey(userId) {
    try {
      const apiKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      await dbPool.query(
        'UPDATE users SET api_key = $1, updated_at = CURRENT_TIMESTAMP WHERE discord_id = $2 RETURNING api_key',
        [apiKey, userId]
      );
      return apiKey;
    } catch (error) {
      console.error(`Error generating API key for user ${userId}:`, error);
      throw error;
    }
  },

  async verifyApiKey(apiKey) {
    try {
      const result = await dbPool.query(
        'SELECT discord_id, username FROM users WHERE api_key = $1',
        [apiKey]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error(`Error verifying API key:`, error);
      throw error;
    }
  },

  async getApiKeyByUserId(userId) {
    try {
      const result = await dbPool.query(
        'SELECT api_key FROM users WHERE discord_id = $1',
        [userId]
      );
      return result.rows[0]?.api_key || null;
    } catch (error) {
      console.error(`Error getting API key for user ${userId}:`, error);
      throw error;
    }
  },

  async healthCheck() {
    try {
      await dbPool.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  },

  createReactionRoles: (...args) => dbPool.createReactionRoles(...args),
  getReactionRole: (...args) => dbPool.getReactionRole(...args),
};

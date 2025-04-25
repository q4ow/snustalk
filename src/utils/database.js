import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from './logger.js';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

dbPool.on('error', (err) => {
  logger.error('Unexpected database error:', err);
});

const initDb = async () => {
  try {
    const sqlPath = path.join(__dirname, "sql", "session-table.sql");
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL file not found at ${sqlPath}`);
    }

    await dbPool.query(fs.readFileSync(sqlPath, "utf8"));
    logger.info("✅ Database tables initialized");
  } catch (error) {
    logger.error("❌ Database initialization error:", error);
    throw error;
  }
};

await initDb().catch((err) => {
  logger.error("Failed to initialize database:", err);
  process.exit(1);
});

export { dbPool };
export const db = {
  async healthCheck() {
    try {
      await dbPool.query('SELECT NOW()');
      logger.debug('Database health check passed');
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  },

  async getGuildSettings(guildId) {
    try {
      const result = await dbPool.query(
        'SELECT * FROM guild_settings WHERE guild_id = $1',
        [guildId],
      );
      return result.rows[0] || {};
    } catch (error) {
      logger.error(`Error fetching settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async updateGuildSettings(guildId, settings) {
    try {
      const result = await dbPool.query(
        `INSERT INTO guild_settings (guild_id, role_ids, channel_ids, welcome_message, goodbye_message, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (guild_id) 
         DO UPDATE SET 
           role_ids = $2,
           channel_ids = $3,
           welcome_message = $4,
           goodbye_message = $5,
           updated_at = CURRENT_TIMESTAMP`,
        [
          guildId,
          settings.role_ids || {},
          settings.channel_ids || {},
          settings.welcome_message,
          settings.goodbye_message,
        ],
      );
      logger.info(`Updated settings for guild ${guildId}`);
      return result;
    } catch (error) {
      logger.error(`Error updating settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async getRoleId(guildId, roleType) {
    try {
      const settings = await this.getGuildSettings(guildId);
      return settings.role_ids?.[roleType];
    } catch (error) {
      logger.error(`Error getting ${roleType} role ID for guild ${guildId}:`, error);
      throw error;
    }
  },

  async getChannelId(guildId, channelType) {
    try {
      const settings = await this.getGuildSettings(guildId);
      return settings.channel_ids?.[channelType];
    } catch (error) {
      logger.error(`Error getting ${channelType} channel ID for guild ${guildId}:`, error);
      throw error;
    }
  },

  async verifyApiKey(apiKey) {
    try {
      const result = await dbPool.query(
        'SELECT * FROM api_keys WHERE key = $1 AND revoked = false',
        [apiKey],
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Error verifying API key:', error);
      throw error;
    }
  },

  async getLoggingSettings(guildId, logType = null) {
    try {
      if (logType) {
        const result = await dbPool.query(
          'SELECT * FROM logging_settings WHERE guild_id = $1 AND log_type = $2',
          [guildId, logType],
        );
        return result.rows[0];
      } else {
        const result = await dbPool.query(
          'SELECT * FROM logging_settings WHERE guild_id = $1',
          [guildId],
        );
        return result.rows;
      }
    } catch (error) {
      logger.error(`Error getting logging settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async updateLoggingSettings(guildId, logType, settings) {
    try {
      const {
        channel_id,
        allowed_roles = [],
        ping_roles = [],
        enabled = true,
      } = settings;

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
        [guildId, logType, channel_id, allowed_roles, ping_roles, enabled],
      );
      logger.info(`Updated ${logType} logging settings for guild ${guildId}`);
    } catch (error) {
      logger.error(`Error updating logging settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async deleteLoggingSettings(guildId, logType) {
    try {
      await dbPool.query(
        'DELETE FROM logging_settings WHERE guild_id = $1 AND log_type = $2',
        [guildId, logType],
      );
      logger.info(`Deleted ${logType} logging settings for guild ${guildId}`);
    } catch (error) {
      logger.error(`Error deleting logging settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async saveTicketSettings(guildId, settings) {
    try {
      await dbPool.query(
        `INSERT INTO ticket_settings (guild_id, settings, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (guild_id) 
         DO UPDATE SET 
           settings = $2,
           updated_at = CURRENT_TIMESTAMP`,
        [guildId, settings],
      );
      logger.info(`Updated ticket settings for guild ${guildId}`);
    } catch (error) {
      logger.error(`Error saving ticket settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async saveAutomodSettings(guildId, settings) {
    try {
      await dbPool.query(
        `INSERT INTO automod_settings (guild_id, settings, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (guild_id) 
         DO UPDATE SET 
           settings = $2,
           updated_at = CURRENT_TIMESTAMP`,
        [guildId, settings],
      );
      logger.info(`Updated automod settings for guild ${guildId}`);
    } catch (error) {
      logger.error(`Error saving automod settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async getAutomodSettings(guildId) {
    try {
      const result = await dbPool.query(
        'SELECT settings FROM automod_settings WHERE guild_id = $1',
        [guildId],
      );
      return result.rows[0]?.settings || {};
    } catch (error) {
      logger.error(`Error getting automod settings for guild ${guildId}:`, error);
      throw error;
    }
  },

  async logRaidIncident(guildId, incident) {
    try {
      await dbPool.query(
        `INSERT INTO raid_incidents 
         (guild_id, incident_type, details, action_taken, affected_users, timestamp)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          guildId,
          incident.type,
          incident.details,
          incident.action,
          incident.affectedUsers,
        ],
      );
      logger.warn(`Raid incident logged for guild ${guildId}: ${incident.type}`);
    } catch (error) {
      logger.error(`Error logging raid incident for guild ${guildId}:`, error);
      throw error;
    }
  },

  async getEndedGiveaways() {
    try {
      const result = await dbPool.query(
        'SELECT * FROM giveaways WHERE ends_at <= NOW() AND ended = FALSE'
      );
      return result.rows;
    } catch (error) {
      logger.error('Error getting ended giveaways:', error);
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
      logger.error(`Error getting giveaway ${id}:`, error);
      throw error;
    }
  },

  async createGiveaway(giveaway) {
    try {
      const result = await dbPool.query(
        `INSERT INTO giveaways (
          guild_id, channel_id, message_id, host_id, prize, description,
          winner_count, ends_at, requirements, button_label, embed_color,
          image, end_message, blacklisted_users
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id`,
        [
          giveaway.guild_id,
          giveaway.channel_id,
          giveaway.message_id,
          giveaway.host_id,
          giveaway.prize,
          giveaway.description,
          giveaway.winner_count,
          giveaway.ends_at,
          giveaway.requirements,
          giveaway.button_label,
          giveaway.embed_color,
          giveaway.image,
          giveaway.end_message,
          giveaway.blacklisted_users || []
        ]
      );
      return result.rows[0].id;
    } catch (error) {
      logger.error('Error creating giveaway:', error);
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
      logger.error(`Error entering giveaway ${giveawayId} for user ${userId}:`, error);
      throw error;
    }
  },

  async getGiveawayEntries(giveawayId) {
    try {
      const result = await dbPool.query(
        'SELECT * FROM giveaway_entries WHERE giveaway_id = $1',
        [giveawayId]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error getting entries for giveaway ${giveawayId}:`, error);
      throw error;
    }
  },

  async endGiveaway(giveawayId) {
    try {
      await dbPool.query(
        'UPDATE giveaways SET ended = TRUE WHERE id = $1',
        [giveawayId]
      );
    } catch (error) {
      logger.error(`Error ending giveaway ${giveawayId}:`, error);
      throw error;
    }
  },

  async blacklistUser(giveawayId, userId) {
    try {
      await dbPool.query(
        'UPDATE giveaways SET blacklisted_users = array_append(blacklisted_users, $2) WHERE id = $1',
        [giveawayId, userId]
      );
    } catch (error) {
      logger.error(`Error blacklisting user ${userId} from giveaway ${giveawayId}:`, error);
      throw error;
    }
  },

  async getTicketCounter(guildId) {
    try {
      const result = await dbPool.query(
        'SELECT ticket_counter FROM guild_settings WHERE guild_id = $1',
        [guildId]
      );
      return result.rows[0]?.ticket_counter || { counter: 0 };
    } catch (error) {
      logger.error(`Error getting ticket counter for guild ${guildId}:`, error);
      throw error;
    }
  },
};

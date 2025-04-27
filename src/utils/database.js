import dotenv from "dotenv";
dotenv.config();

import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";
import { MOD_ACTIONS } from "./moderation.js";

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

dbPool.on("error", (err) => {
  logger.error("Unexpected database error:", err);
});

const initDb = async () => {
  try {
    const sqlFiles = [
      path.join(__dirname, "sql", "session-table.sql"),
      path.join(__dirname, "sql", "reaction-roles.sql"),
      path.join(__dirname, "sql", "mod-actions.sql"),
    ];

    for (const sqlPath of sqlFiles) {
      if (!fs.existsSync(sqlPath)) {
        throw new Error(`SQL file not found at ${sqlPath}`);
      }
      await dbPool.query(fs.readFileSync(sqlPath, "utf8"));
    }

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
      await dbPool.query("SELECT NOW()");
      logger.debug("Database health check passed");
      return true;
    } catch (error) {
      logger.error("Database health check failed:", error);
      return false;
    }
  },

  async getGuildSettings(guildId) {
    try {
      const result = await dbPool.query(
        "SELECT * FROM guild_settings WHERE guild_id = $1",
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
      logger.error(
        `Error getting ${roleType} role ID for guild ${guildId}:`,
        error,
      );
      throw error;
    }
  },

  async getChannelId(guildId, channelType) {
    try {
      const settings = await this.getGuildSettings(guildId);
      return settings.channel_ids?.[channelType];
    } catch (error) {
      logger.error(
        `Error getting ${channelType} channel ID for guild ${guildId}:`,
        error,
      );
      throw error;
    }
  },

  async verifyApiKey(apiKey) {
    try {
      const result = await dbPool.query(
        "SELECT * FROM api_keys WHERE key = $1 AND revoked = false",
        [apiKey],
      );
      return result.rows[0];
    } catch (error) {
      logger.error("Error verifying API key:", error);
      throw error;
    }
  },

  async getLoggingSettings(guildId, logType = null) {
    try {
      if (logType) {
        const result = await dbPool.query(
          "SELECT * FROM logging_settings WHERE guild_id = $1 AND log_type = $2",
          [guildId, logType],
        );
        return result.rows[0];
      } else {
        const result = await dbPool.query(
          "SELECT * FROM logging_settings WHERE guild_id = $1",
          [guildId],
        );
        return result.rows;
      }
    } catch (error) {
      logger.error(
        `Error getting logging settings for guild ${guildId}:`,
        error,
      );
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
      logger.error(
        `Error updating logging settings for guild ${guildId}:`,
        error,
      );
      throw error;
    }
  },

  async deleteLoggingSettings(guildId, logType) {
    try {
      await dbPool.query(
        "DELETE FROM logging_settings WHERE guild_id = $1 AND log_type = $2",
        [guildId, logType],
      );
      logger.info(`Deleted ${logType} logging settings for guild ${guildId}`);
    } catch (error) {
      logger.error(
        `Error deleting logging settings for guild ${guildId}:`,
        error,
      );
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
      logger.error(
        `Error saving automod settings for guild ${guildId}:`,
        error,
      );
      throw error;
    }
  },

  async getAutomodSettings(guildId) {
    try {
      const result = await dbPool.query(
        "SELECT settings FROM automod_settings WHERE guild_id = $1",
        [guildId],
      );
      const settings = result.rows[0]?.settings;
      return (
        settings || {
          enabled: false,
          filters: {
            spam: {
              enabled: true,
              maxMessages: 5,
              timeWindow: 5000,
              action: "timeout",
              duration: 300000,
              whitelistRoles: [],
            },
          },
        }
      );
    } catch (error) {
      logger.error(
        `Error getting automod settings for guild ${guildId}:`,
        error,
      );
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
      logger.warn(
        `Raid incident logged for guild ${guildId}: ${incident.type}`,
      );
    } catch (error) {
      logger.error(`Error logging raid incident for guild ${guildId}:`, error);
      throw error;
    }
  },

  async getEndedGiveaways() {
    try {
      const result = await dbPool.query(
        "SELECT * FROM giveaways WHERE ends_at <= NOW() AND ended = FALSE",
      );
      return result.rows;
    } catch (error) {
      logger.error("Error getting ended giveaways:", error);
      throw error;
    }
  },

  async getGiveaway(id) {
    try {
      const result = await dbPool.query(
        "SELECT * FROM giveaways WHERE id = $1",
        [id],
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
          giveaway.blacklisted_users || [],
        ],
      );
      return result.rows[0].id;
    } catch (error) {
      logger.error("Error creating giveaway:", error);
      throw error;
    }
  },

  async enterGiveaway(giveawayId, userId) {
    try {
      await dbPool.query(
        "INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [giveawayId, userId],
      );
    } catch (error) {
      logger.error(
        `Error entering giveaway ${giveawayId} for user ${userId}:`,
        error,
      );
      throw error;
    }
  },

  async getGiveawayEntries(giveawayId) {
    try {
      const result = await dbPool.query(
        "SELECT * FROM giveaway_entries WHERE giveaway_id = $1",
        [giveawayId],
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error getting entries for giveaway ${giveawayId}:`, error);
      throw error;
    }
  },

  async endGiveaway(giveawayId) {
    try {
      await dbPool.query("UPDATE giveaways SET ended = TRUE WHERE id = $1", [
        giveawayId,
      ]);
    } catch (error) {
      logger.error(`Error ending giveaway ${giveawayId}:`, error);
      throw error;
    }
  },

  async blacklistUser(giveawayId, userId) {
    try {
      await dbPool.query(
        "UPDATE giveaways SET blacklisted_users = array_append(blacklisted_users, $2) WHERE id = $1",
        [giveawayId, userId],
      );
    } catch (error) {
      logger.error(
        `Error blacklisting user ${userId} from giveaway ${giveawayId}:`,
        error,
      );
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
      logger.error(`Error getting ticket counter for guild ${guildId}:`, error);
      throw error;
    }
  },

  async getRaidProtectionSettings(guildId) {
    try {
      const result = await dbPool.query(
        "SELECT raid_protection FROM guild_settings WHERE guild_id = $1",
        [guildId],
      );
      return (
        result.rows[0]?.raid_protection || {
          enabled: false,
          joinThreshold: 10,
          joinTimeWindow: 10000,
          action: "kick",
          logChannel: null,
        }
      );
    } catch (error) {
      logger.error(
        `Error getting raid protection settings for guild ${guildId}:`,
        error,
      );
      throw error;
    }
  },

  async getExternalLinks(guildId) {
    try {
      const result = await dbPool.query(
        "SELECT external_links FROM guild_settings WHERE guild_id = $1",
        [guildId],
      );
      return result.rows[0]?.external_links || {};
    } catch (error) {
      logger.error(`Error getting external links for guild ${guildId}:`, error);
      throw error;
    }
  },

  async getExternalLink(guildId, linkType) {
    try {
      const links = await this.getExternalLinks(guildId);
      return links[linkType];
    } catch (error) {
      logger.error(
        `Error getting ${linkType} link for guild ${guildId}:`,
        error,
      );
      return null;
    }
  },

  async updateExternalLinks(guildId, links) {
    try {
      await dbPool.query(
        `UPDATE guild_settings 
         SET external_links = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE guild_id = $1`,
        [guildId, links],
      );
      logger.info(`Updated external links for guild ${guildId}`);
    } catch (error) {
      logger.error(
        `Error updating external links for guild ${guildId}:`,
        error,
      );
      throw error;
    }
  },

  async trackJoinVelocity(guildId, timestamp) {
    try {
      await dbPool.query(
        `INSERT INTO join_events (guild_id, timestamp)
         VALUES ($1, $2)`,
        [guildId, timestamp],
      );

      await dbPool.query(
        "DELETE FROM join_events WHERE timestamp < NOW() - INTERVAL '1 hour'",
      );

      const result = await dbPool.query(
        `SELECT COUNT(*) as joins
         FROM join_events
         WHERE guild_id = $1
         AND timestamp > NOW() - INTERVAL '1 minute'`,
        [guildId],
      );

      return parseInt(result.rows[0].joins);
    } catch (error) {
      logger.error(`Error tracking join velocity for guild ${guildId}:`, error);
      return 0;
    }
  },

  async getRecentJoins(guildId, timeWindow) {
    try {
      const result = await dbPool.query(
        `SELECT guild_id, timestamp
         FROM join_events
         WHERE guild_id = $1
         AND timestamp > NOW() - INTERVAL '1 second' * $2
         ORDER BY timestamp DESC`,
        [guildId, timeWindow / 1000],
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error getting recent joins for guild ${guildId}:`, error);
      return [];
    }
  },

  async cleanOldJoinData(guildId) {
    try {
      await dbPool.query(
        "DELETE FROM join_events WHERE guild_id = $1 AND timestamp < NOW() - INTERVAL '1 day'",
        [guildId],
      );
    } catch (error) {
      logger.error(`Error cleaning old join data for guild ${guildId}:`, error);
    }
  },

  async createReactionRoles(messageId, channelId, rolesData) {
    try {
      const jsonData = JSON.stringify(rolesData);
      await dbPool.query(
        `INSERT INTO reaction_roles (message_id, channel_id, roles_data)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (message_id) 
         DO UPDATE SET 
           roles_data = $3::jsonb,
           channel_id = $2`,
        [messageId, channelId, jsonData],
      );
      logger.info(`Created/updated reaction roles for message ${messageId}`);
    } catch (error) {
      logger.error(
        `Error creating reaction roles for message ${messageId}:`,
        error,
      );
      throw error;
    }
  },

  async getReactionRole(messageId, roleId) {
    try {
      const result = await dbPool.query(
        "SELECT roles_data::text FROM reaction_roles WHERE message_id = $1",
        [messageId],
      );

      if (!result.rows[0]) return null;

      const roles = JSON.parse(result.rows[0].roles_data);
      return Array.isArray(roles)
        ? roles.find((role) => role.id === roleId)
        : null;
    } catch (error) {
      logger.error(
        `Error getting reaction role for message ${messageId}:`,
        error,
      );
      throw error;
    }
  },

  async addModAction(guildId, action) {
    try {
      const result = await dbPool.query(
        `INSERT INTO mod_actions 
         (guild_id, target_id, moderator_id, action_type, reason, duration, expires_at, requires_acknowledgment, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          guildId,
          action.targetId,
          action.moderatorId,
          action.type,
          action.reason,
          action.duration || null,
          action.duration ? new Date(Date.now() + action.duration) : null,
          action.type === MOD_ACTIONS.BAN ||
            (action.duration && action.duration > 24 * 60 * 60 * 1000),
          action.metadata || {},
        ],
      );
      return result.rows[0].id;
    } catch (error) {
      logger.error(`Error adding mod action for guild ${guildId}:`, error);
      throw error;
    }
  },

  async getModActions(guildId, options = {}) {
    try {
      let query = "SELECT * FROM mod_actions WHERE guild_id = $1";
      const params = [guildId];
      let paramCount = 1;

      if (options.targetId) {
        paramCount++;
        query += ` AND target_id = $${paramCount}`;
        params.push(options.targetId);
      }

      if (options.actionType) {
        paramCount++;
        query += ` AND action_type = $${paramCount}`;
        params.push(options.actionType);
      }

      if (options.activeOnly) {
        query += " AND is_active = true";
      }

      query += " ORDER BY created_at DESC";

      if (options.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(options.limit);
      }

      const result = await dbPool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error(`Error getting mod actions for guild ${guildId}:`, error);
      throw error;
    }
  },

  async expireModAction(guildId, actionId) {
    try {
      await dbPool.query(
        "UPDATE mod_actions SET is_active = false WHERE guild_id = $1 AND id = $2",
        [guildId, actionId],
      );
    } catch (error) {
      logger.error(`Error expiring mod action ${actionId}:`, error);
      throw error;
    }
  },

  async acknowledgeModAction(guildId, actionId) {
    try {
      await dbPool.query(
        "UPDATE mod_actions SET acknowledged_at = CURRENT_TIMESTAMP WHERE guild_id = $1 AND id = $2",
        [guildId, actionId],
      );
    } catch (error) {
      logger.error(`Error acknowledging mod action ${actionId}:`, error);
      throw error;
    }
  },

  async updateAppealStatus(guildId, actionId, status) {
    try {
      await dbPool.query(
        "UPDATE mod_actions SET appeal_status = $3 WHERE guild_id = $1 AND id = $2",
        [guildId, actionId, status],
      );
    } catch (error) {
      logger.error(
        `Error updating appeal status for action ${actionId}:`,
        error,
      );
      throw error;
    }
  },

  async getRateLimitedActions(
    guildId,
    moderatorId,
    timeWindow = 5 * 60 * 1000,
  ) {
    try {
      const result = await dbPool.query(
        `SELECT COUNT(*) as count FROM mod_actions 
         WHERE guild_id = $1 
         AND moderator_id = $2 
         AND created_at > NOW() - INTERVAL '1 second' * $3`,
        [guildId, moderatorId, timeWindow / 1000],
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error(
        `Error checking rate limit for moderator ${moderatorId}:`,
        error,
      );
      return 0;
    }
  },
};

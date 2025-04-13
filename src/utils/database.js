import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  user: process.env.DB_USER || 'keiran',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'snustalk',
  password: process.env.DB_PASSWORD || 'clara',
  port: parseInt(process.env.DB_PORT || '5432'),
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

const initDb = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database');

    const sqlPath = path.join(__dirname, 'sql', 'session-table.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL file not found at ${sqlPath}`);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sqlContent);
    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    if (error.code === '28000') {
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

await initDb().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

export const db = {
  async saveTicketSettings(guildId, settings) {
    await pool.query(
      'INSERT INTO guild_settings (guild_id, ticket_settings) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET ticket_settings = $2',
      [guildId, settings]
    );
  },

  async getTicketSettings(guildId) {
    const result = await pool.query(
      'SELECT ticket_settings FROM guild_settings WHERE guild_id = $1',
      [guildId]
    );
    return result.rows[0]?.ticket_settings;
  },

  async saveTicketClaim(channelId, moderatorId) {
    await pool.query(
      'INSERT INTO ticket_claims (channel_id, moderator_id) VALUES ($1, $2) ON CONFLICT (channel_id) DO UPDATE SET moderator_id = $2',
      [channelId, moderatorId]
    );
  },

  async removeTicketClaim(channelId) {
    await pool.query('DELETE FROM ticket_claims WHERE channel_id = $1', [channelId]);
  },

  async getTicketClaim(channelId) {
    const result = await pool.query(
      'SELECT moderator_id FROM ticket_claims WHERE channel_id = $1',
      [channelId]
    );
    return result.rows[0]?.moderator_id;
  },

  async addTicketAction(channelId, action) {
    await pool.query(
      'INSERT INTO ticket_actions (channel_id, action) VALUES ($1, $2)',
      [channelId, action]
    );
  },

  async getTicketActions(channelId) {
    const result = await pool.query(
      'SELECT action, timestamp FROM ticket_actions WHERE channel_id = $1 ORDER BY timestamp',
      [channelId]
    );
    return result.rows.map(row => ({
      action: row.action,
      timestamp: row.timestamp.toLocaleString()
    }));
  },

  async clearTicketActions(channelId) {
    await pool.query('DELETE FROM ticket_actions WHERE channel_id = $1', [channelId]);
  },

  async getTicketCounter(guildId) {
    const result = await pool.query(
      'SELECT ticket_counter FROM guild_settings WHERE guild_id = $1',
      [guildId]
    );
    return result.rows[0]?.ticket_counter || { counter: 0 };
  },

  async updateTicketCounter(guildId, counter) {
    await pool.query(
      'INSERT INTO guild_settings (guild_id, ticket_counter) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET ticket_counter = $2',
      [guildId, { counter }]
    );
  },

  async getUserNotes(userId) {
    const result = await pool.query(
      'SELECT notes FROM user_notes WHERE user_id = $1',
      [userId]
    );
    return result.rows[0]?.notes || [];
  },

  async addUserNote(userId, note) {
    await pool.query(
      'INSERT INTO user_notes (user_id, notes) VALUES ($1, ARRAY[$2]) ON CONFLICT (user_id) DO UPDATE SET notes = array_append(user_notes.notes, $2)',
      [userId, note]
    );
    return true;
  },

  async deleteUserNote(userId, noteId) {
    const result = await pool.query(
      'UPDATE user_notes SET notes = array_remove(notes, $2) WHERE user_id = $1 RETURNING *',
      [userId, noteId]
    );
    return result.rowCount > 0;
  },

  async editUserNote(userId, noteId, newContent) {
    const result = await pool.query(
      `UPDATE user_notes 
       SET notes = array_replace(notes, 
         (SELECT unnest(notes) WHERE (notes->>'id')::text = $2), 
         jsonb_build_object('id', $2, 'content', $3, 'edited', $4)
       )
       WHERE user_id = $1`,
      [userId, noteId, newContent, new Date().toISOString()]
    );
    return result.rowCount > 0;
  },

  async addModAction(guildId, action) {
    await pool.query(
      'INSERT INTO mod_actions (guild_id, action) VALUES ($1, $2)',
      [guildId, action]
    );
    return true;
  },

  async getModActions(guildId) {
    const result = await pool.query(
      'SELECT action FROM mod_actions WHERE guild_id = $1',
      [guildId]
    );
    return result.rows.map(row => row.action);
  },

  async removeModAction(guildId, actionId, type) {
    const result = await pool.query(
      'DELETE FROM mod_actions WHERE guild_id = $1 AND action->>.id = $2 AND action->>.type = $3',
      [guildId, actionId, type]
    );
    return result.rowCount > 0;
  },

  // New OAuth-related functions
  async createUser(userData) {
    const result = await pool.query(
      `INSERT INTO users (discord_id, username, email, avatar, access_token, refresh_token)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (discord_id) 
       DO UPDATE SET
         username = $2,
         email = $3,
         avatar = $4,
         access_token = $5,
         refresh_token = $6
       RETURNING *`,
      [
        userData.id,
        userData.username,
        userData.email,
        userData.avatar,
        userData.accessToken,
        userData.refreshToken
      ]
    );
    return result.rows[0];
  },

  async getUserById(discordId) {
    const result = await pool.query(
      'SELECT * FROM users WHERE discord_id = $1',
      [discordId]
    );
    return result.rows[0];
  }
};
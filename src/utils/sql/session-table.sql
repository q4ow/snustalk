CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  ticket_settings JSONB,
  ticket_counter JSONB
);

CREATE TABLE IF NOT EXISTS ticket_claims (
  channel_id TEXT PRIMARY KEY,
  moderator_id TEXT
);

CREATE TABLE IF NOT EXISTS ticket_actions (
  channel_id TEXT,
  action JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_notes (
  user_id TEXT,
  notes JSONB[]
);

CREATE TABLE IF NOT EXISTS mod_actions (
  guild_id TEXT,
  action JSONB
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  discord_id TEXT UNIQUE,
  username TEXT,
  email TEXT,
  avatar TEXT,
  access_token TEXT,
  refresh_token TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
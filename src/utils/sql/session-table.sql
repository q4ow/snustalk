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

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  channel_id TEXT NOT NULL UNIQUE,
  guild_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  ticket_number INTEGER NOT NULL,
  ticket_type TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,
  closed_by TEXT
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS automod_settings (
  guild_id TEXT PRIMARY KEY,
  settings JSONB
);

CREATE TABLE IF NOT EXISTS typing_scores (
  user_id TEXT PRIMARY KEY,
  top_wpm INTEGER NOT NULL,
  accuracy FLOAT,
  test_duration INTEGER,
  total_tests INTEGER DEFAULT 0,
  average_wpm FLOAT,
  last_submission TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_typing_scores_wpm ON typing_scores(top_wpm DESC);
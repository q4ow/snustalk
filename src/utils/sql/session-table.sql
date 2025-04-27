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
  ticket_counter JSONB,
  welcome_message TEXT,
  goodbye_message TEXT,
  channel_ids JSONB DEFAULT '{
    "welcome": null,
    "goodbye": null,
    "verification": null,
    "applications": null,
    "applications_logs": null,
    "ticket_logs": null,
    "stats_members": null,
    "stats_bots": null,
    "stats_total_tickets": null,
    "stats_open_tickets": null,
    "ticket_category": null
  }',
  role_ids JSONB DEFAULT '{
    "verified": null,
    "unverified": null,
    "management": null,
    "staff": null,
    "moderator": null,
    "muted": null,
    "additional_verified": []
  }',
  api_keys JSONB DEFAULT '{
    "ez_host": null
  }',
  external_links JSONB DEFAULT '{
    "restorecord": null
  }',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'guild_settings' 
        AND column_name = 'raid_protection'
    ) THEN
        ALTER TABLE guild_settings 
        ADD COLUMN raid_protection JSONB DEFAULT '{
            "enabled": false,
            "alertChannel": null,
            "joinThreshold": 10,
            "joinTimeWindow": 10000,
            "accountAgeDays": 7,
            "actionType": "lockdown",
            "autoModeDuration": 300000,
            "exemptRoles": [],
            "similarNameThreshold": 0.85,
            "mentionThreshold": 15,
            "lockdownDuration": 300000,
            "lockdownMessage": "Server is currently in lockdown mode due to potential raid activity.",
            "exemptChannels": [],
            "notifyRole": null
        }'::jsonb;
    END IF;
END $$;

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

DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tickets' 
        AND column_name = 'closed_by'
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE tickets 
        ALTER COLUMN closed_by TYPE TEXT;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS ticket_messages (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  discord_id TEXT UNIQUE,
  username TEXT,
  email TEXT,
  avatar TEXT,
  access_token TEXT,
  refresh_token TEXT,
  api_key TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS automod_settings (
  guild_id TEXT PRIMARY KEY,
  settings JSONB
);

CREATE TABLE IF NOT EXISTS logging_settings (
    guild_id TEXT NOT NULL,
    log_type TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    allowed_roles TEXT[] DEFAULT '{}',
    ping_roles TEXT[] DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, log_type)
);

CREATE TABLE IF NOT EXISTS giveaways (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL UNIQUE,
    host_id TEXT NOT NULL,
    prize TEXT NOT NULL,
    description TEXT,
    winner_count INTEGER NOT NULL DEFAULT 1,
    ends_at TIMESTAMP NOT NULL,
    ended BOOLEAN DEFAULT FALSE,
    requirements JSONB DEFAULT '{}',
    blacklisted_users TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS giveaway_entries (
    giveaway_id INTEGER REFERENCES giveaways(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (giveaway_id, user_id)
);

CREATE TABLE IF NOT EXISTS reaction_roles (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) NOT NULL,
    channel_id VARCHAR(255) NOT NULL,
    roles_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id)
);

CREATE TABLE IF NOT EXISTS join_velocity (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    join_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS raid_incidents (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    incident_type TEXT NOT NULL,
    details TEXT,
    action_taken TEXT,
    affected_users TEXT[] DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS join_events (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT join_events_guild_id_fk FOREIGN KEY (guild_id) 
        REFERENCES guild_settings(guild_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_join_events_guild_timestamp 
ON join_events(guild_id, timestamp);
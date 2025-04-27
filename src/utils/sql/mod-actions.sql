CREATE TABLE IF NOT EXISTS mod_actions (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    reason TEXT,
    duration BIGINT,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    requires_acknowledgment BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMP,
    appeal_status TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_ban_timeout 
ON mod_actions (guild_id, target_id, action_type) 
WHERE action_type IN ('ban', 'timeout') AND is_active = true;
CREATE TABLE IF NOT EXISTS reaction_roles (
    message_id VARCHAR(255) PRIMARY KEY,
    channel_id VARCHAR(255) NOT NULL,
    roles_data JSONB NOT NULL
);
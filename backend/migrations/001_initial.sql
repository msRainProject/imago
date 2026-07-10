-- 001_initial.sql
-- Initial schema for Hill Images

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'user',
    web_authn_id BLOB,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    deleted_at DATETIME
);

CREATE TABLE IF NOT EXISTS images (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    path VARCHAR(512) NOT NULL,
    thumb_path VARCHAR(512),
    size INTEGER NOT NULL DEFAULT 0,
    mime_type VARCHAR(64),
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    storage_driver VARCHAR(16) NOT NULL DEFAULT 'local',
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    deleted_at DATETIME
);

CREATE TABLE IF NOT EXISTS tokens (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(16) NOT NULL,
    expires_at DATETIME NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    deleted_at DATETIME
);

CREATE TABLE IF NOT EXISTS config_entries (
    id VARCHAR(36) PRIMARY KEY,
    key VARCHAR(128) NOT NULL UNIQUE,
    value TEXT,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    deleted_at DATETIME
);

CREATE TABLE IF NOT EXISTS jwt_blacklists (
    id VARCHAR(36) PRIMARY KEY,
    token_jti VARCHAR(36) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    deleted_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_deleted_at ON images(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_deleted_at ON tokens(deleted_at);
CREATE INDEX IF NOT EXISTS idx_config_entries_deleted_at ON config_entries(deleted_at);
CREATE INDEX IF NOT EXISTS idx_jwt_blacklists_expires_at ON jwt_blacklists(expires_at);
CREATE INDEX IF NOT EXISTS idx_jwt_blacklists_deleted_at ON jwt_blacklists(deleted_at);

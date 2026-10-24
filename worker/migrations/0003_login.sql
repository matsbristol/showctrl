-- showctrl's own sign-in. Run once on databases created before it:
--   npx wrangler d1 execute showctrl --file worker/migrations/0003_login.sql [--local|--remote]
-- Sign-in (worker/login.ts): pending codes, a send log for rate limits, and sessions.
-- Codes and session tokens are stored only as SHA-256 hashes.
CREATE TABLE IF NOT EXISTS login_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_sends (
  key TEXT NOT NULL,            -- 'ip:<address>' or 'e:<email>'
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS login_sends_key ON login_sends (key, at);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_email ON sessions (email);

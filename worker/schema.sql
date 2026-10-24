-- D1: organisations, the index of events and who belongs to which. Event data itself lives in each
-- event's Durable Object. Apply with: npx wrangler d1 execute showctrl --file worker/schema.sql [--local|--remote]
-- (New databases only. Older ones also need worker/migrations/0002_orgs.sql.)

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner TEXT NOT NULL,          -- email; always Festival admin
  created_at INTEGER NOT NULL,
  org_id TEXT                   -- the organisation (customer) it belongs to
);
CREATE INDEX IF NOT EXISTS events_org ON events (org_id);

-- Customers: folders that group events for superadmins. They give nobody access.
CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- No longer used: superadmins create events and name each event's admins (kept so old databases still match).
CREATE TABLE IF NOT EXISTS org_admins (
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  PRIMARY KEY (org_id, email)
);
CREATE INDEX IF NOT EXISTS org_admins_email ON org_admins (email);

-- Kept in step by each event's Durable Object whenever members or stage teams change.
CREATE TABLE IF NOT EXISTS memberships (
  event_id TEXT NOT NULL,
  email TEXT NOT NULL,
  PRIMARY KEY (event_id, email)
);
CREATE INDEX IF NOT EXISTS memberships_email ON memberships (email);

-- Per-user state that isn't tied to one event, so it follows the user across devices.
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  last_event TEXT,
  seen_at INTEGER
);

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

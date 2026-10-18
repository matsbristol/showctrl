-- D1: the index of events and who belongs to which. Event data itself lives in each
-- event's Durable Object. Apply with: npx wrangler d1 execute showctrl --file worker/schema.sql [--local|--remote]

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner TEXT NOT NULL,          -- email; always Festival admin
  created_at INTEGER NOT NULL
);

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

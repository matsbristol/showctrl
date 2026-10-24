-- Organisations (customers). Run once on databases created before organisations:
--   npx wrangler d1 execute showctrl --file worker/migrations/0002_orgs.sql [--local|--remote]
CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS org_admins (
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  PRIMARY KEY (org_id, email)
);
CREATE INDEX IF NOT EXISTS org_admins_email ON org_admins (email);
ALTER TABLE events ADD COLUMN org_id TEXT;
CREATE INDEX IF NOT EXISTS events_org ON events (org_id);

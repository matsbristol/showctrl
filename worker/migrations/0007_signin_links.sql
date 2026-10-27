-- Sign-in links that superadmins hand out when a sign-in email doesn't arrive.
-- Run once on databases created before it:
--   npx wrangler d1 execute showctrl-eu --file worker/migrations/0007_signin_links.sql [--local|--remote]
CREATE TABLE IF NOT EXISTS signin_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_used_at INTEGER,
  uses INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS signin_links_email ON signin_links (email);

-- The sign-in email's link: a one-time token next to the code, valid as long as the code.
-- Run once on databases created before it:
--   npx wrangler d1 execute showctrl-eu --file worker/migrations/0009_login_link.sql [--local|--remote]
ALTER TABLE login_codes ADD COLUMN link_hash TEXT;

-- The browser that asked for the code (hash of its sc_browser cookie). The email's link signs in
-- straight away only in that browser; anywhere else (another device, a mail scanner) it asks first.
-- Run once on databases created before it:
--   npx wrangler d1 execute showctrl-eu --file worker/migrations/0010_login_browser.sql [--local|--remote]
ALTER TABLE login_codes ADD COLUMN browser_hash TEXT;

-- Each person's interface language. Run once on databases created before it:
--   npx wrangler d1 execute showctrl-eu --file worker/migrations/0006_user_lang.sql [--local|--remote]
ALTER TABLE users ADD COLUMN lang TEXT;

-- The typeface each person picked. Run once on databases created before it:
--   npx wrangler d1 execute showctrl --file worker/migrations/0004_user_font.sql [--local|--remote]
ALTER TABLE users ADD COLUMN font TEXT;

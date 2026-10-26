-- The name each person goes by. Run once on databases created before it:
--   npx wrangler d1 execute showctrl --file worker/migrations/0005_user_name.sql [--local|--remote]
ALTER TABLE users ADD COLUMN name TEXT;

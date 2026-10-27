-- Analytics: sign-ins, and which pages each person opens per event per day.
-- Run once on databases created before it:
--   npx wrangler d1 execute showctrl-eu --file worker/migrations/0008_activity.sql [--local|--remote]
CREATE TABLE IF NOT EXISTS signins (
  at INTEGER NOT NULL,
  email TEXT NOT NULL,
  method TEXT NOT NULL,          -- 'code', 'link' (from a superadmin) or 'email-link'
  country TEXT,
  device TEXT
);
CREATE INDEX IF NOT EXISTS signins_at ON signins (at);
CREATE TABLE IF NOT EXISTS usage_daily (
  day TEXT NOT NULL,             -- YYYY-MM-DD, Oslo time
  email TEXT NOT NULL,
  event_id TEXT NOT NULL,
  view TEXT NOT NULL,            -- 'hq/<view>' or 'stage/<view>'
  count INTEGER NOT NULL DEFAULT 0,
  first_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  PRIMARY KEY (day, email, event_id, view)
);
CREATE INDEX IF NOT EXISTS usage_daily_day ON usage_daily (day);

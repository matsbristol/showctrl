import type { EventObject } from './event'

export interface Env {
  ASSETS: Fetcher
  DB: D1Database
  EVENT: DurableObjectNamespace<EventObject>
  /** Uploaded documents. Keys are `<eventId>/<uuid>`. Without it, uploads are off and links still work. */
  FILES?: R2Bucket
  /** Nightly backups (EU jurisdiction). Without it, the nightly run only logs that it skipped. */
  BACKUPS?: R2Bucket

  /** Sends sign-in codes (Cloudflare Email Service; the from domain must be enabled for sending). */
  EMAIL?: SendEmail
  /** The site's address, for links in emails. Default https://showctrl.no. */
  PUBLIC_URL?: string
  /** Sender of sign-in codes. Default login@showctrl.no. */
  LOGIN_FROM?: string

  /** Admin → Import reads pasted text with Claude. Secret: `npx wrangler secret put ANTHROPIC_API_KEY`. */
  ANTHROPIC_API_KEY?: string

  /** "eu": events are stored in Cloudflare's EU jurisdiction. "local-eu" stands in for it under `wrangler dev`. */
  EVENT_JURISDICTION?: string

  /** Optional: Cloudflare Access in front of the site, e.g. https://yourteam.cloudflareaccess.com */
  ACCESS_TEAM_DOMAIN?: string
  /** The Access application's "Application Audience (AUD) tag". */
  ACCESS_AUD?: string
  /** Who runs showctrl itself (comma-separated emails): they add organisations and their first admins. */
  SUPERADMINS?: string
  /** Local development only (.dev.vars). Ignored once ACCESS_AUD is set. */
  DEV_USER_EMAIL?: string
}

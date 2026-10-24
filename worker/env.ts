import type { EventObject } from './event'

export interface Env {
  ASSETS: Fetcher
  DB: D1Database
  EVENT: DurableObjectNamespace<EventObject>
  /** Uploaded documents. Keys are `<eventId>/<uuid>`. Without it, uploads are off and links still work. */
  FILES?: R2Bucket

  /** Sends sign-in codes (Cloudflare Email Service; the from domain must be enabled for sending). */
  EMAIL?: SendEmail
  /** Sender of sign-in codes. Default login@showctrl.no. */
  LOGIN_FROM?: string

  /** Optional: Cloudflare Access in front of the site, e.g. https://yourteam.cloudflareaccess.com */
  ACCESS_TEAM_DOMAIN?: string
  /** The Access application's "Application Audience (AUD) tag". */
  ACCESS_AUD?: string
  /** Who runs showctrl itself (comma-separated emails): they add organisations and their first admins. */
  SUPERADMINS?: string
  /** Local development only (.dev.vars). Ignored once ACCESS_AUD is set. */
  DEV_USER_EMAIL?: string
}

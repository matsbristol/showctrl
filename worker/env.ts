import type { EventObject } from './event'

export interface Env {
  ASSETS: Fetcher
  DB: D1Database
  EVENT: DurableObjectNamespace<EventObject>
  /** Uploaded documents. Keys are `<eventId>/<uuid>`. Without it, uploads are off and links still work. */
  FILES?: R2Bucket

  /** e.g. https://yourteam.cloudflareaccess.com */
  ACCESS_TEAM_DOMAIN?: string
  /** The Access application's "Application Audience (AUD) tag". */
  ACCESS_AUD?: string
  /** Who may create events: comma-separated emails, or * for anyone who gets past Access. */
  CREATORS?: string
  /** Local development only (.dev.vars). Ignored once ACCESS_AUD is set. */
  DEV_USER_EMAIL?: string
}

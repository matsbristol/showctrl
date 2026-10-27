// What GET /api/analytics returns (worker/analytics.ts), for the superadmins' Analytics page.

export interface Analytics {
  days: number
  superadmins: string[]
  names: Record<string, string>
  events: { id: string; name: string; org: string | null }[]
  signins: { at: number; email: string; method: string; country: string | null; device: string | null }[]
  usage: { email: string; event: string; view: string; n: number; days: number; last: number }[]
  daily: { day: string; users: number; views: number }[]
  edits: { event: string; actor: string; col: string; n: number; last: number }[]
}

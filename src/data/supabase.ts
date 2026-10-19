/*
 * The Supabase client, or null in demo mode. Live mode switches on when both
 * VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set (in
 * `.env.local` for development). Without them the app runs on the sample
 * festival in this browser, as before.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { offsetFromServerMs, type OffsetSource } from '../clock/clock'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

/** Server time from Postgres (`server_now()`), for the shared clock. */
export const serverClock = (sb: SupabaseClient): OffsetSource => async () => {
  const t0 = Date.now()
  const { data, error } = await sb.rpc('server_now')
  const t1 = Date.now()
  if (error || typeof data !== 'number') return null
  return offsetFromServerMs(t0, t1, data)
}

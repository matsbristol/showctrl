/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Set it (and the key) to run in live mode. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase publishable (anon) key: safe in the browser, row-level security does the guarding. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

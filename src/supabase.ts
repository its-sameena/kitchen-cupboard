import { createClient } from '@supabase/supabase-js'

/** Accept a pasted URL with a path (e.g. ".../rest/v1/") and keep only the origin. */
function projectUrl(raw: string | undefined) {
  if (!raw) return undefined
  try {
    return new URL(raw.trim()).origin
  } catch {
    return undefined
  }
}

const url = projectUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined)
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const isConfigured = Boolean(url && key)

export const sb = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

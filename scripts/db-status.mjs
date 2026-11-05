// Shows which migrations your live Supabase database has (read-only).
// Usage: npm run db:status   (needs VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local)
import { createClient } from '@supabase/supabase-js'

try {
  process.loadEnvFile('.env.local')
} catch {
  /* use the real environment */
}
const url = process.env.VITE_SUPABASE_URL && new URL(process.env.VITE_SUPABASE_URL.trim()).origin
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })
const colExists = async (table, col) => !(await sb.from(table).select(col).limit(1)).error

// One check per migration file, oldest first.
const checks = [
  ['20261104000000_kitchen_cupboard.sql', () => colExists('devices', 'kitchen_id')],
  ['20261105000000_feedback_edit_and_icons.sql', () => colExists('feedback', 'edited_at')],
  ['20261106000000_unique_profile_colours.sql', async () => {
    // Indexes aren't visible over the API: report duplicates (= definitely missing) or "likely".
    const { data: rows } = await sb.from('members').select('kitchen_id, color')
    const seen = new Set()
    for (const r of rows ?? []) {
      const k = r.kitchen_id + r.color.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
    }
    return 'likely'
  }],
  ['20261107000000_profile_avatars.sql', () => colExists('members', 'avatar')],
]

let pending = 0
for (const [file, check] of checks) {
  const ok = await check()
  if (!ok) pending++
  console.log(`${ok === true ? '✔ applied ' : ok ? '? likely  ' : '✘ MISSING '} ${file}`)
}
console.log(pending ? `\nRun the MISSING files in Supabase → SQL Editor, oldest first.` : '\nDatabase is up to date.')

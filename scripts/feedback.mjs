// Read and triage in-app feedback (developer tool, uses the service-role key).
//
//   npm run feedback                       open feedback (new / planned / in progress)
//   npm run feedback -- --all              everything
//   npm run feedback -- set <id> <status> ["reply shown in the app"]
//
// status: new | planned | in_progress | done | wont_do
// Needs VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
// (the service-role key is never bundled into the app: Vite only exposes VITE_* vars).
import { createClient } from '@supabase/supabase-js'

try {
  process.loadEnvFile('.env.local')
} catch {
  /* fall back to the real environment */
}
const url = process.env.VITE_SUPABASE_URL && new URL(process.env.VITE_SUPABASE_URL.trim()).origin
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase → Project Settings → API).')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })
const STATUSES = ['new', 'planned', 'in_progress', 'done', 'wont_do']
const [cmd, ...args] = process.argv.slice(2)

if (cmd === 'set') {
  const [idPrefix, status, ...replyWords] = args
  if (!idPrefix || !STATUSES.includes(status)) {
    console.error(`Usage: npm run feedback -- set <id> <${STATUSES.join('|')}> ["reply"]`)
    process.exit(1)
  }
  const { data: all, error: e1 } = await sb.from('feedback').select('id')
  if (e1) throw e1
  const matches = all.filter((f) => f.id.startsWith(idPrefix))
  if (matches.length !== 1) {
    console.error(matches.length ? 'Ambiguous id prefix' : 'No feedback with that id')
    process.exit(1)
  }
  const patch = { status }
  if (replyWords.length) patch.reply = replyWords.join(' ')
  const { error } = await sb.from('feedback').update(patch).eq('id', matches[0].id)
  if (error) throw error
  console.log(`Updated ${matches[0].id.slice(0, 8)} → ${status}${patch.reply ? ` (reply: ${patch.reply})` : ''}`)
} else {
  let q = sb.from('feedback').select('*, kitchens(name)').order('created_at', { ascending: true })
  if (cmd !== '--all') q = q.in('status', ['new', 'planned', 'in_progress'])
  const { data, error } = await q
  if (error) throw error
  if (!data.length) {
    console.log('No open feedback 🎉')
  } else {
    const icon = { bug: '🐞', idea: '💡', other: '💬' }
    console.log(`# Feedback (${data.length}${cmd === '--all' ? '' : ' open'})\n`)
    for (const f of data) {
      const c = f.context ?? {}
      console.log(`## ${icon[f.kind]} ${f.kind} · ${f.status} · id ${f.id.slice(0, 8)}`)
      console.log(`From ${f.member_name} (${f.kitchens?.name ?? 'kitchen'}) on ${new Date(f.created_at).toLocaleString()}`)
      console.log(`Context: screen=${c.screen ?? '?'} version=${c.version ?? '?'} viewport=${c.viewport ?? '?'} installed=${c.standalone ?? '?'}`)
      if (c.userAgent) console.log(`Device: ${c.userAgent}`)
      console.log(`\n> ${f.message.replace(/\n/g, '\n> ')}\n`)
      if (f.reply) console.log(`Reply: ${f.reply}\n`)
    }
  }
}

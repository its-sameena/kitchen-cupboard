// Dev-only Vite plugin behind the tuning page (`npm run tune` → /tools/tune/).
// It only runs with `vite` (dev server), never in `vite build`, so none of this
// reaches the live site. Endpoints:
//   GET  /__tune/library   every Lucide, Lucide Lab and Tabler outline icon (for search)
//   POST /__tune/save      { icons?, keywords?, tests? } → rewrites those src/catalog/* files
//   GET  /__tune/reports   "wrong guess" reports from the app (needs SUPABASE_SERVICE_ROLE_KEY)
//   POST /__tune/reports   { id, status, reply } → updates one report
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { itemIconsFile, keywordsFile, keywordTestsFile } from './serialize.mjs'
import { parseSvg } from './svg.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const path = (p) => root + p
const SCANNER = 'supabase/functions/scan-receipt/gemini.ts'

async function body(req) {
  let s = ''
  for await (const chunk of req) s += chunk
  return JSON.parse(s || '{}')
}
const send = (res, status, data) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

let library
async function loadLibrary() {
  if (library) return library
  const [{ createElement }, { renderToStaticMarkup }, lucide, lab] = await Promise.all([
    import('react'),
    import('react-dom/server'),
    import('lucide-react'),
    import('@lucide/lab'),
  ])
  const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Za-z])([0-9])/g, '$1-$2').toLowerCase()
  const strip = (node) => node.map(([t, a]) => [t, Object.fromEntries(Object.entries(a).filter(([k]) => k !== 'key'))])
  const out = []
  for (const [name, Icon] of Object.entries(lucide.icons)) {
    out.push({ source: 'lucide', name: kebab(name), tags: [], node: parseSvg(renderToStaticMarkup(createElement(Icon))).node })
  }
  for (const [name, node] of Object.entries(lab)) {
    if (Array.isArray(node)) out.push({ source: 'lucide-lab', name: kebab(name), tags: [], node: strip(node) })
  }
  const tablerNodes = JSON.parse(readFileSync(path('node_modules/@tabler/icons/tabler-nodes-outline.json'), 'utf8'))
  const tablerInfo = JSON.parse(readFileSync(path('node_modules/@tabler/icons/icons.json'), 'utf8'))
  for (const [name, node] of Object.entries(tablerNodes)) {
    const info = tablerInfo[name] ?? {}
    const clean = parseSvg(`<svg viewBox="0 0 24 24">${node.map(([t, a]) => `<${t} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('')}</svg>`).node
    out.push({ source: 'tabler', name, tags: [...(info.tags ?? []), info.category ?? ''].map(String), node: clean })
  }
  library = out
  return out
}

let supabase
async function db() {
  if (supabase) return supabase
  try {
    process.loadEnvFile(path('.env.local'))
  } catch {
    /* real environment */
  }
  const url = process.env.VITE_SUPABASE_URL && new URL(process.env.VITE_SUPABASE_URL.trim()).origin
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Add SUPABASE_SERVICE_ROLE_KEY to .env.local to see reports (it stays on your Mac).')
  const { createClient } = await import('@supabase/supabase-js')
  supabase = createClient(url, key, { auth: { persistSession: false } })
  return supabase
}

function save(kind, data, dryRun = false) {
  if (kind === 'icons') {
    if (!data || typeof data !== 'object') throw new Error('Bad icons')
    for (const [k, ic] of Object.entries(data)) {
      if (!/^[a-z][a-z0-9-]{0,15}$/.test(k)) throw new Error(`Icon key "${k}": use 1–16 lower-case letters, digits or dashes.`)
      if (!ic.label || !Array.isArray(ic.node) || !ic.node.length) throw new Error(`Icon "${k}" needs a label and a drawing.`)
    }
    if (dryRun) return
    writeFileSync(path('src/catalog/item-icons.ts'), itemIconsFile(data))
    // The receipt scanner keeps its own list of icon keys.
    const fn = readFileSync(path(SCANNER), 'utf8')
    const list = JSON.stringify(Object.keys(data)).replaceAll('","', '", "')
    writeFileSync(path(SCANNER), fn.replace(/const ICONS = \[.*?\]/s, `const ICONS = ${list}`))
  } else if (kind === 'keywords') {
    if (!Array.isArray(data)) throw new Error('Bad keywords')
    if (dryRun) return
    writeFileSync(path('src/catalog/keywords.ts'), keywordsFile(data.filter((r) => r.keywords.length)))
  } else if (kind === 'tests') {
    if (!Array.isArray(data)) throw new Error('Bad tests')
    if (dryRun) return
    writeFileSync(path('src/catalog/keyword-tests.ts'), keywordTestsFile(data))
  } else {
    throw new Error('Unknown kind')
  }
}

export default function tunePlugin() {
  return {
    name: 'kitchen-cupboard-tune',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__tune/')) return next()
        try {
          const route = `${req.method} ${req.url.split('?')[0]}`
          if (route === 'GET /__tune/library') return send(res, 200, await loadLibrary())
          if (route === 'POST /__tune/save') {
            const parts = await body(req)
            // Validate everything first, so a bad part doesn't leave half the files written.
            const order = ['tests', 'keywords', 'icons'].filter((k) => parts[k] !== undefined)
            for (const k of order) save(k, parts[k], true)
            for (const k of order) save(k, parts[k])
            return send(res, 200, { ok: true })
          }
          if (route === 'GET /__tune/reports') {
            const { data, error } = await (await db())
              .from('feedback')
              .select('id, member_name, message, context, status, created_at, kitchens(name)')
              .not('context->iconGuess', 'is', null)
              .in('status', ['new', 'planned', 'in_progress'])
              .order('created_at', { ascending: false })
            if (error) throw error
            return send(res, 200, data)
          }
          if (route === 'POST /__tune/reports') {
            const { id, status, reply } = await body(req)
            const patch = { status }
            if (reply) patch.reply = reply
            const { error } = await (await db()).from('feedback').update(patch).eq('id', id)
            if (error) throw error
            return send(res, 200, { ok: true })
          }
          send(res, 404, { error: 'Not found' })
        } catch (e) {
          send(res, 500, { error: e instanceof Error ? e.message : String(e) })
        }
      })
    },
  }
}

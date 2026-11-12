// Receipt-scanning benchmark: how fast and how accurate is each Gemini setup?
//
//   npm run bench:receipts                    every setup below, 2 runs each
//   npm run bench:receipts -- --runs 1        fewer calls (saves free quota)
//   npm run bench:receipts -- --only A,D      just some setups
//
// Needs: photos in receipts/ (jpg/png/heic; gitignored, never committed) and
// GEMINI_API_KEY in .env.local. Uses your free Gemini quota: setups × photos × runs calls.
// Optional: receipts/<photo name>.txt with the correct items, one per line, to
// score against the truth instead of against setup A.
// Writes a full report to receipts/bench-<date>.md. See docs/receipt-speed.md.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { clean, endpoint, readResponse, requestBody } from '../supabase/functions/scan-receipt/gemini.ts'
import { suggestFor, words } from '../src/data.ts'

/** The setups to compare. A = what the live app does today. */
const SETUPS = {
  A: { label: 'today (full answer, default thinking, 1600px colour)', model: 'gemini-flash-latest', shape: 'full', thinking: 'default', px: 1600, grey: false, q: 82 },
  B: { label: 'minimal thinking', model: 'gemini-flash-latest', shape: 'full', thinking: 'minimal', px: 1600, grey: false, q: 82 },
  C: { label: 'minimal thinking + slim answer', model: 'gemini-flash-latest', shape: 'slim', thinking: 'minimal', px: 1600, grey: false, q: 82 },
  D: { label: 'C + 1200px grey photo', model: 'gemini-flash-latest', shape: 'slim', thinking: 'minimal', px: 1200, grey: true, q: 70 },
  E: { label: 'D on the lite model', model: 'gemini-flash-lite-latest', shape: 'slim', thinking: 'minimal', px: 1200, grey: true, q: 70 },
  // Lite-only comparisons (the main Flash model's free tier is only ~20 requests/day)
  L: { label: 'lite, today\'s full answer, 1600px colour', model: 'gemini-flash-lite-latest', shape: 'full', thinking: 'default', px: 1600, grey: false, q: 82 },
  N: { label: 'lite, name + quantity + shelf (app picks icon), 1600px colour', model: 'gemini-flash-lite-latest', shape: 'shelf', thinking: 'default', px: 1600, grey: false, q: 82 },
  M: { label: 'lite, slim answer, 1600px colour', model: 'gemini-flash-lite-latest', shape: 'slim', thinking: 'default', px: 1600, grey: false, q: 82 },
}
// If a model rejects a thinking setting, try the next one down this list.
const THINKING_FALLBACK = { minimal: ['minimal', 'low', 'off-budget', 'default'], low: ['low', 'off-budget', 'default'], default: ['default'] }

// ───────────────────────── setup ─────────────────────────
const args = process.argv.slice(2)
const arg = (name, dflt) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : dflt
}
const RUNS = Math.max(1, Number(arg('runs', 2)))
/** Longer than the app would ever wait (15 s); a call past this counts as a stall. */
const CALL_LIMIT_MS = Number(arg('limit', 20)) * 1000
const ONLY = arg('only', 'A,B,C,D,E').split(',').map((s) => s.trim().toUpperCase())

try {
  process.loadEnvFile('.env.local')
} catch {
  /* real environment */
}
const KEY = (process.env.GEMINI_API_KEY ?? '').trim()
if (!KEY) {
  console.error('Add GEMINI_API_KEY=... (the same key as the Supabase secret) to .env.local.')
  process.exit(1)
}
const DIR = 'receipts'
const PREFIX = arg('photos', '') // only photos whose name starts with this
const photos = existsSync(DIR) ? readdirSync(DIR).filter((f) => /\.(jpe?g|png|heic|heif|webp)$/i.test(f) && f.startsWith(PREFIX)) : []
if (!photos.length) {
  console.error('Put 3–5 receipt photos in receipts/ (crop out card numbers first).')
  process.exit(1)
}
const cache = join(DIR, '.cache')
mkdirSync(cache, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor((s.length - 1) / 2)] : 0
}
const fmtS = (ms) => (ms / 1000).toFixed(1) + 's'

/** Resize like the app does (long side ≤ px, JPEG), optionally greyscale. Returns base64 + KB. */
function prepare(photo, px, grey, q) {
  const out = join(cache, `${basename(photo, extname(photo))}-${px}${grey ? '-grey' : ''}-q${q}.jpg`)
  if (!existsSync(out)) {
    const a = ['-Z', String(px), '-s', 'format', 'jpeg', '-s', 'formatOptions', String(q)]
    if (grey) a.push('-m', '/System/Library/ColorSync/Profiles/Generic Gray Profile.icc')
    execFileSync('sips', [...a, join(DIR, photo), '--out', out], { stdio: 'ignore' })
  }
  const buf = readFileSync(out)
  return { b64: buf.toString('base64'), kb: Math.round(buf.length / 1024) }
}

/** One Gemini call, with retries for busy/quota and thinking-setting fallback. */
async function scan(setup, image, thinkingOk) {
  let busy = 0
  const ladder = thinkingOk[setup.model + setup.thinking] ? [thinkingOk[setup.model + setup.thinking]] : THINKING_FALLBACK[setup.thinking]
  for (const thinking of ladder) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const t0 = performance.now()
      const res = await fetch(endpoint(setup.model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
        body: JSON.stringify(requestBody(image, 'image/jpeg', { model: setup.model, shape: setup.shape, thinking })),
        signal: AbortSignal.timeout(CALL_LIMIT_MS),
      })
      const ms = performance.now() - t0
      if (res.ok) {
        thinkingOk[setup.model + setup.thinking] = thinking
        const r = readResponse(await res.json())
        let parsed = { store: '', items: [] }
        try {
          parsed = clean(JSON.parse(r.text))
        } catch {
          /* empty answer */
        }
        return { ms, thinking, busy, usage: r.usage, modelVersion: r.modelVersion, ...parsed }
      }
      const text = await res.text()
      if (res.status === 429 || res.status >= 500) {
        busy++
        if (attempt === 2) throw new Error(`${setup.model} busy: ${res.status} three times in a row (Google overloaded or quota used up)`)
        const wait = res.status === 429 ? 35_000 : 5_000
        console.log(`   ${setup.model} ${res.status}, waiting ${wait / 1000}s…`)
        await sleep(wait)
        continue
      }
      if (res.status === 400 && /thinking/i.test(text)) break // try the next thinking setting
      throw new Error(`${setup.model} ${res.status}: ${text.slice(0, 200)}`)
    }
  }
  throw new Error(`${setup.model}: no thinking setting worked`)
}

/** Match items by name (normalised; "Milk" ~ "Semi skimmed milk"). */
function compare(got, ref) {
  const norm = (s) => words(s)
  const used = new Set()
  const pairs = []
  for (const g of got) {
    const gw = norm(g.name)
    const i = ref.findIndex((r, j) => {
      if (used.has(j)) return false
      const rw = norm(r.name)
      return gw === rw || (` ${gw} `.includes(` ${rw} `) || ` ${rw} `.includes(` ${gw} `))
    })
    if (i >= 0) {
      used.add(i)
      pairs.push([g, ref[i]])
    }
  }
  return {
    matched: pairs.length,
    missing: ref.filter((_, j) => !used.has(j)).map((r) => r.name),
    extra: got.filter((g) => !pairs.some(([p]) => p === g)).map((g) => g.name),
    qtyDiff: pairs.filter(([g, r]) => r.quantity && g.quantity !== r.quantity).length,
    shelfAgree: pairs.filter(([g, r]) => !r.category || shelfOf(g) === r.category).length,
  }
}
/** Shelf the app would use: Gemini's (full answer) or the app's own guesser (slim answer). */
const shelfOf = (it) => it.category || suggestFor(it.name)?.category || 'other'

// ───────────────────────── run ─────────────────────────
console.log(`Photos: ${photos.join(', ')}`)
for (const m of [...new Set(ONLY.map((k) => SETUPS[k]?.model).filter(Boolean))]) {
  const info = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}`, { headers: { 'x-goog-api-key': KEY } }).then((r) => r.json())
  console.log(`Model ${m} → ${info.displayName ?? info.name ?? '?'} (version ${info.version ?? '?'})`)
}
console.log(`Setups ${ONLY.join(', ')} × ${photos.length} photos × ${RUNS} runs = ${ONLY.length * photos.length * RUNS} Gemini calls\n`)

const results = {} // setup → photo → [run results]
const failures = {} // setup → [error messages]
const stalls = {} // setup → calls with no answer in time
const thinkingOk = {}
for (const photo of photos) {
  for (const k of ONLY) {
    const s = SETUPS[k]
    if (!s) continue
    const img = prepare(photo, s.px, s.grey, s.q)
    for (let run = 0; run < RUNS; run++) {
      try {
        const r = await scan(s, img.b64, thinkingOk)
        ;(results[k] ??= {})[photo] ??= []
        results[k][photo].push({ ...r, kb: img.kb })
        console.log(`${k} ${photo} run ${run + 1}: ${fmtS(r.ms)}${r.busy ? ` (after ${r.busy} busy retries)` : ''} · ${r.items.length} items · thinking ${r.usage.thinking} · answer ${r.usage.output} tokens (${r.thinking})`)
      } catch (e) {
        const stalled = /timeout|aborted/i.test(e.message)
        console.log(`${k} ${photo} run ${run + 1}: ${stalled ? `STALLED (no answer in ${CALL_LIMIT_MS / 1000}s)` : `FAILED ${e.message}`}`)
        if (stalled) (stalls[k] = (stalls[k] ?? 0) + 1)
        ;(failures[k] ??= []).push(e.message)
      }
      await sleep(1500) // stay under the free tier's requests-per-minute
    }
  }
}

// Reference list per photo: receipts/<name>.txt if you wrote one, else setup A's first run.
const reference = {}
for (const photo of photos) {
  const txt = join(DIR, basename(photo, extname(photo)) + '.txt')
  if (existsSync(txt)) {
    reference[photo] = { from: 'your list', items: readFileSync(txt, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).map((name) => ({ name, quantity: 0, category: '' })) }
  } else {
    const first = ONLY.find((k) => results[k]?.[photo]?.[0])
    if (first) reference[photo] = { from: `setup ${first}`, items: results[first][photo][0].items }
  }
}

const rows = []
let report = `# Receipt benchmark, ${new Date().toLocaleString()}\n\nPhotos: ${photos.join(', ')} · runs: ${RUNS}\n\n`
for (const k of ONLY) {
  const per = results[k]
  if (!per) {
    if (failures[k]) rows.push({ setup: k, time: '-', failed: failures[k].length, stalled: stalls[k] ?? 0 })
    continue
  }
  const all = Object.values(per).flat()
  let matched = 0, refTotal = 0, extra = 0, shelf = 0, unguessed = 0
  for (const [photo, runs] of Object.entries(per)) {
    const ref = reference[photo]
    if (!ref) continue
    const c = compare(runs[0].items, ref.items)
    matched += c.matched
    refTotal += ref.items.length
    extra += c.extra.length
    shelf += c.shelfAgree
    unguessed += runs[0].items.filter((it) => !it.category && !suggestFor(it.name)).length
  }
  rows.push({
    setup: k,
    time: fmtS(median(all.map((r) => r.ms))),
    thinking: median(all.map((r) => r.usage.thinking)),
    answer: median(all.map((r) => r.usage.output)),
    photoKB: median(all.map((r) => r.kb)),
    items: (all.reduce((n, r) => n + r.items.length, 0) / all.length).toFixed(1),
    found: refTotal ? `${Math.round((matched / refTotal) * 100)}%` : '-',
    extra,
    shelfOk: matched ? `${Math.round((shelf / matched) * 100)}%` : '-',
    toOther: unguessed,
    busy: all.reduce((n, r) => n + (r.busy ?? 0), 0) + (failures[k]?.length ?? 0) * 3,
    failed: failures[k]?.length ?? 0,
    stalled: stalls[k] ?? 0,
  })
}
console.log('\nSetups:')
for (const k of ONLY) if (SETUPS[k]) console.log(`  ${k}: ${SETUPS[k].label}${thinkingOk[SETUPS[k].model + SETUPS[k].thinking] && SETUPS[k].thinking !== 'default' ? ` [thinking sent as: ${thinkingOk[SETUPS[k].model + SETUPS[k].thinking]}]` : ''}`)
console.log('\nMedian time per scan, tokens, and accuracy against ' + (Object.values(reference)[0]?.from ?? 'nothing') + ':')
console.table(rows)
console.log('found = reference items it also listed · extra = items not in the reference · shelfOk = same shelf as the reference · toOther = names the app\'s guesser couldn\'t place (slim answers) · busy = "Google overloaded" retries (each costs seconds in the live app too)')

report += `| Setup | What | Median time | Thinking tokens | Answer tokens | Photo KB | Items | Found | Extra | Shelf OK | → Other | Busy retries | Failed | Stalled |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`
for (const r of rows) report += `| ${r.setup} | ${SETUPS[r.setup].label} | ${r.time} | ${r.thinking ?? '-'} | ${r.answer ?? '-'} | ${r.photoKB ?? '-'} | ${r.items ?? '-'} | ${r.found ?? '-'} | ${r.extra ?? '-'} | ${r.shelfOk ?? '-'} | ${r.toOther ?? '-'} | ${r.busy ?? '-'} | ${r.failed ?? 0} | ${r.stalled ?? 0} |\n`
for (const photo of photos) {
  report += `\n## ${photo}\n\nReference: ${reference[photo]?.from ?? 'none'}\n`
  for (const k of ONLY) {
    const r = results[k]?.[photo]?.[0]
    if (!r) continue
    const c = reference[photo] ? compare(r.items, reference[photo].items) : null
    report += `\n**${k}** (${fmtS(r.ms)}, thinking ${r.usage.thinking}, answer ${r.usage.output}, ${r.modelVersion}): ${r.items.map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''} [${shelfOf(i)}]${i.confidence === 'low' ? ' (?)' : ''}`).join(', ')}\n`
    if (c && reference[photo]?.from !== `setup ${k}`) report += `\n- missing: ${c.missing.join(', ') || 'none'}\n- extra: ${c.extra.join(', ') || 'none'}\n`
  }
}
const file = join(DIR, `bench-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.md`)
writeFileSync(file, report)
console.log(`\nFull report with every item list: ${file}`)

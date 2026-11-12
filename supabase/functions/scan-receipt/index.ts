// Reads a photo of a shopping receipt with Google's Gemini API (free tier) and
// returns the groceries on it. POST { image: base64 JPEG, mime: "image/jpeg" }.
// The API key lives in the GEMINI_API_KEY secret, never in the app.
import { createClient } from 'npm:@supabase/supabase-js@2.49.1'
import { clean, endpoint, readResponse, requestBody, type AnswerShape, type Thinking, type Usage } from './gemini.ts'

// Tried in order; a model that's unavailable or out of free quota falls through to the next.
const MODELS = [Deno.env.get('GEMINI_MODEL'), 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']
  .filter((m, i, a): m is string => !!m && a.indexOf(m) === i)
/** Answer shape and thinking for every model above. See gemini.ts and `npm run bench:receipts`. */
const SHAPE: AnswerShape = 'full'
/** Stay under the app's 15 s limit (SCAN_TIMEOUT_MS in src/config.ts). */
const TOTAL_BUDGET_MS = 13_000
/** A model that hasn't answered by now is skipped for the next (faster) one. */
const PER_MODEL_MS = 9_000
const THINKING: Thinking = 'default'

const MAX_BASE64 = 7_000_000 // ~5 MB image; the app sends ~300 KB

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

class GeminiError extends Error {
  constructor(readonly kind: 'key' | 'quota' | 'timeout' | 'other', readonly detail: string) {
    super(detail)
  }
}

interface Answer {
  model: string
  modelVersion: string
  usage: Usage
  /** Time waiting for Google, per model tried (ms). */
  geminiMs: number
  tried: string[]
  result: ReturnType<typeof clean>
}

async function askGemini(key: string, image: string, mime: string, started: number): Promise<Answer> {
  const tried: string[] = []
  let geminiMs = 0
  for (const [i, model] of MODELS.entries()) {
    const left = TOTAL_BUDGET_MS - (performance.now() - started)
    if (left < 1500) {
      tried.push('out of time')
      break
    }
    const limit = i === MODELS.length - 1 ? left : Math.min(left, PER_MODEL_MS)
    const t0 = performance.now()
    let res: Response
    try {
      res = await fetch(endpoint(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(requestBody(image, mime, { model, shape: SHAPE, thinking: THINKING })),
        signal: AbortSignal.timeout(limit),
      })
    } catch (e) {
      geminiMs += performance.now() - t0
      // Google too slow (or the connection dropped): move on to the next model.
      tried.push(`${model}: ${e instanceof DOMException && e.name === 'TimeoutError' ? `no answer in ${Math.round(limit / 1000)} s` : String(e).slice(0, 80)}`)
      continue
    }
    if (res.ok) {
      const r = readResponse(await res.json())
      geminiMs += performance.now() - t0
      try {
        return { model, modelVersion: r.modelVersion, usage: r.usage, geminiMs, tried, result: clean(JSON.parse(r.text)) }
      } catch {
        // Empty or blocked answer (e.g. finishReason SAFETY): try the next model.
        tried.push(`${model}: no usable answer (${r.finishReason})`)
        continue
      }
    }
    const errText = await res.text()
    geminiMs += performance.now() - t0
    console.error('gemini', model, res.status, errText.slice(0, 500))
    let message = ''
    try {
      message = JSON.parse(errText)?.error?.message ?? ''
    } catch {
      message = errText.slice(0, 120)
    }
    // A bad key fails the same way on every model, so stop and say so.
    if (/API_KEY_INVALID|API key not valid|API key expired|PERMISSION_DENIED|has not been used in project|is disabled/i.test(errText) || res.status === 403) {
      throw new GeminiError('key', `${res.status} ${message}`)
    }
    tried.push(`${model}: ${res.status} ${message}`.slice(0, 160))
    // 404/400: model not available; 429: its free quota is used up; 5xx: busy. Try the next one.
    if (![400, 404, 429, 500, 503].includes(res.status)) break
  }
  const allQuota = tried.length > 0 && tried.every((t) => / 429 /.test(t))
  const slow = tried.some((t) => /no answer in|out of time/.test(t))
  throw new GeminiError(allQuota ? 'quota' : slow ? 'timeout' : 'other', tried.join(' | '))
}

/** Placeholder or obviously truncated keys never work; catch them before calling Google. */
const looksLikeKey = (k: string) => /^[A-Za-z0-9_-]{30,}$/.test(k)

Deno.serve(async (req) => {
  const started = performance.now()
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const key = (Deno.env.get('GEMINI_API_KEY') ?? '').trim()
  if (!key) return json({ error: 'Receipt scanning isn’t set up yet (missing GEMINI_API_KEY).' }, 501)
  if (!looksLikeKey(key)) {
    return json({ error: 'The Gemini API key isn’t set correctly. Store your real key from aistudio.google.com/apikey in GEMINI_API_KEY (not the example text).' }, 501)
  }

  // Only phones connected to a kitchen may use the scanner (and your free quota).
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  const { data: auth } = await admin.auth.getUser(token)
  if (!auth?.user) return json({ error: 'Not connected' }, 401)
  const { data: device } = await admin.from('devices').select('kitchen_id').eq('user_id', auth.user.id).maybeSingle()
  if (!device) return json({ error: 'This phone is not in a kitchen' }, 403)

  const checkMs = performance.now() - started
  const { image, mime } = await req.json().catch(() => ({}))
  if (typeof image !== 'string' || !image || image.length > MAX_BASE64) return json({ error: 'Send a photo under 5 MB' }, 400)
  const type = typeof mime === 'string' && /^image\/(jpeg|png|webp|heic|heif)$/.test(mime) ? mime : 'image/jpeg'

  try {
    const a = await askGemini(key, image, type, started)
    // Timings let the app show "Read in 4.2 s" and help tune speed (see docs/receipt-speed.md).
    const meta = {
      model: a.model,
      modelVersion: a.modelVersion,
      shape: SHAPE,
      thinking: THINKING,
      usage: a.usage,
      ms: { check: Math.round(checkMs), gemini: Math.round(a.geminiMs), server: Math.round(performance.now() - started) },
      imageKB: Math.round((image.length * 3) / 4 / 1024),
      items: a.result.items.length,
      fallbacks: a.tried,
    }
    console.log('scan-receipt ok', JSON.stringify(meta))
    return json({ ...a.result, model: a.model, meta })
  } catch (e) {
    const err = e instanceof GeminiError ? e : new GeminiError('other', String(e))
    console.error('scan-receipt failed', err.kind, err.detail)
    if (err.kind === 'key') {
      return json({ error: 'Google rejected the Gemini API key. Check GEMINI_API_KEY is your real key from aistudio.google.com/apikey.', detail: err.detail }, 502)
    }
    if (err.kind === 'timeout') return json({ error: 'Google is slow right now. Try scanning again in a moment.', detail: err.detail }, 504)
    if (err.kind === 'quota') return json({ error: 'Today’s free receipt scans are used up. Try again tomorrow.', detail: err.detail }, 429)
    return json({ error: 'Couldn’t read the receipt right now. Try again in a moment.', detail: err.detail }, 502)
  }
})

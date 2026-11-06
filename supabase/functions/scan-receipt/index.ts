// Reads a photo of a shopping receipt with Google's Gemini API (free tier) and
// returns the groceries on it. POST { image: base64 JPEG, mime: "image/jpeg" }.
// The API key lives in the GEMINI_API_KEY secret, never in the app.
import { createClient } from 'npm:@supabase/supabase-js@2.49.1'

// Must match ITEM_ICONS (src/icons.tsx) and CATEGORIES (src/data.ts). `npm run check:catalog` verifies this.
const ICONS = ["flask-round", "flame", "leaf", "milk", "egg", "drumstick", "beef", "ham", "fish", "shrimp", "snowflake", "ice-cream", "popsicle", "pizza", "wheat", "cake-slice", "cupcake", "candy", "cookie", "croissant", "sandwich", "coffee", "cup-soda", "glass-water", "beer", "wine", "bottle-wine", "martini", "can", "soup", "cooking-pot", "bean", "nut", "popcorn", "amphora", "droplet", "apple", "banana", "citrus", "cherry", "grape", "avocado", "carrot", "broccoli", "leafy-green", "salad", "sprout", "spray-can", "paper-bag", "package", "shopping-bag"]
const CATEGORIES = ["spices", "baking", "coffee", "grains", "canned", "sauces", "snacks", "drinks", "produce", "dairy", "cold", "frozen", "other"]

// Tried in order; a model that's unavailable or out of free quota falls through to the next.
const MODELS = [Deno.env.get('GEMINI_MODEL'), 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']
  .filter((m, i, a): m is string => !!m && a.indexOf(m) === i)

const MAX_BASE64 = 7_000_000 // ~5 MB image; the app sends ~300 KB

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const PROMPT = `You are reading a photo of a UK supermarket receipt (e.g. ASDA, Lidl, Sainsbury's, Tesco, Aldi, Co-op, M&S).
List the grocery and household products that were bought.

Rules:
- Expand abbreviations into plain, short product names a housemate would use, e.g. "GRWN SS MILK 4PT" -> "Milk", "SBY BTRMLK PANCKS" -> "Pancakes", "LIDL ORG BAN" -> "Bananas", "HNZ BKD BNS" -> "Baked beans". Drop brand names unless they are the product's common name. Use Title case only for the first word.
- Skip anything that is not a product: prices, subtotals, totals, VAT, savings, discounts, multibuy lines, loyalty points (Clubcard, Nectar, Lidl Plus), carrier bags, bottle deposits, payment and card lines, store details.
- Merge repeated lines and "2 x" / "@" quantity lines into one item with a quantity.
- category must be one of: spices (Spices & Herbs), baking (Baking), coffee (Coffee & Tea), grains (Pasta, Rice & Grains), canned (Tins & Jars), sauces (Sauces & Oils), snacks (Snacks), drinks (Drinks), produce (Fruit & Veg), dairy (Dairy), cold (Fridge (cold stuff)), frozen (Freezer), other (Other).
- icon must be the closest match from the allowed list.
- confidence is "low" if the line was hard to read or you had to guess what the product is.
- If the image is not a receipt or nothing is readable, return an empty items list.`

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    store: { type: 'STRING', description: 'Shop name if visible, else empty string' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          quantity: { type: 'INTEGER' },
          category: { type: 'STRING', enum: CATEGORIES },
          icon: { type: 'STRING', enum: ICONS },
          raw: { type: 'STRING', description: 'The receipt line as printed' },
          confidence: { type: 'STRING', enum: ['high', 'low'] },
        },
        required: ['name', 'quantity', 'category', 'icon', 'confidence'],
      },
    },
  },
  required: ['store', 'items'],
}

type Item = { name: string; quantity: number; category: string; icon: string; raw: string; confidence: 'high' | 'low' }

/** Never trust model output blindly: clamp and validate every field. */
function clean(raw: unknown): { store: string; items: Item[] } {
  const r = (raw ?? {}) as { store?: unknown; items?: unknown }
  const items = Array.isArray(r.items) ? r.items : []
  return {
    store: typeof r.store === 'string' ? r.store.trim().slice(0, 40) : '',
    items: items
      .map((x) => x as Record<string, unknown>)
      .filter((x) => typeof x.name === 'string' && x.name.trim())
      .slice(0, 80)
      .map((x) => ({
        name: String(x.name).trim().slice(0, 32),
        quantity: Math.min(20, Math.max(1, Math.round(Number(x.quantity) || 1))),
        category: CATEGORIES.includes(String(x.category)) ? String(x.category) : 'other',
        icon: ICONS.includes(String(x.icon)) ? String(x.icon) : 'package',
        raw: typeof x.raw === 'string' ? x.raw.slice(0, 60) : '',
        confidence: x.confidence === 'low' ? 'low' : 'high',
      })),
  }
}

class GeminiError extends Error {
  constructor(readonly kind: 'key' | 'quota' | 'other', readonly detail: string) {
    super(detail)
  }
}

async function askGemini(key: string, image: string, mime: string) {
  const tried: string[] = []
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: mime, data: image } }, { text: PROMPT }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
    })
    if (res.ok) {
      const body = await res.json()
      const cand = body?.candidates?.[0]
      const text = cand?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
      try {
        return { model, result: clean(JSON.parse(text)) }
      } catch {
        // Empty or blocked answer (e.g. finishReason SAFETY): try the next model.
        tried.push(`${model}: no usable answer (${cand?.finishReason ?? body?.promptFeedback?.blockReason ?? 'empty'})`)
        continue
      }
    }
    const errText = await res.text()
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
  throw new GeminiError(allQuota ? 'quota' : 'other', tried.join(' | '))
}

/** Placeholder or obviously truncated keys never work; catch them before calling Google. */
const looksLikeKey = (k: string) => /^[A-Za-z0-9_-]{30,}$/.test(k)

Deno.serve(async (req) => {
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

  const { image, mime } = await req.json().catch(() => ({}))
  if (typeof image !== 'string' || !image || image.length > MAX_BASE64) return json({ error: 'Send a photo under 5 MB' }, 400)
  const type = typeof mime === 'string' && /^image\/(jpeg|png|webp|heic|heif)$/.test(mime) ? mime : 'image/jpeg'

  try {
    const { model, result } = await askGemini(key, image, type)
    return json({ ...result, model })
  } catch (e) {
    const err = e instanceof GeminiError ? e : new GeminiError('other', String(e))
    console.error('scan-receipt failed', err.kind, err.detail)
    if (err.kind === 'key') {
      return json({ error: 'Google rejected the Gemini API key. Check GEMINI_API_KEY is your real key from aistudio.google.com/apikey.', detail: err.detail }, 502)
    }
    if (err.kind === 'quota') return json({ error: 'Today’s free receipt scans are used up. Try again tomorrow.', detail: err.detail }, 429)
    return json({ error: 'Couldn’t read the receipt right now. Try again in a moment.', detail: err.detail }, 502)
  }
})

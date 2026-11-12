// Everything about *how* we ask Gemini to read a receipt: prompt, answer shape,
// model settings and answer parsing. Shared by the edge function (index.ts) and
// the local benchmark (scripts/bench-receipts.mjs), so both test the same thing.
// Plain TypeScript with no Deno or npm imports: Node can load it too.

// Must match ITEM_ICONS (src/catalog/item-icons.ts) and CATEGORIES (src/data.ts). `npm run check:catalog` verifies this.
export const ICONS = ["flask-round", "salt", "spice-mill", "flame", "leaf", "milk", "egg", "drumstick", "beef", "ham", "fish", "shrimp", "snowflake", "ice-cream", "popsicle", "pizza", "wheat", "cake-slice", "cupcake", "candy", "cookie", "croissant", "sandwich", "coffee", "cup-soda", "glass-water", "beer", "wine", "bottle-wine", "martini", "can", "soup", "cereal-box", "cooking-pot", "bean", "nut", "popcorn", "amphora", "droplet", "apple", "banana", "citrus", "cherry", "grape", "avocado", "tomato", "onion", "garlic", "bell-pepper", "carrot", "broccoli", "leafy-green", "salad", "sprout", "spray-can", "paper-bag", "package", "shopping-bag"]
export const CATEGORIES = ["spices", "baking", "coffee", "cereals", "grains", "canned", "sauces", "snacks", "drinks", "produce", "dairy", "cold", "frozen", "other"]

const RULES = `- Expand abbreviations into plain, short product names a housemate would use, e.g. "GRWN SS MILK 4PT" -> "Milk", "SBY BTRMLK PANCKS" -> "Pancakes", "LIDL ORG BAN" -> "Bananas", "HNZ BKD BNS" -> "Baked beans". Drop brand names unless they are the product's common name. Use Title case only for the first word.
- Skip anything that is not a product: prices, subtotals, totals, VAT, savings, discounts, multibuy lines, loyalty points (Clubcard, Nectar, Lidl Plus), carrier bags, bottle deposits, payment and card lines, store details.
- Merge repeated lines and "2 x" / "@" quantity lines into one item with a quantity.`

const INTRO = `You are reading a photo of a UK supermarket receipt (e.g. ASDA, Lidl, Sainsbury's, Tesco, Aldi, Co-op, M&S).
List the grocery and household products that were bought.`

/**
 * "full": Gemini also picks shelf, icon and echoes the printed line (current app).
 * "slim": only name, quantity and an unsure flag; the app guesses shelf and icon
 *         itself from the name (fewer words for Gemini to write = faster).
 */
export type AnswerShape = 'full' | 'slim'

export const PROMPTS: Record<AnswerShape, string> = {
  full: `${INTRO}

Rules:
${RULES}
- category must be one of: spices (Spices & Herbs), baking (Baking), coffee (Coffee & Tea), cereals (Cereals: breakfast cereal, oats, porridge, granola), grains (Pasta, Rice & Grains), canned (Tins & Jars), sauces (Sauces & Oils), snacks (Snacks), drinks (Drinks), produce (Fruit & Veg), dairy (Dairy), cold (Fridge (cold stuff)), frozen (Freezer), other (Other).
- icon must be the closest match from the allowed list.
- confidence is "low" if the line was hard to read or you had to guess what the product is.
- If the image is not a receipt or nothing is readable, return an empty items list.`,
  slim: `${INTRO}

Rules:
${RULES}
- unsure is true only if the line was hard to read or you had to guess what the product is.
- If the image is not a receipt or nothing is readable, return an empty items list.`,
}

export const SCHEMAS: Record<AnswerShape, unknown> = {
  full: {
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
  },
  slim: {
    type: 'OBJECT',
    properties: {
      store: { type: 'STRING' },
      items: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { name: { type: 'STRING' }, quantity: { type: 'INTEGER' }, unsure: { type: 'BOOLEAN' } },
          required: ['name', 'quantity'],
        },
      },
    },
    required: ['store', 'items'],
  },
}

/**
 * How much Gemini "thinks" before answering. "default" sends nothing (the model's
 * own default). Gemini 3 models take thinkingLevel; Gemini 2.5 take thinkingBudget.
 */
export type Thinking = 'default' | 'minimal' | 'low' | 'off-budget'

export interface ScanSettings {
  model: string
  shape: AnswerShape
  thinking: Thinking
}

export function thinkingConfig(t: Thinking): Record<string, unknown> | undefined {
  if (t === 'default') return undefined
  if (t === 'off-budget') return { thinkingBudget: 0 }
  return { thinkingLevel: t }
}

export function requestBody(image: string, mime: string, s: ScanSettings) {
  const thinking = thinkingConfig(s.thinking)
  return {
    contents: [{ parts: [{ inline_data: { mime_type: mime, data: image } }, { text: PROMPTS[s.shape] }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: SCHEMAS[s.shape],
      ...(thinking ? { thinkingConfig: thinking } : {}),
    },
  }
}

export const endpoint = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

export interface Usage {
  /** Tokens Gemini read (photo + prompt). */
  input: number
  /** Tokens spent "thinking" before answering. */
  thinking: number
  /** Tokens in the answer it wrote. */
  output: number
}

/** Pulls the answer text, token counts and the exact model version out of a Gemini response. */
export function readResponse(body: any): { text: string; usage: Usage; modelVersion: string; finishReason: string } {
  const cand = body?.candidates?.[0]
  const u = body?.usageMetadata ?? {}
  return {
    text: cand?.content?.parts?.map((p: { text?: string; thought?: boolean }) => (p.thought ? '' : p.text ?? '')).join('') ?? '',
    usage: { input: u.promptTokenCount ?? 0, thinking: u.thoughtsTokenCount ?? 0, output: u.candidatesTokenCount ?? 0 },
    modelVersion: body?.modelVersion ?? '',
    finishReason: cand?.finishReason ?? body?.promptFeedback?.blockReason ?? 'empty',
  }
}

export interface ScannedItem {
  name: string
  quantity: number
  /** Empty in the "slim" shape: the app picks shelf and icon. */
  category: string
  icon: string
  raw: string
  confidence: 'high' | 'low'
}

/** Never trust model output blindly: clamp and validate every field (works for both shapes). */
export function clean(raw: unknown): { store: string; items: ScannedItem[] } {
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
        category: CATEGORIES.includes(String(x.category)) ? String(x.category) : '',
        icon: ICONS.includes(String(x.icon)) ? String(x.icon) : '',
        raw: typeof x.raw === 'string' ? x.raw.slice(0, 60) : '',
        confidence: x.confidence === 'low' || x.unsure === true ? 'low' : 'high',
      })),
  }
}

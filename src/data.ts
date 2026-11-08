import { KEYWORD_RULES } from './catalog/keywords.ts'
import type { KeywordRule } from './catalog/types.ts'
import type { CategoryId } from './types'

/** Shelves, top to bottom. Reorder to reorder the cupboard; icons are in src/icons.tsx. */
export interface Category {
  id: CategoryId
  label: string
}

export const CATEGORIES: Category[] = [
  { id: 'spices', label: 'Spices & Herbs' },
  { id: 'baking', label: 'Baking' },
  { id: 'coffee', label: 'Coffee & Tea' },
  { id: 'cereals', label: 'Cereals' },
  { id: 'grains', label: 'Pasta, Rice & Grains' },
  { id: 'canned', label: 'Tins & Jars' },
  { id: 'sauces', label: 'Sauces & Oils' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'drinks', label: 'Drinks' },
  { id: 'produce', label: 'Fruit & Veg' },
  { id: 'dairy', label: 'Dairy' },
  { id: 'cold', label: 'Fridge (cold stuff)' },
  { id: 'frozen', label: 'Freezer' },
  { id: 'other', label: 'Other' },
]

export const categoryById = (id: CategoryId) =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]

/** Colours offered first to a new profile (the first one nobody uses is pre-selected). */
export const USER_COLORS = [
  '#e4572e', // tomato
  '#2e86de', // blue
  '#2fa84f', // green
  '#9b59b6', // purple
  '#f1a208', // mustard
  '#e84393', // pink
  '#16a3a3', // teal
  '#6d4c41', // cocoa
]

// ───────────────────────── name → icon + shelf guesses ─────────────────────────
// The keyword list lives in src/catalog/keywords.ts (tune it with `npm run tune`).
// How a guess is made (details: docs/icons-and-keywords.md):
// 1. A name the kitchen already uses keeps its icon and shelf.
// 2. Keywords match whole words only, so "ice" doesn't match "rice" or "juice".
//    A plural "s", "es" or "y" → "ies" is allowed ("tomato" matches "tomatoes").
// 3. Multi-word keywords ("ice cream", "baked beans") beat single words.
// 4. Otherwise the keyword nearest the end of the name wins, because the last
//    word is usually the thing itself: "orange juice" is juice, "tomato sauce" is sauce.
// 5. Still tied, an exact word beats a plural ("peppers" beats "pepper").

/** Lower case, no accents or punctuation, single spaces: "Ben & Jerry's Ice-cream" → "ben jerry s ice cream". */
export const words = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Does `word` (from the name) match `key` (one word of a keyword), allowing plurals? */
function sameWord(word: string, key: string) {
  if (word === key) return true
  if (key.length < 3) return false
  if (word === key + 's' || word === key + 'es') return true
  if (key.endsWith('y') && word === key.slice(0, -1) + 'ies') return true
  if (key.endsWith('s') && word === key.slice(0, -1)) return true // "oats" matches "oat"
  return false
}

/** Where `key` appears in `name` as whole words: index of its last word (-1 if absent), and exact or plural. */
function findPhrase(name: string[], key: string[]) {
  let found = { end: -1, exact: false }
  for (let i = 0; i + key.length <= name.length; i++) {
    if (key.every((k, j) => sameWord(name[i + j], k))) {
      found = { end: i + key.length - 1, exact: key.every((k, j) => name[i + j] === k) }
    }
  }
  return found
}

/** Is score `a` higher than `b`, comparing item by item? */
function beats(a: number[], b: number[]) {
  const i = a.findIndex((v, j) => v !== b[j])
  return i >= 0 && a[i] > b[i]
}

export interface Suggestion {
  icon: string
  category: CategoryId
}

/** One keyword that matched a name, with its score [words in keyword, position of last word, exact]. */
export interface KeywordMatch extends Suggestion {
  keyword: string
  score: number[]
  /** Index of the rule in the rules list. */
  rule: number
}

const split = new WeakMap<readonly KeywordRule[], { key: string[]; keyword: string; rule: number; icon: string; category: CategoryId }[]>()
function prepared(rules: readonly KeywordRule[]) {
  let r = split.get(rules)
  if (!r) {
    r = rules.flatMap((rule, i) =>
      rule.keywords.map((k) => ({ key: words(k).split(' '), keyword: k, rule: i, icon: rule.icon, category: rule.shelf })),
    )
    split.set(rules, r)
  }
  return r
}

/** Every keyword that matches `name`, best first. The first one is the guess. */
export function explainFor(name: string, rules: readonly KeywordRule[] = KEYWORD_RULES): KeywordMatch[] {
  const n = words(name)
  if (!n) return []
  const nameWords = n.split(' ')
  const out: KeywordMatch[] = []
  for (const r of prepared(rules)) {
    if (!r.key[0]) continue
    const { end, exact } = findPhrase(nameWords, r.key)
    if (end >= 0) out.push({ keyword: r.keyword, rule: r.rule, icon: r.icon, category: r.category, score: [r.key.length, end, exact ? 1 : 0] })
  }
  return out.sort((a, b) => (beats(a.score, b.score) ? -1 : beats(b.score, a.score) ? 1 : 0))
}

type Known = { name: string; icon: string; category: CategoryId }

/**
 * Guess an icon and shelf from an item name. `known` is what the kitchen already
 * uses (cupboard items, grocery list): an exact name match there wins, so a
 * housemate's correction sticks for everyone.
 */
export function suggestFor(name: string, known: readonly Known[] = [], rules: readonly KeywordRule[] = KEYWORD_RULES): Suggestion | null {
  const n = words(name)
  if (!n) return null
  const same = known.find((k) => words(k.name) === n)
  if (same) return { icon: same.icon, category: same.category }
  const best = explainFor(name, rules)[0]
  return best ? { icon: best.icon, category: best.category } : null
}

// ───────────────────────── colour picker palette ─────────────────────────

function hsl(h: number, s: number, l: number) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** Hue of each column in the colour picker, left to right. */
const PALETTE_HUES = [198, 220, 245, 272, 300, 340, 6, 22, 36, 50, 66, 100]
/** Lightness of each row, top (dark) to bottom (light). */
const PALETTE_LIGHTNESS = [20, 28, 36, 44, 52, 62, 72, 82, 91]

/**
 * The pop-up colour grid (like the iOS colour picker): a greyscale row,
 * then one column per hue from dark to light. Each row has 12 colours.
 */
export const PROFILE_PALETTE: string[][] = [
  Array.from({ length: 12 }, (_, i) => hsl(0, 0, Math.round(100 - (i * 100) / 11))),
  ...PALETTE_LIGHTNESS.map((l) => PALETTE_HUES.map((h) => hsl(h, l > 80 ? 70 : 78, l))),
]

/** Black or white text, whichever reads better on `hex`. */
export function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#141414' : '#ffffff'
}

export const sameColor = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

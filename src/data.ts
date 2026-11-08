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

/**
 * Name → icon + shelf guesses. Each rule is [keywords, icon key, shelf].
 *
 * How a guess is made (see suggestFor):
 * - Keywords match whole words only, so "ice" doesn't match "rice" or "juice".
 *   A plural "s", "es" or "y" → "ies" is allowed ("tomato" matches "tomatoes").
 * - Multi-word keywords ("ice cream", "baked beans") beat single words.
 * - Otherwise the keyword nearest the end of the name wins, because the last
 *   word is usually the thing itself: "orange juice" is juice, "tomato sauce" is sauce.
 * - Still tied, an exact word beats a plural ("peppers" beats "pepper").
 * Rule order doesn't matter. Add tricky names to scripts/test-suggest.mjs.
 */
const SUGGESTIONS: [string[], string, CategoryId][] = [
  // Dairy
  [['milk', 'oat milk', 'almond milk', 'soy milk', 'soya milk'], 'milk', 'dairy'],
  [['cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'halloumi', 'brie', 'paneer'], 'milk', 'dairy'],
  [['butter', 'margarine'], 'milk', 'dairy'],
  [['yogurt', 'yoghurt', 'cream', 'creme fraiche', 'custard'], 'soup', 'dairy'],
  // Fridge
  [['egg'], 'egg', 'cold'],
  [['chicken', 'turkey'], 'drumstick', 'cold'],
  [['beef', 'steak', 'mince', 'lamb', 'pork', 'burger'], 'beef', 'cold'],
  [['bacon', 'ham', 'sausage', 'chorizo', 'salami', 'pepperoni'], 'ham', 'cold'],
  [['fish', 'salmon', 'cod', 'haddock', 'tuna steak'], 'fish', 'cold'],
  [['prawn', 'shrimp'], 'shrimp', 'cold'],
  [['tofu', 'hummus', 'houmous'], 'soup', 'cold'],
  // Freezer
  [['ice cream', 'gelato'], 'ice-cream', 'frozen'],
  [['ice lolly', 'lolly', 'ice pop'], 'popsicle', 'frozen'],
  [['frozen', 'ice', 'peas', 'fish fingers', 'oven chips', 'nuggets'], 'snowflake', 'frozen'],
  [['pizza'], 'pizza', 'frozen'],
  // Spices
  [['salt', 'sea salt', 'salt and pepper', 'pepper', 'black pepper', 'white pepper', 'ground pepper'], 'salt', 'spices'],
  [['peppercorns', 'pepper mill', 'peppermill', 'salt mill', 'grinder', 'spice mill', 'spice grinder'], 'spice-mill', 'spices'],
  [['chilli', 'chili', 'chilli flakes', 'paprika', 'cayenne'], 'flame', 'spices'],
  [['garlic powder', 'onion powder', 'cinnamon', 'cumin', 'turmeric', 'curry powder', 'garam masala', 'oregano',
    'basil', 'thyme', 'rosemary', 'parsley', 'coriander', 'spice', 'mixed spice', 'herb', 'mixed herbs', 'nutmeg',
    'ginger', 'bay leaves', 'stock cube', 'stock', 'gravy'], 'leaf', 'spices'],
  // Baking
  [['flour', 'self raising flour', 'plain flour', 'cornflour'], 'wheat', 'baking'],
  [['sugar', 'icing sugar', 'brown sugar', 'caster sugar'], 'candy', 'baking'],
  [['baking powder', 'baking soda', 'bicarb', 'bicarbonate of soda', 'yeast', 'vanilla', 'vanilla extract', 'cocoa',
    'chocolate chips', 'sprinkles', 'food colouring'], 'cupcake', 'baking'],
  [['honey', 'syrup', 'golden syrup', 'maple syrup'], 'amphora', 'baking'],
  // Coffee & tea
  [['coffee', 'espresso', 'coffee beans', 'instant coffee', 'hot chocolate'], 'coffee', 'coffee'],
  [['tea', 'tea bags', 'green tea', 'peppermint tea', 'matcha', 'chai'], 'coffee', 'coffee'],
  [['creamer', 'coffee creamer'], 'milk', 'coffee'],
  // Cereals
  [['cereal', 'cereal box', 'cornflakes', 'corn flakes', 'granola', 'muesli', 'bran flakes', 'weetabix', 'shreddies', 'cheerios',
    'rice krispies', 'coco pops', 'frosties'], 'cereal-box', 'cereals'],
  [['oats', 'porridge', 'porridge oats', 'rolled oats'], 'wheat', 'cereals'],
  // Pasta, rice & grains
  [['pasta', 'spaghetti', 'penne', 'fusilli', 'macaroni', 'lasagne', 'noodle', 'couscous', 'quinoa'], 'cooking-pot', 'grains'],
  [['rice', 'basmati', 'risotto'], 'cooking-pot', 'grains'],
  [['bread', 'loaf', 'bagel', 'wrap', 'tortilla', 'pitta', 'naan', 'crumpet', 'garlic bread'], 'sandwich', 'grains'],
  [['croissant', 'pastry', 'pain au chocolat'], 'croissant', 'grains'],
  // Tins & jars
  [['beans', 'baked beans', 'kidney beans', 'black beans', 'butter beans', 'chickpea', 'lentil', 'tin', 'tinned',
    'can of', 'canned', 'soup', 'chopped tomatoes', 'tinned tomatoes', 'tuna', 'sweetcorn', 'coconut milk'], 'can', 'canned'],
  [['jam', 'marmalade', 'peanut butter', 'nutella', 'spread', 'chocolate spread'], 'amphora', 'canned'],
  // Sauces & oils
  [['oil', 'olive oil', 'vegetable oil', 'sunflower oil', 'olive'], 'droplet', 'sauces'],
  [['ketchup', 'mayo', 'mayonnaise', 'mustard', 'sauce', 'vinegar', 'soy', 'sriracha', 'pesto', 'salsa', 'dressing',
    'chutney', 'relish'], 'amphora', 'sauces'],
  // Snacks
  [['crisps', 'chips', 'tortilla chips', 'pringles'], 'popcorn', 'snacks'],
  [['chocolate', 'chocolate bar'], 'candy', 'snacks'],
  [['sweets', 'candy', 'candy cane', 'gummy'], 'candy', 'snacks'],
  [['biscuit', 'cookie', 'digestives', 'crackers'], 'cookie', 'snacks'],
  [['cake', 'brownie', 'muffin'], 'cake-slice', 'snacks'],
  [['popcorn'], 'popcorn', 'snacks'],
  [['nuts', 'almond', 'peanut', 'cashew', 'pecan', 'walnut', 'pistachio', 'hazelnut'], 'nut', 'snacks'],
  // Drinks
  [['juice', 'orange juice', 'apple juice', 'smoothie', 'squash', 'cordial'], 'cup-soda', 'drinks'],
  [['beer', 'lager', 'ale', 'cider'], 'beer', 'drinks'],
  [['wine', 'prosecco'], 'wine', 'drinks'],
  [['vodka', 'gin', 'rum', 'whisky', 'whiskey', 'tequila'], 'martini', 'drinks'],
  [['water', 'sparkling water'], 'glass-water', 'drinks'],
  [['soda', 'cola', 'coke', 'lemonade', 'pop', 'fizzy', 'energy drink'], 'cup-soda', 'drinks'],
  // Fruit & veg
  [['apple'], 'apple', 'produce'],
  [['banana'], 'banana', 'produce'],
  [['lemon', 'lime', 'orange', 'satsuma', 'clementine', 'grapefruit'], 'citrus', 'produce'],
  [['grape'], 'grape', 'produce'],
  [['avocado'], 'avocado', 'produce'],
  [['tomato', 'cherry tomatoes', 'vine tomatoes', 'plum tomatoes'], 'tomato', 'produce'],
  [['berry', 'strawberry', 'blueberry', 'raspberry', 'cherry'], 'cherry', 'produce'],
  [['onion', 'red onion', 'shallot'], 'onion', 'produce'],
  [['spring onion', 'leek', 'celery'], 'leafy-green', 'produce'],
  [['garlic', 'garlic bulb'], 'garlic', 'produce'],
  [['potato', 'sweet potato'], 'bean', 'produce'],
  [['carrot', 'parsnip'], 'carrot', 'produce'],
  [['broccoli', 'cauliflower'], 'broccoli', 'produce'],
  [['bell pepper', 'peppers', 'red pepper', 'green pepper', 'yellow pepper', 'sweet pepper'], 'bell-pepper', 'produce'],
  [['mushroom', 'aubergine', 'eggplant', 'courgette', 'zucchini', 'cucumber'], 'sprout', 'produce'],
  [['lettuce', 'spinach', 'salad', 'kale', 'cabbage', 'rocket'], 'leafy-green', 'produce'],
  // Household
  [['foil', 'tin foil', 'cling film', 'cling', 'bin bags', 'sponge', 'soap', 'washing up liquid', 'kitchen roll',
    'paper towel', 'toilet roll', 'bleach', 'detergent'], 'spray-can', 'other'],
]

/** Lower case, no punctuation, single spaces: "Ben & Jerry's  Ice-cream" → "ben jerry s ice cream". */
const words = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Does `word` (from the name) match `key` (a single keyword word), allowing plurals? */
function sameWord(word: string, key: string) {
  if (word === key) return true
  if (key.length < 3) return false
  if (word === key + 's' || word === key + 'es') return true
  if (key.endsWith('y') && word === key.slice(0, -1) + 'ies') return true
  if (key.endsWith('s') && word === key.slice(0, -1)) return true // "oats" matches "oat"
  return false
}

/**
 * Where `key` appears in `name` as whole words: the index of its last word
 * (-1 if absent) and whether it matched exactly (not as a plural).
 */
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

const RULES = SUGGESTIONS.flatMap(([keys, icon, category]) => keys.map((k) => ({ key: words(k).split(' '), icon, category })))

export interface Suggestion {
  icon: string
  category: CategoryId
}

/**
 * Guess an icon and shelf from an item name. `known` is what the kitchen already
 * uses (cupboard items, grocery list): an exact name match there wins, so a
 * housemate's correction sticks for everyone.
 */
export function suggestFor(name: string, known: readonly { name: string; icon: string; category: CategoryId }[] = []): Suggestion | null {
  const n = words(name)
  if (!n) return null
  const same = known.find((k) => words(k.name) === n)
  if (same) return { icon: same.icon, category: same.category }

  const nameWords = n.split(' ')
  // Score = [words in keyword, position of its last word, exact]; compared in that order.
  let best: { score: number[]; icon: string; category: CategoryId } | null = null
  for (const r of RULES) {
    const { end, exact } = findPhrase(nameWords, r.key)
    if (end < 0) continue
    const score = [r.key.length, end, exact ? 1 : 0]
    const better = !best || beats(score, best.score)
    if (better) best = { score, icon: r.icon, category: r.category }
  }
  return best && { icon: best.icon, category: best.category }
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

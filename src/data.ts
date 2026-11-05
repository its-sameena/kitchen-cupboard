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

/** keyword → [icon key, category]. Order matters: first match wins. */
const SUGGESTIONS: [string[], string, CategoryId][] = [
  [['oat milk', 'almond milk', 'soy milk'], 'milk', 'dairy'],
  [['milk'], 'milk', 'dairy'],
  [['cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta'], 'milk', 'dairy'],
  [['butter'], 'milk', 'dairy'],
  [['yogurt', 'yoghurt', 'cream'], 'soup', 'dairy'],
  [['egg'], 'egg', 'cold'],
  [['chicken'], 'drumstick', 'cold'],
  [['beef', 'steak', 'mince'], 'beef', 'cold'],
  [['bacon', 'ham', 'sausage'], 'ham', 'cold'],
  [['fish', 'salmon', 'tuna steak'], 'fish', 'cold'],
  [['tofu', 'hummus'], 'soup', 'cold'],
  [['ice cream'], 'ice-cream', 'frozen'],
  [['frozen', 'peas', 'ice'], 'snowflake', 'frozen'],
  [['pizza'], 'pizza', 'frozen'],
  [['salt'], 'flask-round', 'spices'],
  [['pepper', 'chilli', 'chili', 'paprika', 'cayenne'], 'flame', 'spices'],
  [['garlic powder', 'garlic'], 'leaf', 'spices'],
  [['cinnamon', 'cumin', 'turmeric', 'curry', 'oregano', 'basil', 'thyme', 'spice', 'herb', 'nutmeg', 'ginger'], 'leaf', 'spices'],
  [['flour'], 'wheat', 'baking'],
  [['sugar', 'icing'], 'candy', 'baking'],
  [['baking powder', 'baking soda', 'bicarb', 'yeast', 'vanilla', 'cocoa', 'chocolate chips', 'sprinkles'], 'cupcake', 'baking'],
  [['honey', 'syrup'], 'amphora', 'baking'],
  [['coffee', 'espresso', 'beans'], 'coffee', 'coffee'],
  [['tea', 'matcha', 'chai'], 'coffee', 'coffee'],
  [['creamer'], 'milk', 'coffee'],
  [['pasta', 'spaghetti', 'penne', 'noodle'], 'cooking-pot', 'grains'],
  [['rice'], 'cooking-pot', 'grains'],
  [['bread', 'bagel', 'wrap', 'tortilla'], 'sandwich', 'grains'],
  [['cereal', 'oats', 'granola', 'muesli'], 'soup', 'grains'],
  [['beans', 'chickpea', 'lentil', 'tin', 'can', 'soup', 'tomatoes'], 'can', 'canned'],
  [['jam', 'peanut butter', 'nutella', 'spread'], 'amphora', 'canned'],
  [['oil', 'olive'], 'droplet', 'sauces'],
  [['ketchup', 'mayo', 'mustard', 'sauce', 'vinegar', 'soy', 'sriracha', 'pesto'], 'amphora', 'sauces'],
  [['crisps', 'chips'], 'popcorn', 'snacks'],
  [['chocolate'], 'candy', 'snacks'],
  [['biscuit', 'cookie'], 'cookie', 'snacks'],
  [['popcorn'], 'popcorn', 'snacks'],
  [['nuts', 'almond', 'peanut', 'cashew'], 'nut', 'snacks'],
  [['juice'], 'cup-soda', 'drinks'],
  [['beer'], 'beer', 'drinks'],
  [['wine'], 'wine', 'drinks'],
  [['water', 'soda', 'cola', 'coke', 'lemonade', 'pop'], 'cup-soda', 'drinks'],
  [['apple'], 'apple', 'produce'],
  [['banana'], 'banana', 'produce'],
  [['lemon', 'lime'], 'citrus', 'produce'],
  [['orange'], 'citrus', 'produce'],
  [['avocado'], 'avocado', 'produce'],
  [['tomato'], 'cherry', 'produce'],
  [['onion'], 'leafy-green', 'produce'],
  [['potato'], 'popcorn', 'produce'],
  [['carrot'], 'carrot', 'produce'],
  [['lettuce', 'spinach', 'salad', 'kale'], 'leafy-green', 'produce'],
  [['berries', 'strawberr', 'blueberr'], 'cherry', 'produce'],
  [['foil', 'cling', 'bags', 'sponge', 'soap', 'paper towel'], 'spray-can', 'other'],
]

export function suggestFor(name: string): { icon: string; category: CategoryId } | null {
  const n = name.trim().toLowerCase()
  if (!n) return null
  for (const [keys, icon, category] of SUGGESTIONS) {
    if (keys.some((k) => n.includes(k))) return { icon, category }
  }
  return null
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

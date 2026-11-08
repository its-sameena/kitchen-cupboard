// Checks the name → icon/shelf guesser (suggestFor in src/data.ts) against tricky names.
// Add a line whenever someone reports a bad guess. Run: npm run test:suggest
import { suggestFor } from '../src/data.ts'

/** [name typed, expected shelf, expected icon (optional)] */
const CASES = [
  ['Sauce', 'sauces', 'amphora'],
  ['BBQ sauce', 'sauces', 'amphora'],
  ['Soy sauce', 'sauces', 'amphora'],
  ['Tomato sauce', 'sauces'],
  ['Rice', 'grains', 'cooking-pot'],
  ['Basmati rice', 'grains'],
  ['Orange juice', 'drinks', 'cup-soda'],
  ['Apple juice', 'drinks'],
  ['Oranges', 'produce', 'citrus'],
  ['Mixed spice', 'spices', 'leaf'],
  ['Baked beans', 'canned', 'can'],
  ['Coffee beans', 'coffee', 'coffee'],
  ['Tomatoes', 'produce', 'tomato'],
  ['Cherry tomatoes', 'produce', 'tomato'],
  ['Chopped tomatoes', 'canned', 'can'],
  ['Pecans', 'snacks', 'nut'],
  ['Candy canes', 'snacks', 'candy'],
  ['Tin foil', 'other', 'spray-can'],
  ['Peppermint tea', 'coffee', 'coffee'],
  ['Pepper', 'spices', 'salt'],
  ['Black pepper', 'spices', 'salt'],
  ['Salt', 'spices', 'salt'],
  ['Salt and pepper', 'spices', 'salt'],
  ['Peppercorns', 'spices', 'spice-mill'],
  ['Pepper mill', 'spices', 'spice-mill'],
  ['Chilli flakes', 'spices', 'flame'],
  ['Peppers', 'produce', 'bell-pepper'],
  ['Red peppers', 'produce', 'bell-pepper'],
  ['Eggplant', 'produce'],
  ['Eggs', 'cold', 'egg'],
  ['Veggie burgers', 'cold', 'beef'],
  ['Ice cream', 'frozen', 'ice-cream'],
  ["Ben & Jerry's ice-cream", 'frozen', 'ice-cream'],
  ['Sour cream', 'dairy'],
  ['Cream cheese', 'dairy'],
  ['Cheddar', 'dairy'],
  ['Oat milk', 'dairy', 'milk'],
  ['Coconut milk', 'canned'],
  ['Peanut butter', 'canned', 'amphora'],
  ['Butter', 'dairy'],
  ['Frozen peas', 'frozen', 'snowflake'],
  ['Frozen pizza', 'frozen', 'pizza'],
  ['Ginger', 'spices'],
  ['Gin', 'drinks', 'martini'],
  ['Garlic', 'produce', 'garlic'],
  ['Garlic bread', 'grains', 'sandwich'],
  ['Garlic powder', 'spices'],
  ['Chocolate', 'snacks', 'candy'],
  ['Chocolate chips', 'baking', 'cupcake'],
  ['Hot chocolate', 'coffee'],
  ['Tortilla chips', 'snacks', 'popcorn'],
  ['Crisps', 'snacks'],
  ['Sausages', 'cold', 'ham'],
  ['Onions', 'produce', 'onion'],
  ['Red onion', 'produce', 'onion'],
  ['Spring onions', 'produce', 'leafy-green'],
  ['Strawberries', 'produce', 'cherry'],
  ['Tuna', 'canned'],
  ['Tuna steak', 'cold', 'fish'],
  ['Water', 'drinks', 'glass-water'],
  // Cereals shelf
  ['Cereal', 'cereals', 'cereal-box'],
  ['Cornflakes', 'cereals', 'cereal-box'],
  ['Rice Krispies', 'cereals'],
  ['Porridge oats', 'cereals', 'wheat'],
  ['Oats', 'cereals'],
  ['Granola', 'cereals'],
  // No guess
  ['Batteries', null],
  ['', null],
]

let failed = 0
for (const [name, shelf, icon] of CASES) {
  const got = suggestFor(name)
  const ok = shelf === null ? got === null : got?.category === shelf && (!icon || got.icon === icon)
  if (!ok) {
    failed++
    console.error(`✗ "${name}": expected ${shelf ?? 'no guess'}${icon ? ` / ${icon}` : ''}, got ${got ? `${got.category} / ${got.icon}` : 'no guess'}`)
  }
}

// What the kitchen already uses wins over the keyword rules.
const known = [{ name: 'Rice', icon: 'wheat', category: 'cereals' }]
const learned = suggestFor('  rice ', known)
if (learned?.category !== 'cereals' || learned.icon !== 'wheat') {
  failed++
  console.error('✗ a known item name should override the keyword guess')
}

if (failed) {
  console.error(`\n${failed} of ${CASES.length + 1} checks failed`)
  process.exit(1)
}
console.log(`Icon guesser ✔ (${CASES.length + 1} checks)`)

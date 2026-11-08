// Checks the name → icon/shelf guesser (suggestFor in src/data.ts) against tricky names.
// The names live in src/catalog/keyword-tests.ts (or add them in `npm run tune`).
// Run: npm run test:suggest
import { KEYWORD_TESTS } from '../src/catalog/keyword-tests.ts'
import { suggestFor } from '../src/data.ts'

const CASES = KEYWORD_TESTS.map((t) => [t.name, t.shelf, t.icon])


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

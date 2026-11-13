// Checks the top-bar greetings (src/greetings.ts). Run: npm run test:greetings
import assert from 'node:assert/strict'
import { GREETINGS, pickGreeting, fillGreeting } from '../src/greetings.ts'

const at = (h) => new Date(2026, 10, 13, h, 0)
const pickAll = (h, recent = [], n = 4000) => {
  const counts = {}
  for (let i = 0; i < n; i++) {
    const t = pickGreeting(at(h), recent)
    counts[t] = (counts[t] ?? 0) + 1
  }
  return counts
}

for (const g of GREETINGS) {
  assert.equal(g.text.split('{name}').length, 2, `"${g.text}" needs exactly one {name}`)
  const around = g.text.replace('{name}', '').length
  assert.ok(around <= 18, `"${g.text}" is long (${around} chars around the name); the top bar fits ~25`)
  assert.ok(!/\p{Extended_Pictographic}/u.test(g.text), `"${g.text}" has an emoji`)
}
assert.equal(new Set(GREETINGS.map((g) => g.text)).size, GREETINGS.length, 'duplicate greeting')

// Time of day
assert.ok(!Object.keys(pickAll(21)).some((t) => /Morning|Rise and dine|Lunch|Midnight/.test(t)), 'morning/lunch/late greeting at 9pm')
assert.ok(Object.keys(pickAll(8)).some((t) => /Morning|Rise and dine/.test(t)), 'no morning greeting at 8am')
assert.ok(Object.keys(pickAll(1)).some((t) => /Midnight snack|Up late/.test(t)), 'no late-night greeting at 1am')

// Recent ones are skipped
const recent = ['Hi, {name}', 'Ahoy, {name}', 'Chef {name}', 'Hola, {name}', 'Ciao, {name}']
assert.ok(!Object.keys(pickAll(15, recent)).some((t) => recent.includes(t)), 'picked a recent greeting')

// Roughly equal chances
const counts = Object.values(pickAll(15, [], 20000))
const eligible = GREETINGS.filter((g) => !g.when || g.when === 'afternoon').length
assert.equal(counts.length, eligible, 'some greetings never came up')
const avg = 20000 / eligible
assert.ok(Math.min(...counts) > avg * 0.7 && Math.max(...counts) < avg * 1.3, 'chances are uneven')

assert.equal(fillGreeting('{name}’s back!', 'Sam'), 'Sam’s back!')
console.log(`Greetings ✔ (${GREETINGS.length} greetings, ${eligible} eligible at 3pm)`)

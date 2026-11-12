// The scan-receipt function keeps its own copy of the shelf ids and icon keys
// (it can't import the React app). This fails if they drift apart.
import { readFileSync } from 'node:fs'

import { ITEM_ICON_DATA } from '../src/catalog/item-icons.ts'
import { KEYWORD_RULES } from '../src/catalog/keywords.ts'

const appIcons = Object.keys(ITEM_ICON_DATA)
const appCats = [...readFileSync('src/data.ts', 'utf8').matchAll(/\{ id: '([a-z]+)', label: '[^']+' \}/g)].map((m) => m[1])

const fn = readFileSync('supabase/functions/scan-receipt/gemini.ts', 'utf8')
const fnIcons = JSON.parse(fn.match(/const ICONS = (\[.*?\])/s)[1])
const fnCats = JSON.parse(fn.match(/const CATEGORIES = (\[.*?\])/s)[1])

const diff = (a, b) => a.filter((x) => !b.includes(x))
const problems = [
  ...KEYWORD_RULES.filter((r) => !appIcons.includes(r.icon)).map((r) => `keyword rule [${r.keywords[0]}…] uses unknown icon "${r.icon}"`),
  ...KEYWORD_RULES.filter((r) => !appCats.includes(r.shelf)).map((r) => `keyword rule [${r.keywords[0]}…] uses unknown shelf "${r.shelf}"`),
  ...diff(appIcons, fnIcons).map((x) => `icon "${x}" missing from scan-receipt`),
  ...diff(fnIcons, appIcons).map((x) => `scan-receipt has unknown icon "${x}"`),
  ...diff(appCats, fnCats).map((x) => `shelf "${x}" missing from scan-receipt`),
  ...diff(fnCats, appCats).map((x) => `scan-receipt has unknown shelf "${x}"`),
]
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`Catalog in sync ✔ (${appIcons.length} icons, ${appCats.length} shelves)`)

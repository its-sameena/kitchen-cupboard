// Writes the catalog files in src/catalog/ in a stable, readable, hand-editable format.
// Used by the tuning page (tools/tune/plugin.mjs). Plain JS so Node and Vite can both load it.

const q = (s) => JSON.stringify(String(s))
const key = (k) => (/^[a-z_$][a-z0-9_$]*$/i.test(k) ? k : q(k))
const attrs = (a) => '{ ' + Object.entries(a).map(([k, v]) => `${key(k)}: ${q(v)}`).join(', ') + ' }'

export function itemIconsFile(icons) {
  const body = Object.entries(icons)
    .map(([k, ic]) => {
      const node = ic.node.map(([tag, a]) => `      [${q(tag)}, ${attrs(a)}],`).join('\n')
      return `  ${key(k)}: {\n    label: ${q(ic.label)},\n    source: ${q(ic.source)},\n    node: [\n${node}\n    ],\n  },`
    })
    .join('\n')
  return `// Item icons: the ones housemates pick for cupboard items, in picker order.
// Edit by hand, or with the tuning page (\`npm run tune\`), which rewrites this file.
// The key (e.g. "milk") is saved in the database: never rename or remove a key in use.
// \`node\` is the drawing on a 24×24 grid. See docs/icons-and-keywords.md.
import type { ItemIconData } from './types'

export const ITEM_ICON_DATA: Record<string, ItemIconData> = {
${body}
}
`
}

export function keywordsFile(rules) {
  let last = ''
  const lines = []
  for (const r of rules) {
    if (r.shelf !== last) {
      if (last) lines.push('')
      lines.push(`  // ${r.shelf}`)
      last = r.shelf
    }
    lines.push(`  { shelf: ${q(r.shelf)}, icon: ${q(r.icon)}, keywords: [${r.keywords.map(q).join(', ')}] },`)
  }
  return `// Name → icon + shelf guesses. Edit by hand, or with the tuning page (\`npm run tune\`),
// which rewrites this file (comments other than these headers aren't kept).
// How matching works: docs/icons-and-keywords.md. Rule order doesn't matter.
import type { KeywordRule } from './types'

export const KEYWORD_RULES: KeywordRule[] = [
${lines.join('\n')}
]
`
}

export function keywordTestsFile(tests) {
  const lines = tests.map((t) => {
    const parts = [`name: ${q(t.name)}`, `shelf: ${t.shelf === null ? 'null' : q(t.shelf)}`]
    if (t.icon) parts.push(`icon: ${q(t.icon)}`)
    return `  { ${parts.join(', ')} },`
  })
  return `// Names the guesser must get right. \`npm run test:suggest\` checks them, and the
// tuning page shows them live. Add one for every bad guess you fix.
// shelf: null means "should not guess anything". icon is optional.
import type { KeywordTest } from './types'

export const KEYWORD_TESTS: KeywordTest[] = [
${lines.join('\n')}
]
`
}

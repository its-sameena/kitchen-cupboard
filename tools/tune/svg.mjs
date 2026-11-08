// Turns SVG markup (pasted, or rendered from an icon library) into an icon node:
// [['path', { d: '…' }], ['circle', { cx: '12', cy: '12', r: '3' }], …]
// Plain JS (no DOM), so it works in Node and the browser.

const SHAPES = ['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']
const GEOMETRY = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points']

/** @returns {{ node: [string, Record<string,string>][], warnings: string[] }} */
export function parseSvg(markup) {
  const warnings = []
  const svg = String(markup)
  const viewBox = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().split(/[\s,]+/).map(Number)
  if (!viewBox) warnings.push('No viewBox found: assuming 0 0 24 24.')
  else if (viewBox.join(' ') !== '0 0 24 24') {
    warnings.push(`viewBox is "${viewBox.join(' ')}", not "0 0 24 24": the icon will look the wrong size. Redraw or scale it to 24×24.`)
  }
  if (/\btransform\s*=/.test(svg)) warnings.push('Has a transform: it is ignored, so the shape may move. Flatten transforms in your editor before exporting.')
  if (/<(text|image|use|mask|clipPath|linearGradient|radialGradient)\b/i.test(svg)) {
    warnings.push('Has text, images, masks or gradients: those are skipped. Use plain shapes only.')
  }

  const node = []
  for (const m of svg.matchAll(/<(path|circle|rect|line|polyline|polygon|ellipse)\b([^>]*?)\/?>/gi)) {
    const tag = m[1].toLowerCase()
    if (!SHAPES.includes(tag)) continue
    const all = {}
    for (const a of m[2].matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) all[a[1]] = a[3] ?? a[4]
    // Tabler adds an invisible 24×24 background box; skip anything not drawn.
    if (all.stroke === 'none' && (!all.fill || all.fill === 'none')) continue
    const attrs = {}
    for (const g of GEOMETRY) if (all[g] !== undefined) attrs[g] = all[g]
    if (all.fill && all.fill !== 'none') {
      attrs.fill = 'currentColor'
      if (!warnings.some((w) => w.startsWith('Filled'))) warnings.push('Filled shapes found: kept, filled with the text colour.')
    }
    if (Object.keys(attrs).length) node.push([tag, attrs])
  }
  if (!node.length) warnings.push('No shapes found. Paste the whole <svg>…</svg>, with paths, circles, rects or lines.')
  return { node, warnings }
}

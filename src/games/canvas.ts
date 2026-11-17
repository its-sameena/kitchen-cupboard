/**
 * Small helpers shared by the hidden arcade games: a crisp canvas that follows its
 * size, the app's theme colours, and drawing the app's own item icons on a canvas.
 */
import { ITEM_ICON_DATA } from '../catalog/item-icons.ts'
import type { CategoryId } from '../types'

export interface Game {
  destroy(): void
  restart(): void
}

export interface GameEvents {
  onScore(score: number): void
  /** Lives left (games without lives never call it). */
  onLives?(lives: number): void
  onOver(score: number): void
}

/** Keeps the canvas sharp on retina screens; calls `layout(w, h)` with its size in CSS pixels. */
export function fitCanvas(canvas: HTMLCanvasElement, layout: (w: number, h: number) => void) {
  const ctx = canvas.getContext('2d')!
  const resize = () => {
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    layout(width, height)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()
  return { ctx, stop: () => ro.disconnect() }
}

/** A colour from src/theme.css, e.g. css('--ink'). */
export function css(name: string, fallback = '#888') {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

export const shelfColor = (id: CategoryId) => css(`--shelf-${id}`)

/** A hex colour (#rgb or #rrggbb) with transparency, as rgba() (canvas-safe). */
export function alpha(color: string, a: number) {
  let h = color.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return color
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

const paths = new Map<string, Path2D | null>()

/** One Path2D for an item icon (src/catalog/item-icons.ts), on its 24×24 grid. */
function iconPath(key: string): Path2D | null {
  if (paths.has(key)) return paths.get(key)!
  const data = ITEM_ICON_DATA[key]
  let p: Path2D | null = null
  if (data) {
    p = new Path2D()
    const n = (v?: string) => Number(v ?? 0)
    for (const [tag, a] of data.node) {
      if (tag === 'path' && a.d) p.addPath(new Path2D(a.d))
      else if (tag === 'circle') {
        p.moveTo(n(a.cx) + n(a.r), n(a.cy))
        p.arc(n(a.cx), n(a.cy), n(a.r), 0, Math.PI * 2)
      } else if (tag === 'ellipse') {
        p.moveTo(n(a.cx) + n(a.rx), n(a.cy))
        p.ellipse(n(a.cx), n(a.cy), n(a.rx), n(a.ry), 0, 0, Math.PI * 2)
      } else if (tag === 'rect') {
        p.roundRect(n(a.x), n(a.y), n(a.width), n(a.height), n(a.rx))
      } else if (tag === 'line') {
        p.moveTo(n(a.x1), n(a.y1))
        p.lineTo(n(a.x2), n(a.y2))
      } else if ((tag === 'polyline' || tag === 'polygon') && a.points) {
        const pts = a.points.trim().split(/[\s,]+/).map(Number)
        for (let i = 0; i + 1 < pts.length; i += 2) (i ? p.lineTo : p.moveTo).call(p, pts[i], pts[i + 1])
        if (tag === 'polygon') p.closePath()
      }
    }
  }
  paths.set(key, p)
  return p
}

/** Draws an item icon centred on (cx, cy), `size` pixels wide, in the given colour. */
export function drawIcon(ctx: CanvasRenderingContext2D, key: string, cx: number, cy: number, size: number, color: string) {
  const p = iconPath(key)
  if (!p) return
  ctx.save()
  ctx.translate(cx - size / 2, cy - size / 2)
  ctx.scale(size / 24, size / 24)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.9
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke(p)
  ctx.restore()
}

/** A requestAnimationFrame loop with a capped time step (seconds). Returns stop(). */
export function loop(step: (dt: number) => void) {
  let last = performance.now()
  let id = 0
  const tick = (now: number) => {
    const dt = Math.min(1 / 30, (now - last) / 1000)
    last = now
    step(dt)
    id = requestAnimationFrame(tick)
  }
  id = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(id)
}

/** Little bits that fly off when something breaks. */
export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
  size: number
}

export function burst(into: Particle[], x: number, y: number, color: string, count = 8) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const s = 60 + Math.random() * 160
    into.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.6 + Math.random() * 0.3, color, size: 2 + Math.random() * 3 })
  }
}

export function stepParticles(ps: Particle[], dt: number, ctx: CanvasRenderingContext2D) {
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]
    p.life -= dt
    if (p.life <= 0) {
      ps.splice(i, 1)
      continue
    }
    p.vy += 600 * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    ctx.globalAlpha = Math.min(1, p.life * 2)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.globalAlpha = 1
}

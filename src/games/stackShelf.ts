/**
 * Stack the Shelf: a tin slides back and forth above the stack; tap to drop it.
 * Whatever hangs over the edge is sliced off, so the tins get narrower. A near-
 * perfect drop snaps into place, and 3 perfect drops in a row widen the tin again.
 * Miss the stack completely and it's game over. Score = tins stacked.
 */
import type { CategoryId } from '../types'
import { alpha, css, drawIcon, fitCanvas, loop, shelfColor, type Game, type GameEvents } from './canvas'

const TIN_H = 30
const PERFECT_PX = 5
const COLORS: CategoryId[] = ['canned', 'sauces', 'dairy', 'snacks', 'drinks', 'produce', 'baking', 'cereals', 'spices', 'cold']
const ICONS = ['can', 'soup', 'amphora', 'cookie', 'cup-soda', 'apple', 'cupcake', 'cereal-box', 'salt', 'egg']

interface Tin {
  x: number
  w: number
  /** Index in the stack: 0 = first tin on the shelf. */
  level: number
  kind: number
}
interface Debris {
  x: number
  y: number
  w: number
  vy: number
  vx: number
  rot: number
  vr: number
  kind: number
}

export function createStackShelf(canvas: HTMLCanvasElement, ev: GameEvents): Game {
  let W = 0
  let H = 0
  let stack: Tin[] = []
  let moving: Tin & { dir: 1 | -1 } = { x: 0, w: 0, level: 0, kind: 0, dir: 1 }
  let debris: Debris[] = []
  let flashes: { text: string; life: number }[] = []
  let speed = 0
  let streak = 0
  let camera = 0
  let state: 'ready' | 'play' | 'over' = 'ready'
  let score = 0
  let baseW = 0
  const colors = { ink: css('--ink', '#141414'), muted: css('--muted', '#74726c') }

  /** Screen y of the top edge of a tin at this stack level. */
  const yOf = (level: number) => H - 70 - (level + 1) * TIN_H + camera

  function nextTin() {
    const top = stack[stack.length - 1]
    const dir: 1 | -1 = stack.length % 2 ? -1 : 1
    moving = { x: dir === 1 ? -top.w * 0.6 : W - top.w * 0.4, w: top.w, level: top.level + 1, kind: (top.kind + 1) % COLORS.length, dir }
  }

  function reset() {
    baseW = Math.min(W * 0.55, 220)
    stack = [{ x: (W - baseW) / 2, w: baseW, level: 0, kind: 0 }]
    debris = []
    flashes = []
    speed = Math.max(140, W * 0.42)
    streak = 0
    camera = 0
    score = 0
    state = 'ready'
    nextTin()
  }

  function layout(w: number, h: number) {
    const first = W === 0
    const shift = (w - W) / 2
    W = w
    H = h
    if (first) reset()
    else {
      for (const t of stack) t.x += shift
      moving.x += shift
    }
  }

  const { ctx, stop: stopFit } = fitCanvas(canvas, layout)

  function drop() {
    if (state === 'over') return
    if (state === 'ready') state = 'play'
    const top = stack[stack.length - 1]
    const left = Math.max(moving.x, top.x)
    const right = Math.min(moving.x + moving.w, top.x + top.w)
    const overlap = right - left
    if (overlap <= 0) {
      debris.push({ x: moving.x, y: yOf(moving.level), w: moving.w, vx: moving.dir * 40, vy: 0, rot: 0, vr: moving.dir * 2, kind: moving.kind })
      state = 'over'
      ev.onOver(score)
      return
    }
    let placed: Tin
    if (Math.abs(moving.x - top.x) <= PERFECT_PX) {
      streak++
      const grow = streak >= 3 ? Math.min(12, baseW - top.w) : 0
      placed = { x: top.x - grow / 2, w: top.w + grow, level: moving.level, kind: moving.kind }
      flashes.push({ text: grow > 0 ? 'Perfect! Wider tin' : 'Perfect!', life: 0.9 })
      if (grow > 0) streak = 0
    } else {
      streak = 0
      placed = { x: left, w: overlap, level: moving.level, kind: moving.kind }
      // The bit hanging over falls off.
      const offX = moving.x < top.x ? moving.x : right
      const offW = moving.w - overlap
      debris.push({ x: offX, y: yOf(moving.level), w: offW, vx: (moving.x < top.x ? -1 : 1) * 60, vy: -40, rot: 0, vr: (moving.x < top.x ? -1 : 1) * 3, kind: moving.kind })
    }
    stack.push(placed)
    score++
    ev.onScore(score)
    speed = Math.min(speed * 1.04, W * 1.6)
    nextTin()
  }

  const onDown = (e: PointerEvent) => {
    e.preventDefault()
    drop()
  }
  canvas.addEventListener('pointerdown', onDown)

  function drawTin(x: number, y: number, w: number, kind: number) {
    const color = shelfColor(COLORS[kind])
    ctx.fillStyle = alpha(color, 0.85)
    ctx.beginPath()
    ctx.roundRect(x, y, w, TIN_H - 2, 6)
    ctx.fill()
    // Lid and base rims
    ctx.fillStyle = alpha('#ffffff', 0.35)
    ctx.fillRect(x + 3, y + 3, Math.max(0, w - 6), 2.5)
    ctx.fillStyle = alpha('#000000', 0.12)
    ctx.fillRect(x + 3, y + TIN_H - 7, Math.max(0, w - 6), 2.5)
    if (w > 34) drawIcon(ctx, ICONS[kind], x + w / 2, y + TIN_H / 2 - 1, 16, colors.ink)
  }

  function step(dt: number) {
    // Slide the current tin across, bouncing at the edges.
    if (state !== 'over') {
      moving.x += moving.dir * speed * dt
      const min = -moving.w * 0.6
      const max = W - moving.w * 0.4
      if (moving.x > max) {
        moving.x = max
        moving.dir = -1
      } else if (moving.x < min) {
        moving.x = min
        moving.dir = 1
      }
    }
    // Camera follows the stack upward.
    const want = Math.max(0, (stack.length + 1) * TIN_H - H * 0.45)
    camera += (want - camera) * Math.min(1, dt * 6)

    ctx.clearRect(0, 0, W, H)
    // Glass shelf the stack stands on
    const shelfY = H - 70 + camera
    if (shelfY < H + 20) {
      ctx.fillStyle = alpha(shelfColor('canned'), 0.5)
      ctx.beginPath()
      ctx.roundRect(16, shelfY, W - 32, 10, 5)
      ctx.fill()
    }
    for (const t of stack.slice(1)) {
      const y = yOf(t.level)
      if (y > H + TIN_H || y < -TIN_H) continue
      drawTin(t.x, y, t.w, t.kind)
    }
    // First tin sits on the shelf
    const base = stack[0]
    drawTin(base.x, yOf(0), base.w, base.kind)
    if (state !== 'over') drawTin(moving.x, yOf(moving.level), moving.w, moving.kind)

    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i]
      d.vy += 900 * dt
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.rot += d.vr * dt
      if (d.y > H + 100) {
        debris.splice(i, 1)
        continue
      }
      ctx.save()
      ctx.translate(d.x + d.w / 2, d.y + TIN_H / 2)
      ctx.rotate(d.rot)
      drawTin(-d.w / 2, -TIN_H / 2, d.w, d.kind)
      ctx.restore()
    }

    ctx.textAlign = 'center'
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]
      f.life -= dt
      if (f.life <= 0) {
        flashes.splice(i, 1)
        continue
      }
      ctx.globalAlpha = Math.min(1, f.life * 2)
      ctx.fillStyle = colors.ink
      ctx.font = '700 16px Inter, system-ui, sans-serif'
      ctx.fillText(f.text, W / 2, yOf(stack[stack.length - 1].level) - 24 - (0.9 - f.life) * 20)
    }
    ctx.globalAlpha = 1
    if (state === 'ready') {
      ctx.fillStyle = colors.muted
      ctx.font = '500 13px Inter, system-ui, sans-serif'
      ctx.fillText('Tap to drop the tin', W / 2, H - 30)
    }
  }

  const stopLoop = loop(step)

  return {
    destroy() {
      stopLoop()
      stopFit()
      canvas.removeEventListener('pointerdown', onDown)
    },
    restart() {
      reset()
      ev.onScore(0)
    },
  }
}

/**
 * Shelf Breaker: slide the cutting board to bounce a pea into the items on the
 * glass shelves. Tins take two hits. Clear a whole shelf for a bonus; clear them
 * all for the next level (faster, more tins). 3 lives.
 */
import type { CategoryId } from '../types'
import { alpha, burst, css, drawIcon, fitCanvas, loop, shelfColor, stepParticles, type Game, type GameEvents, type Particle } from './canvas'

/** Each row is a shelf: its colour and the icons on it. */
const SHELVES: { id: CategoryId; icons: string[] }[] = [
  { id: 'spices', icons: ['flask-round', 'salt', 'spice-mill', 'leaf', 'flame'] },
  { id: 'coffee', icons: ['coffee', 'coffee-bean', 'milk', 'coffee'] },
  { id: 'canned', icons: ['can', 'amphora', 'can', 'soup'] },
  { id: 'snacks', icons: ['cookie', 'candy', 'popcorn', 'nut', 'cake-slice'] },
  { id: 'produce', icons: ['apple', 'banana', 'carrot', 'tomato', 'avocado', 'grape'] },
]
const COLS = 6
const POINTS = 10
const SHELF_BONUS = 50
const LIVES = 3

interface Brick {
  x: number
  y: number
  w: number
  h: number
  row: number
  icon: string
  hp: number
  maxHp: number
}

export function createShelfBreaker(canvas: HTMLCanvasElement, ev: GameEvents): Game {
  let W = 0
  let H = 0
  let bricks: Brick[] = []
  let particles: Particle[] = []
  let flashes: { text: string; x: number; y: number; life: number }[] = []
  let paddle = { x: 0, w: 0, h: 12, y: 0 }
  let ball = { x: 0, y: 0, vx: 0, vy: 0, r: 7 }
  let speed = 0
  let state: 'ready' | 'play' | 'over' = 'ready'
  let score = 0
  let lives = LIVES
  let level = 1
  const colors = { ink: css('--ink', '#141414'), muted: css('--muted', '#74726c'), bg: css('--bg', '#f3f2ee'), pea: '#5fc47a', board: '#c99a63' }

  const baseSpeed = () => Math.max(300, H * 0.5) * (1 + (level - 1) * 0.1)

  function buildBricks() {
    const pad = 14
    const gap = 6
    const top = 22
    const bw = (W - pad * 2 - gap * (COLS - 1)) / COLS
    const bh = Math.min(34, Math.max(26, bw * 0.62))
    const tinChance = Math.min(0.6, 0.15 + level * 0.1)
    bricks = []
    SHELVES.forEach((shelf, row) => {
      for (let c = 0; c < COLS; c++) {
        const icon = shelf.icons[(c + row) % shelf.icons.length]
        const tough = icon === 'can' || Math.random() < tinChance * 0.4
        const hp = tough ? 2 : 1
        bricks.push({ x: pad + c * (bw + gap), y: top + row * (bh + 16), w: bw, h: bh, row, icon: tough ? 'can' : icon, hp, maxHp: hp })
      }
    })
  }

  function resetBall() {
    state = 'ready'
    speed = baseSpeed()
    ball.x = paddle.x
    ball.y = paddle.y - paddle.h / 2 - ball.r - 1
    ball.vx = 0
    ball.vy = 0
  }

  function layout(w: number, h: number) {
    const first = W === 0
    W = w
    H = h
    paddle.w = Math.max(64, W * 0.24)
    paddle.y = H - 46
    if (first) paddle.x = W / 2
    paddle.x = Math.min(Math.max(paddle.x, paddle.w / 2), W - paddle.w / 2)
    if (first || state === 'ready') {
      if (first) buildBricks()
      resetBall()
    }
  }

  const { ctx, stop: stopFit } = fitCanvas(canvas, layout)

  function launch() {
    if (state !== 'ready') return
    state = 'play'
    const a = (Math.random() - 0.5) * 0.6
    ball.vx = Math.sin(a) * speed
    ball.vy = -Math.cos(a) * speed
  }

  const move = (clientX: number) => {
    const r = canvas.getBoundingClientRect()
    paddle.x = Math.min(Math.max(clientX - r.left, paddle.w / 2), W - paddle.w / 2)
    if (state === 'ready') ball.x = paddle.x
  }
  const onDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId)
    move(e.clientX)
    launch()
  }
  const onMove = (e: PointerEvent) => move(e.clientX)
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)

  function hitBricks() {
    for (const b of bricks) {
      if (b.hp <= 0) continue
      const nx = Math.max(b.x, Math.min(ball.x, b.x + b.w))
      const ny = Math.max(b.y, Math.min(ball.y, b.y + b.h))
      const dx = ball.x - nx
      const dy = ball.y - ny
      if (dx * dx + dy * dy > ball.r * ball.r) continue
      // Bounce off the side we hit most squarely.
      const overlapX = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r))
      const overlapY = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r))
      if (overlapX < overlapY) ball.vx = ball.x < b.x + b.w / 2 ? -Math.abs(ball.vx) : Math.abs(ball.vx)
      else ball.vy = ball.y < b.y + b.h / 2 ? -Math.abs(ball.vy) : Math.abs(ball.vy)
      b.hp--
      const color = shelfColor(SHELVES[b.row].id)
      if (b.hp > 0) {
        burst(particles, ball.x, ball.y, color, 3)
        return
      }
      score += POINTS
      burst(particles, b.x + b.w / 2, b.y + b.h / 2, color, 10)
      if (!bricks.some((o) => o.row === b.row && o.hp > 0)) {
        score += SHELF_BONUS
        flashes.push({ text: `Shelf cleared +${SHELF_BONUS}`, x: W / 2, y: b.y + b.h / 2, life: 1.2 })
      }
      ev.onScore(score)
      if (bricks.every((o) => o.hp <= 0)) {
        level++
        flashes.push({ text: `Level ${level}`, x: W / 2, y: H / 2, life: 1.4 })
        buildBricks()
        resetBall()
      }
      return
    }
  }

  function physics(dt: number) {
    const steps = 4
    for (let i = 0; i < steps && state === 'play'; i++) {
      const s = dt / steps
      ball.x += ball.vx * s
      ball.y += ball.vy * s
      if (ball.x < ball.r) {
        ball.x = ball.r
        ball.vx = Math.abs(ball.vx)
      } else if (ball.x > W - ball.r) {
        ball.x = W - ball.r
        ball.vx = -Math.abs(ball.vx)
      }
      if (ball.y < ball.r) {
        ball.y = ball.r
        ball.vy = Math.abs(ball.vy)
      }
      // Cutting board: where it lands sets the angle (edges send it wide).
      const top = paddle.y - paddle.h / 2
      if (ball.vy > 0 && ball.y + ball.r >= top && ball.y < paddle.y + paddle.h / 2 && Math.abs(ball.x - paddle.x) <= paddle.w / 2 + ball.r) {
        const hit = Math.max(-1, Math.min(1, (ball.x - paddle.x) / (paddle.w / 2)))
        const angle = hit * (Math.PI / 3)
        speed = Math.min(speed * 1.01, baseSpeed() * 1.5)
        ball.vx = Math.sin(angle) * speed
        ball.vy = -Math.cos(angle) * speed
        ball.y = top - ball.r
      }
      hitBricks()
      if (ball.y - ball.r > H) {
        lives--
        ev.onLives?.(lives)
        if (lives <= 0) {
          state = 'over'
          ev.onOver(score)
        } else resetBall()
      }
    }
  }

  function draw(dt: number) {
    ctx.clearRect(0, 0, W, H)
    // Glass shelves under each row
    SHELVES.forEach((shelf, row) => {
      const b = bricks.find((o) => o.row === row)
      if (!b) return
      const y = b.y + b.h + 4
      ctx.fillStyle = alpha(shelfColor(shelf.id), 0.55)
      ctx.beginPath()
      ctx.roundRect(8, y, W - 16, 6, 3)
      ctx.fill()
    })
    for (const b of bricks) {
      if (b.hp <= 0) continue
      const color = shelfColor(SHELVES[b.row].id)
      ctx.fillStyle = alpha(color, 0.28)
      ctx.strokeStyle = alpha(color, b.maxHp > 1 ? 1 : 0.7)
      ctx.lineWidth = b.maxHp > 1 ? 2.5 : 1.5
      ctx.beginPath()
      ctx.roundRect(b.x, b.y, b.w, b.h, 8)
      ctx.fill()
      ctx.stroke()
      drawIcon(ctx, b.icon, b.x + b.w / 2, b.y + b.h / 2, Math.min(b.h - 8, 22), colors.ink)
      if (b.maxHp > 1 && b.hp === 1) {
        // Dented tin
        ctx.strokeStyle = colors.ink
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(b.x + b.w * 0.2, b.y + 4)
        ctx.lineTo(b.x + b.w * 0.32, b.y + b.h * 0.45)
        ctx.lineTo(b.x + b.w * 0.24, b.y + b.h - 4)
        ctx.stroke()
      }
    }
    // Cutting board
    ctx.fillStyle = colors.board
    ctx.beginPath()
    ctx.roundRect(paddle.x - paddle.w / 2, paddle.y - paddle.h / 2, paddle.w, paddle.h, 6)
    ctx.fill()
    ctx.fillStyle = alpha('#000000', 0.15)
    ctx.beginPath()
    ctx.arc(paddle.x + paddle.w / 2 - 10, paddle.y, 2.5, 0, Math.PI * 2)
    ctx.fill()
    // Pea
    if (state !== 'over') {
      ctx.fillStyle = colors.pea
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.beginPath()
      ctx.arc(ball.x - 2.2, ball.y - 2.2, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
    stepParticles(particles, dt, ctx)
    ctx.textAlign = 'center'
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]
      f.life -= dt
      f.y -= 20 * dt
      if (f.life <= 0) {
        flashes.splice(i, 1)
        continue
      }
      ctx.globalAlpha = Math.min(1, f.life * 2)
      ctx.fillStyle = colors.ink
      ctx.font = '700 15px Inter, system-ui, sans-serif'
      ctx.fillText(f.text, f.x, f.y)
    }
    ctx.globalAlpha = 1
    if (state === 'ready') {
      ctx.fillStyle = colors.muted
      ctx.font = '500 13px Inter, system-ui, sans-serif'
      ctx.fillText('Drag to move · tap to launch', W / 2, paddle.y - 40)
    }
  }

  const stopLoop = loop((dt) => {
    physics(dt)
    draw(dt)
  })

  return {
    destroy() {
      stopLoop()
      stopFit()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
    },
    restart() {
      score = 0
      lives = LIVES
      level = 1
      particles = []
      flashes = []
      ev.onScore(0)
      ev.onLives?.(lives)
      buildBricks()
      resetBall()
    },
  }
}

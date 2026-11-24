/**
 * The Toolbox physics stage (Matter.js): things fall from the sky onto a ground line,
 * stack, tumble and slide off each other, and can be dragged and flung. Each body's
 * shape is the outer outline of its icon. Drawn on a canvas in the holder's colour.
 */
import Matter from 'matter-js'
import { ITEM_ICON_DATA } from '../catalog/item-icons.ts'

const { Engine, Bodies, Body, Composite, Query, Vertices, Constraint } = Matter

/**
 * Look and feel of the Toolbox: change these numbers to tune it
 * (docs/customising.md → Toolbox). Save with `npm run dev` running to see changes.
 */
export const TOOLBOX = {
  /** Size of each thing on the stage (px). Its physics shape scales with it. */
  size: 58,
  /** Icon line thickness (in the icon's 24-unit grid; the cupboard uses ~1.7). */
  line: 2.2,
  /** Thickness of the black ground line (px). */
  ground: 2.5,
  /** Gravity: 1 = normal, higher = things fall faster and feel heavier. */
  gravity: 1.1,
  /** Bounciness on landing: 0 = thud, 1 = superball. */
  bounce: 0.25,
  /** Sliding friction: 0 = ice, 1 = rubber. */
  friction: 0.6,
  /** How hard it is to start a resting thing sliding (0–1). */
  grip: 0.8,
  /** Air resistance: higher = slower, floatier flings. */
  airDrag: 0.012,
  /** Mass per area: mostly affects how things push each other. */
  weight: 0.0015,
  /** Dragging: how tightly a thing follows your finger (0–1) and how much it wobbles. */
  dragStiffness: 0.12,
  dragDamping: 0.08,
  /** Legend jump: upward speed (min–max), sideways spread and spin. */
  jumpUp: [13, 19] as [number, number],
  jumpSideways: 9,
  jumpSpin: 0.5,
  /** Falling in: time between things dropping from the top (ms). */
  dropEvery: 110,
}

export const THING_SIZE = TOOLBOX.size
const LINE = TOOLBOX.line
const GROUND = TOOLBOX.ground

export interface StageThing {
  id: string
  icon: string
  color: string
}

export interface Stage {
  /** Add new things (they fall from the sky), remove gone ones, update colours/icons. */
  sync(things: StageThing[]): void
  /** Make these things jump (into everything else). */
  jump(ids: string[]): void
  /** Where each thing is (for testing). */
  positions(): Record<string, { x: number; y: number; angle: number }>
  destroy(): void
}

// ───────────────────────── icons ─────────────────────────

const paths = new Map<string, Path2D>()
function iconPath(key: string): Path2D {
  let p = paths.get(key)
  if (p) return p
  p = new Path2D()
  const data = ITEM_ICON_DATA[key] ?? ITEM_ICON_DATA.package
  const n = (v?: string) => Number(v ?? 0)
  for (const [tag, a] of data.node) {
    if (tag === 'path' && a.d) p.addPath(new Path2D(a.d))
    else if (tag === 'circle') {
      p.moveTo(n(a.cx) + n(a.r), n(a.cy))
      p.arc(n(a.cx), n(a.cy), n(a.r), 0, Math.PI * 2)
    } else if (tag === 'ellipse') {
      p.moveTo(n(a.cx) + n(a.rx), n(a.cy))
      p.ellipse(n(a.cx), n(a.cy), n(a.rx), n(a.ry), 0, 0, Math.PI * 2)
    } else if (tag === 'rect') p.roundRect(n(a.x), n(a.y), n(a.width), n(a.height), n(a.rx))
    else if (tag === 'line') {
      p.moveTo(n(a.x1), n(a.y1))
      p.lineTo(n(a.x2), n(a.y2))
    } else if ((tag === 'polyline' || tag === 'polygon') && a.points) {
      const pts = a.points.trim().split(/[\s,]+/).map(Number)
      for (let i = 0; i + 1 < pts.length; i += 2) (i ? p.lineTo : p.moveTo).call(p, pts[i], pts[i + 1])
      if (tag === 'polygon') p.closePath()
    }
  }
  paths.set(key, p)
  return p
}

/** Draws an icon centred on (0,0), THING_SIZE wide, as thick coloured lines. */
function drawIcon(ctx: CanvasRenderingContext2D, key: string, color: string) {
  ctx.save()
  ctx.translate(-THING_SIZE / 2, -THING_SIZE / 2)
  ctx.scale(THING_SIZE / 24, THING_SIZE / 24)
  ctx.strokeStyle = color
  ctx.lineWidth = LINE
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke(iconPath(key))
  ctx.restore()
}

/** The icon's outer outline (convex hull of its drawn pixels), centred on the icon's middle. */
const hulls = new Map<string, Matter.Vector[]>()
function outline(key: string): Matter.Vector[] {
  const cached = hulls.get(key)
  if (cached) return cached
  const pad = 6
  const s = THING_SIZE + pad * 2
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.translate(s / 2, s / 2)
  drawIcon(ctx, key, '#000')
  const { data } = ctx.getImageData(0, 0, s, s)
  const pts: Matter.Vector[] = []
  for (let y = 0; y < s; y += 2) {
    for (let x = 0; x < s; x += 2) if (data[(y * s + x) * 4 + 3] > 40) pts.push({ x: x - s / 2, y: y - s / 2 })
  }
  const square = [{ x: -20, y: -20 }, { x: 20, y: -20 }, { x: 20, y: 20 }, { x: -20, y: 20 }]
  const h: Matter.Vector[] = pts.length >= 3 ? Vertices.hull(pts as unknown as Matter.Vertex[]) : square
  hulls.set(key, h)
  return h
}

// ───────────────────────── the stage ─────────────────────────

export function createStage(canvas: HTMLCanvasElement, onTap: (id: string) => void): Stage {
  const ctx = canvas.getContext('2d')!
  const engine = Engine.create({ gravity: { x: 0, y: TOOLBOX.gravity }, positionIterations: 10, velocityIterations: 8 })
  let W = 0
  let H = 0
  let walls: Matter.Body[] = []
  const bodies = new Map<string, { body: Matter.Body; icon: string; color: string; offset: Matter.Vector }>()

  /** Ground, ceiling and side walls (rebuilt when the stage changes size): nothing leaves the box. */
  function buildWalls() {
    Composite.remove(engine.world, walls)
    const t = 200
    walls = [
      Bodies.rectangle(W / 2, H - GROUND + t / 2, W * 3, t, { isStatic: true, friction: 0.9 }),
      Bodies.rectangle(W / 2, -t / 2, W * 3, t, { isStatic: true }),
      Bodies.rectangle(-t / 2, H / 2, t, H + t * 2, { isStatic: true }),
      Bodies.rectangle(W + t / 2, H / 2, t, H + t * 2, { isStatic: true }),
    ]
    Composite.add(engine.world, walls)
  }

  function resize() {
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const r = canvas.getBoundingClientRect()
    W = r.width
    H = r.height
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    buildWalls()
    // Keep everything inside if the stage got narrower.
    for (const { body } of bodies.values()) {
      if (body.position.x > W - 20) Body.setPosition(body, { x: W - THING_SIZE / 2, y: body.position.y })
    }
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()

  /** Things waiting to drop in from the top, one every TOOLBOX.dropEvery ms. */
  const pending: StageThing[] = []
  let nextDrop = 0

  function add(t: StageThing) {
    const hull = outline(t.icon)
    const centre = Vertices.centre(hull)
    const x = THING_SIZE / 2 + Math.random() * Math.max(1, W - THING_SIZE)
    const y = THING_SIZE / 2 + 2 // just inside the ceiling
    const body = Bodies.fromVertices(x, y, [hull], {
      restitution: TOOLBOX.bounce,
      friction: TOOLBOX.friction,
      frictionStatic: TOOLBOX.grip,
      frictionAir: TOOLBOX.airDrag,
      density: TOOLBOX.weight,
    })
    Body.setAngle(body, (Math.random() - 0.5) * 1.2)
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.15)
    Composite.add(engine.world, body)
    // The body's position is the outline's centre; draw the icon offset back to its middle.
    bodies.set(t.id, { body, icon: t.icon, color: t.color, offset: { x: -centre.x, y: -centre.y } })
  }

  // ── drag and fling ──
  let grab: { constraint: Matter.Constraint; id: string; x: number; y: number; t: number; moved: boolean } | null = null
  const point = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const idOf = (b: Matter.Body) => [...bodies].find(([, v]) => v.body === b)?.[0]
  const onDown = (e: PointerEvent) => {
    const p = point(e)
    const hit = Query.point([...bodies.values()].map((v) => v.body), p).pop()
    if (!hit) return
    const id = idOf(hit)
    if (!id) return
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      /* capture is a nicety; dragging still works without it */
    }
    const constraint = Constraint.create({
      pointA: p,
      bodyB: hit,
      pointB: { x: p.x - hit.position.x, y: p.y - hit.position.y },
      stiffness: TOOLBOX.dragStiffness,
      damping: TOOLBOX.dragDamping,
      length: 0,
    })
    Composite.add(engine.world, constraint)
    grab = { constraint, id, x: p.x, y: p.y, t: performance.now(), moved: false }
  }
  const onMove = (e: PointerEvent) => {
    if (!grab) return
    const p = point(e)
    grab.constraint.pointA = p
    if (Math.hypot(p.x - grab.x, p.y - grab.y) > 8) grab.moved = true
  }
  const onUp = () => {
    if (!grab) return
    Composite.remove(engine.world, grab.constraint)
    const tap = !grab.moved && performance.now() - grab.t < 350
    const id = grab.id
    grab = null
    if (tap) onTap(id)
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)

  // ── loop ──
  let raf = 0
  let last = performance.now()
  let acc = 0
  const STEP = 1000 / 60 // fixed physics steps keep stacking stable
  const frame = (now: number) => {
    acc = Math.min(acc + (now - last), STEP * 4) // after a pause, don't try to catch up
    last = now
    while (acc >= STEP) {
      Engine.update(engine, STEP)
      acc -= STEP
    }
    if (pending.length && now >= nextDrop) {
      add(pending.shift()!)
      nextDrop = now + TOOLBOX.dropEvery
    }
    ctx.clearRect(0, 0, W, H)
    // Ground line
    ctx.fillStyle = '#141414'
    ctx.fillRect(0, H - GROUND, W, GROUND)
    for (const v of bodies.values()) {
      const { body } = v
      ctx.save()
      ctx.translate(body.position.x, body.position.y)
      ctx.rotate(body.angle)
      ctx.translate(v.offset.x, v.offset.y)
      drawIcon(ctx, v.icon, v.color)
      ctx.restore()
    }
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return {
    sync(things) {
      const ids = new Set(things.map((t) => t.id))
      for (const [id, v] of bodies) {
        if (!ids.has(id)) {
          Composite.remove(engine.world, v.body)
          bodies.delete(id)
        }
      }
      for (let i = pending.length - 1; i >= 0; i--) if (!ids.has(pending[i].id)) pending.splice(i, 1)
      for (const t of things) {
        const v = bodies.get(t.id)
        const waiting = pending.find((p) => p.id === t.id)
        if (waiting) waiting.color = t.color
        else if (!v) pending.push({ ...t })
        else if (v.icon !== t.icon) {
          Composite.remove(engine.world, v.body)
          bodies.delete(t.id)
          add(t)
        } else v.color = t.color
      }
    },
    jump(ids) {
      for (const id of ids) {
        const v = bodies.get(id)
        if (!v) continue
        const [lo, hi] = TOOLBOX.jumpUp
        Body.setVelocity(v.body, { x: (Math.random() - 0.5) * TOOLBOX.jumpSideways, y: -(lo + Math.random() * (hi - lo)) })
        Body.setAngularVelocity(v.body, (Math.random() - 0.5) * TOOLBOX.jumpSpin)
      }
    },
    positions() {
      return Object.fromEntries([...bodies].map(([id, v]) => [id, { x: Math.round(v.body.position.x), y: Math.round(v.body.position.y), angle: +v.body.angle.toFixed(2) }]))
    },
    destroy() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      Engine.clear(engine)
    },
  }
}

/**
 * The Toolbox physics stage (Matter.js): things fall from the sky onto a ground line,
 * stack, tumble and slide off each other, and can be dragged and flung. Each body's
 * shape is the outer outline of its icon. Drawn on a canvas in the holder's colour.
 */
import Matter from 'matter-js'
import { ITEM_ICON_DATA } from '../catalog/item-icons.ts'

const { Engine, Bodies, Body, Composite, Query, Vertices, Constraint } = Matter

/** Icon size on the stage (px) and its line thickness (in 24-unit icon space). */
export const THING_SIZE = 58
const LINE = 3.2
/** Thickness of the black ground line (px). */
const GROUND = 4

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
  const engine = Engine.create({ gravity: { x: 0, y: 1.1 }, positionIterations: 10, velocityIterations: 8 })
  let W = 0
  let H = 0
  let walls: Matter.Body[] = []
  const bodies = new Map<string, { body: Matter.Body; icon: string; color: string; offset: Matter.Vector }>()
  let dropQueue = 0

  /** Ground and side walls (rebuilt when the stage changes size). Walls go far up so tall stacks stay in. */
  function buildWalls() {
    Composite.remove(engine.world, walls)
    const t = 200
    walls = [
      Bodies.rectangle(W / 2, H - GROUND + t / 2, W * 3, t, { isStatic: true, friction: 0.9 }),
      Bodies.rectangle(-t / 2, H - 3000, t, 6000, { isStatic: true }),
      Bodies.rectangle(W + t / 2, H - 3000, t, 6000, { isStatic: true }),
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

  function add(t: StageThing) {
    const hull = outline(t.icon)
    const centre = Vertices.centre(hull)
    const x = THING_SIZE / 2 + Math.random() * Math.max(1, W - THING_SIZE)
    const y = -THING_SIZE - dropQueue++ * 70 // staggered, from above the top edge
    const body = Bodies.fromVertices(x, y, [hull], {
      restitution: 0.25,
      friction: 0.6,
      frictionStatic: 0.8,
      frictionAir: 0.012,
      density: 0.0015,
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
      stiffness: 0.12,
      damping: 0.08,
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
    dropQueue = Math.max(0, dropQueue - 0.05) // later additions start lower again
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
      for (const t of things) {
        const v = bodies.get(t.id)
        if (!v) add(t)
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
        Body.setVelocity(v.body, { x: (Math.random() - 0.5) * 9, y: -13 - Math.random() * 6 })
        Body.setAngularVelocity(v.body, (Math.random() - 0.5) * 0.5)
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

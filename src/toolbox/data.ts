/**
 * Toolbox PROTOTYPE data: shared household things and who has them.
 * Stored on this phone only (localStorage) while we test the page; nothing is
 * written to the database. Stage 2 moves this to Supabase with the same shape.
 */
import type { User } from '../types'

export interface Thing {
  id: string
  name: string
  /** Item icon key (src/catalog/item-icons.ts). */
  icon: string
  /** Profile id of whoever has it, or null = Elsewhere. */
  holder: string | null
  addedAt: number
}

/** One change of hands. Undo marks it undone and gives the thing back to `from`. */
export interface Handover {
  id: string
  thingId: string
  from: string | null
  to: string | null
  /** Who made the change (the only one who can undo it). */
  by: string
  at: number
  undone?: boolean
  /** The "added it" entry: shown in history, but not undoable. */
  added?: boolean
}

export interface ToolboxData {
  things: Thing[]
  history: Handover[]
}

const key = (kitchenId: string) => `kc-toolbox-proto:${kitchenId}`
const id = () => Math.random().toString(36).slice(2, 10)

/** Sample things for the prototype, spread across the housemates (food icons for now). */
const SAMPLES: [string, string][] = [
  ['Big pot', 'cooking-pot'],
  ['Kettle', 'coffee'],
  ['Mixing bowl', 'soup'],
  ['Cake tin', 'cake-slice'],
  ['Pizza stone', 'pizza'],
  ['Wine glasses', 'wine'],
  ['Picnic bag', 'shopping-bag'],
  ['Blender', 'cup-soda'],
]

function seed(users: User[]): ToolboxData {
  const now = Date.now()
  const things = SAMPLES.map(([name, icon], i) => ({
    id: id(),
    name,
    icon,
    holder: i === SAMPLES.length - 1 || !users.length ? null : users[i % users.length].id,
    addedAt: now - i * 3600_000,
  }))
  return { things, history: [] }
}

export function loadToolbox(kitchenId: string, users: User[]): ToolboxData {
  try {
    const d = JSON.parse(localStorage.getItem(key(kitchenId)) ?? 'null') as ToolboxData | null
    if (d && Array.isArray(d.things)) return d
  } catch {
    /* fall through to samples */
  }
  const d = seed(users)
  saveToolbox(kitchenId, d)
  return d
}

export function saveToolbox(kitchenId: string, d: ToolboxData) {
  try {
    localStorage.setItem(key(kitchenId), JSON.stringify(d))
  } catch {
    /* private mode: the prototype still works until reload */
  }
}

export function resetToolbox(kitchenId: string) {
  try {
    localStorage.removeItem(key(kitchenId))
  } catch {
    /* ignore */
  }
}

/** `by` says `to` has the thing now (to = null: Elsewhere). */
export function handOver(d: ToolboxData, thingId: string, to: string | null, by: string): ToolboxData {
  const t = d.things.find((x) => x.id === thingId)
  if (!t || t.holder === to) return d
  return {
    things: d.things.map((x) => (x.id === thingId ? { ...x, holder: to } : x)),
    history: [...d.history, { id: id(), thingId, from: t.holder, to, by, at: Date.now() }],
  }
}

/** The change `me` can undo on this thing: their latest one, if it's still the current state. */
export function undoable(d: ToolboxData, thingId: string, me: string): Handover | null {
  const t = d.things.find((x) => x.id === thingId)
  const last = [...d.history].reverse().find((h) => h.thingId === thingId && !h.undone)
  return t && last && !last.added && last.by === me && last.to === t.holder ? last : null
}

export function undo(d: ToolboxData, thingId: string, me: string): ToolboxData {
  const h = undoable(d, thingId, me)
  if (!h) return d
  return {
    things: d.things.map((x) => (x.id === thingId ? { ...x, holder: h.from } : x)),
    history: d.history.map((x) => (x.id === h.id ? { ...x, undone: true } : x)),
  }
}

export function addThing(d: ToolboxData, name: string, icon: string, holder: string | null, by: string): { data: ToolboxData; thing: Thing } {
  const thing: Thing = { id: id(), name: name.trim(), icon, holder, addedAt: Date.now() }
  return {
    thing,
    data: {
      things: [...d.things, thing],
      history: [...d.history, { id: id(), thingId: thing.id, from: null, to: holder, by, at: Date.now(), added: true }],
    },
  }
}

export function removeThing(d: ToolboxData, thingId: string): ToolboxData {
  return { things: d.things.filter((x) => x.id !== thingId), history: d.history.filter((h) => h.thingId !== thingId) }
}

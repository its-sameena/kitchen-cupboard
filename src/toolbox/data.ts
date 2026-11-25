/**
 * Toolbox helpers. The data itself (things + handover history) lives in the
 * database (toolbox_things / toolbox_handovers) and comes from the store.
 */
import type { Handover, Thing } from '../types'

/**
 * The change `me` may undo on this thing: their own latest change, while it's still
 * the current state (the database enforces the same rule in undo_handover).
 */
export function undoable(thing: Thing, handovers: Handover[], me: string): Handover | null {
  const last = [...handovers].reverse().find((h) => h.thingId === thing.id && !h.undone)
  return last && !last.added && last.by === me && last.to === thing.holder ? last : null
}

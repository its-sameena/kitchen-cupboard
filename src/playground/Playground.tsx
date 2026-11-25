/**
 * Secret physics playground (tap the top-left app icon 5 times): every item in the
 * cupboard drops in, drawn in its owner's colour (an item two people own appears twice).
 * Just for fun: drag and fling things around. Nothing here changes any data.
 * Full screen, the bottom edge of the screen is the ground, and there's no ceiling,
 * so a big cupboard piles up and out of view.
 */
import { useEffect, useMemo, useRef } from 'react'
import { ICON_SIZES } from '../config'
import { UI } from '../icons'
import { useKitchen } from '../store'
import { createStage, TOOLBOX, type Stage, type Tuning } from '../toolbox/stage'

/**
 * Look and feel of the playground: change these to tune it (same meanings as TOOLBOX in
 * src/toolbox/stage.ts, documented in docs/customising.md → Toolbox). Anything not listed
 * here uses the Toolbox's value.
 */
export const PLAYGROUND: Tuning = {
  ...TOOLBOX,
  /** Smaller than the Toolbox, since a cupboard has lots of items. */
  size: 46,
  /** Icon line thickness (24-unit icon grid). */
  line: 2,
  /** A quicker cascade, again because there are many items. */
  dropEvery: 45,
}

export default function Playground({ onClose }: { onClose: () => void }) {
  const s = useKitchen()
  const canvas = useRef<HTMLCanvasElement>(null)
  const stage = useRef<Stage | null>(null)

  // One thing per owner: in stock only, in that owner's colour.
  const things = useMemo(
    () =>
      s.items.flatMap((item) =>
        item.owners.map((owner) => ({
          id: `${item.id}:${owner}`,
          icon: item.icon,
          color: s.users.find((u) => u.id === owner)?.color ?? '#a6a5ad',
        })),
      ),
    [s.items, s.users],
  )

  useEffect(() => {
    stage.current = createStage(canvas.current!, { tuning: PLAYGROUND, ceiling: false, groundLine: false })
    return () => stage.current?.destroy()
  }, [])
  useEffect(() => stage.current?.sync(things), [things])

  // Nothing behind it scrolls while you play; Escape leaves on a keyboard.
  useEffect(() => {
    document.documentElement.classList.add('no-page-scroll')
    const block = (e: TouchEvent) => e.preventDefault()
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('touchmove', block, { passive: false })
    window.addEventListener('keydown', key)
    return () => {
      document.documentElement.classList.remove('no-page-scroll')
      document.removeEventListener('touchmove', block)
      window.removeEventListener('keydown', key)
    }
  }, [onClose])

  return (
    <div className="playground" role="dialog" aria-label="Playground: everything in the cupboard, to throw around">
      <canvas ref={canvas} className="playground-stage" />
      <button className="playground-back" onClick={onClose} aria-label="Leave the playground">
        <UI.back size={ICON_SIZES.button + 2} />
      </button>
    </div>
  )
}

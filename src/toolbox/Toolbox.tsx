/**
 * Toolbox tab: the house's shared things piled on a ground line with physics.
 * Each thing is drawn in its holder's colour (grey = Elsewhere). Tap one to see who has
 * it and say you have it; tap a housemate below the ground to make their things jump.
 * Shared and live through the database (toolbox_things / toolbox_handovers).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ICON_SIZES } from '../config'
import { ITEM_ICONS, ItemIcon, UI } from '../icons'
import { addThing, handOver, removeThing, undoHandover, useKitchen, useMe } from '../store'
import type { Handover, Thing, User } from '../types'
import { Avatar, Sheet, timeAgo } from '../components/ui'
import { undoable } from './data'
import { createStage, TOOLBOX, type Stage } from './stage'

/** Colour for things that aren't with anyone in the house. */
export const ELSEWHERE = '#a6a5ad'

export default function Toolbox() {
  const s = useKitchen()
  const me = useMe()!
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const stage = useRef<Stage | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(400)

  const userOf = (id: string | null) => (id ? s.users.find((u) => u.id === id) : undefined)
  const colorOf = (holder: string | null) => userOf(holder)?.color ?? ELSEWHERE

  // Fill the space between the top bar and the floating tab bar. Measured from where the
  // tab bar really is, so the iPhone home-indicator strip (safe area) is accounted for.
  useLayoutEffect(() => {
    const GAP = 12 // space between the legend row and the tab bar
    const fit = () => {
      const top = box.current?.getBoundingClientRect().top ?? 0
      const bar = document.querySelector('.tabbar')?.getBoundingClientRect().top ?? window.innerHeight
      setHeight(Math.max(260, Math.floor(bar - top - GAP)))
    }
    fit()
    const again = requestAnimationFrame(fit) // once more after fonts/layout settle
    window.addEventListener('resize', fit)
    window.visualViewport?.addEventListener('resize', fit)
    return () => {
      cancelAnimationFrame(again)
      window.removeEventListener('resize', fit)
      window.visualViewport?.removeEventListener('resize', fit)
    }
  }, [])

  useEffect(() => {
    stage.current = createStage(canvas.current!, setOpenId)
    return () => stage.current?.destroy()
  }, [])

  // The page never scrolls while the Toolbox is open, wherever you swipe (except inside sheets).
  useEffect(() => {
    document.documentElement.classList.add('no-page-scroll')
    window.scrollTo(0, 0)
    const block = (e: TouchEvent) => {
      if (!(e.target as HTMLElement).closest('.sheet')) e.preventDefault()
    }
    document.addEventListener('touchmove', block, { passive: false })
    return () => {
      document.documentElement.classList.remove('no-page-scroll')
      document.removeEventListener('touchmove', block)
    }
  }, [])

  const things = useMemo(() => s.things.map((t) => ({ id: t.id, icon: t.icon, color: colorOf(t.holder) })), [s.things, s.users])
  useEffect(() => stage.current?.sync(things), [things])

  // Legend: housemates who are in the kitchen, then Elsewhere.
  const legend: { id: string | null; user?: User; count: number }[] = [
    ...s.users.map((u) => ({ id: u.id, user: u, count: s.things.filter((t) => t.holder === u.id).length })),
    { id: null, count: s.things.filter((t) => t.holder === null).length },
  ]

  const open = s.things.find((t) => t.id === openId)

  return (
    <div className="toolbox" ref={box} style={{ height }}>
      <canvas ref={canvas} className="toolbox-stage" aria-label="The house's shared things. Tap one to see who has it." />
      {s.things.length === 0 && <p className="toolbox-empty muted small">Tap + to add the house’s first shared thing.</p>}
      <div className="toolbox-foot">
        <div className="toolbox-legend" role="group" aria-label="Make someone's things jump">
          {legend.map((l) => (
            <button
              key={l.id ?? 'elsewhere'}
              className="toolbox-person"
              onClick={() => stage.current?.jump(s.things.filter((t) => t.holder === l.id).map((t) => t.id))}
              aria-label={`${l.user?.name ?? 'Elsewhere'}: ${l.count} thing${l.count === 1 ? '' : 's'}`}
            >
              {l.user ? <Avatar user={l.user} size={34} /> : <span className="toolbox-elsewhere" />}
              <span className="toolbox-count">{l.count}</span>
            </button>
          ))}
        </div>
        <button className="toolbox-add" onClick={() => setAdding(true)} aria-label="Add a thing">
          <UI.add size={24} strokeWidth={2.4} />
        </button>
      </div>

      <Sheet open={!!open} onClose={() => setOpenId(null)} title={open?.name} from="top">
        {open && (
          <ThingSheet
            key={open.id}
            thing={open}
            handovers={s.handovers}
            me={me}
            users={s.users}
            colorOf={colorOf}
            onRemove={() => {
              removeThing(open.id)
              setOpenId(null)
            }}
          />
        )}
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add to the Toolbox" from="top">
        {adding && (
          <AddThing
            me={me}
            users={s.users}
            onAdd={(name, icon, holder) => {
              addThing(name.trim(), icon, holder)
              setAdding(false)
            }}
          />
        )}
      </Sheet>
    </div>
  )
}

function holderName(users: User[], id: string | null, me: string) {
  if (id === null) return 'Elsewhere'
  if (id === me) return 'You'
  return users.find((u) => u.id === id)?.name ?? 'Someone'
}

function ThingSheet(props: {
  thing: Thing
  handovers: Handover[]
  me: User
  users: User[]
  colorOf: (holder: string | null) => string
  onRemove: () => void
}) {
  const { thing: t, handovers, me, users, colorOf, onRemove } = props
  const [picking, setPicking] = useState(false)
  const holder = users.find((u) => u.id === t.holder)
  const canUndo = undoable(t, handovers, me.id)
  const history = handovers.filter((h) => h.thingId === t.id).slice(-6).reverse()
  const name = (id: string | null) => holderName(users, id, me.id)

  return (
    <div className="thing-sheet">
      <div className="thing-head">
        <span className="thing-icon" style={{ color: colorOf(t.holder) }}>
          {/* Same line thickness as on the ground (TOOLBOX.line in stage.ts) */}
          <ItemIcon name={t.icon} size={44} strokeWidth={TOOLBOX.line} />
        </span>
        <div>
          <span className="muted small">{t.holder === null ? 'Not with anyone in the house' : 'Has it now'}</span>
          <strong className="thing-holder">
            {holder && <Avatar user={holder} size={26} />}
            {t.holder === me.id ? 'You have it' : name(t.holder)}
          </strong>
        </div>
      </div>

      {t.holder !== me.id && (
        <button className="btn btn-primary btn-block" onClick={() => handOver(t.id, me.id)}>
          I have this
        </button>
      )}
      {canUndo && (
        <button className="btn btn-ghost btn-block" onClick={() => undoHandover(t.id)}>
          Undo: give it back to {canUndo.from === me.id ? 'you' : name(canUndo.from)}
        </button>
      )}

      {!picking ? (
        <button className="link thing-other" onClick={() => setPicking(true)}>
          Someone else has it…
        </button>
      ) : (
        <div className="thing-pick" role="group" aria-label="Who has it?">
          {users
            .filter((u) => u.id !== t.holder && u.id !== me.id)
            .map((u) => (
              <button
                key={u.id}
                className="thing-pick-btn"
                onClick={() => {
                  handOver(t.id, u.id)
                  setPicking(false)
                }}
              >
                <Avatar user={u} size={30} /> {u.name}
              </button>
            ))}
          {t.holder !== null && (
            <button
              className="thing-pick-btn"
              onClick={() => {
                handOver(t.id, null)
                setPicking(false)
              }}
            >
              <span className="toolbox-elsewhere sm" /> Elsewhere
            </button>
          )}
        </div>
      )}

      {history.length > 0 && (
        <ul className="thing-history">
          {history.map((h) => (
            <li key={h.id} className={h.undone ? 'undone' : ''}>
              {h.added
                ? `${name(h.by)} added it${h.to ? `, with ${name(h.to).toLowerCase() === 'you' ? 'you' : name(h.to)}` : ', elsewhere'}`
                : h.by === h.to
                  ? `${name(h.by)} took it`
                  : `${name(h.by)} said ${h.to === null ? 'it’s elsewhere' : `${name(h.to)} has it`}`}
              {h.undone ? ' (undone)' : ''}
              <span className="muted"> · {timeAgo(h.at)}</span>
            </li>
          ))}
        </ul>
      )}
      <button className="link danger-text thing-remove" onClick={() => confirm(`Remove “${t.name}” from the Toolbox?`) && onRemove()}>
        Remove from Toolbox
      </button>
    </div>
  )
}

function AddThing({ me, users, onAdd }: { me: User; users: User[]; onAdd: (name: string, icon: string, holder: string | null) => void }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('package')
  const [holder, setHolder] = useState<string | null>(me.id)
  return (
    <form
      className="add-thing"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onAdd(name, icon, holder)
      }}
    >
      <div className="add-thing-row">
        <span className="thing-icon sm">
          <ItemIcon name={icon} size={30} strokeWidth={TOOLBOX.line} />
        </span>
        <input
          className="add-thing-name"
          autoFocus
          value={name}
          maxLength={32}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Drill, HDMI cable, Iron"
          aria-label="What is it?"
          autoComplete="off"
          enterKeyHint="done"
        />
      </div>
      <span className="add-thing-label">Icon</span>
      <div className="add-thing-icons" role="group" aria-label="Icon">
        {Object.entries(ITEM_ICONS).map(([key, { icon: Icon, label }]) => (
          <button type="button" key={key} className={key === icon ? 'on' : ''} title={label} aria-label={label} onClick={() => setIcon(key)}>
            <Icon size={ICON_SIZES.list} strokeWidth={1.7} />
          </button>
        ))}
      </div>
      <span className="add-thing-label">Who has it now?</span>
      <div className="thing-pick" role="group" aria-label="Who has it now?">
        {users.map((u) => (
          <button type="button" key={u.id} className={'thing-pick-btn' + (holder === u.id ? ' on' : '')} onClick={() => setHolder(u.id)}>
            <Avatar user={u} size={26} /> {u.id === me.id ? 'Me' : u.name}
          </button>
        ))}
        <button type="button" className={'thing-pick-btn' + (holder === null ? ' on' : '')} onClick={() => setHolder(null)}>
          <span className="toolbox-elsewhere sm" /> Elsewhere
        </button>
      </div>
      <button className="btn btn-primary btn-block" disabled={!name.trim()}>
        Drop it in
      </button>
    </form>
  )
}

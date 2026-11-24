import { useEffect, useRef, useState } from 'react'
import { motionMs } from '../motion'
import { categoryById, suggestFor } from '../data'
import {
  activeRun,
  addGrocery,
  endRun,
  hideRun,
  loadRunItems,
  markBought,
  removeGrocery,
  requestEntry,
  startRun,
  toggleGot,
  unrequestEntry,
  useKitchen,
  useMe,
} from '../store'
import type { GroceryEntry, GroceryRun, RunItem, User } from '../types'
import { ICON_SIZES, STORES, type StoreConfig } from '../config'
import { ItemIcon, UI } from '../icons'
import { Avatar, Sheet, timeAgo } from './ui'

export default function Groceries() {
  const s = useKitchen()
  const me = useMe()!
  const run = activeRun(s)
  const shopper = run ? s.users.find((u) => u.id === run.shopperId) : undefined
  const iAmShopping = run?.shopperId === me.id
  const [startOpen, setStartOpen] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)

  const userById = (id?: string) => s.users.find((u) => u.id === id)
  // Rows already here when the screen opened don't animate; ones that arrive later slide in.
  const known = useRef<Set<string> | null>(null)
  if (!known.current) known.current = new Set(s.grocery.map((g) => g.id))
  const isNew = (id: string) => !known.current!.has(id)
  const requested = s.grocery.filter((g) => g.forUser)
  const rest = s.grocery.filter((g) => !g.forUser)
  const gotCount = s.grocery.filter((g) => g.gotBy).length

  return (
    <div className="grocery-screen">
      {!run && (
        <div className="run-card idle">
          <div>
            <h2>Heading to the shops?</h2>
            <p>Let everyone know so they can ask you to pick things up.</p>
          </div>
          <button className="btn btn-run" onClick={() => setStartOpen(true)}>
            <UI.groceryRun size={ICON_SIZES.button} /> Start a grocery run
          </button>
        </div>
      )}

      {run && iAmShopping && (
        <div className="run-card live">
          <div className="run-pulse" aria-hidden />
          <div>
            <h2>You’re on a grocery run{run.store ? ` · ${run.store}` : ''}</h2>
            <p>
              Started {timeAgo(run.startedAt)} · {gotCount}/{s.grocery.length} in basket
            </p>
          </div>
          <button className="btn btn-light" onClick={() => setConfirmEnd(true)}>
            Finish run
          </button>
        </div>
      )}

      {run && !iAmShopping && (
        <div className="run-card live">
          <div className="run-pulse" aria-hidden />
          <Avatar user={shopper} size={40} />
          <div>
            <h2>
              {shopper?.name} is shopping{run.store ? ` at ${run.store}` : ''}
            </h2>
            <p>Tap “Ask” on anything below, or add something new.</p>
          </div>
        </div>
      )}

      <QuickAdd
        placeholder={run && !iAmShopping ? `Ask ${shopper?.name} for…` : 'Add to the grocery list…'}
        buttonLabel={run && !iAmShopping ? 'Ask' : 'Add'}
      />

      {s.grocery.length === 0 && (
        <div className="empty">
          <UI.emptyList className="empty-icon" size={52} strokeWidth={1.3} aria-hidden />
          <p>The grocery list is empty.</p>
          <p className="muted">Items appear here when someone marks the last one as run out.</p>
        </div>
      )}

      {requested.length > 0 && (
        <>
          <h3 className="section-title">Requested{run ? ` from ${iAmShopping ? 'you' : shopper?.name}` : ''}</h3>
          <ul className="g-list">
            {requested.map((g) => (
              <GroceryRow key={g.id} isNew={isNew(g.id)} g={g} me={me} run={!!run} iAmShopping={iAmShopping} shopperName={shopper?.name} userById={userById} />
            ))}
          </ul>
        </>
      )}

      {rest.length > 0 && (
        <>
          <h3 className="section-title">Grocery list</h3>
          <ul className="g-list">
            {rest.map((g) => (
              <GroceryRow key={g.id} isNew={isNew(g.id)} g={g} me={me} run={!!run} iAmShopping={iAmShopping} shopperName={shopper?.name} userById={userById} />
            ))}
          </ul>
        </>
      )}

      <RecentRuns />

      <StartRunSheet open={startOpen} onClose={() => setStartOpen(false)} />
      <Sheet open={confirmEnd} onClose={() => setConfirmEnd(false)} title="Finish grocery run?">
        <p>
          {gotCount
            ? `${gotCount} item${gotCount > 1 ? 's' : ''} in your basket will go into the cupboard. Requested items go to whoever asked for them; the rest are yours.`
            : 'Nothing is ticked off yet. Everyone will be told you’re back.'}
        </p>
        <div className="actions">
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              endRun()
              setConfirmEnd(false)
            }}
          >
            I’m home – finish run
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => setConfirmEnd(false)}>
            Keep shopping
          </button>
        </div>
      </Sheet>
    </div>
  )
}

function GroceryRow({
  g,
  isNew,
  me,
  run,
  iAmShopping,
  shopperName,
  userById,
}: {
  g: GroceryEntry
  isNew: boolean
  me: User
  run: boolean
  iAmShopping: boolean
  shopperName?: string
  userById: (id?: string) => User | undefined
}) {
  const forUser = userById(g.forUser)
  const addedBy = userById(g.addedBy)
  const meta = forUser
    ? `for ${forUser.id === me.id ? 'you' : forUser.name}`
    : `added by ${addedBy ? (addedBy.id === me.id ? 'you' : addedBy.name) : 'someone'} · ${timeAgo(g.addedAt)}`

  return (
    <li
      className={'g-row' + (g.gotBy ? ' got' : '') + (isNew ? ' g-new' : '')}
      style={forUser ? ({ '--for': forUser.color } as React.CSSProperties) : undefined}
    >
      {iAmShopping ? (
        <button
          className={'check' + (g.gotBy ? ' on' : '')}
          onClick={() => toggleGot(g.id)}
          aria-label={g.gotBy ? `Un-tick ${g.name}` : `Tick ${g.name}`}
        >
          {/* Always rendered so the tick can draw itself in (see .check in styles.css) */}
          <UI.check size={20} strokeWidth={3} />
        </button>
      ) : (
        <span className="g-icon">
          <ItemIcon name={g.icon} size={ICON_SIZES.list} strokeWidth={1.7} />
        </span>
      )}
      <div className="g-text">
        <span className="g-name">
          {iAmShopping && <ItemIcon name={g.icon} size={16} className="inline-icon" />}
          {g.name}
        </span>
        <span className="g-meta">
          {forUser && <span className="for-dot" />}
          {meta} · {categoryById(g.category).label}
        </span>
      </div>
      <div className="g-actions">
        {run && !iAmShopping && !g.forUser && (
          <button className="btn btn-sm btn-run" onClick={() => requestEntry(g.id)}>
            Ask {shopperName}
          </button>
        )}
        {run && !iAmShopping && g.forUser === me.id && (
          <button className="btn btn-sm btn-ghost" onClick={() => unrequestEntry(g.id)}>
            Cancel
          </button>
        )}
        {!run && (
          <button className="btn btn-sm btn-primary" onClick={() => markBought(g.id)} title="Bought it – put in cupboard">
            Bought
          </button>
        )}
        {!iAmShopping && (g.addedBy === me.id || !run) && (
          <button className="icon-btn sm" onClick={() => removeGrocery(g.id)} aria-label={`Remove ${g.name}`}>
            <UI.close size={16} />
          </button>
        )}
      </div>
    </li>
  )
}

function QuickAdd({ placeholder, buttonLabel }: { placeholder: string; buttonLabel: string }) {
  const s = useKitchen()
  const [name, setName] = useState('')
  // Names the kitchen already uses keep their shelf and icon.
  const sug = suggestFor(name, [...s.items, ...s.grocery])
  return (
    <form
      className="quick-add"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        addGrocery({ name, icon: sug?.icon ?? 'shopping-bag', category: sug?.category ?? 'other' })
        setName('')
      }}
    >
      <span className="qa-icon">
        <ItemIcon name={sug?.icon ?? 'shopping-bag'} size={ICON_SIZES.list} strokeWidth={1.7} />
      </span>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} maxLength={32} enterKeyHint="send" />
      <button className="btn btn-sm btn-primary" disabled={!name.trim()}>
        {buttonLabel}
      </button>
    </form>
  )
}

function StartRunSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <Sheet open={open} onClose={onClose} title="Where are you going?">
      <p className="muted">Tap a shop to start. Everyone in the kitchen gets a notification and can send you requests.</p>
      <div className="store-grid">
        {STORES.map((st, i) => (
          <StoreButton
            key={st.label}
            index={i}
            store={st}
            picked={picked === st.label}
            onClick={() => {
              if (picked) return
              // The button fills with its colour first, then the run starts and the sheet closes.
              setPicked(st.label)
              setTimeout(() => {
                startRun(st.name)
                onClose()
                setPicked(null)
              }, motionMs(300))
            }}
          />
        ))}
      </div>
    </Sheet>
  )
}

function StoreButton({
  store,
  index,
  picked,
  onClick,
}: {
  store: StoreConfig
  index: number
  picked: boolean
  onClick: () => void
}) {
  const [logoFailed, setLogoFailed] = useState(false)
  const showLogo = store.logo && !logoFailed
  return (
    <button
      className={'store-btn' + (showLogo ? ' has-logo' : '') + (picked ? ' picked' : '')}
      style={{ '--store': store.color, '--i': index } as React.CSSProperties}
      onClick={onClick}
      aria-label={store.name ? `Going to ${store.label}` : 'Going somewhere else'}
    >
      {showLogo ? (
        <img src={store.logo} alt={store.label} onError={() => setLogoFailed(true)} />
      ) : (
        <span>{store.label}</span>
      )}
    </button>
  )
}

/** Grey link that opens the last few grocery runs in a sheet. */
function RecentRuns() {
  const s = useKitchen()
  const [open, setOpen] = useState(false)
  const me = useMe()
  /** The run whose items are shown, or null for the list of runs. */
  const [viewing, setViewing] = useState<string | null>(null)
  /** The row swiped open (showing its red Clear bubble). */
  const [swiped, setSwiped] = useState<string | null>(null)
  /** Asking "Clear this run?" for this run. */
  const [confirming, setConfirming] = useState<string | null>(null)
  /** Cleared on this phone just now (hidden straight away, before the reload). */
  const [cleared, setCleared] = useState<string[]>([])
  const hidden = new Set([...s.hiddenRuns.filter((h) => h.memberId === me?.id).map((h) => h.runId), ...cleared])
  const past = s.runs
    .filter((r) => r.endedAt && !hidden.has(r.id))
    .reverse()
    .slice(0, 10)
  const run = past.find((r) => r.id === viewing)
  const confirmRun = past.find((r) => r.id === confirming)
  if (!past.length && !open) return null
  return (
    <>
      <button className="recent-link" onClick={() => setOpen(true)}>
        Show recent runs
      </button>
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false)
          setViewing(null)
        }}
        title={run ? 'Run details' : 'Recent runs'}
      >
        {!run && past.length > 0 && <p className="muted small run-hint">Swipe a run left to clear it from your list.</p>}
        {!run && past.length === 0 && <p className="muted small">No recent runs.</p>}
        {run ? (
          <RunDetails run={run} onBack={() => setViewing(null)} />
        ) : (
          <ul className="recent-runs">
            {past.map((r) => {
              // Runs from before items were recorded have no details to open.
              const hasDetails = r.itemCount !== null
              const row = (
                <>
                  <RunSummary run={r} />
                  <span className="muted small">{timeAgo(r.endedAt!)}</span>
                  {hasDetails && <UI.chevron size={18} className="run-chevron" aria-hidden />}
                </>
              )
              return (
                <li key={r.id}>
                  <SwipeToClear
                    open={swiped === r.id}
                    onOpen={(o) => setSwiped(o ? r.id : null)}
                    onClear={() => setConfirming(r.id)}
                  >
                    {hasDetails ? (
                      <button className="run-row" onClick={() => setViewing(r.id)} aria-label="See what was bought on this run">
                        {row}
                      </button>
                    ) : (
                      <div className="run-row">{row}</div>
                    )}
                  </SwipeToClear>
                </li>
              )
            })}
          </ul>
        )}
      </Sheet>
      <Sheet
        open={!!confirmRun}
        onClose={() => {
          setConfirming(null)
          setSwiped(null)
        }}
        title="Clear this run?"
      >
        {confirmRun && (
          <div className="confirm-clear">
            <div className="run-row">
              <RunSummary run={confirmRun} />
            </div>
            <p className="muted small">It’s removed from your recent runs only. Your housemates will still see it, and nothing in the cupboard changes.</p>
            <button
              className="btn btn-danger btn-block"
              onClick={() => {
                hideRun(confirmRun.id)
                setCleared((c) => [...c, confirmRun.id])
                setConfirming(null)
                setSwiped(null)
              }}
            >
              <UI.delete size={ICON_SIZES.button} /> Clear run
            </button>
            <button
              className="btn btn-ghost btn-block"
              onClick={() => {
                setConfirming(null)
                setSwiped(null)
              }}
            >
              Keep it
            </button>
          </div>
        )}
      </Sheet>
    </>
  )
}

/** Width of the red Clear bubble when a row is swiped open. */
const CLEAR_W = 88

/**
 * Swipe a row left: it slides with your finger while a red "Clear" bubble grows in
 * from the right. Let go past halfway and it stays open (tap the bubble); swipe most
 * of the way across to go straight to the confirmation. Vertical drags still scroll.
 */
export function SwipeToClear({ open, onOpen, onClear, children }: { open: boolean; onOpen: (open: boolean) => void; onClear: () => void; children: React.ReactNode }) {
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef<{ x: number; y: number; base: number; dir?: 'h' | 'v'; width: number } | null>(null)
  const moved = useRef(false)
  /** Latest drag position (state can lag a frame behind on release). */
  const latest = useRef(0)
  const offset = drag ?? (open ? -CLEAR_W : 0)
  const bubble = Math.max(0, -offset - 8)
  return (
    <div
      className="swipe"
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY, base: open ? -CLEAR_W : 0, width: e.currentTarget.clientWidth }
        moved.current = false
      }}
      onPointerMove={(e) => {
        const st = start.current
        if (!st) return
        const dx = e.clientX - st.x
        const dy = e.clientY - st.y
        if (!st.dir) {
          if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
            st.dir = 'h'
            e.currentTarget.setPointerCapture(e.pointerId)
          } else if (Math.abs(dy) > 8) st.dir = 'v'
        }
        if (st.dir !== 'h') return
        moved.current = true
        latest.current = Math.min(0, Math.max(-st.width, st.base + dx))
        setDrag(latest.current)
      }}
      onPointerUp={() => {
        const st = start.current
        start.current = null
        if (!st || st.dir !== 'h') return
        const end = latest.current
        setDrag(null)
        if (end < -st.width * 0.6) {
          onOpen(true)
          onClear()
        } else onOpen(end < -CLEAR_W / 2)
      }}
      onPointerCancel={() => {
        start.current = null
        setDrag(null)
      }}
      // A swipe isn't a tap: don't open the run's details after dragging.
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest('.swipe-clear')) return
        if (moved.current) {
          e.preventDefault()
          e.stopPropagation()
          moved.current = false
        } else if (open) {
          e.stopPropagation()
          onOpen(false)
        }
      }}
    >
      <button
        type="button"
        className="swipe-clear"
        style={{ width: bubble, opacity: Math.min(1, bubble / 40) }}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        onClick={(e) => {
          e.stopPropagation()
          onClear()
        }}
      >
        {bubble > 56 && (
          <>
            <UI.delete size={16} /> Clear
          </>
        )}
      </button>
      <div className={'swipe-content' + (drag === null ? ' settle' : '')} style={{ transform: `translateX(${offset}px)` }}>
        {children}
      </div>
    </div>
  )
}

const itemsLabel = (n: number) => `${n} item${n === 1 ? '' : 's'}`

/** Avatar, "Sam at ASDA", and "Sat 21 Nov · 25 min · 12 items" (count only for runs that recorded it). */
function RunSummary({ run }: { run: GroceryRun }) {
  const s = useKitchen()
  const u = s.users.find((x) => x.id === run.shopperId)
  const store = STORES.find((st) => st.name && st.name === run.store)
  const mins = Math.max(1, Math.round((run.endedAt! - run.startedAt) / 60000))
  return (
    <>
      <Avatar user={u} size={34} />
      <div className="run-text">
        <strong>
          {u?.name ?? 'Someone'}
          {run.store ? (
            <>
              {' at '}
              <span className="store-tag" style={{ '--store': store?.color ?? 'var(--muted)' } as React.CSSProperties}>
                {run.store}
              </span>
            </>
          ) : null}
        </strong>
        <span className="muted small">
          {new Date(run.startedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
          {mins < 60 ? `${mins} min` : `${Math.round(mins / 6) / 10} h`}
          {run.itemCount !== null && ` · ${itemsLabel(run.itemCount)}`}
        </span>
      </div>
    </>
  )
}

/** Everything bought on one run, and who each item went to. */
function RunDetails({ run, onBack }: { run: GroceryRun; onBack: () => void }) {
  const s = useKitchen()
  const [items, setItems] = useState<RunItem[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    loadRunItems(run.id).then(
      (list) => live && setItems(list),
      () => live && setError('Couldn’t load this run. Check your connection and try again.'),
    )
    return () => {
      live = false
    }
  }, [run.id])
  const nameOf = (id?: string) => s.users.find((u) => u.id === id)?.name ?? 'someone'
  return (
    <div className="run-details">
      <button className="link run-back" onClick={onBack}>
        <UI.chevronLeft size={16} /> Recent runs
      </button>
      <div className="run-head">
        <RunSummary run={run} />
      </div>
      {error && <p className="muted small">{error}</p>}
      {!items && !error && <p className="muted small">Loading…</p>}
      {items && items.length === 0 && <p className="muted small">Nothing was picked up on this run.</p>}
      {items && items.length > 0 && (
        <ul className="run-items">
          {items.map((it, i) => {
            const person = s.users.find((u) => u.id === it.forUser)
            return (
              <li key={i} style={{ '--shelf': `var(--shelf-${it.category})` } as React.CSSProperties}>
                <span className="run-item-icon">
                  <ItemIcon name={it.icon} size={ICON_SIZES.list} strokeWidth={1.7} />
                </span>
                <div className="run-text">
                  <strong>{it.name}</strong>
                  <span className="muted small">
                    {categoryById(it.category).label} · {it.requested ? `asked for by ${nameOf(it.forUser)}` : `for ${nameOf(it.forUser)}`}
                  </span>
                </div>
                {person && <Avatar user={person} size={26} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

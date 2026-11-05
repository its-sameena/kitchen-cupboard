import { useState } from 'react'
import { categoryById, suggestFor } from '../data'
import {
  activeRun,
  addGrocery,
  endRun,
  markBought,
  removeGrocery,
  requestEntry,
  startRun,
  toggleGot,
  unrequestEntry,
  useKitchen,
  useMe,
} from '../store'
import type { GroceryEntry, User } from '../types'
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
              <GroceryRow key={g.id} g={g} me={me} run={!!run} iAmShopping={iAmShopping} shopperName={shopper?.name} userById={userById} />
            ))}
          </ul>
        </>
      )}

      {rest.length > 0 && (
        <>
          <h3 className="section-title">Grocery list</h3>
          <ul className="g-list">
            {rest.map((g) => (
              <GroceryRow key={g.id} g={g} me={me} run={!!run} iAmShopping={iAmShopping} shopperName={shopper?.name} userById={userById} />
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
  me,
  run,
  iAmShopping,
  shopperName,
  userById,
}: {
  g: GroceryEntry
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
      className={'g-row' + (g.gotBy ? ' got' : '')}
      style={forUser ? ({ '--for': forUser.color } as React.CSSProperties) : undefined}
    >
      {iAmShopping ? (
        <button
          className={'check' + (g.gotBy ? ' on' : '')}
          onClick={() => toggleGot(g.id)}
          aria-label={g.gotBy ? `Un-tick ${g.name}` : `Tick ${g.name}`}
        >
          {g.gotBy && <UI.check size={20} strokeWidth={3} />}
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
  const [name, setName] = useState('')
  const sug = suggestFor(name)
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
  return (
    <Sheet open={open} onClose={onClose} title="Where are you going?">
      <p className="muted">Tap a shop to start. Everyone in the kitchen gets a notification and can send you requests.</p>
      <div className="store-grid">
        {STORES.map((st) => (
          <StoreButton
            key={st.label}
            store={st}
            onClick={() => {
              startRun(st.name)
              onClose()
            }}
          />
        ))}
      </div>
    </Sheet>
  )
}

function StoreButton({ store, onClick }: { store: StoreConfig; onClick: () => void }) {
  const [logoFailed, setLogoFailed] = useState(false)
  const showLogo = store.logo && !logoFailed
  return (
    <button
      className="store-btn"
      style={{ '--store': store.color } as React.CSSProperties}
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
  const past = s.runs.filter((r) => r.endedAt).reverse()
  if (!past.length) return null
  return (
    <>
      <button className="recent-link" onClick={() => setOpen(true)}>
        Show recent runs
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Recent runs">
        <ul className="recent-runs">
          {past.map((r) => {
            const u = s.users.find((x) => x.id === r.shopperId)
            const store = STORES.find((st) => st.name && st.name === r.store)
            const mins = Math.max(1, Math.round((r.endedAt! - r.startedAt) / 60000))
            return (
              <li key={r.id}>
                <Avatar user={u} size={34} />
                <div>
                  <strong>
                    {u?.name ?? 'Someone'}
                    {r.store ? (
                      <>
                        {' at '}
                        <span className="store-tag" style={{ '--store': store?.color ?? 'var(--muted)' } as React.CSSProperties}>
                          {r.store}
                        </span>
                      </>
                    ) : null}
                  </strong>
                  <span className="muted small">
                    {new Date(r.startedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                    {mins < 60 ? `${mins} min` : `${Math.round(mins / 6) / 10} h`}
                  </span>
                </div>
                <span className="muted small">{timeAgo(r.endedAt!)}</span>
              </li>
            )
          })}
        </ul>
      </Sheet>
    </>
  )
}

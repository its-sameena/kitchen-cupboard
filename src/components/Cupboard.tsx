import { useEffect, useMemo, useRef, useState } from 'react'
import { ICON_SIZES } from '../config'
import { CATEGORIES, categoryById, suggestFor } from '../data'
import { CATEGORY_ICONS, DEFAULT_ITEM_ICON, ITEM_ICONS, ItemIcon, UI } from '../icons'
import {
  activeRun,
  addGrocery,
  addItem,
  deleteItem,
  getMe,
  haveItToo,
  ranOut,
  requestEntry,
  updateItem,
  useKitchen,
  useMe,
} from '../store'
import type { CategoryId, Item, User } from '../types'
import { motionMs } from '../motion'
import { ReceiptReview } from './ReceiptReview'
import { Avatar, ItemCard, Sheet, timeAgo } from './ui'

export default function Cupboard() {
  const s = useKitchen()
  const me = useMe()!
  const [filter, setFilter] = useState<string | 'all'>('all')
  const [query, setQuery] = useState('')
  const [openItem, setOpenItem] = useState<string | null>(null)
  const [adding, setAdding] = useState<CategoryId | null | false>(false)
  const [addOpen, setAddOpen] = useState(false)
  const [fabAgain, setFabAgain] = useState(false)
  const [moreName, setMoreName] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  // Entrance animations play on first load only; afterwards new cards animate straight away.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), motionMs(1400))
    return () => clearTimeout(t)
  }, [])

  const q = query.trim().toLowerCase()
  const shelves = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        items: s.items
          .filter((i) => i.category === c.id && (!q || i.name.toLowerCase().includes(q)))
          .sort((a, b) => (b.owners.length > 0 ? 1 : 0) - (a.owners.length > 0 ? 1 : 0) || a.name.localeCompare(b.name)),
      })),
    [s.items, q],
  )
  const filled = shelves.filter((c) => c.items.length > 0)
  const empty = q ? [] : shelves.filter((c) => c.items.length === 0)

  const total = s.items.filter((i) => i.owners.length).length
  const mine = s.items.filter((i) => i.owners.includes(me.id)).length

  return (
    <div className={'cupboard-screen' + (settled ? ' settled' : '')}>
      <div className="toolbar">
        <div className="search">
          <UI.search size={16} aria-hidden />
          <input
            type="search"
            placeholder={`Search ${total} items…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="chips" role="tablist" aria-label="Filter by housemate">
          <button className={'chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>
            Everyone
          </button>
          {s.users.map((u) => (
            <button
              key={u.id}
              className={'chip' + (filter === u.id ? ' on' : '')}
              style={{ '--chip': u.color } as React.CSSProperties}
              onClick={() => setFilter(filter === u.id ? 'all' : u.id)}
            >
              <span className="chip-dot" />
              {u.id === me.id ? `Me (${mine})` : u.name}
            </button>
          ))}
        </div>
      </div>

      {filled.map((shelf, order) => (
        <Shelf
          key={shelf.id}
          order={order}
          id={shelf.id}
          label={shelf.label}
          count={shelf.items.filter((i) => i.owners.length).length}
          onAdd={q ? undefined : () => setAdding(shelf.id)}
        >
          {shelf.items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              users={s.users}
              dimmed={filter !== 'all' && !item.owners.includes(filter)}
              onClick={() => setOpenItem(item.id)}
            />
          ))}
        </Shelf>
      ))}

      {q && filled.length === 0 && (
        <div className="empty-search">
          <p>No “{query}” in the cupboard.</p>
          <button className="btn btn-primary" onClick={() => setAdding(null)}>
            <UI.add size={ICON_SIZES.button} /> Add “{query}”
          </button>
        </div>
      )}

      {empty.length > 0 && (
        <section className="empty-shelves" aria-label="Empty shelves">
          <h3 className="section-title">{filled.length ? 'Empty shelves' : 'Start stocking a shelf'}</h3>
          <div className="cat-grid">
            {empty.map((c) => (
              <button key={c.id} className="cat-chip" onClick={() => setAdding(c.id)}>
                <ShelfIcon id={c.id} /> {c.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {addOpen ? (
        <AddIngredients
          onClose={() => {
            setAddOpen(false)
            setFabAgain(true)
          }}
          onMore={(name) => {
            setMoreName(name)
            setAdding(null)
          }}
          onScan={setReceipt}
        />
      ) : (
        <button className={'add-fab' + (fabAgain ? ' again' : '')} onClick={() => setAddOpen(true)} aria-label="Add ingredients">
          <UI.add size={26} strokeWidth={2.2} />
        </button>
      )}

      {receipt && <ReceiptReview file={receipt} onClose={() => setReceipt(null)} />}
      <ItemSheet itemId={openItem} onClose={() => setOpenItem(null)} me={me} />
      <AddItemSheet
        open={adding !== false}
        initialCategory={adding || undefined}
        initialName={moreName || (q && filled.length === 0 ? query : '')}
        onClose={() => {
          setAdding(false)
          setQuery('')
          setMoreName('')
        }}
      />
    </div>
  )
}

function ItemSheet({ itemId, onClose, me }: { itemId: string | null; onClose: () => void; me: User }) {
  const s = useKitchen()
  const item = s.items.find((i) => i.id === itemId)
  const [editing, setEditing] = useState(false)
  if (!item) return null

  const owners = item.owners.map((id) => s.users.find((u) => u.id === id)).filter(Boolean) as User[]
  const iHave = item.owners.includes(me.id)
  const run = activeRun(s)
  const shopper = run && s.users.find((u) => u.id === run.shopperId)
  const entry = s.grocery.find((g) => g.itemId === item.id && !g.gotBy)
  const canRequest = run && run.shopperId !== me.id
  const close = () => {
    setEditing(false)
    onClose()
  }

  return (
    <Sheet open onClose={close} title={editing ? 'Edit item' : undefined}>
      {editing ? (
        <ItemForm
          initial={item}
          submitLabel="Save"
          onSubmit={(v) => {
            updateItem(item.id, v)
            setEditing(false)
          }}
          onDelete={
            owners.length === 0 || (owners.length === 1 && iHave)
              ? () => {
                  deleteItem(item.id)
                  close()
                }
              : undefined
          }
        />
      ) : (
        <div className="item-detail">
          <div className="item-hero">
            <div className="shelf item-hero-card" style={shelfVar(item.category)}>
              <ItemCard item={item} users={s.users} onClick={() => setEditing(true)} />
            </div>
            <div>
              <h2>{item.name}</h2>
              <p className="muted">
                <ShelfIcon id={item.category} /> {categoryById(item.category).label} · updated {timeAgo(item.updatedAt)}
              </p>
            </div>
            <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit item">
              <UI.edit size={ICON_SIZES.button} />
            </button>
          </div>

          <h3 className="section-title">
            {owners.length ? `In the kitchen ×${owners.length}` : 'Out of stock'}
          </h3>
          {owners.length ? (
            <ul className="owner-list">
              {owners.map((u, i) => (
                <li key={u.id} style={{ '--i': i } as React.CSSProperties}>
                  <Avatar user={u} size={28} />
                  <span>{u.id === me.id ? 'You' : u.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              Nobody has this right now.
              {entry ? ' It’s on the grocery list.' : ''}
            </p>
          )}

          <div className="actions">
            {iHave ? (
              <button
                className="btn btn-danger btn-block"
                onClick={() => {
                  ranOut(item.id)
                  close()
                }}
              >
                I’ve run out
                <small>
                  {owners.length > 1 ? `×${owners.length} → ×${owners.length - 1}` : 'Adds it to the grocery list'}
                </small>
              </button>
            ) : (
              <button
                className="btn btn-primary btn-block"
                onClick={() => {
                  haveItToo(item.id)
                  close()
                }}
              >
                {owners.length ? 'I have this too' : 'I’ve restocked this'}
              </button>
            )}

            {canRequest &&
              (entry?.forUser ? (
                <p className="muted center">
                  <UI.check size={14} /> Requested from {shopper?.name} {entry.forUser === me.id ? 'by you' : ''}
                </p>
              ) : (
                <button
                  className="btn btn-run btn-block"
                  onClick={() => {
                    if (entry) requestEntry(entry.id)
                    else addGrocery({ name: item.name, icon: item.icon, category: item.category, itemId: item.id })
                    close()
                  }}
                >
                  <UI.groceryRun size={ICON_SIZES.button} /> Ask {shopper?.name} to pick one up
                </button>
              ))}

            {!canRequest && !entry && owners.length > 0 && (
              <button
                className="btn btn-ghost btn-block"
                onClick={() => {
                  addGrocery({ name: item.name, icon: item.icon, category: item.category, itemId: item.id })
                  close()
                }}
              >
                Running low? Add to grocery list
              </button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}

function AddItemSheet({
  open,
  onClose,
  initialCategory,
  initialName,
}: {
  open: boolean
  onClose: () => void
  initialCategory?: CategoryId
  initialName?: string
}) {
  const s = useKitchen()
  if (!open) return null
  return (
    <Sheet open onClose={onClose} title="Add to the cupboard">
      <ItemForm
        initial={{ name: initialName ?? '', icon: '', category: initialCategory ?? 'other' }}
        lockCategory={!!initialCategory}
        submitLabel="Add to cupboard"
        existing={s.items}
        onSubmit={(v) => {
          addItem(v)
          onClose()
        }}
      />
    </Sheet>
  )
}

export function ItemForm({
  initial,
  submitLabel,
  onSubmit,
  onDelete,
  existing,
  lockCategory,
}: {
  initial: Pick<Item, 'name' | 'icon' | 'category'>
  submitLabel: string
  onSubmit: (v: Pick<Item, 'name' | 'icon' | 'category'>) => void
  onDelete?: () => void
  existing?: Item[]
  lockCategory?: boolean
}) {
  const meId = getMe()
  const [name, setName] = useState(initial.name)
  const [icon, setIcon] = useState(initial.icon)
  const [category, setCategory] = useState<CategoryId>(initial.category)
  const [touchedIcon, setTouchedIcon] = useState(!!initial.icon)
  const [touchedCat, setTouchedCat] = useState(lockCategory || !!initial.icon)

  const suggestion = suggestFor(name, existing)
  const shownCatForIcon = touchedCat ? category : suggestion?.category ?? category
  const shownIcon = touchedIcon ? icon : suggestion?.icon ?? DEFAULT_ITEM_ICON[shownCatForIcon]
  const shownCat = touchedCat ? category : suggestion?.category ?? category
  const match = existing?.find((i) => i.name.trim().toLowerCase() === name.trim().toLowerCase())

  return (
    <form
      className="item-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        onSubmit({ name: name.trim(), icon: shownIcon, category: match?.category ?? shownCat })
      }}
    >
      <div className="name-row">
        <span className="icon-preview">
          <ItemIcon name={shownIcon} size={30} strokeWidth={1.6} />
        </span>
        <label className="field grow">
          <span>Item name</span>
          <input
            autoFocus={!initial.name}
            value={name}
            maxLength={32}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Paprika, Oat milk, Coffee beans"
            list="known-items"
          />
          {existing && (
            <datalist id="known-items">
              {existing.map((i) => (
                <option key={i.id} value={i.name} />
              ))}
            </datalist>
          )}
        </label>
      </div>
      {match && (
        <p className="hint">
          {match.name} is already on the {categoryById(match.category).label} shelf
          {meId && match.owners.includes(meId)
            ? ' — and you already have it.'
            : ` — you’ll be added as an owner (×${match.owners.length + 1}).`}
        </p>
      )}

      {!match && (
        <>
          <div className="field">
            <span>Shelf</span>
            <div className="cat-grid">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={'cat-chip' + (shownCat === c.id ? ' on' : '')}
                  onClick={() => {
                    setCategory(c.id)
                    setTouchedCat(true)
                  }}
                >
                  <ShelfIcon id={c.id} /> {c.label}
                </button>
              ))}
            </div>
          </div>
          <details className="field icon-picker">
            <summary>
              Change icon <ItemIcon name={shownIcon} size={16} />
            </summary>
            <div className="icon-grid">
              {Object.entries(ITEM_ICONS).map(([key, { icon: Icon, label }]) => (
                <button
                  type="button"
                  key={key}
                  className={key === shownIcon ? 'on' : ''}
                  title={label}
                  aria-label={label}
                  onClick={() => {
                    setIcon(key)
                    setTouchedIcon(true)
                  }}
                >
                  <Icon size={ICON_SIZES.list} strokeWidth={1.6} />
                </button>
              ))}
            </div>
          </details>
        </>
      )}

      <button className="btn btn-primary btn-block" disabled={!name.trim()}>
        {match && submitLabel.startsWith('Add') ? 'I have this too' : submitLabel}
      </button>
      {onDelete && (
        <button type="button" className="btn btn-ghost btn-block danger-text" onClick={onDelete}>
          Remove from cupboard
        </button>
      )}
    </form>
  )
}

function ShelfIcon({ id }: { id: CategoryId }) {
  const Icon = CATEGORY_ICONS[id]
  return <Icon size={ICON_SIZES.shelf} strokeWidth={2.2} aria-hidden />
}

const shelfVar = (id: CategoryId) => ({ '--shelf': `var(--shelf-${id})`, margin: 0 }) as React.CSSProperties

/** One shelf: heading with count and arrows, a scrolling row of cards, and the glass shelf in front. */
function Shelf({
  order,
  id,
  label,
  count,
  onAdd,
  children,
}: {
  order: number
  id: CategoryId
  label: string
  count: number
  onAdd?: () => void
  children: React.ReactNode
}) {
  const row = useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <section
      className="shelf"
      // Each shelf starts 180ms after the one above it (capped so long cupboards don't wait).
      style={{ '--shelf': `var(--shelf-${id})`, '--shelf-d': `${120 + Math.min(order, 4) * 180}ms` } as React.CSSProperties}
      aria-label={label}
    >
      <div className="shelf-head">
        <span className="shelf-title">
          <ShelfIcon id={id} /> {label}
        </span>
        <span className="shelf-meta">
          {count} item{count === 1 ? '' : 's'}
        </span>
        <span className="shelf-nav">
          <button onClick={() => scroll(-1)} aria-label={`Scroll ${label} left`}>
            <UI.chevronLeft size={16} />
          </button>
          <button onClick={() => scroll(1)} aria-label={`Scroll ${label} right`}>
            <UI.chevron size={16} />
          </button>
        </span>
      </div>
      <div className="shelf-stage">
        <div className="shelf-row" ref={row}>
          {children}
          {onAdd && (
            <button className="item item-add" onClick={onAdd} aria-label={`Add to ${label}`}>
              <span className="item-face">
                <UI.add size={ICON_SIZES.card - 4} strokeWidth={1.5} />
                <span className="item-name">Add</span>
              </span>
            </button>
          )}
        </div>
        <div className="shelf-glass" aria-hidden />
      </div>
    </section>
  )
}

/** Common staples offered in the "Add ingredients" card (after anything that's run out). */
const STAPLES = ['Eggs', 'Milk', 'Bread', 'Butter', 'Onions', 'Bananas', 'Rice', 'Pasta', 'Olive oil', 'Coffee beans', 'Cheddar', 'Tomatoes']

/** The card the plus button grows into: tap suggested ingredients or type one. */
function AddIngredients({
  onClose,
  onMore,
  onScan,
}: {
  onClose: () => void
  onMore: (name: string) => void
  onScan: (photo: File) => void
}) {
  const photoInput = useRef<HTMLInputElement>(null)
  const s = useKitchen()
  const me = useMe()!
  const [picked, setPicked] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [closing, setClosing] = useState(false)
  const norm = (n: string) => n.trim().toLowerCase()

  // Worked out once when the card opens, so chips don't jump around while you tap.
  const [suggestions] = useState(() => {
    const mine = new Set(s.items.filter((i) => i.owners.includes(me.id)).map((i) => norm(i.name)))
    const outOfStock = s.items.filter((i) => i.owners.length === 0).map((i) => i.name)
    const seen = new Set<string>()
    return [...outOfStock, ...STAPLES]
      .filter((n) => {
        const k = norm(n)
        if (mine.has(k) || seen.has(k)) return false
        seen.add(k)
        return true
      })
      .slice(0, 8)
  })

  const count = picked.length + (draft.trim() ? 1 : 0)

  const close = (after?: () => void) => {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      onClose()
      after?.()
    }, motionMs(220))
  }

  const add = () => {
    const names = [...picked, ...(draft.trim() ? [draft.trim()] : [])]
    for (const n of names) {
      const existing = s.items.find((i) => norm(i.name) === norm(n))
      if (existing) {
        if (!existing.owners.includes(me.id)) haveItToo(existing.id)
      } else {
        const sug = suggestFor(n)
        const category = sug?.category ?? 'other'
        addItem({ name: n, icon: sug?.icon ?? DEFAULT_ITEM_ICON[category], category })
      }
    }
    close()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <>
      <div className={'add-backdrop' + (closing ? ' closing' : '')} onClick={() => close()} aria-hidden />
      <div className={'add-card' + (closing ? ' closing' : '')} role="dialog" aria-label="Add ingredients">
        <div className="add-card-head">
          <h2>Add ingredients</h2>
          <button className="btn btn-sm btn-ghost" onClick={() => photoInput.current?.click()}>
            <UI.receipt size={16} /> Scan receipt
          </button>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) close(() => onScan(f))
            }}
          />
          <button className="icon-btn" onClick={() => close()} aria-label="Close">
            <UI.close size={16} />
          </button>
        </div>

        {suggestions.length > 0 && (
          <div>
            <div className="muted small" style={{ fontWeight: 600, marginBottom: 8 }}>
              Suggested
            </div>
            <div className="add-chips">
              {suggestions.map((n, i) => {
                const on = picked.includes(n)
                return (
                  <button
                    key={n}
                    className={'add-chip' + (on ? ' on' : '')}
                    style={{ '--i': i } as React.CSSProperties}
                    aria-pressed={on}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== n) : [...p, n]))}
                  >
                    {on ? <UI.check size={14} strokeWidth={2.6} /> : <UI.add size={14} strokeWidth={2.4} />}
                    {n}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <label className="add-input">
          <UI.search size={18} aria-hidden />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && count > 0 && add()}
            placeholder="Or type an ingredient…"
            aria-label="Type an ingredient"
            maxLength={32}
            enterKeyHint="done"
          />
        </label>

        <button className="btn btn-primary btn-block" disabled={!count} onClick={add}>
          {count ? `Add ${count} to cupboard` : 'Add to cupboard'}
        </button>
        <button className="link add-more" onClick={() => close(() => onMore(draft.trim()))}>
          Choose shelf and icon instead
        </button>
      </div>
    </>
  )
}

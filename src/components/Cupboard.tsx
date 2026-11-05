import { useMemo, useState } from 'react'
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
import { Avatar, ItemJar, Sheet, timeAgo } from './ui'

export default function Cupboard() {
  const s = useKitchen()
  const me = useMe()!
  const [filter, setFilter] = useState<string | 'all'>('all')
  const [query, setQuery] = useState('')
  const [openItem, setOpenItem] = useState<string | null>(null)
  const [adding, setAdding] = useState<CategoryId | null | false>(false)

  const q = query.trim().toLowerCase()
  const shelves = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        items: s.items
          .filter((i) => i.category === c.id && (!q || i.name.toLowerCase().includes(q)))
          .sort((a, b) => (b.owners.length > 0 ? 1 : 0) - (a.owners.length > 0 ? 1 : 0) || a.name.localeCompare(b.name)),
      })).filter((c) => c.items.length > 0 || !q),
    [s.items, q],
  )

  const total = s.items.filter((i) => i.owners.length).length
  const mine = s.items.filter((i) => i.owners.includes(me.id)).length

  return (
    <div className="cupboard-screen">
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

      <div className="cabinet">
        <div className="cabinet-top" aria-hidden />
        {shelves.map((shelf) => (
          <section className="shelf" key={shelf.id} aria-label={shelf.label}>
            <div className="plaque">
              <ShelfIcon id={shelf.id} /> {shelf.label}
            </div>
            <div className="shelf-row">
              {shelf.items.map((item) => (
                <ItemJar
                  key={item.id}
                  item={item}
                  users={s.users}
                  dimmed={filter !== 'all' && !item.owners.includes(filter)}
                  onClick={() => setOpenItem(item.id)}
                />
              ))}
              {!q && (
                <button className="jar jar-add" onClick={() => setAdding(shelf.id)} aria-label={`Add to ${shelf.label}`}>
                  <span className="jar-ring">
                    <span className="jar-face">
                      <UI.add size={26} strokeWidth={1.5} />
                    </span>
                  </span>
                  <span className="jar-name">Add</span>
                </button>
              )}
            </div>
            <div className="plank" aria-hidden />
          </section>
        ))}
        {q && shelves.length === 0 && (
          <div className="empty-search">
            <p>No “{query}” in the cupboard.</p>
            <button className="btn btn-primary" onClick={() => setAdding(null)}>
              Add “{query}”
            </button>
          </div>
        )}
        <div className="cabinet-base" aria-hidden />
      </div>

      <button className="fab" onClick={() => setAdding(null)} aria-label="Add item">
        <UI.add size={30} strokeWidth={2} />
      </button>

      <ItemSheet itemId={openItem} onClose={() => setOpenItem(null)} me={me} />
      <AddItemSheet
        open={adding !== false}
        initialCategory={adding || undefined}
        initialName={q && shelves.length === 0 ? query : ''}
        onClose={() => {
          setAdding(false)
          setQuery('')
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
            <ItemJar item={item} users={s.users} onClick={() => setEditing(true)} />
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
              {owners.map((u) => (
                <li key={u.id}>
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

  const suggestion = suggestFor(name)
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

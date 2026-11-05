import { useEffect, useRef, type ReactNode } from 'react'
import { ICON_SIZES } from '../config'
import { ItemIcon, UI } from '../icons'
import type { Item, User } from '../types'

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden />
        {title && (
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <UI.close size={ICON_SIZES.button} />
            </button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function Avatar({ user, size = 32, ring }: { user?: User; size?: number; ring?: boolean }) {
  return (
    <span
      className={'avatar' + (ring ? ' avatar-ring' : '')}
      style={{ width: size, height: size, fontSize: size * 0.45, background: user?.color ?? '#999' }}
      title={user?.name}
    >
      {user?.name.slice(0, 1).toUpperCase() ?? '?'}
    </span>
  )
}

export function AvatarStack({ users, size = 22 }: { users: User[]; size?: number }) {
  return (
    <span className="avatar-stack">
      {users.map((u) => (
        <Avatar key={u.id} user={u} size={size} ring />
      ))}
    </span>
  )
}

/** Conic-gradient ring split evenly between the owners' colours. */
export function ownerRing(owners: User[]) {
  if (owners.length === 0) return undefined
  if (owners.length === 1) return owners[0].color
  const step = 360 / owners.length
  const stops = owners.map((u, i) => `${u.color} ${i * step}deg ${(i + 1) * step}deg`).join(', ')
  return `conic-gradient(${stops})`
}

export function ItemJar({
  item,
  users,
  dimmed,
  onClick,
}: {
  item: Item
  users: User[]
  dimmed?: boolean
  onClick: () => void
}) {
  const owners = item.owners.map((id) => users.find((u) => u.id === id)).filter(Boolean) as User[]
  const out = owners.length === 0
  return (
    <button
      className={'jar' + (out ? ' jar-out' : '') + (dimmed ? ' jar-dim' : '')}
      onClick={onClick}
      aria-label={`${item.name}, ${out ? 'out of stock' : `${owners.length} in kitchen, owned by ${owners.map((o) => o.name).join(', ')}`}`}
    >
      <span className="jar-ring" style={{ background: ownerRing(owners) }}>
        <span className="jar-face">
          <ItemIcon name={item.icon} className="jar-icon" size={ICON_SIZES.jar} strokeWidth={1.6} />
        </span>
        {owners.length > 1 && <span className="jar-count">x{owners.length}</span>}
        {out && <span className="jar-out-tag">out</span>}
      </span>
      <span className="jar-name">{item.name}</span>
    </button>
  )
}

export function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

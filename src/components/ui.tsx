import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ICON_SIZES } from '../config'
import { avatarUri } from '../avatar'
import { motionMs } from '../motion'
import { textOn } from '../data'
import { ItemIcon, UI } from '../icons'
import type { Item, User } from '../types'

/**
 * Bottom sheet. Springs up when opened; closing (X, backdrop, Escape, or
 * dragging the handle down) slides it away before calling onClose.
 */
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
  const [closing, setClosing] = useState(false)
  const [dragY, setDragY] = useState(0)
  const drag = useRef<{ startY: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const close = useCallback(() => {
    if (timer.current) return
    setClosing(true)
    timer.current = setTimeout(() => {
      timer.current = undefined
      setClosing(false)
      setDragY(0)
      onClose()
    }, motionMs(260))
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [open, close])

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!open) return null

  const dragging = drag.current !== null
  return (
    <div
      className={'sheet-backdrop' + (closing ? ' closing' : '')}
      style={dragY > 0 && !closing ? { opacity: Math.max(0.3, 1 - dragY / 500) } : undefined}
      onClick={close}
    >
      <div
        className={'sheet' + (closing ? ' closing' : '') + (dragging ? ' dragging' : '')}
        role="dialog"
        aria-modal="true"
        style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag the handle down to dismiss */}
        <div
          className="sheet-grab"
          onPointerDown={(e) => {
            drag.current = { startY: e.clientY }
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
              /* capture is a nicety; dragging still works without it */
            }
          }}
          onPointerMove={(e) => {
            if (drag.current) setDragY(Math.max(0, e.clientY - drag.current.startY))
          }}
          onPointerUp={() => {
            if (!drag.current) return
            drag.current = null
            if (dragY > 110) close()
            else setDragY(0)
          }}
          onPointerCancel={() => {
            drag.current = null
            setDragY(0)
          }}
        >
          <div className="sheet-handle" aria-hidden />
        </div>
        {title && (
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={close} aria-label="Close">
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
  if (user?.avatar) {
    return (
      <img
        className={'avatar avatar-img' + (ring ? ' avatar-ring' : '')}
        src={avatarUri(user.avatar, user.color)}
        width={size}
        height={size}
        alt={user.name}
        title={user.name}
        draggable={false}
      />
    )
  }
  return (
    <span
      className={'avatar' + (ring ? ' avatar-ring' : '')}
      style={{ width: size, height: size, fontSize: size * 0.45, background: user?.color ?? '#999', color: textOn(user?.color ?? '#999999') }}
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

/** Frame colour for an item: one owner's colour, or diagonal bands for several owners. */
export function ownerRing(owners: User[]) {
  if (owners.length === 0) return undefined
  if (owners.length === 1) return owners[0].color
  const step = 100 / owners.length
  const stops = owners.map((u, i) => `${u.color} ${i * step}% ${(i + 1) * step}%`).join(', ')
  return `linear-gradient(135deg, ${stops})`
}

/** An item standing on a shelf, like a book cover. Must sit inside an element that sets --shelf. */
export function ItemCard({
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
      className={'item' + (out ? ' item-out' : '') + (dimmed ? ' item-dim' : '')}
      style={out ? undefined : ({ '--ring': ownerRing(owners) } as React.CSSProperties)}
      onClick={onClick}
      aria-label={`${item.name}, ${out ? 'out of stock' : `${owners.length} in kitchen, owned by ${owners.map((o) => o.name).join(', ')}`}`}
    >
      <span className="item-face">
        <ItemIcon name={item.icon} className="item-icon" size={ICON_SIZES.card} strokeWidth={1.5} />
        <span className="item-name">{item.name}</span>
      </span>
      {owners.length > 1 && (
        <span className="item-count" key={owners.length}>
          x{owners.length}
        </span>
      )}
      {out && <span className="item-out-tag">Out</span>}
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

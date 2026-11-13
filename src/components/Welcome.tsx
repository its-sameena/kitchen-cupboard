import { useState, type MouseEvent, type ReactNode } from 'react'
import { motionMs } from '../motion'
import { PROFILE_PALETTE, USER_COLORS, sameColor, textOn } from '../data'
import { ColorPicker, type TakenColor } from './ColorPicker'
import { boot, createKitchen, createProfile, joinKitchen, selectProfile, useApp, useKitchen } from '../store'
import { avatarUri } from '../avatar'
import { UI } from '../icons'
import { Avatar, Sheet } from './ui'

function Shell({ children, compact }: { children: ReactNode; compact?: boolean }) {
  return (
    <div className={'login' + (compact ? ' compact' : '')}>
      <div className="login-hero">
        <img src="/favicon.svg" alt="" width={compact ? 52 : 72} height={compact ? 52 : 72} />
        {!compact && (
          <>
            <h1>Kitchen Cupboard</h1>
            <p>Who has what, at a glance.</p>
          </>
        )}
      </div>
      {children}
    </div>
  )
}

const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Something went wrong')

const INVITE_KEY = 'kitchen-cupboard:invite'

/** Invite code from ?join=, kept until the phone has joined. */
function pendingInvite() {
  const fromUrl = new URLSearchParams(location.search).get('join')
  try {
    if (fromUrl) localStorage.setItem(INVITE_KEY, fromUrl.toUpperCase())
    return (fromUrl ?? localStorage.getItem(INVITE_KEY) ?? '').toUpperCase()
  } catch {
    return (fromUrl ?? '').toUpperCase()
  }
}

function clearInvite() {
  try {
    localStorage.removeItem(INVITE_KEY)
  } catch {
    /* ignore */
  }
  if (location.search) history.replaceState(null, '', '/')
}

/** First launch on a phone: join the household's kitchen (or start one). */
export function KitchenSetup() {
  const [invite] = useState(pendingInvite)
  const [mode, setMode] = useState<'join' | 'create'>('join')
  const [code, setCode] = useState(invite)
  const [kitchen, setKitchen] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ready = mode === 'create' || code.length === 6

  return (
    <Shell>
      <form
        className="card login-card"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!ready) return
          setBusy(true)
          setError('')
          try {
            if (mode === 'create') await createKitchen(kitchen)
            else await joinKitchen(code)
            clearInvite()
          } catch (err) {
            setError(errText(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <h2>Connect this phone</h2>
        <p className="muted small">You only do this once. After that, just pick your profile.</p>
        <div className="seg">
          <button type="button" className={mode === 'join' ? 'on' : ''} onClick={() => setMode('join')}>
            Join our kitchen
          </button>
          <button type="button" className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>
            Start a new one
          </button>
        </div>

        {mode === 'join' ? (
          <label className="field">
            <span>Kitchen code (any housemate can find it in the House tab)</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 6))}
              placeholder="e.g. 3FA9C1"
              className="code-input"
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
            />
          </label>
        ) : (
          <label className="field">
            <span>Kitchen name</span>
            <input value={kitchen} maxLength={40} onChange={(e) => setKitchen(e.target.value)} placeholder="e.g. Flat 4 Kitchen" />
          </label>
        )}

        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={!ready || busy}>
          {busy ? '…' : mode === 'join' ? 'Join kitchen' : 'Create kitchen'}
        </button>
      </form>
    </Shell>
  )
}

/** Netflix-style "Who's in the kitchen?" picker. */
export function ProfilePicker() {
  const k = useKitchen()
  const [adding, setAdding] = useState(k.users.length === 0)
  // Tapping a profile: its tile swells, the others fade, and its colour floods the screen from the tile.
  const [opening, setOpening] = useState<string | null>(null)
  const [flood, setFlood] = useState<{ x: number; y: number; color: string; grown: boolean } | null>(null)

  const open = (e: MouseEvent<HTMLButtonElement>, id: string, color: string) => {
    if (opening) return
    if (motionMs(1) === 0) return selectProfile(id)
    const face = e.currentTarget.querySelector('.picker-face')?.getBoundingClientRect()
    const x = face ? face.left + face.width / 2 : window.innerWidth / 2
    const y = face ? face.top + face.height / 2 : window.innerHeight / 2
    setOpening(id)
    setFlood({ x, y, color, grown: false })
    setTimeout(() => setFlood((f) => f && { ...f, grown: true }), motionMs(160))
    setTimeout(() => selectProfile(id), motionMs(700))
  }

  return (
    <div className="picker">
      <div className="picker-head">
        <img src="/favicon.svg" alt="" width={44} height={44} />
        <span>{k.kitchenName}</span>
      </div>
      <h1>Who’s in the kitchen?</h1>
      <div className="picker-grid">
        {k.users.map((u, i) => {
          const count = k.items.filter((i) => i.owners.includes(u.id)).length
          const state = opening === u.id ? ' opening' : opening ? ' dimmed' : ''
          return (
            <button
              key={u.id}
              className={'picker-tile' + state}
              style={{ '--i': i } as React.CSSProperties}
              onClick={(e) => open(e, u.id, u.color)}
            >
              <span className="picker-face" style={{ background: u.color, color: textOn(u.color) }}>
                {u.avatar ? (
                  <img className="picker-avatar" src={avatarUri(u.avatar, u.color)} alt="" draggable={false} />
                ) : (
                  u.name.slice(0, 1).toUpperCase()
                )}
              </span>
              <strong>{u.name}</strong>
              <small>{count} item{count === 1 ? '' : 's'}</small>
            </button>
          )
        })}
        <button
          className={'picker-tile' + (opening ? ' dimmed' : '')}
          style={{ '--i': k.users.length } as React.CSSProperties}
          onClick={() => setAdding(true)}
        >
          <span className="picker-face picker-add">
            <UI.add size={44} strokeWidth={1.4} />
          </span>
          <strong>Add profile</strong>
          <small>&nbsp;</small>
        </button>
      </div>
      <p className="picker-note">This phone will remember who you are.</p>

      {flood && (
        <div
          className="picker-flood"
          aria-hidden
          style={{ background: flood.color, clipPath: `circle(${flood.grown ? 1500 : 0}px at ${flood.x}px ${flood.y}px)` }}
        />
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="New profile">
        <NewProfileForm taken={k.users.map((u) => ({ color: u.color, name: u.name }))} onDone={() => setAdding(false)} />
      </Sheet>
    </div>
  )
}

function NewProfileForm({ taken, onDone }: { taken: TakenColor[]; onDone: () => void }) {
  const [name, setName] = useState('')
  const free = (c: string) => !taken.some((t) => sameColor(t.color, c))
  const [color, setColor] = useState(
    () => USER_COLORS.find(free) ?? PROFILE_PALETTE.slice(1).flat().find(free) ?? USER_COLORS[0],
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        setBusy(true)
        setError('')
        try {
          await createProfile(name, color)
          onDone()
        } catch (err) {
          setError(errText(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <div className="name-row">
        <Avatar user={{ id: '', name: name || '?', color, seenAt: 0, createdAt: 0 }} size={56} />
        <label className="field grow">
          <span>Name</span>
          <input autoFocus value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" autoComplete="nickname" />
        </label>
      </div>
      <div className="field">
        <ColorPicker value={color} onChange={setColor} taken={taken} />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={!name.trim() || busy}>
        {busy ? '…' : 'Create & continue'}
      </button>
    </form>
  )
}

/**
 * While the app connects: the same logo, size and spot as the placeholder in
 * index.html, so opening the app has no jump.
 */
export function Loading() {
  return (
    <div className="boot" role="status">
      <img className="boot-logo" src="/favicon.svg" alt="" />
      <p className="boot-text">Opening the cupboard…</p>
    </div>
  )
}

export function Offline() {
  const { error } = useApp()
  return (
    <Shell>
      <div className="card login-card center">
        <UI.offline className="empty-icon" size={48} strokeWidth={1.4} aria-hidden />
        <h2>Can’t reach the kitchen</h2>
        <p className="muted">{error ?? 'Check your connection and try again.'}</p>
        <button className="btn btn-primary btn-block" onClick={() => void boot()}>
          Try again
        </button>
      </div>
    </Shell>
  )
}

export function SetupNeeded() {
  return (
    <Shell>
      <div className="card login-card">
        <h2>Connect Supabase</h2>
        <p>
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, then
          restart <code>npm run dev</code>. The steps are in the README.
        </p>
      </div>
    </Shell>
  )
}

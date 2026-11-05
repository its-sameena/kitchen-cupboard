import { useCallback, useEffect, useState } from 'react'
import Cupboard from './components/Cupboard'
import Groceries from './components/Groceries'
import House from './components/House'
import { AvatarCreator } from './components/AvatarCreator'
import { FeedbackSheet } from './components/Feedback'
import { KitchenSetup, Loading, Offline, ProfilePicker, SetupNeeded } from './components/Welcome'
import { Avatar, Sheet, timeAgo } from './components/ui'
import type { LucideIcon } from 'lucide-react'
import { DEFAULT_TAB, ICON_SIZES, TABS, type TabId } from './config'
import { EVENT_ICONS, UI } from './icons'
import { subscribePush } from './notify'
import { activeRun, clearError, dismissAvatarPrompt, setAvatar, eventsFor, markSeen, onNewEvents, useApp, useKitchen, useMe } from './store'
import type { KitchenEvent } from './types'

type Tab = TabId

const isTab = (t: string | null): t is Tab => TABS.some((x) => x.id === t)

function initialTab(): Tab {
  const t = new URLSearchParams(location.search).get('tab')
  return isTab(t) ? t : DEFAULT_TAB
}

export default function App() {
  const { status, error } = useApp()
  const me = useMe()
  let screen
  if (status === 'unconfigured') screen = <SetupNeeded />
  else if (status === 'offline') screen = <Offline />
  else if (status === 'no_kitchen') screen = <KitchenSetup />
  else if (status === 'pick_profile') screen = <ProfilePicker />
  else if (status === 'ready' && me) screen = <Main />
  else screen = <Loading />
  return (
    <>
      {screen}
      {error && status !== 'offline' && (
        <button className="error-toast" onClick={clearError}>
          <span className="icon-line">
            <UI.warning size={ICON_SIZES.button} /> {error}
          </span>
          <span>Tap to dismiss</span>
        </button>
      )}
    </>
  )
}

function Main() {
  const s = useKitchen()
  const me = useMe()!
  const [tab, setTab] = useState<Tab>(initialTab)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const { avatarPrompt } = useApp()
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [toasts, setToasts] = useState<KitchenEvent[]>([])
  const run = activeRun(s)
  const shopper = run && s.users.find((u) => u.id === run.shopperId)

  const mine = eventsFor(s, me.id)
  const unread = mine.filter((e) => e.at > me.seenAt).length
  const groceryBadge = run && run.shopperId === me.id ? s.grocery.filter((g) => g.forUser && !g.gotBy).length : s.grocery.length

  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  // In-app toasts for things other housemates did (system notifications come via Web Push).
  useEffect(
    () =>
      onNewEvents((fresh) => {
        if (document.visibilityState !== 'visible') return
        setToasts((t) => [...t, ...fresh].slice(-3))
        fresh.forEach((e) => setTimeout(() => dismiss(e.id), 6000))
        navigator.vibrate?.(80)
      }),
    [dismiss],
  )

  // Keep this device's push subscription registered for the signed-in account.
  useEffect(() => {
    subscribePush(s.kitchenId, me.id).catch(() => {})
  }, [s.kitchenId, me.id])

  // Notification click → switch tab.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== 'open') return
      const t = new URL(e.data.url, location.origin).searchParams.get('tab')
      if (isTab(t)) setTab(t)
    }
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg)
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand">
          <img src="/favicon.svg" alt="" />
          <span>Hi, {me.name}</span>
        </div>
        <button className="icon-btn" onClick={() => setFeedbackOpen(true)} aria-label="Send feedback">
          <UI.feedback size={ICON_SIZES.button + 2} />
        </button>
        <button
          className="icon-btn bell"
          onClick={() => {
            setInboxOpen(true)
          }}
          aria-label={`Activity${unread ? `, ${unread} new` : ''}`}
        >
          <UI.activity size={ICON_SIZES.button + 2} />
          {unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
        </button>
        <button className="avatar-btn" onClick={() => setTab('house')} aria-label="Your profile">
          <Avatar user={me} size={34} />
        </button>
      </header>

      <div className="page-title">
        <span className="kicker">{s.kitchenName}</span>
        <h1>{TABS.find((t) => t.id === tab)?.title}</h1>
      </div>

      {run && tab !== 'grocery' && (
        <button className="run-banner" onClick={() => setTab('grocery')}>
          <span className="run-pulse" aria-hidden />
          {run.shopperId === me.id
            ? `You’re on a grocery run · ${s.grocery.filter((g) => g.forUser).length} requests`
            : `${shopper?.name} is shopping${run.store ? ` at ${run.store}` : ''}. Need anything?`}
          <UI.chevron className="chev" size={20} />
        </button>
      )}

      <main className="content">
        {tab === 'cupboard' && <Cupboard />}
        {tab === 'grocery' && <Groceries />}
        {tab === 'house' && <House />}
      </main>

      <nav className="tabbar" aria-label="Main" style={{ gridTemplateColumns: `repeat(${TABS.length}, 1fr)` }}>
        {TABS.map((t) => {
          const live = t.id === 'grocery' && !!run
          return (
            <TabBtn
              key={t.id}
              icon={(live && t.liveIcon) || t.icon}
              label={(live && t.liveLabel) || t.label}
              on={tab === t.id}
              onClick={() => setTab(t.id)}
              badge={t.id === 'grocery' ? groceryBadge : undefined}
              live={live}
            />
          )
        })}
      </nav>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <button
            key={t.id}
            className="toast"
            onClick={() => {
              dismiss(t.id)
              setTab(t.type === 'run_started' || t.type === 'request' ? 'grocery' : 'cupboard')
            }}
          >
            <ToastIcon type={t.type} />
            <span className="toast-text">
              <strong>{t.title}</strong>
              <span>{t.body}</span>
            </span>
          </button>
        ))}
      </div>

      <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} screen={tab} />

      {/* Asked once, right after a profile is created. "Not now" keeps the initials. */}
      <Sheet open={avatarPrompt && !creatorOpen} onClose={dismissAvatarPrompt} title="Add an avatar?">
        <div className="avatar-prompt">
          <Avatar user={me} size={72} />
          <p className="muted">
            Make a little plant buddy to show instead of your initials. You can change or remove it any time in House.
          </p>
        </div>
        <div className="actions">
          <button className="btn btn-primary btn-block" onClick={() => setCreatorOpen(true)}>
            <UI.avatar size={ICON_SIZES.button} /> Create my avatar
          </button>
          <button className="btn btn-ghost btn-block" onClick={dismissAvatarPrompt}>
            Not now, keep my initials
          </button>
        </div>
      </Sheet>
      <AvatarCreator
        open={creatorOpen}
        background={me.color}
        onClose={() => {
          setCreatorOpen(false)
          dismissAvatarPrompt()
        }}
        onSave={setAvatar}
      />

      <Sheet
        open={inboxOpen}
        onClose={() => {
          setInboxOpen(false)
          markSeen()
        }}
        title="Activity"
      >
        {mine.length === 0 ? (
          <p className="muted center">Nothing yet. Alerts from your housemates show up here.</p>
        ) : (
          <ul className="inbox">
            {[...mine]
              .reverse()
              .slice(0, 40)
              .map((e) => (
                <li key={e.id} className={e.at > me.seenAt ? 'new' : ''}>
                  <Avatar user={s.users.find((u) => u.id === e.actorId)} size={30} />
                  <div>
                    <strong>{e.title}</strong>
                    <span>{e.body}</span>
                    <small>{timeAgo(e.at)}</small>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </Sheet>
    </div>
  )
}

function ToastIcon({ type }: { type: KitchenEvent['type'] }) {
  const Icon = EVENT_ICONS[type] ?? UI.activity
  return <Icon className="toast-icon" size={20} aria-hidden />
}

function TabBtn({
  icon: Icon,
  label,
  on,
  onClick,
  badge,
  live,
}: {
  icon: LucideIcon
  label: string
  on: boolean
  onClick: () => void
  badge?: number
  live?: boolean
}) {
  return (
    <button
      className={'tab' + (on ? ' on' : '') + (live ? ' live' : '')}
      onClick={onClick}
      aria-current={on ? 'page' : undefined}
      aria-label={badge ? `${label}, ${badge}` : label}
    >
      <span className="tab-icon">
        <Icon size={ICON_SIZES.tab} strokeWidth={on ? 2.2 : 1.8} />
        {!!badge && <span className="badge">{badge > 99 ? '99+' : badge}</span>}
      </span>
      <span className="tab-label">{label}</span>
    </button>
  )
}

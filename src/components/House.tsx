import { useState } from 'react'
import { USER_COLORS } from '../data'
import { needsInstallForNotifications, notifyPermission, requestNotifyPermission, type NotifyPermission } from '../notify'
import { deleteProfile, forgetDevice, selectProfile, setKitchenName, updateProfile, useKitchen, useMe } from '../store'
import { ICON_SIZES } from '../config'
import { UI } from '../icons'
import { FeedbackList, FeedbackSheet } from './Feedback'
import { Avatar, Sheet } from './ui'

export default function House() {
  const s = useKitchen()
  const me = useMe()!
  const [perm, setPerm] = useState<NotifyPermission>(notifyPermission())
  const [name, setName] = useState(me.name)
  const [kitchen, setKitchen] = useState(s.kitchenName)
  const [confirm, setConfirm] = useState<'profile' | 'device' | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const iosHint = needsInstallForNotifications()
  const inviteUrl = `${location.origin}/?join=${s.inviteCode}`

  const share = async () => {
    const text = `Join our kitchen on Cupboard — kitchen code ${s.inviteCode}`
    try {
      if (navigator.share) await navigator.share({ title: 'Kitchen Cupboard', text, url: inviteUrl })
      else {
        await navigator.clipboard.writeText(`${text}\n${inviteUrl}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  return (
    <div className="house-screen">
      <section className="card">
        <h3 className="section-title">Housemates</h3>
        <ul className="members">
          {s.users.map((u) => {
            const count = s.items.filter((i) => i.owners.includes(u.id)).length
            return (
              <li key={u.id}>
                <Avatar user={u} size={36} />
                <div>
                  <strong>
                    {u.name}
                    {u.id === me.id && ' (you)'}
                  </strong>
                  <span className="muted">{count} item{count === 1 ? '' : 's'} in the cupboard</span>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="invite">
          <div>
            <span className="muted small">Kitchen code (for new phones)</span>
            <strong className="invite-code">{s.inviteCode}</strong>
          </div>
          <button className="btn btn-sm btn-primary" onClick={share}>
            {copied ? <><UI.check size={16} /> Copied</> : <><UI.share size={16} /> Invite</>}
          </button>
        </div>
      </section>

      <section className="card">
        <h3 className="section-title">Notifications</h3>
        {perm === 'granted' ? (
          <p className="icon-line">
            <UI.notificationsOn size={ICON_SIZES.button} /> On. You’ll get an alert for grocery runs, requests and items running out.
          </p>
        ) : perm === 'denied' ? (
          <p className="icon-line">
            <UI.warning size={ICON_SIZES.button} /> Blocked. Allow notifications for this site in your browser settings.
          </p>
        ) : iosHint || perm === 'unsupported' ? (
          <p className="icon-line">
            <UI.install size={ICON_SIZES.button} /> On iPhone, first tap <strong>Share → Add to Home Screen</strong>, then open Cupboard from your home screen
            to turn on notifications.
          </p>
        ) : (
          <>
            <p className="muted">Get a phone alert when someone starts a grocery run or asks you for something.</p>
            <button className="btn btn-primary btn-block" onClick={async () => setPerm(await requestNotifyPermission(s.kitchenId, me.id))}>
              <UI.activity size={ICON_SIZES.button} /> Turn on notifications
            </button>
          </>
        )}
      </section>

      <section className="card">
        <div className="section-row">
          <h3 className="section-title">My profile</h3>
          <button className="btn btn-sm btn-ghost" onClick={() => selectProfile(null)}>
            <UI.switchProfile size={16} /> Switch profile
          </button>
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            updateProfile({ name })
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} aria-label="Your name" />
          <button className="btn btn-sm btn-primary" disabled={!name.trim() || name.trim() === me.name}>
            Save
          </button>
        </form>
        <div className="swatches">
          {USER_COLORS.map((c) => (
            <button
              key={c}
              className={'swatch' + (c === me.color ? ' on' : '')}
              style={{ background: c }}
              onClick={() => updateProfile({ color: c })}
              aria-label={`Use colour ${c}`}
            />
          ))}
        </div>
      </section>

      <section className="card">
        <h3 className="section-title">Kitchen</h3>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            setKitchenName(kitchen)
          }}
        >
          <input value={kitchen} onChange={(e) => setKitchen(e.target.value)} maxLength={24} aria-label="Kitchen name" />
          <button className="btn btn-sm btn-primary" disabled={!kitchen.trim() || kitchen.trim() === s.kitchenName}>
            Rename
          </button>
        </form>
      </section>

      <section className="card">
        <div className="section-row">
          <h3 className="section-title">Feedback</h3>
          <button className="btn btn-sm btn-primary" onClick={() => setFeedbackOpen(true)}>
            <UI.feedback size={16} /> Send feedback
          </button>
        </div>
        <FeedbackList />
      </section>

      <div className="actions">
        <button className="btn btn-ghost btn-block danger-text" onClick={() => setConfirm('profile')}>
          <UI.delete size={ICON_SIZES.button} /> Delete my profile
        </button>
        <button className="btn btn-ghost btn-block danger-text" onClick={() => setConfirm('device')}>
          <UI.disconnect size={ICON_SIZES.button} /> Disconnect this phone
        </button>
      </div>
      <p className="muted small center">Kitchen Cupboard v{__APP_VERSION__}</p>

      <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} screen="house" />
      <Sheet
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm === 'profile' ? `Delete ${me.name}’s profile?` : 'Disconnect this phone?'}
      >
        <p>
          {confirm === 'profile'
            ? 'Your items come off the shelves for everyone. This can’t be undone.'
            : 'This phone stops seeing the kitchen. Profiles and items stay. Reconnect any time with the kitchen code.'}
        </p>
        <div className="actions">
          <button
            className="btn btn-danger btn-block"
            onClick={() => {
              setConfirm(null)
              void (confirm === 'profile' ? deleteProfile() : forgetDevice())
            }}
          >
            {confirm === 'profile' ? 'Delete profile' : 'Disconnect'}
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => setConfirm(null)}>
            Cancel
          </button>
        </div>
      </Sheet>
    </div>
  )
}

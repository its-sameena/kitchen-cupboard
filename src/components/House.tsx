import { useState } from 'react'
import { needsInstallForNotifications, notifyPermission, requestNotifyPermission, type NotifyPermission } from '../notify'
import { deleteProfile, forgetDevice, selectProfile, setAvatar, setKitchenName, updateProfile, useKitchen, useMe } from '../store'
import { ICON_SIZES } from '../config'
import { UI } from '../icons'
import { AvatarCreator } from './AvatarCreator'
import { ColorPicker } from './ColorPicker'
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
  const [creatorOpen, setCreatorOpen] = useState(false)
  // Notifications can't be offered here (e.g. iPhone outside the home-screen app): hide the section.
  const canNotify = !needsInstallForNotifications() && perm !== 'unsupported'

  const copyCode = async () => {
    if (await copyText(s.inviteCode)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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
          <button
            className={'copy-btn' + (copied ? ' copied' : '')}
            onClick={copyCode}
            aria-label={copied ? 'Kitchen code copied' : 'Copy kitchen code'}
            title={copied ? 'Copied' : 'Copy code'}
          >
            {copied ? <UI.copied size={20} /> : <UI.copy size={20} />}
          </button>
        </div>
      </section>

      {canNotify && (
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
        ) : (
          <>
            <p className="muted">Get a phone alert when someone starts a grocery run or asks you for something.</p>
            <button className="btn btn-primary btn-block" onClick={async () => setPerm(await requestNotifyPermission(s.kitchenId, me.id))}>
              <UI.activity size={ICON_SIZES.button} /> Turn on notifications
            </button>
          </>
        )}
      </section>
      )}

      <section className="card">
        <div className="section-row">
          <h3 className="section-title">My profile</h3>
          <button className="btn btn-sm btn-ghost" onClick={() => selectProfile(null)}>
            <UI.switchProfile size={16} /> Switch profile
          </button>
        </div>
        <button className="avatar-row" onClick={() => setCreatorOpen(true)}>
          <Avatar user={me} size={52} />
          <span className="avatar-row-text">
            <strong>{me.avatar ? 'Your avatar' : 'Add an avatar'}</strong>
            <small>{me.avatar ? 'Tap to change or remove it' : 'Showing your initials for now'}</small>
          </span>
          <UI.chevron size={18} aria-hidden />
        </button>
        <AvatarCreator
          open={creatorOpen}
          onClose={() => setCreatorOpen(false)}
          background={me.color}
          initial={me.avatar}
          onSave={setAvatar}
          onRemove={me.avatar ? () => setAvatar(null) : undefined}
        />
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
        <ColorPicker
          value={me.color}
          onChange={(c) => updateProfile({ color: c })}
          taken={s.users.filter((u) => u.id !== me.id).map((u) => ({ color: u.color, name: u.name }))}
        />
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

/** Copy text to the clipboard, with a fallback for browsers without the Clipboard API. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    el.remove()
    return ok
  }
}

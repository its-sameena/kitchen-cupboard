import { useEffect, useState } from 'react'
import { ICON_SIZES } from '../config'
import { FEEDBACK_ICONS, UI } from '../icons'
import { deleteFeedback, submitFeedback, updateFeedback, useKitchen, useMe } from '../store'
import type { Feedback, FeedbackKind, FeedbackStatus } from '../types'
import { Sheet, timeAgo } from './ui'

const KINDS: { id: FeedbackKind; label: string; placeholder: string }[] = [
  { id: 'bug', label: 'Something’s broken', placeholder: 'What happened, and what did you expect instead?' },
  { id: 'idea', label: 'Idea', placeholder: 'What would make the app better for you?' },
  { id: 'other', label: 'Other', placeholder: 'Anything else on your mind…' },
]

export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: 'New',
  planned: 'Planned',
  in_progress: 'In progress',
  done: 'Done',
  wont_do: 'Not planned',
}

const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Something went wrong')

/** New feedback, or editing/deleting your own when `editing` is given. */
export function FeedbackSheet({
  open,
  onClose,
  screen,
  editing,
}: {
  open: boolean
  onClose: () => void
  screen: string
  editing?: Feedback
}) {
  const [kind, setKind] = useState<FeedbackKind>('idea')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Load the item being edited each time the sheet opens.
  useEffect(() => {
    if (!open) return
    setKind(editing?.kind ?? 'idea')
    setMessage(editing?.message ?? '')
    setError('')
    setConfirmDelete(false)
  }, [open, editing])

  const close = () => {
    onClose()
    setTimeout(() => setSent(false), 300)
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(errText(err))
    } finally {
      setBusy(false)
    }
  }

  const unchanged = editing && editing.kind === kind && editing.message === message.trim()

  return (
    <Sheet open={open} onClose={close} title={sent ? undefined : editing ? 'Edit your feedback' : 'Send feedback'}>
      {sent ? (
        <div className="center sent">
          <UI.thanks className="empty-icon" size={48} strokeWidth={1.4} aria-hidden />
          <h2>Thanks!</h2>
          <p className="muted">You can follow what happens to it in House → Feedback. Tap it there to edit or delete it.</p>
          <button className="btn btn-primary btn-block" onClick={close}>
            Done
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!message.trim() || unchanged) return
            void run(async () => {
              if (editing) {
                await updateFeedback(editing.id, kind, message)
                close()
              } else {
                await submitFeedback(kind, message, {
                  screen,
                  version: __APP_VERSION__,
                  userAgent: navigator.userAgent,
                  viewport: `${window.innerWidth}x${window.innerHeight}`,
                  standalone: window.matchMedia('(display-mode: standalone)').matches,
                })
                setMessage('')
                setSent(true)
              }
            })
          }}
        >
          <div className="cat-grid kind-grid">
            {KINDS.map((k) => {
              const Icon = FEEDBACK_ICONS[k.id]
              return (
                <button type="button" key={k.id} className={'cat-chip' + (kind === k.id ? ' on' : '')} onClick={() => setKind(k.id)}>
                  <Icon size={15} /> {k.label}
                </button>
              )
            })}
          </div>
          <label className="field">
            <span>Your message</span>
            <textarea
              rows={5}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={KINDS.find((k) => k.id === kind)!.placeholder}
            />
          </label>
          {!editing && (
            <p className="muted small">Your name, the screen you were on and your phone model are attached to help fix things.</p>
          )}
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={!message.trim() || busy || unchanged}>
            {busy ? '…' : editing ? 'Save changes' : 'Send feedback'}
          </button>

          {editing &&
            (confirmDelete ? (
              <div className="confirm-row">
                <span>Delete this feedback?</span>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await deleteFeedback(editing.id)
                      close()
                    })
                  }
                >
                  Delete
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-ghost btn-block danger-text" onClick={() => setConfirmDelete(true)}>
                <UI.delete size={ICON_SIZES.button} /> Delete feedback
              </button>
            ))}
        </form>
      )}
    </Sheet>
  )
}

export function FeedbackList() {
  const k = useKitchen()
  const me = useMe()
  const [showAll, setShowAll] = useState(false)
  const [editing, setEditing] = useState<Feedback | undefined>()

  if (!k.feedback.length) return <p className="muted small">No feedback yet. Be the first!</p>
  const list = showAll ? k.feedback : k.feedback.slice(0, 5)

  return (
    <>
      <ul className="fb-list">
        {list.map((f) => {
          const Icon = FEEDBACK_ICONS[f.kind]
          const mine = !!me && f.memberId === me.id
          const body = (
            <>
              <div className="fb-top">
                <Icon className="fb-kind" size={16} aria-label={f.kind} />
                <span className="muted small">
                  {mine ? 'You' : f.memberName} · {timeAgo(f.createdAt)}
                  {f.editedAt ? ' · edited' : ''}
                </span>
                <span className={`fb-status s-${f.status}`}>{STATUS_LABEL[f.status]}</span>
              </div>
              <p className="fb-msg">{f.message}</p>
              {f.reply && (
                <p className="fb-reply">
                  <UI.reply size={14} aria-hidden /> {f.reply}
                </p>
              )}
              {mine && (
                <span className="fb-edit-hint">
                  <UI.edit size={12} aria-hidden /> Tap to edit or delete
                </span>
              )}
            </>
          )
          return (
            <li key={f.id}>
              {mine ? (
                <button className="fb-item fb-mine" onClick={() => setEditing(f)} aria-label="Edit your feedback">
                  {body}
                </button>
              ) : (
                <div className="fb-item">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
      {k.feedback.length > 5 && (
        <button className="link" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show less' : `Show all ${k.feedback.length}`}
        </button>
      )}
      <FeedbackSheet open={!!editing} onClose={() => setEditing(undefined)} screen="house" editing={editing} />
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { ICON_SIZES } from '../config'
import { CATEGORIES } from '../data'
import { ItemIcon, UI } from '../icons'
import { scanReceipt, type ScannedItem, type ScanTiming } from '../receipt'
import { addItem, haveItToo, useKitchen, useMe } from '../store'
import type { CategoryId } from '../types'
import { Sheet } from './ui'

interface Row extends ScannedItem {
  key: string
  checked: boolean
}

const norm = (n: string) => n.trim().toLowerCase()

const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`

/** "Read in 4.2 s"; tap for where the time went (helps tune scanning speed). */
function ReadIn({ t }: { t: ScanTiming }) {
  const [open, setOpen] = useState(false)
  return (
    <button type="button" className="rcpt-time" onClick={() => setOpen(!open)} aria-expanded={open}>
      Read in {sec(t.totalMs)}
      {open && (
        <span className="rcpt-time-detail">
          Photo {sec(t.photoMs)} · upload {sec(t.networkMs)} · Google {sec(t.geminiMs)}
          {t.serverMs - t.geminiMs > 300 ? ` · server ${sec(t.serverMs - t.geminiMs)}` : ''}
          <br />
          {t.modelVersion || t.model} · thinking {t.usage.thinking.toLocaleString()} · answer {t.usage.output.toLocaleString()} tokens · {t.imageKB} KB photo
        </span>
      )}
    </button>
  )
}

/**
 * Photo → Gemini → a list you check and edit before anything is added.
 * Nothing touches the cupboard until you tap "Add".
 */
export function ReceiptReview({ file, onClose }: { file: File; onClose: () => void }) {
  const s = useKitchen()
  const me = useMe()!
  const [photo, setPhoto] = useState<File>(file)
  const [preview, setPreview] = useState('')
  const [phase, setPhase] = useState<'reading' | 'error' | 'review'>('reading')
  const [error, setError] = useState('')
  const [store, setStore] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [timing, setTiming] = useState<ScanTiming | null>(null)
  const retry = useRef<HTMLInputElement>(null)

  const findExisting = (name: string) => s.items.find((i) => norm(i.name) === norm(name))
  const onList = (name: string) => s.grocery.some((g) => !g.gotBy && norm(g.name) === norm(name))

  useEffect(() => {
    const url = URL.createObjectURL(photo)
    setPreview(url)
    setPhase('reading')
    let cancelled = false
    scanReceipt(photo)
      .then((res) => {
        if (cancelled) return
        if (!res.items.length) {
          setError('No groceries found on that photo. Try again with the whole receipt flat and in good light.')
          setPhase('error')
          return
        }
        setStore(res.store)
        setTiming(res.timing)
        setRows(
          res.items.map((it, i) => {
            const existing = findExisting(it.name)
            // Things you already own start unticked; everything else is ticked.
            return { ...it, key: `${i}-${it.name}`, checked: !existing?.owners.includes(me.id) }
          }),
        )
        setPhase('review')
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(e.message)
        setPhase('error')
      })
    return () => {
      cancelled = true
      URL.revokeObjectURL(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo])

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const chosen = rows.filter((r) => r.checked && r.name.trim())

  const addAll = () => {
    for (const r of chosen) {
      const existing = findExisting(r.name)
      if (existing) {
        if (!existing.owners.includes(me.id)) haveItToo(existing.id)
      } else {
        addItem({ name: r.name.trim(), icon: r.icon, category: r.category })
      }
    }
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={phase === 'review' ? 'Check your receipt' : 'Scan a receipt'}>
      <input
        ref={retry}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) setPhoto(f)
          e.target.value = ''
        }}
      />

      {phase === 'reading' && (
        <div className="rcpt-reading">
          <div className="rcpt-photo">
            {preview && <img src={preview} alt="Your receipt" />}
            <span className="rcpt-scanline" aria-hidden />
          </div>
          <p>
            <strong>Reading your receipt…</strong>
          </p>
          <p className="muted small">This usually takes a few seconds.</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="rcpt-error">
          <UI.warning size={40} strokeWidth={1.4} className="empty-icon" aria-hidden />
          <p style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{error}</p>
          <div className="actions">
            <button className="btn btn-primary btn-block" onClick={() => retry.current?.click()}>
              <UI.camera size={ICON_SIZES.button} /> Try another photo
            </button>
            <button className="btn btn-ghost btn-block" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      )}

      {phase === 'review' && (
        <>
          <p className="muted small rcpt-summary">
            {store ? `${store} · ` : ''}
            {rows.length} item{rows.length === 1 ? '' : 's'} found. Untick anything you don’t want and fix names if needed.
          </p>
          <ul className="rcpt-list">
            {rows.map((r, i) => {
              const existing = findExisting(r.name)
              const mine = !!existing?.owners.includes(me.id)
              const listed = onList(r.name)
              return (
                <li
                  key={r.key}
                  className={'rcpt-row' + (r.checked ? '' : ' off')}
                  style={{ '--i': Math.min(i, 10), '--shelf': `var(--shelf-${existing?.category ?? r.category})` } as React.CSSProperties}
                >
                  <button
                    className={'check' + (r.checked ? ' on' : '')}
                    onClick={() => update(r.key, { checked: !r.checked })}
                    aria-label={`${r.checked ? 'Untick' : 'Tick'} ${r.name}`}
                    aria-pressed={r.checked}
                  >
                    <UI.check size={20} strokeWidth={3} />
                  </button>
                  <span className="rcpt-icon">
                    <ItemIcon name={existing?.icon ?? r.icon} size={ICON_SIZES.list} strokeWidth={1.7} />
                  </span>
                  <div className="rcpt-main">
                    <div className="rcpt-line">
                      <input value={r.name} maxLength={32} onChange={(e) => update(r.key, { name: e.target.value })} aria-label="Item name" />
                      {r.quantity > 1 && <span className="rcpt-qty">×{r.quantity}</span>}
                    </div>
                    <div className="rcpt-meta">
                      {existing ? (
                        <span className="rcpt-tag">{mine ? 'Already yours' : 'You’ll be added as an owner'}</span>
                      ) : (
                        <select
                          value={r.category}
                          onChange={(e) => update(r.key, { category: e.target.value as CategoryId })}
                          aria-label={`Shelf for ${r.name}`}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      )}
                      {listed && <span className="rcpt-tag ok">On the grocery list</span>}
                      {r.confidence === 'low' && <span className="rcpt-tag warn">Check this one</span>}
                    </div>
                    {r.raw && <div className="rcpt-raw">“{r.raw}”</div>}
                  </div>
                </li>
              )
            })}
          </ul>
          {timing && <ReadIn t={timing} />}
          <div className="rcpt-footer">
            <button className="btn btn-primary btn-block" disabled={!chosen.length} onClick={addAll}>
              {chosen.length ? `Add ${chosen.length} to cupboard` : 'Nothing selected'}
            </button>
            <button className="link" onClick={() => retry.current?.click()}>
              Scan a different photo
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}

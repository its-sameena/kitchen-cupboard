import { useEffect, useState } from 'react'
import { AVATAR_PARTS, avatarUri, partLabel, randomAvatar, type AvatarConfig } from '../avatar'
import { UI } from '../icons'
import { Sheet } from './ui'

type Tab = 'plant' | 'eyes' | 'mouth' | 'colours' | 'extras'

const TABS: { id: Tab; label: string }[] = [
  { id: 'plant', label: 'Plant' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'mouth', label: 'Mouth' },
  { id: 'colours', label: 'Colours' },
  { id: 'extras', label: 'Extras' },
]

/**
 * Build-your-own DiceBear "sprouts" avatar. The background is always the
 * profile's highlight colour (`background`).
 */
export function AvatarCreator({
  open,
  onClose,
  background,
  initial,
  onSave,
  onRemove,
}: {
  open: boolean
  onClose: () => void
  background: string
  initial?: AvatarConfig
  onSave: (cfg: AvatarConfig) => void
  onRemove?: () => void
}) {
  const [cfg, setCfg] = useState<AvatarConfig>(() => initial ?? randomAvatar())
  const [tab, setTab] = useState<Tab>('plant')

  // Start from the saved avatar (or a random one) each time the creator opens.
  useEffect(() => {
    if (!open) return
    setCfg(initial ?? randomAvatar())
    setTab('plant')
  }, [open, initial])

  const update = (patch: Partial<AvatarConfig>) => setCfg((c) => ({ ...c, ...patch }))

  /** Grid of mini previews, each showing the current avatar with one option changed. */
  const options = <K extends keyof AvatarConfig>(key: K, values: (AvatarConfig[K] | null)[], noneLabel = 'None') => (
    <div className="av-grid">
      {values.map((v) => {
        const on = cfg[key] === v
        return (
          <button
            key={String(v)}
            type="button"
            className={'av-opt' + (on ? ' on' : '')}
            aria-pressed={on}
            onClick={() => update({ [key]: v } as Partial<AvatarConfig>)}
          >
            <img src={avatarUri({ ...cfg, [key]: v }, background)} alt="" width={64} height={64} />
            <span>{v === null ? noneLabel : partLabel(String(v))}</span>
          </button>
        )
      })}
    </div>
  )

  const swatches = (key: 'potColor' | 'plantColor' | 'bloomColor', label: string, hint?: string) => (
    <div className="av-colours">
      <span className="av-colours-label">
        {label}
        {hint && <small> · {hint}</small>}
      </span>
      <div className="av-swatches">
        {AVATAR_PARTS[key].map((c) => (
          <button
            key={c}
            type="button"
            className={'av-swatch' + (cfg[key] === c ? ' on' : '')}
            style={{ background: c }}
            aria-label={`${label} ${c}`}
            aria-pressed={cfg[key] === c}
            onClick={() => update({ [key]: c })}
          />
        ))}
      </div>
    </div>
  )

  return (
    <Sheet open={open} onClose={onClose} title={initial ? 'Edit your avatar' : 'Create your avatar'}>
      <div className="av-creator">
        <div className="av-preview">
          <img src={avatarUri(cfg, background)} alt="Your avatar" width={148} height={148} />
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCfg(randomAvatar())}>
            <UI.shuffle size={16} /> Randomise
          </button>
        </div>

        <div className="av-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'on' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="av-panel">
          {tab === 'plant' && options('plant', AVATAR_PARTS.plant)}
          {tab === 'eyes' && options('eyes', AVATAR_PARTS.eyes)}
          {tab === 'mouth' && options('mouth', AVATAR_PARTS.mouth)}
          {tab === 'colours' && (
            <>
              {swatches('potColor', 'Pot', 'your face colour')}
              {swatches('plantColor', 'Plant')}
              {swatches('bloomColor', 'Flower', 'shows on flowering plants')}
            </>
          )}
          {tab === 'extras' && (
            <>
              <h4 className="av-sub">Pot shape</h4>
              {options('pot', AVATAR_PARTS.pot)}
              <h4 className="av-sub">Pot pattern</h4>
              {options('pattern', [null, ...AVATAR_PARTS.pattern], 'Plain')}
              <h4 className="av-sub">Cheeks</h4>
              {options('cheeks', [null, ...AVATAR_PARTS.cheeks])}
            </>
          )}
        </div>

        <div className="av-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onSave(cfg)
              onClose()
            }}
          >
            Save avatar
          </button>
        </div>
        {onRemove && (
          <button
            type="button"
            className="btn btn-ghost btn-block danger-text av-remove"
            onClick={() => {
              onRemove()
              onClose()
            }}
          >
            <UI.delete size={16} /> Remove avatar (show initials)
          </button>
        )}
      </div>
    </Sheet>
  )
}

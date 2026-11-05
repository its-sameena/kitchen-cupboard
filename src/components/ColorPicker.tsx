import { useState } from 'react'
import { PROFILE_PALETTE, sameColor, textOn } from '../data'
import { UI } from '../icons'
import { Sheet } from './ui'

export interface TakenColor {
  color: string
  name: string
}

/** A swatch button that opens a grid of colours. Colours used by other housemates can't be picked. */
export function ColorPicker({
  value,
  onChange,
  taken,
  label = 'Highlight colour',
}: {
  value: string
  onChange: (color: string) => void
  taken: TakenColor[]
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const owner = (c: string) => taken.find((t) => sameColor(t.color, c))

  return (
    <>
      <button type="button" className="color-trigger" onClick={() => setOpen(true)}>
        <span className="color-dot" style={{ background: value }} />
        <span className="color-trigger-text">
          <strong>{label}</strong>
          <small>Tap to change</small>
        </span>
        <UI.chevron size={18} aria-hidden />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Pick a colour">
        <div className="palette" role="listbox" aria-label="Colours">
          {PROFILE_PALETTE.map((row, r) =>
            row.map((c, i) => {
              const usedBy = owner(c)
              const selected = sameColor(c, value)
              return (
                <button
                  key={`${r}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={usedBy ? `${c}, used by ${usedBy.name}` : c}
                  title={usedBy ? `Used by ${usedBy.name}` : undefined}
                  disabled={!!usedBy}
                  className={'palette-cell' + (selected ? ' on' : '') + (usedBy ? ' taken' : '')}
                  style={{ background: c, color: textOn(c) }}
                  onClick={() => {
                    onChange(c)
                    setOpen(false)
                  }}
                >
                  {usedBy && <UI.close size={12} strokeWidth={2.5} aria-hidden />}
                </button>
              )
            }),
          )}
        </div>
        {taken.length > 0 && (
          <div className="palette-taken">
            <span className="muted small">Already taken</span>
            {taken.map((t) => (
              <span key={t.name} className="taken-chip">
                <span className="color-dot sm" style={{ background: t.color }} />
                {t.name}
              </span>
            ))}
          </div>
        )}
      </Sheet>
    </>
  )
}

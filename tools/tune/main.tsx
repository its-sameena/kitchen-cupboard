/**
 * Tuning page for item icons and name → icon/shelf keywords. Dev only:
 * `npm run tune` opens it. Edits are kept in this tab until you press Save,
 * which rewrites src/catalog/*.ts (and the receipt scanner's icon list).
 * The running app reloads with the change; commit + push to ship it.
 */
import { createElement, StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ITEM_ICON_DATA } from '../../src/catalog/item-icons.ts'
import { KEYWORD_TESTS } from '../../src/catalog/keyword-tests.ts'
import { KEYWORD_RULES } from '../../src/catalog/keywords.ts'
import type { IconNode, ItemIconData, KeywordRule, KeywordTest } from '../../src/catalog/types.ts'
import { CATEGORIES, categoryById, explainFor, suggestFor, words } from '../../src/data.ts'
import { DEFAULT_ITEM_ICON } from '../../src/icons.tsx'
import type { CategoryId } from '../../src/types.ts'
import { parseSvg } from './svg.mjs'
import '../../src/theme.css'
import './tune.css'

// ───────────────────────── state ─────────────────────────

type Icons = Record<string, ItemIconData>
interface Draft {
  icons: Icons
  rules: KeywordRule[]
  tests: KeywordTest[]
  dirty: { icons: boolean; rules: boolean; tests: boolean }
}
const STORE = 'tune-draft'
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

/** Unsaved edits survive reloads (saving a file reloads the page); saved parts come from the files. */
function loadDraft(): Draft {
  const fresh: Draft = {
    icons: clone(ITEM_ICON_DATA),
    rules: clone(KEYWORD_RULES),
    tests: clone(KEYWORD_TESTS),
    dirty: { icons: false, rules: false, tests: false },
  }
  try {
    const d = JSON.parse(sessionStorage.getItem(STORE) ?? 'null') as Draft | null
    if (!d) return fresh
    return {
      icons: d.dirty.icons ? d.icons : fresh.icons,
      rules: d.dirty.rules ? d.rules : fresh.rules,
      tests: d.dirty.tests ? d.tests : fresh.tests,
      dirty: d.dirty,
    }
  } catch {
    return fresh
  }
}

async function api<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? res.statusText)
  return data
}

// ───────────────────────── small pieces ─────────────────────────

function Svg({ node, size = 24, stroke = 1.7 }: { node: IconNode; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {node.map(([tag, attrs], i) => createElement(tag, { ...attrs, key: i }))}
    </svg>
  )
}

const toMarkup = (node: IconNode) =>
  `<svg viewBox="0 0 24 24">\n${node.map(([t, a]) => `  <${t} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')} />`).join('\n')}\n</svg>`

const STARTER = `<svg viewBox="0 0 24 24">
  <!-- 24×24 grid, (0,0) top-left. Keep shapes inside 2..22. -->
  <circle cx="12" cy="13" r="8" />
  <path d="M12 5V2" />
</svg>`

function shelfStyle(id: CategoryId) {
  return { '--shelf': `var(--shelf-${id})` } as React.CSSProperties
}

function IconPicker({ icons, value, onPick }: { icons: Icons; value: string; onPick: (key: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const list = Object.entries(icons).filter(([k, ic]) => !q || k.includes(q.toLowerCase()) || ic.label.toLowerCase().includes(q.toLowerCase()))
  return (
    <span className="picker">
      <button type="button" className="icon-btn" onClick={() => setOpen(!open)} title={icons[value]?.label ?? value}>
        {icons[value] ? <Svg node={icons[value].node} /> : <span className="missing">?</span>}
      </button>
      {open && (
        <div className="picker-pop" onMouseLeave={() => setOpen(false)}>
          <input autoFocus placeholder="Filter icons" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="picker-grid">
            {list.map(([k, ic]) => (
              <button
                type="button"
                key={k}
                className={k === value ? 'on' : ''}
                title={`${ic.label} (${k})`}
                onClick={() => {
                  onPick(k)
                  setOpen(false)
                }}
              >
                <Svg node={ic.node} />
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  )
}

function ShelfSelect({ value, onChange }: { value: CategoryId; onChange: (v: CategoryId) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as CategoryId)}>
      {CATEGORIES.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </select>
  )
}

/** What an item card would show for this name. */
function Guess({ icons, name, rules }: { icons: Icons; name: string; rules: KeywordRule[] }) {
  const g = suggestFor(name, [], rules)
  const shelf = g?.category ?? 'other'
  const icon = g?.icon ?? DEFAULT_ITEM_ICON[shelf]
  return (
    <div className="guess" style={shelfStyle(shelf)}>
      <div className="guess-tile">{icons[icon] ? <Svg node={icons[icon].node} size={40} stroke={1.6} /> : '?'}</div>
      <div>
        <strong>{name || '…'}</strong>
        <div className="muted small">
          {g ? `${categoryById(shelf).label} · ${icons[icon]?.label ?? icon}` : 'No keyword matched: lands on Other with the box icon (or the shelf you pick)'}
        </div>
      </div>
    </div>
  )
}

const scoreText = (s: number[]) => `${s[0]}-word keyword · ends at word ${s[1] + 1} · ${s[2] ? 'exact' : 'plural'}`

// ───────────────────────── Try a name ─────────────────────────

function TryTab({ d, set, preset }: { d: Draft; set: Setter; preset: Preset | null }) {
  const [name, setName] = useState(preset?.name ?? '')
  const matches = explainFor(name, d.rules)
  const g = suggestFor(name, [], d.rules)
  // What it *should* be: follows the guess until you pick something yourself.
  const [chosen, setChosen] = useState<{ icon?: string; shelf?: CategoryId }>(preset ? { icon: preset.icon, shelf: preset.shelf } : {})
  const icon = chosen.icon ?? g?.icon ?? 'package'
  const shelf = chosen.shelf ?? g?.category ?? 'other'
  const setIcon = (v: string) => setChosen((c) => ({ ...c, icon: v }))
  const setShelf = (v: CategoryId) => setChosen((c) => ({ ...c, shelf: v }))
  const [keyword, setKeyword] = useState('')
  const [asTest, setAsTest] = useState(true)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (preset) {
      setName(preset.name)
      setChosen({ icon: preset.icon, shelf: preset.shelf })
    }
  }, [preset])

  const kw = (keyword || words(name)).trim()
  const target = d.rules.findIndex((r) => r.icon === icon && r.shelf === shelf)

  const addKeyword = () => {
    if (!kw) return
    set((x) => {
      const rules = clone(x.rules)
      if (target >= 0) {
        if (!rules[target].keywords.includes(kw)) rules[target].keywords.push(kw)
      } else {
        const at = rules.map((r) => r.shelf).lastIndexOf(shelf)
        rules.splice(at >= 0 ? at + 1 : rules.length, 0, { shelf, icon, keywords: [kw] })
      }
      const tests = asTest && !x.tests.some((t) => words(t.name) === words(name)) ? [...x.tests, { name: name.trim(), shelf, icon }] : x.tests
      return { ...x, rules, tests, dirty: { ...x.dirty, rules: true, tests: x.dirty.tests || tests !== x.tests } }
    })
    setNote(`Added “${kw}”. Check the guess above; save when you’re happy.`)
    setKeyword('')
  }

  const removeKeyword = (rule: number, k: string) =>
    set((x) => {
      const rules = clone(x.rules)
      rules[rule].keywords = rules[rule].keywords.filter((w) => w !== k)
      return { ...x, rules: rules.filter((r) => r.keywords.length), dirty: { ...x.dirty, rules: true } }
    })

  const ok = g && g.icon === icon && g.category === shelf
  return (
    <section>
      <p className="muted">Type an item name the way a housemate would. You’ll see what the app guesses and why.</p>
      <input
        className="big"
        autoFocus
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setChosen({})
          setNote('')
        }}
        placeholder="e.g. Baked beans"
      />
      <Guess icons={d.icons} name={name} rules={d.rules} />

      {name.trim() && (
        <>
          <h3>Why</h3>
          {matches.length ? (
            <table className="why">
              <tbody>
                {matches.map((m, i) => (
                  <tr key={m.rule + m.keyword} className={i === 0 ? 'win' : ''}>
                    <td>{i === 0 ? 'Wins' : ''}</td>
                    <td>
                      <code>{m.keyword}</code>
                    </td>
                    <td>
                      <Svg node={d.icons[m.icon]?.node ?? []} size={18} /> {categoryById(m.category).label}
                    </td>
                    <td className="muted small">{scoreText(m.score)}</td>
                    <td>
                      <button className="link" onClick={() => removeKeyword(m.rule, m.keyword)} title="Remove this keyword from its rule">
                        remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No keyword matches this name.</p>
          )}
          <p className="muted small">
            Longest keyword wins; then the one nearest the end of the name; then exact beats plural. Remove a keyword that shouldn’t match, or add a longer one below.
          </p>

          <h3>It should be</h3>
          <div className="row">
            <IconPicker icons={d.icons} value={icon} onPick={setIcon} />
            <ShelfSelect value={shelf} onChange={setShelf} />
            {ok ? <span className="pill ok">Already right</span> : <span className="pill warn">Different from the guess</span>}
          </div>
          <div className="row">
            <label className="grow">
              Keyword to add
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={words(name)} />
            </label>
            <label className="check">
              <input type="checkbox" checked={asTest} onChange={(e) => setAsTest(e.target.checked)} /> Save “{name.trim()}” as a test
            </label>
            <button className="btn btn-primary" disabled={!kw} onClick={addKeyword}>
              {target >= 0 ? 'Add to existing rule' : 'Add as new rule'}
            </button>
          </div>
          <p className="muted small">
            Tip: use the shortest word that’s specific, e.g. “basmati” rather than “tilda basmati rice 1kg”. Multi-word keywords (“coffee beans”) beat single words.
          </p>
          {note && <p className="ok-text">{note}</p>}
        </>
      )}
    </section>
  )
}

// ───────────────────────── Keywords ─────────────────────────

function KeywordsTab({ d, set }: { d: Draft; set: Setter }) {
  const [q, setQ] = useState('')
  const dupes = useMemo(() => {
    const seen = new Map<string, number>()
    const out = new Set<string>()
    d.rules.forEach((r) => r.keywords.forEach((k) => {
      const w = words(k)
      if (seen.has(w)) out.add(w)
      seen.set(w, 1)
    }))
    return out
  }, [d.rules])

  const edit = (i: number, f: (r: KeywordRule) => void) =>
    set((x) => {
      const rules = clone(x.rules)
      f(rules[i])
      return { ...x, rules, dirty: { ...x.dirty, rules: true } }
    })
  const remove = (i: number) => set((x) => ({ ...x, rules: x.rules.filter((_, j) => j !== i), dirty: { ...x.dirty, rules: true } }))
  const addRule = (shelf: CategoryId) =>
    set((x) => {
      const rules = clone(x.rules)
      const at = rules.map((r) => r.shelf).lastIndexOf(shelf)
      rules.splice(at >= 0 ? at + 1 : rules.length, 0, { shelf, icon: DEFAULT_ITEM_ICON[shelf], keywords: [] })
      return { ...x, rules, dirty: { ...x.dirty, rules: true } }
    })

  const match = (r: KeywordRule) => !q || r.icon.includes(q) || r.keywords.some((k) => k.includes(q.toLowerCase()))
  return (
    <section>
      <div className="row">
        <input className="grow" placeholder="Search keywords or icon keys" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted small">{d.rules.reduce((n, r) => n + r.keywords.length, 0)} keywords in {d.rules.length} rules</span>
      </div>
      {dupes.size > 0 && <p className="warn-text">Same keyword in two rules (only one can win): {[...dupes].join(', ')}</p>}
      {CATEGORIES.map((c) => {
        const rules = d.rules.map((r, i) => [r, i] as const).filter(([r]) => r.shelf === c.id && match(r))
        if (q && !rules.length) return null
        return (
          <div key={c.id} className="shelf-group" style={shelfStyle(c.id)}>
            <h3>
              {c.label} <button className="link" onClick={() => addRule(c.id)}>+ rule</button>
            </h3>
            {rules.map(([r, i]) => (
              <div key={i} className="rule">
                <IconPicker icons={d.icons} value={r.icon} onPick={(k) => edit(i, (x) => (x.icon = k))} />
                <ShelfSelect value={r.shelf} onChange={(v) => edit(i, (x) => (x.shelf = v))} />
                <div className="chips">
                  {r.keywords.map((k) => (
                    <span key={k} className={'chip' + (dupes.has(words(k)) ? ' dupe' : '')}>
                      {k}
                      <button onClick={() => edit(i, (x) => (x.keywords = x.keywords.filter((w) => w !== k)))} aria-label={`Remove ${k}`}>
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    className="chip-input"
                    placeholder="+ keyword, Enter"
                    onKeyDown={(e) => {
                      const v = e.currentTarget.value.trim().toLowerCase()
                      if (e.key === 'Enter' && v) {
                        edit(i, (x) => (x.keywords = [...new Set([...x.keywords, ...v.split(',').map((s) => s.trim()).filter(Boolean)])]))
                        e.currentTarget.value = ''
                      }
                    }}
                  />
                </div>
                <button className="link danger" onClick={() => remove(i)}>
                  delete
                </button>
              </div>
            ))}
          </div>
        )
      })}
    </section>
  )
}

// ───────────────────────── Icons ─────────────────────────

interface LibIcon {
  source: string
  name: string
  tags: string[]
  node: IconNode
}

function IconsTab({ d, set }: { d: Draft; set: Setter }) {
  const [sel, setSel] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const used = (k: string) => d.rules.filter((r) => r.icon === k).length + Object.values(DEFAULT_ITEM_ICON).filter((v) => v === k).length + (k === 'cereal-box' ? 1 : 0)
  const keys = Object.keys(d.icons)

  const update = (f: (icons: Icons) => Icons) => set((x) => ({ ...x, icons: f(clone(x.icons)), dirty: { ...x.dirty, icons: true } }))
  const move = (k: string, dir: -1 | 1) =>
    update((icons) => {
      const ks = Object.keys(icons)
      const i = ks.indexOf(k)
      const j = i + dir
      if (j < 0 || j >= ks.length) return icons
      ;[ks[i], ks[j]] = [ks[j], ks[i]]
      return Object.fromEntries(ks.map((key) => [key, icons[key]]))
    })

  return (
    <section className="icons-tab">
      <div>
        <div className="row">
          <span className="muted small">{keys.length} icons, in picker order. Click one to edit its label or drawing.</span>
          <button className="btn btn-primary" onClick={() => { setAdding(true); setSel(null) }}>
            + Add icon
          </button>
        </div>
        <div className="icon-tiles">
          {keys.map((k) => (
            <button key={k} className={'tile' + (sel === k ? ' on' : '')} onClick={() => { setSel(k); setAdding(false) }}>
              <Svg node={d.icons[k].node} size={30} stroke={1.6} />
              <span>{d.icons[k].label}</span>
              <code>{k}</code>
            </button>
          ))}
        </div>
      </div>
      <aside>
        {adding && (
          <AddIcon
            icons={d.icons}
            onAdd={(key, ic) => {
              update((icons) => ({ ...icons, [key]: ic }))
              setAdding(false)
              setSel(key)
            }}
          />
        )}
        {sel && d.icons[sel] && (
          <EditIcon
            k={sel}
            ic={d.icons[sel]}
            icons={d.icons}
            usedBy={used(sel)}
            onChange={(ic) => update((icons) => ({ ...icons, [sel]: ic }))}
            onMove={(dir) => move(sel, dir)}
            onDelete={() => {
              update((icons) => {
                delete icons[sel]
                return icons
              })
              setSel(null)
            }}
          />
        )}
        {!adding && !sel && <p className="muted">Pick an icon to edit, or add a new one from Lucide, Lucide Lab, Tabler, or your own drawing.</p>}
      </aside>
    </section>
  )
}

/** Big preview on a 24×24 grid, plus real sizes next to neighbours. */
function Preview({ node, icons }: { node: IconNode; icons: Icons }) {
  const compare = ['milk', 'apple', 'can'].filter((k) => icons[k])
  return (
    <div className="preview">
      <div className="grid24">
        <Svg node={node} size={240} stroke={1.7} />
      </div>
      <div className="sizes">
        {[16, 24, 32, 48].map((s) => (
          <Svg key={s} node={node} size={s} />
        ))}
      </div>
      <div className="sizes cards">
        <span className="card-demo">
          <Svg node={node} size={34} stroke={1.6} />
        </span>
        {compare.map((k) => (
          <span key={k} className="card-demo dim">
            <Svg node={icons[k].node} size={34} stroke={1.6} />
          </span>
        ))}
      </div>
    </div>
  )
}

function DrawingEditor({ node, initialText, onChange }: { node: IconNode; initialText?: string; onChange: (n: IconNode) => void }) {
  const [text, setText] = useState(initialText ?? toMarkup(node))
  const [warnings, setWarnings] = useState<string[]>([])
  return (
    <label>
      Drawing (SVG on a 24×24 grid, edits preview live)
      <textarea
        rows={9}
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const r = parseSvg(e.target.value)
          setWarnings(r.warnings)
          if (r.node.length) onChange(r.node)
        }}
      />
      {warnings.map((w) => (
        <span key={w} className="warn-text small">
          {w}
        </span>
      ))}
    </label>
  )
}

function EditIcon(props: {
  k: string
  ic: ItemIconData
  icons: Icons
  usedBy: number
  onChange: (ic: ItemIconData) => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
}) {
  const { k, ic, icons, usedBy, onChange, onMove, onDelete } = props
  return (
    <div className="panel" key={k}>
      <h3>
        <code>{k}</code> <span className="muted small">from {ic.source}</span>
      </h3>
      <Preview node={ic.node} icons={icons} />
      <label>
        Label in the picker
        <input value={ic.label} onChange={(e) => onChange({ ...ic, label: e.target.value })} />
      </label>
      <DrawingEditor key={k} node={ic.node} onChange={(node) => onChange({ ...ic, node, source: ic.source.startsWith('custom') ? ic.source : `${ic.source} (edited)` })} />
      <div className="row">
        <button className="btn" onClick={() => onMove(-1)}>
          Move earlier
        </button>
        <button className="btn" onClick={() => onMove(1)}>
          Move later
        </button>
        <button
          className="btn danger"
          disabled={usedBy > 0}
          title={usedBy ? 'Used by keyword rules or as a shelf default' : ''}
          onClick={() => confirm(`Delete "${k}"? Items already saved with it will show a box icon.`) && onDelete()}
        >
          {usedBy ? `Used ${usedBy}× (can’t delete)` : 'Delete'}
        </button>
      </div>
      <p className="muted small">The key is saved in the database, so it can’t be renamed. To replace an icon everywhere, edit its drawing instead.</p>
    </div>
  )
}

function AddIcon({ icons, onAdd }: { icons: Icons; onAdd: (key: string, ic: ItemIconData) => void }) {
  const [mode, setMode] = useState<'search' | 'paste'>('search')
  const [lib, setLib] = useState<LibIcon[] | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [pick, setPick] = useState<{ node: IconNode; source: string; name: string } | null>(null)
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (mode === 'search' && !lib) api<LibIcon[]>('/__tune/library').then(setLib, (e) => setErr(String(e.message)))
  }, [mode, lib])

  const results = useMemo(() => {
    if (!lib || q.trim().length < 2) return []
    const t = q.trim().toLowerCase()
    return lib.filter((i) => i.name.includes(t) || i.tags.some((g) => g.toLowerCase().includes(t))).slice(0, 150)
  }, [lib, q])

  const choose = (node: IconNode, source: string, name: string) => {
    setPick({ node, source, name })
    const base = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 16)
    setKey(icons[base] ? '' : base)
    setLabel(name.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()))
  }
  const keyError = !key ? 'Pick a key' : !/^[a-z][a-z0-9-]{0,15}$/.test(key) ? '1–16 lower-case letters, digits, dashes' : icons[key] ? 'Already used' : ''

  return (
    <div className="panel">
      <div className="seg">
        <button className={mode === 'search' ? 'on' : ''} onClick={() => setMode('search')}>
          Search libraries
        </button>
        <button className={mode === 'paste' ? 'on' : ''} onClick={() => { setMode('paste'); choose(parseSvg(STARTER).node, 'custom', '') }}>
          Paste or draw SVG
        </button>
      </div>
      {mode === 'search' && (
        <>
          <input autoFocus placeholder="e.g. cheese, bread, jar, bottle (Tabler also searches tags)" value={q} onChange={(e) => setQ(e.target.value)} />
          {err && <p className="warn-text">{err}</p>}
          {!lib && !err && <p className="muted small">Loading ~7,500 icons…</p>}
          <div className="lib-grid">
            {results.map((i) => (
              <button key={i.source + i.name} title={`${i.name} · ${i.source}`} onClick={() => choose(i.node, `${i.source}:${i.name}`, i.name)} className={pick?.source === `${i.source}:${i.name}` ? 'on' : ''}>
                <Svg node={i.node} size={26} />
                <span className={'src ' + i.source}>{i.source === 'lucide-lab' ? 'lab' : i.source}</span>
              </button>
            ))}
          </div>
          {lib && q.trim().length >= 2 && !results.length && <p className="muted small">Nothing found. Try a simpler word, or draw it yourself.</p>}
        </>
      )}
      {mode === 'paste' && pick && <DrawingEditor node={pick.node} initialText={STARTER} onChange={(node) => setPick({ ...pick, node })} />}
      {pick && (
        <>
          <Preview node={pick.node} icons={icons} />
          <div className="row">
            <label className="grow">
              Key (saved in the database)
              <input value={key} onChange={(e) => setKey(e.target.value.toLowerCase())} />
              {keyError && <span className="warn-text small">{keyError}</span>}
            </label>
            <label className="grow">
              Label
              <input value={label} onChange={(e) => setLabel(e.target.value)} />
            </label>
          </div>
          <button className="btn btn-primary" disabled={!!keyError || !label.trim() || !pick.node.length} onClick={() => onAdd(key, { label: label.trim(), source: pick.source, node: pick.node })}>
            Add “{label || key}”
          </button>
        </>
      )}
    </div>
  )
}

// ───────────────────────── Tests ─────────────────────────

function testResults(d: Draft) {
  return d.tests.map((t) => {
    const got = suggestFor(t.name, [], d.rules)
    const pass = t.shelf === null ? got === null : got?.category === t.shelf && (!t.icon || got.icon === t.icon)
    return { t, got, pass }
  })
}

function TestsTab({ d, set }: { d: Draft; set: Setter }) {
  const results = testResults(d)
  const [name, setName] = useState('')
  const failing = results.filter((r) => !r.pass)
  const g = suggestFor(name, [], d.rules)
  const remove = (i: number) => set((x) => ({ ...x, tests: x.tests.filter((_, j) => j !== i), dirty: { ...x.dirty, tests: true } }))
  return (
    <section>
      <p className="muted">
        Names the guesser must get right; <code>npm run test:suggest</code> checks the same list. {failing.length ? <strong className="warn-text">{failing.length} failing</strong> : <strong className="ok-text">All {results.length} pass</strong>}
      </p>
      <div className="row">
        <input className="grow" placeholder="Add a name to lock in its current guess" value={name} onChange={(e) => setName(e.target.value)} />
        <span className="muted small">{name && (g ? `→ ${categoryById(g.category).label} / ${g.icon}` : '→ no guess')}</span>
        <button
          className="btn"
          disabled={!name.trim()}
          onClick={() => {
            set((x) => ({ ...x, tests: [...x.tests, { name: name.trim(), shelf: g?.category ?? null, ...(g ? { icon: g.icon } : {}) }], dirty: { ...x.dirty, tests: true } }))
            setName('')
          }}
        >
          Add test
        </button>
      </div>
      <table className="tests">
        <tbody>
          {[...failing, ...results.filter((r) => r.pass)].map(({ t, got, pass }) => {
            const i = d.tests.indexOf(t)
            return (
              <tr key={i} className={pass ? '' : 'fail'}>
                <td>{pass ? '✓' : '✗'}</td>
                <td>{t.name}</td>
                <td className="muted small">
                  expects {t.shelf ? categoryById(t.shelf).label : 'no guess'}
                  {t.icon ? ` / ${t.icon}` : ''}
                </td>
                <td className="small">{pass ? '' : `got ${got ? `${categoryById(got.category).label} / ${got.icon}` : 'no guess'}`}</td>
                <td>
                  <button className="link danger" onClick={() => remove(i)}>
                    delete
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

// ───────────────────────── Reports ─────────────────────────

interface Report {
  id: string
  member_name: string
  message: string
  created_at: string
  kitchens?: { name: string } | null
  context: { iconGuess?: { name: string; guessed: { icon: string; category: CategoryId } | null; chosen: { icon: string; category: CategoryId } } }
}

function ReportsTab({ d, onTry }: { d: Draft; onTry: (p: Preset) => void }) {
  const [list, setList] = useState<Report[] | null>(null)
  const [err, setErr] = useState('')
  const load = () => api<Report[]>('/__tune/reports').then(setList, (e) => setErr(String(e.message)))
  useEffect(() => void load(), [])
  const mark = async (id: string, status: string, reply: string) => {
    await api('/__tune/reports', { id, status, reply })
    load()
  }
  if (err) return <p className="warn-text">{err}</p>
  if (!list) return <p className="muted">Loading reports…</p>
  if (!list.length) return <p className="muted">No open “wrong guess” reports. Housemates send them from the add-item sheet.</p>
  return (
    <section>
      <p className="muted">Sent from the app when someone fixes a guess and taps “Report wrong guess”.</p>
      {list.map((r) => {
        const g = r.context.iconGuess!
        const now = suggestFor(g.name, [], d.rules)
        const fixed = now?.icon === g.chosen.icon && now?.category === g.chosen.category
        return (
          <div key={r.id} className="report">
            <div>
              <strong>{g.name}</strong>
              <div className="muted small">
                guessed {g.guessed ? `${categoryById(g.guessed.category).label} / ${g.guessed.icon}` : 'nothing'} → chose{' '}
                <Svg node={d.icons[g.chosen.icon]?.node ?? []} size={14} /> {categoryById(g.chosen.category).label} / {g.chosen.icon}
              </div>
              <div className="muted small">
                {r.member_name} · {r.kitchens?.name} · {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
            <div className="row">
              {fixed ? <span className="pill ok">Fixed in your edits</span> : <span className="pill warn">Still guessed wrong</span>}
              <button className="btn" onClick={() => onTry({ name: g.name, icon: g.chosen.icon, shelf: g.chosen.category })}>
                Fix in “Try a name”
              </button>
              <button className="btn" onClick={() => mark(r.id, 'done', `Fixed: “${g.name}” now gets the right icon and shelf.`)}>
                Mark done
              </button>
              <button className="link" onClick={() => mark(r.id, 'wont_do', 'Kept as is: you can still pick the icon yourself.')}>
                won’t fix
              </button>
            </div>
          </div>
        )
      })}
      <p className="muted small">“Mark done” replies to the housemate in House → Feedback. Mark it after you’ve saved and pushed the fix.</p>
    </section>
  )
}

// ───────────────────────── page ─────────────────────────

type Setter = (f: (d: Draft) => Draft) => void
interface Preset {
  name: string
  icon: string
  shelf: CategoryId
}
/** Message left by a save just before the page reloaded itself (read once, outside React). */
const FLASH = sessionStorage.getItem('tune-flash') ?? ''
sessionStorage.removeItem('tune-flash')

const TABS = ['Try a name', 'Keywords', 'Icons', 'Tests', 'Reports'] as const

function App() {
  const [d, setD] = useState<Draft>(loadDraft)
  const [tab, setTab] = useState<(typeof TABS)[number]>(() => (sessionStorage.getItem('tune-tab') as (typeof TABS)[number]) || 'Try a name')
  const [preset, setPreset] = useState<Preset | null>(null)
  const [status, setStatus] = useState(FLASH)
  const set: Setter = (f) =>
    setD((x) => {
      const n = f(x)
      sessionStorage.setItem(STORE, JSON.stringify(n))
      return n
    })
  useEffect(() => sessionStorage.setItem('tune-tab', tab), [tab])

  const dirty = d.dirty.icons || d.dirty.rules || d.dirty.tests
  const failing = testResults(d).filter((r) => !r.pass).length
  const unknownIcons = [...new Set(d.rules.map((r) => r.icon).filter((k) => !d.icons[k]))]

  useEffect(() => {
    // While saving, the page reloads itself on purpose: don't ask.
    const warn = (e: BeforeUnloadEvent) => dirty && !sessionStorage.getItem('tune-flash') && e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const saveAll = async () => {
    const parts: Record<string, unknown> = {}
    if (d.dirty.tests) parts.tests = d.tests
    if (d.dirty.rules) parts.keywords = d.rules
    if (d.dirty.icons) parts.icons = d.icons
    const before = sessionStorage.getItem(STORE)
    try {
      setStatus('Saving…')
      // Writing the files reloads this page (it imports them), so store the clean state first.
      sessionStorage.setItem(STORE, JSON.stringify({ ...d, dirty: { icons: false, rules: false, tests: false } }))
      sessionStorage.setItem('tune-flash', 'Saved to src/catalog/. Try it in the app, then commit and push to ship it.')
      await api('/__tune/save', parts)
      setD((x) => ({ ...x, dirty: { icons: false, rules: false, tests: false } }))
      setStatus(sessionStorage.getItem('tune-flash') ?? '')
    } catch (e) {
      if (before) sessionStorage.setItem(STORE, before)
      sessionStorage.removeItem('tune-flash')
      setStatus('Save failed: ' + (e as Error).message)
    }
  }
  const discard = () => {
    if (!confirm('Throw away unsaved changes?')) return
    sessionStorage.removeItem(STORE)
    location.reload()
  }

  return (
    <div className="tune">
      <header>
        <div>
          <h1>Tune icons & keywords</h1>
          <p className="muted small">Dev only · edits stay in this tab until you save · <a href="/">open the app</a></p>
        </div>
        <div className="row">
          <span className={'pill ' + (failing ? 'warn' : 'ok')}>{failing ? `${failing} test${failing > 1 ? 's' : ''} failing` : 'Tests pass'}</span>
          {dirty && (
            <span className="pill warn">
              Unsaved: {[d.dirty.rules && 'keywords', d.dirty.icons && 'icons', d.dirty.tests && 'tests'].filter(Boolean).join(', ')}
            </span>
          )}
          {dirty && (
            <button className="btn" onClick={discard}>
              Discard
            </button>
          )}
          <button className="btn btn-primary" disabled={!dirty || unknownIcons.length > 0} onClick={saveAll}>
            Save to code
          </button>
        </div>
      </header>
      {unknownIcons.length > 0 && <p className="warn-text">Rules use icons that don’t exist: {unknownIcons.join(', ')}</p>}
      {status && <p className="status">{status}</p>}
      <nav>
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      {tab === 'Try a name' && <TryTab d={d} set={set} preset={preset} />}
      {tab === 'Keywords' && <KeywordsTab d={d} set={set} />}
      {tab === 'Icons' && <IconsTab d={d} set={set} />}
      {tab === 'Tests' && <TestsTab d={d} set={set} />}
      {tab === 'Reports' && (
        <ReportsTab
          d={d}
          onTry={(p) => {
            setPreset(p)
            setTab('Try a name')
          }}
        />
      )}
    </div>
  )
}

createRoot(document.getElementById('tune')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/**
 * The hidden Kitchen Arcade (tap the top-bar logo 7 times). Two tiny games; best
 * scores are kept on this phone only (localStorage), nothing touches the database.
 */
import { useEffect, useRef, useState } from 'react'
import { ICON_SIZES } from '../config'
import { UI } from '../icons'
import type { Game, GameEvents } from './canvas'
import { createShelfBreaker } from './shelfBreaker'
import { createStackShelf } from './stackShelf'

type GameId = 'breaker' | 'stack'

const GAMES: Record<GameId, { title: string; blurb: string; create: (c: HTMLCanvasElement, ev: GameEvents) => Game; lives: boolean }> = {
  breaker: {
    title: 'Shelf Breaker',
    blurb: 'Bounce the pea off the cutting board and clear the shelves. Tins take two hits.',
    create: createShelfBreaker,
    lives: true,
  },
  stack: {
    title: 'Stack the Shelf',
    blurb: 'Tap to drop each tin. Overhangs get sliced off. How high can you go?',
    create: createStackShelf,
    lives: false,
  },
}

const BEST_KEY = 'kc-arcade-best'
function readBest(): Partial<Record<GameId, number>> {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}')
  } catch {
    return {}
  }
}
function saveBest(id: GameId, score: number) {
  const all = readBest()
  if (score <= (all[id] ?? 0)) return false
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify({ ...all, [id]: score }))
  } catch {
    /* private mode */
  }
  return true
}

export default function Arcade({ onClose }: { onClose: () => void }) {
  const [game, setGame] = useState<GameId | null>(null)
  const [best, setBest] = useState(readBest)

  // Keep the page behind still while playing.
  useEffect(() => {
    document.body.classList.add('no-scroll')
    return () => document.body.classList.remove('no-scroll')
  }, [])

  return (
    <div className="arcade" role="dialog" aria-label="Kitchen Arcade">
      <header className="arcade-head">
        {game ? (
          <button className="icon-btn" onClick={() => setGame(null)} aria-label="Back to games">
            <UI.back size={ICON_SIZES.button + 2} />
          </button>
        ) : (
          <span className="arcade-spacer" />
        )}
        <h2>{game ? GAMES[game].title : 'Kitchen Arcade'}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close the arcade">
          <UI.close size={ICON_SIZES.button + 2} />
        </button>
      </header>
      {game ? (
        <Play id={game} best={best[game] ?? 0} onBest={() => setBest(readBest())} />
      ) : (
        <div className="arcade-menu">
          <p className="muted small center">You found the secret arcade.</p>
          {(Object.keys(GAMES) as GameId[]).map((id) => (
            <button key={id} className="arcade-card" onClick={() => setGame(id)}>
              <strong>{GAMES[id].title}</strong>
              <span className="muted small">{GAMES[id].blurb}</span>
              <span className="arcade-best">Best: {best[id] ?? 0}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Play({ id, best, onBest }: { id: GameId; best: number; onBest: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<Game | null>(null)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [over, setOver] = useState<{ score: number; record: boolean } | null>(null)

  useEffect(() => {
    engine.current = GAMES[id].create(canvas.current!, {
      onScore: setScore,
      onLives: setLives,
      onOver: (s) => {
        const record = saveBest(id, s)
        if (record) onBest()
        setOver({ score: s, record })
      },
    })
    return () => engine.current?.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const again = () => {
    setOver(null)
    setLives(3)
    engine.current?.restart()
  }

  return (
    <div className="arcade-play">
      <div className="arcade-hud">
        <span>
          Score <strong>{score}</strong>
        </span>
        {GAMES[id].lives && <span>{'●'.repeat(Math.max(0, lives)) || '–'}</span>}
        <span>
          Best <strong>{Math.max(best, score)}</strong>
        </span>
      </div>
      <div className="arcade-stage">
        <canvas ref={canvas} className="arcade-canvas" />
      </div>
      {over && (
        <div className="arcade-over">
          <div className="arcade-over-card">
            <h3>{over.record && over.score > 0 ? 'New best!' : 'Game over'}</h3>
            <p className="arcade-score">{over.score}</p>
            <button className="btn btn-primary btn-block" onClick={again}>
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

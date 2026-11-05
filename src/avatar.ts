/**
 * Profile avatars built with DiceBear's "sprouts" style (CC0 licence):
 * a potted plant with a face. The choices offered come straight from the
 * style definition, so they stay in sync with the installed package.
 */
import { Avatar, Style } from '@dicebear/core'
import sprouts from '@dicebear/styles/sprouts.json'

export interface AvatarConfig {
  plant: string
  pot: string
  /** Pot pattern, or null for a plain pot. */
  pattern: string | null
  /** Blush/freckles, or null for none. */
  cheeks: string | null
  eyes: string
  mouth: string
  potColor: string
  plantColor: string
  bloomColor: string
}

type Def = {
  components: Record<string, { variants?: Record<string, unknown> }>
  colors: Record<string, { values: string[] }>
}
const def = sprouts as unknown as Def
const style = new Style(sprouts as ConstructorParameters<typeof Style>[0])

const variants = (component: string) => Object.keys(def.components[component]?.variants ?? {})
const colors = (name: string) => def.colors[name]?.values ?? []

/** Everything the creator can offer, read from the style. */
export const AVATAR_PARTS = {
  plant: variants('plant'),
  pot: variants('pot'),
  pattern: variants('pattern'),
  cheeks: variants('cheeks'),
  eyes: variants('eyes'),
  mouth: variants('mouth'),
  potColor: colors('pot'),
  plantColor: colors('plant'),
  bloomColor: colors('bloom'),
}

/** "bigPupils" → "Big pupils" */
export const partLabel = (v: string) => {
  const s = v.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

export function randomAvatar(): AvatarConfig {
  return {
    plant: pick(AVATAR_PARTS.plant),
    pot: pick(AVATAR_PARTS.pot),
    pattern: Math.random() < 0.45 ? pick(AVATAR_PARTS.pattern) : null,
    cheeks: Math.random() < 0.3 ? pick(AVATAR_PARTS.cheeks) : null,
    eyes: pick(AVATAR_PARTS.eyes),
    mouth: pick(AVATAR_PARTS.mouth),
    potColor: pick(AVATAR_PARTS.potColor),
    plantColor: pick(AVATAR_PARTS.plantColor),
    bloomColor: pick(AVATAR_PARTS.bloomColor),
  }
}

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
const oneOf = (v: unknown, list: string[], fallback: string) => (typeof v === 'string' && list.includes(v) ? v : fallback)

/** Turns whatever is stored in the database into a valid config (or null). */
export function normalizeAvatar(raw: unknown): AvatarConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const P = AVATAR_PARTS
  return {
    plant: oneOf(r.plant, P.plant, P.plant[0]),
    pot: oneOf(r.pot, P.pot, P.pot[0]),
    pattern: r.pattern == null ? null : oneOf(r.pattern, P.pattern, P.pattern[0]),
    cheeks: r.cheeks == null ? null : oneOf(r.cheeks, P.cheeks, P.cheeks[0]),
    eyes: oneOf(r.eyes, P.eyes, P.eyes[0]),
    mouth: oneOf(r.mouth, P.mouth, P.mouth[0]),
    potColor: isHex(r.potColor) ? r.potColor : P.potColor[0],
    plantColor: isHex(r.plantColor) ? r.plantColor : P.plantColor[0],
    bloomColor: isHex(r.bloomColor) ? r.bloomColor : P.bloomColor[0],
  }
}

const cache = new Map<string, string>()

/** SVG data URI for an avatar on the given background colour (the profile colour). */
export function avatarUri(cfg: AvatarConfig, background: string): string {
  const key = JSON.stringify(cfg) + background
  const hit = cache.get(key)
  if (hit) return hit
  const uri = new Avatar(style, {
    seed: 'kitchen-cupboard',
    plantVariant: cfg.plant,
    potVariant: cfg.pot,
    patternProbability: cfg.pattern ? 100 : 0,
    ...(cfg.pattern ? { patternVariant: cfg.pattern } : {}),
    cheeksProbability: cfg.cheeks ? 100 : 0,
    ...(cfg.cheeks ? { cheeksVariant: cfg.cheeks } : {}),
    eyesVariant: cfg.eyes,
    mouthVariant: cfg.mouth,
    animationVariant: 'none',
    potColor: [cfg.potColor],
    plantColor: [cfg.plantColor],
    bloomColor: [cfg.bloomColor],
    backgroundColor: [background],
  } as ConstructorParameters<typeof Avatar>[1]).toDataUri()
  if (cache.size > 400) cache.clear()
  cache.set(key, uri)
  return uri
}

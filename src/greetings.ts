/**
 * The greeting next to the logo in the top bar ("Ahoy, Sam").
 *
 * A new one is picked when the app opens, when someone switches profile, and when
 * the app comes back after 30+ minutes in the background. It never changes between
 * pages. Every greeting that fits the time of day is equally likely, and the last
 * few shown on this phone are skipped so it doesn't repeat.
 *
 * Edit the list freely: `{name}` is replaced by the profile name. Keep the words
 * around the name short (18 characters at most; `npm run test:greetings` checks): the top bar fits ~25 in total and
 * names can be 20 long (longer ones end in "…"). No emoji (app rule).
 */

/** Hours (24h, local time) a greeting may be shown. Omit for any time. */
type When = 'morning' | 'afternoon' | 'evening' | 'late'

const HOURS: Record<When, (h: number) => boolean> = {
  morning: (h) => h >= 5 && h < 12,
  afternoon: (h) => h >= 12 && h < 17,
  evening: (h) => h >= 17 && h < 23,
  late: (h) => h >= 23 || h < 5,
}

export const GREETINGS: { text: string; when?: When }[] = [
  // The original
  { text: 'Hi, {name}' },

  // Far too formal for a cupboard
  { text: 'Good day, {name}' },
  { text: 'Greetings, {name}' },
  { text: 'Salutations, {name}' },
  { text: 'Welcome back, {name}' },
  { text: 'At your service, {name}' },
  { text: 'We meet again, {name}' },
  { text: 'Ah, {name}' },

  // Everyday British
  { text: 'Hiya, {name}' },
  { text: 'Alright, {name}?' },
  { text: 'Oi oi, {name}' },
  { text: 'Hey hey, {name}' },
  { text: 'Wagwan, {name}' },
  { text: 'Cheers, {name}' },

  // Quirky
  { text: 'Ahoy, {name}' },
  { text: 'Howdy, {name}' },
  { text: 'Hola, {name}' },
  { text: 'Bonjour, {name}' },
  { text: 'Ciao, {name}' },
  { text: 'Hallo, {name}' },
  { text: '{name}’s back!' },
  { text: 'All yours, {name}' },

  // Kitchen
  { text: 'Chef {name}' },
  { text: 'Hungry, {name}?' },
  { text: 'Kettle’s on, {name}' },
  { text: 'Snack time, {name}' },
  { text: 'Back again, {name}?' },
  { text: 'Peckish, {name}?' },

  // Time of day
  { text: 'Morning, {name}', when: 'morning' },
  { text: 'Rise and dine, {name}', when: 'morning' },
  { text: 'Afternoon, {name}', when: 'afternoon' },
  { text: 'Lunch, {name}?', when: 'afternoon' },
  { text: 'Evening, {name}', when: 'evening' },
  { text: 'Dinner plans, {name}?', when: 'evening' },
  { text: 'Midnight snack, {name}?', when: 'late' },
  { text: 'Up late, {name}?', when: 'late' },
]

/** How many recent greetings to skip, so the same one doesn't come back too soon. */
const NO_REPEAT = 5
/** Background time after which reopening the app counts as a new open. */
export const REOPEN_AFTER_MS = 30 * 60 * 1000

const RECENT_KEY = 'kc-recent-greetings'

function readRecent(): string[] {
  try {
    const r = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(r) ? r : []
  } catch {
    return []
  }
}

/**
 * Picks a greeting template for this time of day, avoiding the last few shown.
 * `recent` and `random` are parameters so it can be tested.
 */
export function pickGreeting(now = new Date(), recent: string[] = readRecent(), random = Math.random): string {
  const h = now.getHours()
  const fits = GREETINGS.filter((g) => !g.when || HOURS[g.when](h))
  const fresh = fits.filter((g) => !recent.includes(g.text))
  const pool = fresh.length ? fresh : fits
  return pool[Math.floor(random() * pool.length)].text
}

/** Picks a greeting and remembers it on this phone. */
export function nextGreeting(): string {
  const text = pickGreeting()
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([text, ...readRecent().filter((t) => t !== text)].slice(0, NO_REPEAT)))
  } catch {
    /* private mode: repeats are possible, that's fine */
  }
  return text
}

export const fillGreeting = (template: string, name: string) => template.replace('{name}', name)

// ───────────────────────── the current greeting ─────────────────────────

/** Kept outside React so tab changes, reconnects and re-renders never change it. */
let current: { profile: string; text: string } | null = null
let hiddenAt = 0

/** The greeting template to show for this profile right now. */
export function currentGreeting(profileId: string): string {
  if (!current || current.profile !== profileId) current = { profile: profileId, text: nextGreeting() }
  return current.text
}

/** Call when the app becomes visible again: after 30+ minutes away it counts as a new open. */
export function onVisibilityChange(hidden: boolean): boolean {
  if (hidden) {
    hiddenAt = Date.now()
    return false
  }
  const reopened = hiddenAt > 0 && Date.now() - hiddenAt >= REOPEN_AFTER_MS
  hiddenAt = 0
  if (reopened) current = null
  return reopened
}

/**
 * Motion helpers. Durations live in CSS (src/theme.css → Motion);
 * these let JavaScript wait for an animation to finish at the same speed.
 */

/** The `--motion` multiplier from the theme; 0 when the phone asks for reduced motion. */
export function motionScale() {
  if (typeof window === 'undefined') return 1
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--motion'))
  return Number.isFinite(v) ? Math.max(0, v) : 1
}

/** A duration in ms scaled like the CSS animations (`calc(Xms * var(--motion))`). */
export const motionMs = (base: number) => base * motionScale()

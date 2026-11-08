# Animations

All motion is plain CSS: no animation library. The timings came from the Claude Design prototype. There are three levels to tune: overall speed, the "feel", and single animations.

## 1. Overall speed

`src/theme.css` → `--motion`:

| Value | Effect |
| --- | --- |
| `1` | as designed |
| `2` | everything twice as slow (great for watching an animation closely) |
| `0.5` | twice as fast |
| `0` | no animation |

Every duration and delay is written as `calc(Xms * var(--motion))`, so this one number scales them all. JavaScript that waits for an animation (closing sheets, toasts) uses `motionMs()` from `src/motion.ts`, which reads the same value.

Phones with **Reduce motion** turned on (iPhone: Settings → Accessibility → Motion) get no animation automatically.

## 2. The feel (easing curves)

Also in `src/theme.css`:

| Variable | Used for | Character |
| --- | --- | --- |
| `--ease-spring` | cards, badges, presses | bouncy overshoot |
| `--ease-bounce` | run card, tab pill, toasts, profile tiles | gentler overshoot |
| `--ease-soft` | fades and slides | smooth ease-out |
| `--ease-sheet` | bottom sheets rising | slight overshoot |
| `--ease-exit` | things leaving the screen | accelerates away |

Design curves at [cubic-bezier.com](https://cubic-bezier.com) or [easings.net](https://easings.net), then paste the four numbers. A second number above 1 (e.g. `cubic-bezier(.34, 1.56, .64, 1)`) gives the overshoot "spring".

## 3. A single animation

The **MOTION** section near the end of `src/styles.css`. Each block is labelled:

| Label in the CSS | What moves |
| --- | --- |
| *Page title fades up…* | The big title when you switch tabs |
| *Tab bar: one pill slides…* | The highlight behind the active tab |
| *Shelves: the glass slides in…* | Shelves arrive one after another; cards spring up 40ms apart |
| *"xN" badge pops…* | The count badge on shared items |
| *After the first load…* | New cards/badges added later animate immediately |
| *Plus button rises in…* | The **+** button growing into the *Add ingredients* card |
| *Sheets…* | Bottom sheets: drag by the handle, slide away on close |
| *Item sheet: owner chips…* | Owner names sliding in one by one |
| *Groceries* | Live run card dropping in, shop buttons popping, tick marks drawing, new rows |
| *Profile picker* | Tiles rising, avatars gently swaying, "add" breathing, colour flood when opening |
| *Receipt scanning* (own section) | The scan line moving over the photo |

A rule looks like this:

```css
.store-btn { animation: kc-pop-soft calc(340ms * var(--motion)) var(--ease-spring) backwards;
             animation-delay: calc((160ms + var(--i, 0) * 60ms) * var(--motion)); }
```

It says: use the `kc-pop-soft` movement, over 340ms, with the spring curve. Each button waits 160ms, plus 60ms times its position (`--i`), so they cascade.

- **Slower or faster:** change `340ms`.
- **Different stagger:** change `60ms`.
- **Different movement:** use another `kc-…` name. The movements (`@keyframes`) are listed at the top of the MOTION section:
  - `kc-fade`, `kc-fade-up`, `kc-rise`: appear
  - `kc-pop`, `kc-pop-soft`: scale in with a bounce
  - `kc-glass`: shelves sliding in
  - `kc-morph`, `kc-morph-out`: the + button into the card, and back
  - `kc-chip`, `kc-drop`, `kc-row-in`: slide in from a side
  - `kc-sway`, `kc-breathe`: idle loops
- **Remove one:** delete its `animation:` line, or set its duration to `0ms`.

### Adding a new animation

1. Give the element a class in its component, e.g. `className="note"`.
2. Add a rule in the MOTION section, reusing a keyframe and an easing variable, and **always** multiply time by `var(--motion)`:
   ```css
   .note { animation: kc-fade-up calc(300ms * var(--motion)) var(--ease-soft) backwards; }
   ```
   `backwards` keeps the element hidden during its delay.
3. Use **transform** and **opacity** only. They stay smooth on phones, whereas animating `width`, `height`, `top` or `margin` stutters.

## Watching and debugging

- Set `--motion: 3` temporarily to see what's happening.
- In Chrome devtools, open ⋮ → More tools → **Animations**. It records every animation on the page, and you can replay it at 10% speed and drag the timing bars.
- Animations only run while the tab is visible. A background tab looks frozen; that's normal.

## Bigger changes

To rethink motion (new transitions, gestures), it's cheaper to design it visually first than to iterate in code:

1. Prototype it in **Claude Design** (or describe one screen). Iterate there until it feels right; the prototype is cheap to change.
2. Ask Claude Code to port it: *"Port the animations from this prototype into the MOTION section, using the existing easing variables and `var(--motion)`."*
3. Do it on a branch so you can compare, or roll back. This is how the current animations were added (the `pre-animations` tag is the version before). See [shipping.md](shipping.md).

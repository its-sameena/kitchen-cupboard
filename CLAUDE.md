# Kitchen Cupboard

Phone-first PWA (Vite + React + TypeScript) on Supabase. See README.md for setup.

## Architecture
- `src/store.ts`: the only data layer. Anonymous Supabase auth per device → `devices` row links the device to a kitchen → the chosen profile (`members.id`) is remembered in localStorage and passed as `p_me` to every RPC.
- `supabase/migrations/*.sql`: schema, RLS and all write RPCs (SECURITY DEFINER, atomic). The client only writes directly to `members(name,color,seen_at)`, `kitchens(name)`, deletes on `items`/`grocery`, and its own `push_subscriptions`.
- `supabase/functions/notify`: Web Push for an event id; called by the client after an RPC returns one.
- UI customisation points: `src/theme.css` (colours, fonts, per-shelf glass colours, card size, motion tokens), `src/config.ts` (tab order, icon sizes, shelf item order, shops), `src/icons.tsx` (UI + shelf icons, Lucide), `src/data.ts` (shelves, guesser logic, profile colours). Don't use emoji in the UI. User-facing guides are in `docs/`; keep them in sync when changing these.
- Item icons and keywords are data in `src/catalog/` (`item-icons.ts` = drawings as 24×24 SVG nodes, `keywords.ts`, `keyword-tests.ts`). The dev-only tuning page (`npm run tune`, `tools/tune/`, Vite plugin with `apply: 'serve'`) rewrites them; keep their format serializable (see `tools/tune/serialize.mjs`). Item icon keys are stored in the `emoji` DB column: never rename/remove one in use. If the user asks to change keywords/icons, suggest the tuning page first.
- Avatars: optional DiceBear "sprouts" config in `members.avatar` (jsonb, NULL = initials), rendered client-side by `src/avatar.ts`; background = profile colour. Shown via the shared `Avatar` component.
- Motion: all animation is CSS (motion tokens in `src/theme.css` + MOTION section in `src/styles.css`); durations are `calc(Xms * var(--motion))`. JS waits for animations with `motionMs()` from `src/motion.ts` so it respects `--motion` and reduced motion.
- Trust model: housemates trust each other. Any connected phone can act as any profile in its kitchen. Don't add per-user auth unless asked.

## Checks
- `npm run test:db`: runs the migrations in PGlite with RLS and exercises every flow. Update it whenever SQL changes.
- `npx tsc --noEmit -p .` and `npm run build`.
- Edge functions: `cd supabase/functions/<name> && deno check index.ts` (notify, scan-receipt).
- `npm run test:suggest` after changing keywords or the guesser; add a case to `src/catalog/keyword-tests.ts` for every reported bad guess.
- `npm run check:catalog` after changing ITEM_ICONS or CATEGORIES: scan-receipt keeps its own copy.
- Schema changes after the project is live go in a NEW migration file, never by editing the existing one.
- Apply a new migration to the live database with `npx supabase db query --remote -f supabase/migrations/<file>.sql`. Never `supabase db push`: earlier migrations were run in the SQL editor, so the CLI's history is empty and it would re-run all of them.

## Roadmap
Feature ideas and their status live in `docs/roadmap.md`. Update it when one is built (move it to Done) or a new idea is agreed.

## User feedback workflow
When asked to "check feedback" (or similar):
1. `npm run feedback` lists open items with context (screen, version, device).
2. Summarise them for the user, group duplicates, and propose fixes. Ask before implementing.
3. After a fix ships, mark it: `npm run feedback -- set <id> done "short reply shown to housemates"`.
   Use `planned` / `in_progress` / `wont_do` (with a reason) as appropriate.
4. Bump `version` in package.json when shipping fixes; it is attached to new feedback.

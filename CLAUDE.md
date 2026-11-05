# Kitchen Cupboard

Phone-first PWA (Vite + React + TypeScript) on Supabase. See README.md for setup.

## Architecture
- `src/store.ts`: the only data layer. Anonymous Supabase auth per device → `devices` row links the device to a kitchen → the chosen profile (`members.id`) is remembered in localStorage and passed as `p_me` to every RPC.
- `supabase/migrations/*.sql`: schema, RLS and all write RPCs (SECURITY DEFINER, atomic). The client only writes directly to `members(name,color,seen_at)`, `kitchens(name)`, deletes on `items`/`grocery`, and its own `push_subscriptions`.
- `supabase/functions/notify`: Web Push for an event id; called by the client after an RPC returns one.
- UI customisation points: `src/styles.css` THEME block (colours, fonts, per-shelf glass colours, card size), `src/config.ts` (tab order, icon sizes), `src/icons.tsx` (all icons, Lucide), `src/data.ts` (shelves, suggestions, profile colours). Don't use emoji in the UI. Item icons are stored as keys of `ITEM_ICONS` in the `emoji` DB column.
- Avatars: optional DiceBear "sprouts" config in `members.avatar` (jsonb, NULL = initials), rendered client-side by `src/avatar.ts`; background = profile colour. Shown via the shared `Avatar` component.
- Trust model: housemates trust each other. Any connected phone can act as any profile in its kitchen. Don't add per-user auth unless asked.

## Checks
- `npm run test:db`: runs the migrations in PGlite with RLS and exercises every flow. Update it whenever SQL changes.
- `npx tsc --noEmit -p .` and `npm run build`.
- Edge function: `cd supabase/functions/notify && deno check index.ts`.
- Schema changes after the project is live go in a NEW migration file, never by editing the existing one.

## User feedback workflow
When asked to "check feedback" (or similar):
1. `npm run feedback` lists open items with context (screen, version, device).
2. Summarise them for the user, group duplicates, and propose fixes. Ask before implementing.
3. After a fix ships, mark it: `npm run feedback -- set <id> done "short reply shown to housemates"`.
   Use `planned` / `in_progress` / `wont_do` (with a reason) as appropriate.
4. Bump `version` in package.json when shipping fixes; it is attached to new feedback.

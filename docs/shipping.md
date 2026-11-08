# Shipping updates safely

The live site at Vercel is what your housemates use. This is the routine for changing it without breaking their day, or their data.

## The routine

```text
branch  →  push  →  Vercel preview (test on your phone)  →  merge to main  →  live
```

1. **Start a branch:** `git checkout -b feature/short-name` (or ask Claude: "do this on a new branch").
2. **Make and test the change locally:** `npm run dev`.
3. **Run the checks** that apply:
   ```bash
   npx tsc --noEmit -p .      # types
   npm run build              # it builds
   npm run test:suggest       # icon/shelf guesses (after keyword changes)
   npm run check:catalog      # after icon or shelf changes
   npm run test:db            # after any SQL change
   ```
4. **Push the branch:** `git push -u origin feature/short-name`. Vercel builds a **preview** with its own URL; find it on the Vercel dashboard under Deployments. Your housemates keep using `main`.
5. **Test the preview on your phone.** Remember that it uses the **same live database** as everyone else.
6. **Ship it:** merge to `main` (on GitHub, or `git checkout main && git merge feature/short-name && git push`). Vercel deploys it to the live URL. Open phones pick it up on their next launch.
7. **Bump `version` in `package.json`** when shipping fixes; it's attached to new feedback, so you know which version a report came from.

To undo a release, revert the merge commit on `main` and push. Vercel also lets you "Promote" an older deployment instantly.

## Database changes (migrations)

The preview and the live site share one database, so **database changes go live the moment you run them**, before you merge. Make them *additive* (new columns, new allowed values, new functions), so the old app keeps working until the new one ships.

1. Never edit an existing file in `supabase/migrations/`. Add a new one, e.g. `20261201000000_what_it_does.sql`. End it with `notify pgrst, 'reload schema';`.
2. Test it locally: `npm run test:db` (add checks for it in `scripts/test-db.mjs`).
3. Apply **only that file** to the live database:
   ```bash
   npx supabase db query --remote -f supabase/migrations/<file>.sql
   ```
   **Never** run `supabase db push`. The earlier migrations were run in the SQL editor, so the CLI thinks none have run and would re-run them all. Also never run `supabase/reset.sql` now that the app is live, because it deletes everything.
4. `npm run db:status` shows which migrations the live database has.

Adding a **shelf** is the common case. It needs:
- a migration that widens the `items_category_check` constraint (see `20261108000000_cereals_shelf.sql`)
- the shelf added in `src/data.ts` (`CATEGORIES`), `src/types.ts` (`CategoryId`), `src/icons.tsx` (`CATEGORY_ICONS`, `DEFAULT_ITEM_ICON`) and `src/theme.css` (`--shelf-<id>`)
- the scanner's `CATEGORIES` list and prompt in `supabase/functions/scan-receipt/index.ts`

## Edge functions

These run on Supabase, not Vercel, so pushing to GitHub doesn't update them. They deploy straight to production:

```bash
npx supabase functions deploy scan-receipt   # after icon/shelf changes, or scanner changes
npx supabase functions deploy notify         # after notification changes
```

Deploy them when you merge, not before, unless the change is backwards-compatible.

## Feedback

After a fix ships:

```bash
npm run feedback -- set <id> done "Fixed in 0.9 – thanks!"
```

The reply shows to housemates in **House → Feedback**. Icon reports can also be closed from the tuning page's **Reports** tab.

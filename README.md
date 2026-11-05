# Kitchen Cupboard

A phone-first PWA for a shared kitchen: see who has what on a wooden "shared cupboard", ask whoever's at the shops to pick things up, and keep a shared grocery list. Backed by Supabase (anonymous device auth, Postgres, realtime) with Web Push notifications. No passwords: each phone joins the kitchen once, then you pick your profile.

## One-time setup (≈10 minutes)

### 1. Create the Supabase project
1. Sign up at [supabase.com](https://supabase.com) and create a free project.
2. Open **SQL Editor → New query**, paste all of `supabase/migrations/20261104000000_kitchen_cupboard.sql`, and click **Run**. Then do the same for each newer file in `supabase/migrations/`, oldest first.
   If you ran an *earlier* version of this file, run `supabase/reset.sql` first. It deletes the old tables and their data.
3. **Authentication → Sign In / Providers** → turn on **Allow anonymous sign-ins**. Phones connect silently this way; nobody needs an email or password.
4. In **Project Settings → API**, copy these into `.env.local`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co   # just the project URL, no /rest/v1/
   VITE_SUPABASE_ANON_KEY=eyJ...          # anon / publishable key
   SUPABASE_SERVICE_ROLE_KEY=eyJ...       # service_role key: only for `npm run feedback`, never shipped
   ```
   (`VITE_VAPID_PUBLIC_KEY` is already filled in.)

### 2. Deploy the push-notification function
```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy notify
```
`supabase/functions/.env` holds the generated VAPID key pair (gitignored). Edit `VAPID_SUBJECT` to your own email address first.
The app works without this step; the only difference is that housemates won't get phone notifications.

### 3. Run it
```bash
npm install
npm run dev
```

## Putting it online (so your laptop isn't needed)

The database, realtime and push already run on Supabase. Two pieces need deploying:

**A. Push function (once, runs on Supabase).** Set `VAPID_SUBJECT` in `supabase/functions/.env` to `mailto:` + your email, then:
```bash
npx supabase login
npx supabase link --project-ref rhjpjuzojwbeakfybxjx
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy notify
```

**B. The app (Vercel, free).** `vercel.json` is already set up.
```bash
npx vercel login
npx vercel link                                   # create the project, accept the defaults
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel env add VITE_VAPID_PUBLIC_KEY production
npx vercel --prod                                 # prints your https://….vercel.app URL
```
Paste each value from `.env.local` when asked. Never add `SUPABASE_SERVICE_ROLE_KEY` to Vercel.
To ship an update later, run `npx vercel --prod` again. Open phones pick it up on their next launch.

Note: free Supabase projects pause after about a week with no activity. Daily use keeps yours awake; if it does pause, click **Restore** in the dashboard.

## Using it with your housemates

1. On the first phone, tap **Start a new one** to create the kitchen. Then **Add profile** for yourself; you can add profiles for your housemates too.
2. In the **House** tab, tap **Invite** to share a link with the 6-character kitchen code.
3. Each housemate opens the link once to connect their phone, then picks their profile on the Netflix-style **Who's in the kitchen?** screen. The phone remembers the choice. **House → Switch profile** changes it.
4. On iPhone: **Share → Add to Home Screen**, open it from there, then **House → Turn on notifications** (iOS 16.4+).

## Feedback loop

Anyone can tap the speech-bubble icon in the top bar (or **House → Send feedback**) to report a bug or suggest an idea. The app records the screen, app version and device with each message. Everyone sees the list and its status in **House → Feedback**. Tap your own feedback there to edit or delete it.

To work through it with Claude Code, just say "check the app feedback". Claude runs:
```bash
npm run feedback                 # open items, as markdown
npm run feedback -- --all        # everything
npm run feedback -- set <id> done "Fixed in v0.3 – thanks!"   # status + reply shown in the app
```

## Customising the look

Run `npm run dev` and keep the app open while you edit: changes appear instantly. To see it at phone size on a computer, open the browser's developer tools and switch on the device toolbar (Chrome: ⌘⇧M).
Or just describe what you want to Claude Code, e.g. *"make the buttons navy and use the Nunito font"*.

| What you want to change | Where | How |
| --- | --- | --- |
| **Colour scheme** | `src/styles.css`, the `THEME` block at the top | Every colour is a variable, e.g. `--primary` (main buttons), `--run` (grocery-run orange), `--cream` (page background), `--paper` (cards), `--ink` (text), the `--wood-*` shades (top bar and cupboard), `--brass` (shelf labels), `--jar-icon` (icons inside jars). Change a value and the whole app follows. |
| **Fonts** | `index.html` + the `THEME` block | Pick a font on [Google Fonts](https://fonts.google.com), paste its `<link>` where `index.html` shows an example, then set `--font-body` (and optionally `--font-heading`), e.g. `--font-body: 'Nunito', sans-serif;`. |
| **Order of pages (tabs)** | `src/config.ts` → `TABS` | The tab bar shows them left to right in array order: move a line to move a tab. `label` is the tab text, `title` the subtitle in the top bar. `DEFAULT_TAB` is the page the app opens on. |
| **Interface icons** (tabs, buttons, top bar, empty states) | `src/icons.tsx` → `UI` | Find an icon on [lucide.dev/icons](https://lucide.dev/icons), add its name (PascalCase, e.g. `ShoppingBasket`) to the `import` list, and point the entry at it, e.g. `cupboard: Refrigerator`. |
| **Shelf icons** | `src/icons.tsx` → `CATEGORY_ICONS` | Same as above, one per shelf. |
| **Item icons** (the ones you pick when adding food) | `src/icons.tsx` → `ITEM_ICONS` | Add entries to offer more icons, or change the icon/label of one. Keep existing keys (e.g. `'milk'`): they're saved in the database. |
| **Icons guessed from item names** | `src/data.ts` → `SUGGESTIONS` | e.g. `[['oat milk'], 'milk', 'dairy']` means "oat milk" gets the milk icon on the Dairy shelf. |
| **Icon sizes** | `src/config.ts` → `ICON_SIZES` | Sizes in pixels for jars, shelf labels, lists, tabs and buttons. |
| **Shelf order and names** | `src/data.ts` → `CATEGORIES` | Top-to-bottom order of the cupboard; change `label` to rename a shelf. Adding a brand-new shelf also needs a database change, so ask Claude. |
| **Profile colours** | `src/data.ts` → `USER_COLORS` | The colours housemates can pick for their highlight ring. |
| **Roundness, shadows** | `THEME` block | `--radius` (card corners) and `--shadow`. |
| **App name, home-screen icon, status-bar colour** | `vite.config.ts` (`manifest`), `index.html` (`<title>`, `theme-color`), `public/favicon.svg` | After editing `favicon.svg`, run `npm run icons` to regenerate the PNG app icons. |
| **Layout of a screen** | `src/components/` | `Cupboard.tsx`, `Groceries.tsx`, `House.tsx`, `Welcome.tsx` (setup + profile picker), `Feedback.tsx`; the tab bar and top bar are in `src/App.tsx`. Styles for each are in labelled sections of `src/styles.css`. |

After changing the look, phones get it on their next launch once the app is redeployed.

## How it works

- **Cupboard**: one shelf per category. Each item's ring is coloured by its owners (split when shared). A badge `xN` shows how many housemates have one.
- **I've run out** removes only *your* copy. When the last copy goes, the item turns grey and joins the grocery list.
- **Grocery run**: start a run → everyone is alerted → they **Ask** for list items or type new ones → the shopper ticks items off → **Finish run** restocks the cupboard. Requested items go to whoever asked; the rest go to the shopper.
- **Live sync**: every phone gets changes over Supabase Realtime. Each change is made by a Postgres function (`supabase/migrations/…sql`), so two people tapping at once can't corrupt the counts. Row Level Security limits each connected phone to its own kitchen.
- **Notifications**: the app calls the `notify` edge function after an action. The function sends Web Push to the right housemates: everyone for runs and out-of-stock items, only the shopper for requests.

## Development

```bash
npm run test:db   # runs the migrations in an in-memory Postgres (PGlite) and checks flows + RLS
npm run build
```

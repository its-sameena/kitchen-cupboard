# Kitchen Cupboard

A phone-first PWA for a shared kitchen: see who has what on glass shelves in a shared cupboard, ask whoever's at the shops to pick things up, and keep a shared grocery list. Backed by Supabase (anonymous device auth, Postgres, realtime) with Web Push notifications. No passwords: each phone joins the kitchen once, then you pick your profile.

## Guides

| Guide | For when you want to… |
| --- | --- |
| [Customising the app](docs/customising.md) | change colours, fonts, sizes, the order of tabs/shelves/items/shops, text, screen layout, shop logos |
| [Icons and keywords](docs/icons-and-keywords.md) | fix the icon/shelf guessed from a name, add icons from Lucide/Tabler, draw your own (`npm run tune`) |
| [Animations](docs/animations.md) | make motion faster, slower, bouncier, or change a single animation |
| [Receipt scanning speed](docs/receipt-speed.md) | see where scan time goes, and test faster Gemini settings with your own receipts (`npm run bench:receipts`) |
| [Shipping updates safely](docs/shipping.md) | test on a preview, change the database without losing data, deploy functions, roll back |
| [Roadmap](docs/roadmap.md) | see the feature ideas we've discussed, with effort and a recommended order |
| [Working with Claude](docs/working-with-claude.md) | turn an idea into the app quickly, and spend fewer tokens doing it |

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
   SUPABASE_SERVICE_ROLE_KEY=eyJ...       # service_role key: for `npm run feedback` and the tuning page's Reports; never shipped
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
The project is connected to GitHub, so pushing to `main` deploys the live site and every other branch gets a preview URL. See [Shipping updates safely](docs/shipping.md). Open phones pick up a new version on their next launch.

Note: free Supabase projects pause after about a week with no activity. Daily use keeps yours awake; if it does pause, click **Restore** in the dashboard.

### 4. Receipt scanning (optional, free)

**Add ingredients → Scan receipt** photographs a receipt and lists the groceries on it for you to check before adding. It uses Google's Gemini API through the `scan-receipt` function, so your key never reaches the app.

1. Get a free key at [Google AI Studio → API keys](https://aistudio.google.com/apikey). No card is needed. Don't link a billing account to that Google Cloud project if you want it to stay free: then you just hit a daily limit instead of being charged.
2. Store it as a Supabase secret and deploy the function:
   ```bash
   npx supabase secrets set GEMINI_API_KEY=AIza...   # ← paste your real key here (it starts with AIza)
   npx supabase functions deploy scan-receipt
   ```
3. Optional: `npx supabase secrets set GEMINI_MODEL=<model name>` to pin a model. By default it tries `gemini-flash-latest`, then falls back to others if one is unavailable or out of free quota.

**Free limits:** a few dozen to hundreds of scans per day depending on the model, far more than a household needs. Check your project's limits in AI Studio. When they run out, the app says so and works again the next day.
**Privacy:** on the free tier Google may use what you send (the receipt photo) to improve its products, and people may review it. Receipts show the shop, time and sometimes the last digits of a card. If that matters to you, crop those out or don't use scanning.

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

## How it works

- **Cupboard**: one glass shelf per category. Each item card is framed in its owners' colours (split into bands when shared). A badge `xN` shows how many housemates have one.
- **I've run out** removes only *your* copy. When the last copy goes, the item turns grey and joins the grocery list.
- **Grocery run**: start a run → everyone is alerted → they **Ask** for list items or type new ones → the shopper ticks items off → **Finish run** restocks the cupboard. Requested items go to whoever asked; the rest go to the shopper.
- **Live sync**: every phone gets changes over Supabase Realtime. Each change is made by a Postgres function (`supabase/migrations/…sql`), so two people tapping at once can't corrupt the counts. Row Level Security limits each connected phone to its own kitchen.
- **Notifications**: the app calls the `notify` edge function after an action. The function sends Web Push to the right housemates: everyone for runs and out-of-stock items, only the shopper for requests.

## Development

```bash
npm run dev           # the app, live-reloading (also on your phone via the Network URL)
npm run tune          # dev-only page for item icons and name → icon/shelf keywords
npm run feedback      # read in-app feedback (needs SUPABASE_SERVICE_ROLE_KEY)
npm run db:status     # which migrations your live Supabase database has
npm run test:db       # runs the migrations in an in-memory Postgres (PGlite) and checks flows + RLS
npm run test:suggest  # checks the icon/shelf guesser against the names in src/catalog/keyword-tests.ts
npm run bench:receipts # time and compare Gemini setups on photos in receipts/ (uses free quota)
npm run check:catalog # scan-receipt's shelf/icon lists match the app's; keyword rules use real icons
npm run build
```

Project map:

| Path | What |
| --- | --- |
| `src/theme.css` | Colours, fonts, sizes, motion speed |
| `src/styles.css` | All other styles, in labelled sections; animations in the MOTION section |
| `src/config.ts` | Tabs, icon sizes, shelf item order, shops |
| `src/data.ts` | Shelves, profile colours, the name → icon/shelf guesser |
| `src/catalog/` | Item icons, keyword rules, guesser tests (edited by `npm run tune`) |
| `src/icons.tsx` | Interface and shelf icons (Lucide) |
| `src/components/` | Screens |
| `src/store.ts` | The only data layer (Supabase calls) |
| `supabase/migrations/` | Database schema and functions |
| `supabase/functions/` | `notify` (push) and `scan-receipt` (Gemini) |
| `tools/tune/` | The tuning page (dev only, never deployed) |
| `docs/` | The guides above |

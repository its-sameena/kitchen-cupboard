# Receipt scanning speed

How long a scan takes, where the time goes, and how to test faster settings with your own receipts.

## Where the time goes

```text
1. Phone shrinks the photo          "Photo"   in the app's timing line
2. Upload to Supabase and back      "upload"
3. Supabase checks the phone        "server"  (only shown if noticeable)
4. Google: reading + thinking       ┐
5. Google: writing the list         ┘ "Google"
```

After a scan, the review sheet shows **Read in 6.4 s**. Tap it for the breakdown:

> Photo 0.3 s · upload 0.9 s · Google 5.1 s
> gemini-… · thinking 2,100 · answer 1,450 tokens · 240 KB photo

- **thinking** is how much Gemini reasoned privately before answering. That's pure waiting.
- **answer** is how much it wrote. A longer receipt means a longer answer, which takes longer.
- If **Google** is most of the time, the settings below are what matters. If **Photo** or **upload** is large, the photo size or mobile signal is the problem.

The same numbers are written to the function logs (Supabase → Edge Functions → scan-receipt → Logs, lines starting `scan-receipt ok`). They're also attached to any feedback sent within an hour of a scan, so a housemate's "scanning is slow" arrives with the numbers. `npm run feedback` prints them.

## Time limits

A scan never hangs:

| Limit | Where | Default | What happens |
| --- | --- | --- | --- |
| Whole scan, on the phone | `SCAN_TIMEOUT_MS` in `src/config.ts` | 15 s | The scan stops and the sheet offers **Scan again** (same photo) or **Try another photo**. A seconds counter shows while reading; after 8 s it says Google is slow. |
| Inside the function, all models | `TOTAL_BUDGET_MS` in `supabase/functions/scan-receipt/index.ts` | 13 s | Stops trying and replies "Google is slow right now", which the phone shows with **Scan again**. Keep it about 2 s under the phone's limit. |
| Per model | `PER_MODEL_MS`, same file | 9 s | A model that hasn't answered by then is skipped for the next (faster) one. |

Closing the sheet also cancels the scan.

## Testing settings on your Mac

1. **Add receipt photos.** Put 3–5 photos in `receipts/` in the project: a short one, a long one, a crumpled or badly lit one, and different shops. Crop out card numbers first.
   - The folder is gitignored, so photos and results never leave your Mac, except to Google when the benchmark runs. On the free tier, Google may use them to improve its products.
2. **Add your key.** Make sure `.env.local` has `GEMINI_API_KEY=AIza…`, the same key as the Supabase secret.
3. **Optional, for a true accuracy score:** for each photo, write the correct items, one per line, in a text file with the same name. For example, `receipts/lidl-long.txt` for `lidl-long.jpg`. Without it, every setup is compared against setup A (today's settings).
4. **Run:**
   ```bash
   npm run bench:receipts                 # all setups, 2 runs each
   npm run bench:receipts -- --runs 1     # half the calls
   npm run bench:receipts -- --only A,D   # just some setups
   ```
   It uses your free Gemini quota: setups × photos × runs calls, e.g. 5 × 4 × 2 = 40, with a pause between calls to stay under the per-minute limit.

### The setups

| | What changes | Why it might be faster |
| --- | --- | --- |
| **A** | Nothing: today's live settings | Baseline |
| **B** | Minimal thinking | Skips most of Gemini's private reasoning |
| **C** | B + slim answer: only name, quantity, "unsure" | Gemini writes far less. The app picks the shelf and icon with its own guesser (the tuning page's keywords). |
| **D** | C + 1,200px greyscale photo | Smaller upload, less for Gemini to read |
| **E** | D on the Flash-Lite model | A smaller, faster model |

The setups live at the top of `scripts/bench-receipts.mjs`; add your own lines to try other combinations. The prompt and answer shapes are in `supabase/functions/scan-receipt/gemini.ts`, shared with the live function, so a winning setup can be switched on exactly as tested.

### Reading the results

| Column | Meaning |
| --- | --- |
| Median time | Typical seconds per scan (from your Mac, so add the phone's photo and upload time) |
| Thinking / Answer tokens | Where Gemini's time went |
| Found | % of the reference items this setup also listed (higher = more accurate) |
| Extra | Items it listed that aren't in the reference (made up, or not groceries) |
| Shelf OK | Same shelf as the reference for matched items |
| → Other | Names the app's guesser couldn't place (slim setups). Fix them in `npm run tune`, and the number drops. |
| Busy retries | Times Google said "overloaded" (503) or "quota" (429). Each one costs seconds in the live app too. |

`receipts/bench-<date>.md` lists every item each setup found, per photo, with what's missing or extra. Read it to judge whether a "miss" matters (e.g. "Semi skimmed milk" vs "Milk" is fine).

## What we chose (v0.10, November 2026)

Benchmarks on 16 receipts (8 small web images, 8 full-size phone photos):

| | Today's setup on Flash | Flash-Lite, full answer | **Flash-Lite, shelf answer (chosen)** |
| --- | --- | --- | --- |
| Time (Mac → Google, median) | 6–7 s when it answers; often stalled or "overloaded" | 2.6 s | **1.6 s** |
| Free quota | 20 requests/day, 5/minute | 15/minute | 15/minute |
| Items found | | reference | same items (differences were only wording) |
| Shelf matches reference | | | 92–95%, nothing falls to Other |

Why: Gemini 3.8 Flash "thinks" before answering, is often overloaded, and its free tier allows only 20 requests a day for the whole household. Flash-Lite doesn't think, and asking only for name, quantity and shelf (not icon, printed line and confidence) roughly halves what it writes. The app picks icons with its own keywords.

The function has two **modes**: `fast` (sent by the app from v0.10: Flash-Lite first, Flash as backup, shelf answer, 6 s per model) and `classic` (older app versions: Flash first, full answer).

## Switching to another setup

In `supabase/functions/scan-receipt/index.ts`, change `MODES.fast` (models, answer shape, per-model time) to the winning setup, then deploy:

```bash
npx supabase functions deploy scan-receipt
```

The app already handles both answer shapes. With the slim shape it fills in shelf and icon with its own guesser. The photo size is set in `src/receipt.ts` (`photoToJpeg(file, max)`), and changing that needs a normal app release ([shipping.md](shipping.md)).

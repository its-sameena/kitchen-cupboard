# Roadmap

Feature ideas for Kitchen Cupboard, as discussed in November 2026. Nothing here is built yet unless marked. Pick one, then build it on a branch, test the preview, and merge (see [shipping.md](shipping.md)).

Effort: **tiny** (under an hour) · **small** (an evening) · **medium** (a few evenings) · **large** (a project).

## Recommended order

1. **Quick-wins bundle:** home-screen badge (4), running low (A), grocery list in shop order (E), changelog and tags (9), refresh old icons (10).
2. **Recipes with "What can I cook?"** (1 + C): the big idea from feedback.
3. **Use-by dates** (B), then the weekly digest (H).

## Discussed earlier

| # | Idea | What it gives you | Effort | Notes |
| --- | --- | --- | --- | --- |
| 1 | **Recipes with a "cookable" marker** | Save recipes; each shows "cookable" or "missing 2 items" from what's on the shelves. One tap adds missing items to the grocery list. | Medium–large | From feedback 0e43a0af. New tables, a Recipes screen. |
| 2 | **Calorie tracker** | Log what you eat from the cupboard. | Large | Same feedback. A different kind of app; revisit after recipes. |
| 3 | **Scan the receipt at Finish run** | The shopper scans the receipt; matching list items are ticked and restocked automatically. | Small–medium | Reuses the fast scanner. |
| 4 | **Home-screen badge** | The app icon shows a count of new requests and out-of-stock items. | Small | Works for home-screen web apps on iPhone and Android. |
| 5 | **Barcode scanning** | Scan a product to add it. | Medium | iPhone browsers have no built-in barcode reader (needs a library), and naming products needs a product database. Less useful now that receipt scanning works. |
| 6 | **Haptics** | Small taps on actions. | Small | iPhone web apps can't vibrate; Android only. Low value for an iOS-first app. |
| 7 | ~~Shop logos~~ | Done in v0.10.1. | | |
| 8 | **Notification test on real phones** | Make sure every alert reaches every phone, including Android. | Small | Mostly testing. |
| 9 | **Changelog and version tags** | `CHANGELOG.md` (doubles as release notes for housemates) and a git tag per release. | Tiny | Version history so far is in [README → Development](../README.md#development) via `git log`. |
| 10 | **Refresh old icons** | Items added before v0.9 switch to the better icons and guesses in one go. | Small | One database update; ask before running on the live database. |
| 11 | **Native app (Capacitor)** | App Store-style app with real haptics and widgets. | Large | Only if the web app hits a wall. |
| 12 | **Show scanned items as they arrive** | The receipt list fills in while Gemini is still writing. | Medium | Less needed since v0.10 (scans take about 2 s). |

## New ideas

| # | Idea | Why it fits | Effort |
| --- | --- | --- | --- |
| A | **"Running low"** | Between "have it" and "out": mark it and it joins the grocery list while still on the shelf. | Small |
| B | **Use-by dates and "use soon"** | Optional dates on fridge and freezer items, a "Use soon" strip on the cupboard, and a notification the day before. | Medium |
| C | **"What can I cook?"** | Gemini suggests 3 meals from what's on the shelves (same free key). Pairs with recipes. | Small–medium |
| D | **Usuals and quick re-add** | The grocery list suggests things bought every week, learned from past runs. | Small |
| E | **Grocery list in shop order** | Group the list by shelf type, so the shopper walks the shop once. | Small |
| F | **Split the bill** | Receipts include prices: record what each person's items cost and keep a simple "who owes whom". | Medium–large. It's about money, so it needs careful design. |
| G | **Dark mode** | Follows the phone setting. Colours are already variables in `src/theme.css`. | Small |
| H | **Weekly kitchen digest** | Sunday notification: what ran out, what's expiring, who's shopping. | Small (after B) |
| I | **Housemate-written greetings** | Everyone can add their own top-bar greetings in House (inside jokes), shown to the whole kitchen alongside the built-in ones. | Small–medium (needs a database table) |

## Done

- v0.11.0: rotating top-bar greetings (36 approved, in `src/greetings.ts`).
- v0.10.2: logo-first loading screen (the iOS launch-image version was tried and removed).
- v0.10.1: shop logos on the grocery-run buttons (ASDA, Lidl, Sainsbury's).
- v0.10: faster receipt scanning (Flash-Lite, 15 s limit with Scan again). [receipt-speed.md](receipt-speed.md)
- v0.9: smarter icon guesses, Cereals shelf, new food icons, tuning page, Report wrong guess.

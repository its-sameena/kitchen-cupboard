# Icons and keywords

When someone types an item name, the app guesses an **icon** and a **shelf**. "Sauce" gets the jar icon on Sauces & Oils, for example. This guide shows how to tune those guesses and add new icons yourself, without code and without asking Claude.

- [The tuning page](#the-tuning-page) (start here)
- [How a guess is made](#how-a-guess-is-made)
- [Fixing a bad guess](#fixing-a-bad-guess)
- [Adding an icon from a library](#adding-an-icon-from-a-library)
- [Drawing your own icon](#drawing-your-own-icon)
- [Reports from housemates](#reports-from-housemates)
- [Editing the files by hand](#editing-the-files-by-hand)
- [Shipping your changes](#shipping-your-changes)

## The tuning page

```bash
npm run tune
```

This starts the dev server and opens **http://localhost:5173/tools/tune/** in your browser.

The page only exists on your Mac while `npm run tune` (or `npm run dev`) is running. It is never part of the live site.

| Tab | What it's for |
| --- | --- |
| **Try a name** | Type a name and see the card the app would show, plus *why*: every keyword that matched, the winner, and how they were ranked. Fix the guess right there. |
| **Keywords** | Every rule, grouped by shelf. A rule is an icon, a shelf and a list of keywords. You can add or remove keywords (type and press Enter; commas add several), change a rule's icon or shelf, add or delete rules. Keywords used in two rules are outlined in orange. |
| **Icons** | Every item icon, in the order the picker shows them. Click one to rename its label, edit its drawing, move it, or delete it. **+ Add icon** searches Lucide, Lucide Lab and Tabler, or takes a pasted or hand-drawn SVG. |
| **Tests** | Names the guesser must get right, each with a pass or fail result shown live. `npm run test:suggest` checks the same list from the terminal. |
| **Reports** | "Wrong guess" reports sent from the app by housemates. |

Edits stay in the page (they survive a reload) until you press **Save to code**. Saving rewrites the files in `src/catalog/`, plus the receipt scanner's icon list. Any open copy of the app reloads with your changes, so you can try them straight away.

The badges at the top tell you whether tests pass and what's unsaved. **Discard** throws away unsaved edits.

## How a guess is made

The code is `suggestFor` in `src/data.ts`; the keyword list is `src/catalog/keywords.ts`. For a name like **"Tilda basmati rice"**:

1. **Your kitchen first.** If the cupboard or grocery list already has an item with exactly this name, its icon and shelf are reused. A housemate's manual choice therefore sticks for everyone.
2. **Normalise.** The name is lower-cased and stripped of accents and punctuation: `tilda basmati rice`.
3. **Whole words only.** Each keyword is looked for as whole words, so `ice` matches "Ice" and "Ice cubes" but **not** "Rice" or "Juice".
4. **Plurals are free.** A keyword also matches with `s` or `es` added, `y` → `ies`, or a trailing `s` removed. So `tomato` matches "Tomatoes", `berry` matches "Berries", and `oats` matches "Oat". Keywords shorter than 3 letters must match exactly.
5. **Ranking.** If several keywords match, the winner is decided in this order:
   1. **More words wins.** `ice cream` (2 words) beats `cream`, and `baked beans` beats `beans`.
   2. **Nearest the end of the name wins.** The last word is usually the thing itself: "Orange **juice**" is juice, "Tomato **sauce**" is sauce, "Garlic **bread**" is bread.
   3. **Exact beats plural.** For "Peppers", the vegetable keyword `peppers` beats the spice keyword `pepper`.
6. **No match** → no guess. The shelf you're adding to (or Other) and its default icon are used. Defaults are in `DEFAULT_ITEM_ICON` in `src/icons.tsx`.

Rule order in the file doesn't matter. Once someone picks an icon or shelf by hand, the guess stops changing it.

## Fixing a bad guess

In **Try a name**:

1. Type the name, e.g. "Jalapeños".
2. Read **Why**:
   - **A wrong keyword won** (e.g. `pepper` → Spices): click **remove** next to it if it should never match, or add a *longer* keyword that will beat it.
   - **Nothing matched**: you need a new keyword.
3. Under **It should be**, pick the right icon and shelf.
4. Check **Keyword to add**. It defaults to the whole name; shorten it to the specific word, e.g. `jalapeno`. Plurals are automatic.
5. Keep **Save "…" as a test** ticked, so this name can never quietly break again.
6. Click **Add to existing rule** (if a rule with that icon and shelf already exists) or **Add as new rule**. The card above updates and the badge says "Already right".
7. **Save to code**.

Good keywords:
- **Specific single words:** `basmati`, `halloumi`, `sriracha`.
- **Two-word phrases to beat a generic word:** `coffee beans` (vs `beans`), `chocolate chips` (vs `chips`), `peanut butter` (vs `butter`).
- **The singular form:** write `tomato`, and plurals come free.

Avoid:
- **Brand names**, unless people really type them (`weetabix` is fine).
- **Very short words** that appear inside phrases you don't mean: `can`, `tin`, `pop`. Whole-word matching helps, but "pop" still matches "Coco **Pops**".

## Adding an icon from a library

**Icons → + Add icon → Search libraries**, then type a word such as *cheese*, *bread*, *jar* or *bottle*:

| Source | Badge | Notes |
| --- | --- | --- |
| [Lucide](https://lucide.dev/icons) | `lucide` | The app's main set. Searched by name. |
| [Lucide Lab](https://github.com/lucide-icons/lucide-lab) | `lab` | Lucide's community extras (onion, garlic, cheese, chilli…). Same style. |
| [Tabler](https://tabler.io/icons) | `tabler` | ~5,000 outline icons; also searches tags and categories, so *seasoning* finds the salt shaker. Very close in style. |

All three are free (ISC or MIT licence) and need no credit in the app.

Click an icon to preview it:
- **The 24×24 grid** shows the drawing large.
- **16/24/32/48px** are real sizes.
- **Item cards** put it next to Milk, Apple and Tin, so you can check it matches.

Then set the **key**, which is saved in the database. Use 1–16 lower-case letters, digits and dashes, and never rename it later. Set the **label** shown in the picker, click **Add**, and then **Save to code**.

The icon's drawing is copied into `src/catalog/item-icons.ts`, so the app never loads the icon packs themselves. They are only used by this page (`devDependencies`).

To use the new icon for some names, add keywords for it ([Fixing a bad guess](#fixing-a-bad-guess)), or pick it as a rule's icon in **Keywords**.

## Drawing your own icon

The tomato, spice mill and cereal box were drawn by hand because no free pack had them. You can do the same: **Icons → + Add icon → Paste or draw SVG** gives you a starter drawing and a live preview on the 24×24 grid.

### The rules that make it match the others

- **Canvas:** `viewBox="0 0 24 24"`. (0,0) is the top-left corner, (24,24) the bottom-right, and the centre is (12,12).
- **Margin:** keep shapes inside **2…22**. The red-tinted border in the preview is the 2-unit margin. Lucide icons mostly span about 3 to 21.
- **Lines, not fills:** no `fill`, no `stroke` and no `stroke-width` in your markup. The app draws every shape as a 2px round-capped line in the text colour, so all icons match automatically.
- **Simple shapes:** `<path>`, `<circle>`, `<rect>`, `<line>`, `<polyline>`, `<polygon>` and `<ellipse>`. Text, images, gradients, masks and `transform` are not supported. The editor warns you about them.
- **Few details:** at 30px, anything closer than about 2 units apart blurs together. Three to five shapes is plenty.

### Worked example: the tomato

```svg
<svg viewBox="0 0 24 24">
  <path d="M12 6.5c-5 0-9 3-9 7.25S7 21 12 21s9-3 9-7.25-4-7.25-9-7.25Z" />  <!-- body -->
  <path d="M12 6.5V2.5" />                                                   <!-- stem -->
  <path d="m7.5 7.5 2 2.25L12 6.5l2.5 3.25 2-2.25" />                         <!-- leaves -->
</svg>
```

- **Body:** a slightly squashed circle, 18 wide (x 3→21) and 14.5 tall (y 6.5→21), made from two curves. Use a plain `<circle cx="12" cy="13.5" r="8" />` if you'd rather.
- **Stem:** a straight line up from the top centre: `M12 6.5` (move to 12, 6.5), `V2.5` (vertical line to y = 2.5).
- **Leaves:** a zig-zag across the top (`m` = move, `l` = line, lower-case means "relative to the last point").

The first version was too small and flat. Making the body use the full height fixed it. Always compare against Milk and Apple in the preview.

### Path cheat-sheet

| Command | Meaning | Example |
| --- | --- | --- |
| `M x y` | move the pen (no line) | `M12 3` |
| `L x y` / `H x` / `V y` | straight line / horizontal / vertical | `L18 9`, `H20`, `V21` |
| `A rx ry 0 0 1 x y` | arc of an ellipse to (x,y); `0 1` vs `0 0` flips direction | `A3 3 0 0 1 15 8` |
| `C x1 y1 x2 y2 x y` | curve with two control points | `C8 2 16 2 18 8` |
| `Z` | close back to the start | |
| lower-case | same, but relative to the current point | `l2 3` = 2 right, 3 down |

### Faster ways to draw

- **Edit an existing icon.** Find something close in the library (Tabler `bottle` for a sauce bottle, say), add it, then tweak its drawing in **Icons → (your icon) → Drawing**.
- **Draw visually,** then paste:
  - [SVG Path Editor](https://yqnn.github.io/svg-path-editor/) lets you drag points on a grid; set the viewBox to 0 0 24 24.
  - In Figma, Inkscape or Illustrator, draw on a 24×24 frame with 2px strokes, flatten or outline nothing, and export as SVG.
- **Ask Claude for a first draft:** *"Draw a 24×24 Lucide-style stroke icon of a honey jar, 3–5 shapes, inside 2..22; give me only the SVG."* Then paste it into the page and refine it by eye. That's a short answer, so it costs few tokens.

You can also edit the drawing of any existing icon (e.g. to tweak a Lucide one). Its key stays the same, so every item already using it updates.

## Reports from housemates

When someone adds an item and changes the guessed icon or shelf, the sheet shows **Report wrong guess**. Tapping it sends a feedback item with:
- the name
- what the app guessed
- what they picked instead

You'll find these in:
- **The tuning page → Reports:** each report says whether your current edits already fix it. **Fix in "Try a name"** loads it with their choice pre-selected. **Mark done** replies to them in House → Feedback (do this after you've shipped the fix).
- **`npm run feedback`:** reports appear there too, as normal bug feedback.

The Reports tab reads the live database using `SUPABASE_SERVICE_ROLE_KEY` from your `.env.local`. That key stays on your Mac; the page and plugin only run in dev.

## Editing the files by hand

Everything the page does is plain data in `src/catalog/`. You can edit these in any editor; the page and the app pick up changes instantly.

| File | Holds |
| --- | --- |
| `src/catalog/keywords.ts` | `KEYWORD_RULES`: `{ shelf, icon, keywords }` per rule |
| `src/catalog/item-icons.ts` | `ITEM_ICON_DATA`: `key: { label, source, node }`, in picker order. `node` is the drawing: `[["path", { d: "…" }], ["circle", { cx: "12", cy: "12", r: "3" }]]` |
| `src/catalog/keyword-tests.ts` | `KEYWORD_TESTS`: `{ name, shelf, icon? }`; `shelf: null` means "should guess nothing" |
| `src/catalog/types.ts` | The shapes of the above |

The page rewrites these files in a fixed format, so comments you add inside the lists are lost on the next save. Put notes in this doc instead.

When adding a new icon key by hand, also add it to `ICONS` in `supabase/functions/scan-receipt/gemini.ts`; the page does this for you. Then run:

```bash
npm run test:suggest   # the test names
npm run check:catalog  # icon keys and shelves match the receipt scanner; rules use real icons/shelves
```

Shelves themselves (`CATEGORIES` in `src/data.ts`) are not editable in the page. A new shelf needs a database migration; see [shipping.md](shipping.md).

## Shipping your changes

1. **Save to code**, then try it in the app (`npm run dev`, or the "open the app" link on the page).
2. Run the checks above, or just `npm run test:suggest`.
3. Commit and push on a branch, and check the Vercel preview on your phone. Merge to `main` to ship. See [shipping.md](shipping.md).
4. **If you added or removed icons,** redeploy the receipt scanner so it can use them:
   ```bash
   npx supabase functions deploy scan-receipt
   ```
5. Mark any related reports as done (Reports tab, or `npm run feedback -- set <id> done "…"`).

Existing cupboard items keep the icon they were saved with. Changing a keyword only affects new guesses, while changing an icon's *drawing* updates every item that uses that key.

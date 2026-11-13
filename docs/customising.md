# Customising the app

How to change the look, the order of things and the layout yourself, plus when it's quicker to ask Claude. Icons and name guessing have their own guide: [icons-and-keywords.md](icons-and-keywords.md). Motion is in [animations.md](animations.md).

- [Your editing setup](#your-editing-setup)
- [Where everything lives](#where-everything-lives)
- [Ordering things](#ordering-things)
- [Layout of a screen](#layout-of-a-screen)
- [Shop logos](#shop-logos)
- [Doing it yourself vs asking Claude](#doing-it-yourself-vs-asking-claude)

## Your editing setup

```bash
npm run dev
```

**Leave it running.** Every time you save a file, the app in your browser updates within a second, without a reload.

- **Phone size on your computer:** open the browser's developer tools (Chrome: ⌥⌘I), then the device toolbar (⌘⇧M), and pick an iPhone.
- **On your real phone:** `npm run dev` prints a **Network** address like `http://192.168.1.20:5173`. Open it on your phone while it's on the same Wi-Fi.
  - It talks to the **live** database, so anything you add is real.
  - Notifications and "Add to Home Screen" need HTTPS, so test those on a Vercel preview instead ([shipping.md](shipping.md)).
- **Try a value before you commit to it:** in developer tools, click any element, then in **Styles** click a colour or number and change it. You'll see it instantly. When you like it, copy the value into the right file below; devtools changes vanish on reload.
- **Finding which CSS rule styles something:** right-click the element → **Inspect**. The Styles pane shows the class names, such as `.shelf-glass`. Search for that name in `src/styles.css`.
- **An editor:** VS Code (free) is a good choice. ⌘P opens a file by name, and ⌘⇧F searches every file.

## Where everything lives

| What you want to change | Where | How |
| --- | --- | --- |
| **Colours** | `src/theme.css` | Every colour is a variable: `--bg` (page), `--surface` (cards, sheets, tab bar), `--surface-2` (chips, inputs), `--ink` (text), `--muted`, `--accent` (black buttons, *Add item* pill), `--run` (grocery-run orange), `--danger`, `--success`. Change one value and the whole app follows. |
| **Shelf glass colours** | `src/theme.css` → `--shelf-spices`, `--shelf-dairy`, … | One per shelf. `--shelf-opacity` sets how see-through the glass is (100% = solid). Cards on a shelf are tinted the same colour. |
| **Fonts** | `index.html` + `src/theme.css` | Inter (text) and Instrument Serif (big titles). Pick fonts on [Google Fonts](https://fonts.google.com), replace the `<link>` in `index.html`, then set `--font-body` / `--font-display`. |
| **Roundness, shadows, card size** | `src/theme.css` | `--radius` (cards, sheets), `--radius-sm` (item cards, inputs), `--shadow`, `--card-w` / `--card-h` (item cards on the shelves). |
| **Animation speed and feel** | `src/theme.css` → Motion | See [animations.md](animations.md). |
| **Tabs (order, names, start page)** | `src/config.ts` → `TABS`, `DEFAULT_TAB` | Array order = left to right. `label` is the tab text, `title` the big page title. |
| **Icon sizes** | `src/config.ts` → `ICON_SIZES` | Pixels for item cards, shelf headings, lists, tabs, buttons. |
| **Order of items on a shelf** | `src/config.ts` → `SHELF_ITEM_ORDER` | See [Ordering things](#ordering-things). |
| **Shops for grocery runs** | `src/config.ts` → `STORES` | Name, border colour, optional logo; array order = button order. |
| **Shelves (order, names)** | `src/data.ts` → `CATEGORIES` | Top-to-bottom order; `label` renames. A *new* shelf also needs a database migration ([shipping.md](shipping.md)). |
| **Profile colours** | `src/data.ts` → `PALETTE_HUES`, `PALETTE_LIGHTNESS`, `USER_COLORS` | The pop-up grid is built from hues (columns) × lightness (rows). `USER_COLORS` are offered first to new profiles. Colours are unique per kitchen. |
| **Interface icons** (tabs, buttons, top bar) | `src/icons.tsx` → `UI` | Find one on [lucide.dev/icons](https://lucide.dev/icons), add its PascalCase name to the `import` list, point the entry at it, e.g. `cupboard: Refrigerator`. |
| **Shelf heading icons** | `src/icons.tsx` → `CATEGORY_ICONS` | Same as above, one per shelf. |
| **Item icons and name guessing** | `npm run tune` | See [icons-and-keywords.md](icons-and-keywords.md). |
| **Avatars** | `src/avatar.ts`, `src/components/AvatarCreator.tsx` | DiceBear **sprouts** (CC0). Parts and colours come from the style; tabs and labels are in `AvatarCreator.tsx`. Background = profile colour. |
| **App name, home-screen icon, status-bar colour** | `vite.config.ts` (`manifest`), `index.html`, `public/favicon.svg` | After editing `favicon.svg`, run `npm run icons` to regenerate the PNGs. |
| **Text on screens** | `src/components/*.tsx` | Search for the words you see (⌘⇧F), e.g. "Who's in the kitchen". Change the text between the tags. |

Phones get changes on their next launch after the app is redeployed.

## Ordering things

| Thing | Where | How |
| --- | --- | --- |
| Tabs | `src/config.ts` → `TABS` | Move a line. |
| Shelves | `src/data.ts` → `CATEGORIES` | Move a line. The empty shelves (shown greyed out at the bottom) keep the same order. |
| Items on a shelf | `src/config.ts` → `SHELF_ITEM_ORDER` | Default: in stock first, then A→Z. Ready-made alternatives are in the comment underneath (A→Z only, most owners first, recently changed first). Copy one over the default. |
| Icons in the picker | `npm run tune` → Icons → **Move earlier / later** | Or reorder entries in `src/catalog/item-icons.ts`. |
| Shop buttons | `src/config.ts` → `STORES` | Move a line (two per row). |
| Colour grid | `src/data.ts` → `PALETTE_HUES` (columns, left→right) and `PALETTE_LIGHTNESS` (rows, top→bottom) | |

A custom item order is a small function: return a negative number to put `a` first. For example, to put items *you* own first, ask Claude, since it needs to know who "you" is.

## Layout of a screen

| Screen | Component | Styles (sections in `src/styles.css`) |
| --- | --- | --- |
| Top bar, tab bar, toasts | `src/App.tsx` | "App shell", "Inbox & toasts" |
| Cupboard, shelves, add-item sheet | `src/components/Cupboard.tsx` | "Cupboard: glass shelves" |
| Groceries and grocery runs | `src/components/Groceries.tsx` | "Groceries", "Shop buttons" |
| House (profiles, invite, settings) | `src/components/House.tsx` | "House", "Colour picker", "Copy kitchen code" |
| Setup and the profile picker | `src/components/Welcome.tsx` | "Setup screens" |
| Feedback | `src/components/Feedback.tsx` | "Feedback" |
| Receipt scanning | `src/components/ReceiptReview.tsx` | "Receipt scanning" |
| Avatar creator | `src/components/AvatarCreator.tsx` | "Avatars (DiceBear sprouts)" |
| Shared bits (sheet, item card, avatar) | `src/components/ui.tsx` | "Sheets", "Buttons & fields" |

Moving things around *within* a screen means editing the JSX in the component, i.e. reordering blocks of `<div>…</div>`. That's easy to get slightly wrong by hand, so for anything bigger than swapping two blocks it's usually quicker to ask Claude (see below).

## Shop logos

The grocery-run buttons show the shop names in brand colours. To show logos instead:

1. **Get each logo:** ideally a transparent `.svg` or `.png` about 300px wide, from the shop's website or press page, or Wikimedia Commons (search e.g. "Asda logo svg"). Logos are trademarks: fine in a private household app, but don't publish the app with them.
2. **Save them:** put them in `public/stores/` as, for example, `asda.svg`.
3. **Add a `logo` to each shop** in `STORES` (`src/config.ts`):
   ```ts
   { name: 'ASDA', label: 'ASDA', color: '#78be20', logo: '/stores/asda.svg' },
   ```
4. **Reload.** A missing or broken logo falls back to the name. When a shop is tapped, logo buttons get a light tint of the shop's colour (instead of a solid fill) so the logo stays visible.

The ASDA, Lidl and Sainsbury's logos are set up (`public/stores/asda.svg`, `lidl.svg`, `sainsburys.svg`). Use simple file names: no spaces or apostrophes.

## Splash screen

Opening the app shows the logo (30% of the screen width, centred) before bringing you to the rest of the app:

1. **While the app's code downloads:** a tiny bit of HTML and CSS in `index.html` (the `<style>` block and the `boot` element inside `#root`).
2. **While it connects:** `Loading()` in `src/components/Welcome.tsx`, styled by `.boot` in `src/styles.css`. It keeps the logo in the same spot and fades in "Opening the cupboard…" only if opening takes more than about half a second.

To change the logo size or background, change it in both places: `30vw` and `#f3f2ee` in `index.html`, and `.boot-logo` in `src/styles.css`. The logo image is `public/favicon.svg`, which is also the app icon.

Before either of these, iOS briefly shows a plain screen in the app's background colour (`background_color` in `vite.config.ts`). A custom iOS launch image was tried in v0.10.2 and removed, because it didn't line up with the page's logo.

## Doing it yourself vs asking Claude

| Change | Fastest way |
| --- | --- |
| A colour, font, size, radius, speed | **Yourself**: one value in `src/theme.css` or `src/config.ts`. |
| Reordering tabs, shelves, shops, picker icons | **Yourself**: move a line. |
| Icons and keyword guesses | **Yourself**: `npm run tune`. |
| Wording on a screen | **Yourself**: search for the text, edit it. |
| Moving a button to another place, a new section on a screen | **Claude**, with a screenshot and one sentence. |
| A new feature, anything touching the database | **Claude**, on a branch (see [shipping.md](shipping.md)). |

When you do ask, see [working-with-claude.md](working-with-claude.md) for how to keep it quick and cheap.

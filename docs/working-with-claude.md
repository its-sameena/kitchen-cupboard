# Working with Claude (and without it)

How to turn the version of the app in your head into the real thing, while spending as little time and as few tokens as possible.

## Pick the right tool for the change

| You want to… | Best tool | Why |
| --- | --- | --- |
| Change a colour, size, speed, font | **Edit `src/theme.css` yourself** | One value; you see it instantly with `npm run dev`. |
| Reorder tabs, shelves, shops, items | **Edit `src/config.ts` / `src/data.ts` yourself** | Move a line. See [customising.md](customising.md). |
| Fix an icon guess, add an icon | **`npm run tune`** | Built for exactly this; no tokens at all. See [icons-and-keywords.md](icons-and-keywords.md). |
| Change wording | **Yourself**: search for the text | |
| Try a visual idea | **Browser devtools**, then copy the value into the file | Free, instant, throwaway. |
| Explore a new look or interaction | **Claude Design** prototype | Cheap to iterate visually before any code exists. |
| Move things around on a screen, new UI | **Claude Code** | Several files and JSX at once. |
| New feature, database, notifications | **Claude Code, on a branch** | Needs migrations, tests, a safe rollout ([shipping.md](shipping.md)). |
| Understand how something works | **Claude Code**, read-only question | Ask it to "explain, don't change anything". |

Rule of thumb: if you can name the file and the value, do it yourself. If it touches more than one file, or you can't say where it lives, ask Claude.

## From the idea in your head to the app

1. **Capture it visually.** A screenshot of the current screen with scribbles, a photo of a paper sketch, or a reference image (like the bookshelf photo that became the glass shelves). One picture replaces a paragraph of description.
2. **Say what, not how.** *"Make the run card feel more urgent: bigger, orange glow, pulse once when it appears"* works better than guessing CSS. Mention the **feeling** you want, too: calm, playful, fast.
3. **For bigger ideas, prototype first.** Use Claude Design or ask for "a quick mockup/artifact, no code changes". Iterate on the mockup, then say "build this in the app".
4. **Ask for a plan before a big change:** *"Plan how you'd add recipes; don't write code yet."* Correcting a plan is much cheaper than correcting an implementation.
5. **Build on a branch, test on your phone** via the Vercel preview, then merge. You can always go back.
6. **Feed reality back in.** Housemates' feedback (`npm run feedback`) and icon reports (`npm run tune` → Reports) tell you what to change next.

## Spending fewer tokens

Tokens are spent on everything Claude reads and writes, and the conversation so far is re-read on every message. So:

### Point, don't make it search
- **Name the file:** *"In `src/theme.css`, make `--run` a deeper orange"* costs a fraction of *"make the orange darker somewhere"*.
- **Point at a single guide** instead of the whole repo: *"Read `docs/animations.md` and slow down the shelf animation"*.
- **Name things by what's on screen, plus the file** if you know it: *"the 'Show recent runs' link in `Groceries.tsx`"*.
- **Paste the error message** (or attach a screenshot of it) instead of describing it.

### Keep conversations short and focused
- **One task per session.** When a task is done, start a new session for the next one. A long conversation re-reads all of its history every time.
- **Batch small tweaks into one message:** *"1) buttons navy, 2) title 10% bigger, 3) remove the divider under House"*. That's one round trip instead of three.
- If a session gets long but you're mid-task, use `/compact` to summarise it and carry on.
- **Say "no edits, just answer"** when you only want an explanation. Claude then won't open and change files.

### Do the cheap parts yourself
- **Tweak values yourself** after Claude builds something. Re-asking "a bit bigger… no, smaller" costs a full round each time, while changing the number yourself is free.
- **Use `npm run tune`** for all icon and keyword work.
- **Run the checks yourself** if you like (`npm run build`, `npm run test:suggest`) and paste only failures.

### Help Claude get it right first time
- **Attach a screenshot** for anything visual; crop it to the relevant part.
- **Say what "done" looks like:** *"…and the + button should still fit on an iPhone SE"*.
- **Ask for options when you're unsure:** *"Give me two directions in one mockup"*. That beats several rounds of guessing.
- **Keep `CLAUDE.md` short and accurate.** Claude reads it at the start of every session, so it saves re-explaining the project. Update it when something important changes (Claude can do that for you).

### Choose the right effort
- **Small, well-specified edits** (a value, a label, a small component change) don't need the most powerful model or high effort. Pick a lighter one in the model picker if you have the choice.
- **Design, new features and debugging** benefit from the stronger model; it's cheaper overall if it gets it right first time.

## Prompt templates

Copy and fill in the blanks:

- **Visual tweak:** *"[screenshot] On the Cupboard screen, make ___ look more ___. Only change CSS in `src/styles.css` / `src/theme.css`."*
- **Move UI:** *"[screenshot] Move the ___ from ___ to ___ in `src/components/___.tsx`. Keep the styling."*
- **New feature:** *"On a new branch: plan how to add ___. Ask me questions first. No code until I approve."*
- **Bug:** *"When I ___, I expected ___ but got ___. [error text or screenshot]. Find the cause before fixing."*
- **Explain:** *"No edits: how does ___ work? Point me to the file and line."*
- **Feedback triage:** *"Check the app feedback."* (Claude follows the steps in `CLAUDE.md`.)
- **Ship:** *"Run the checks, commit, and push this branch."* Later: *"Merge to main."*

## Without Claude at all

Everything in [customising.md](customising.md), [animations.md](animations.md) and [icons-and-keywords.md](icons-and-keywords.md) can be done by hand:
- Edit, watching `npm run dev`.
- Run the checks.
- Commit and push (see [shipping.md](shipping.md)).

The git basics you need:

```bash
git status                          # what changed
git diff                            # how it changed
git checkout -b feature/my-change   # start a branch
git add -A && git commit -m "What I changed"
git push -u origin feature/my-change
git checkout main && git merge feature/my-change && git push   # ship
git checkout -- src/theme.css       # throw away your edits to one file
```

GitHub Desktop (free) does all of this with buttons, if you prefer.

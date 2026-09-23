# ScriptureTok

Scripture study that feels like a feed.

A single-file, mobile-first web app that turns the weekly **Come, Follow Me**
lesson into a vertical, full-screen, swipeable feed — with XP, levels, daily
quests and a study streak. Built for an 11-year-old who will happily scroll for
an hour and will not happily read a wall of Isaiah.

**Currently loaded:** September 21–27, 2026 · *A Marvelous Work and a Wonder* ·
Isaiah 13–14; 24–30; 35 — 13 reels.

---

## What's in it

| | |
|---|---|
| **Feed** | Full-screen vertical reels with scroll-snap, one lesson idea each |
| **Double-tap to like** | Floating hearts from the tap point, exactly like Reels |
| **Creator accounts** | `@isaiah_prophecies`, `@the_sealed_book`, `@babylon_falls`… |
| **Audio titles** | Scrolling fake track credits (`SEALED BOOK 🔒 (sped up)`) |
| **XP & levels** | 8 levels, Seeker → Marvelous Worker |
| **Daily quests** | Swipe-up sheet, 5 quests, bonus XP, resets each morning |
| **Study streak** | Consecutive days, resets on a missed day |
| **Dig deeper** | Tap to reveal extra insight on any reel, worth bonus XP |
| **Open scriptures** | Every reel links to the official text so verses are checkable |

XP: **+10** reading a reel · **+20** first like · **+15** first deep dive ·
**+20…60** per quest. Finishing the week completely lands around level 4.

---

## Hosting it on GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
3. Wait ~60 seconds. It's live at `https://<you>.github.io/<repo>/`.

### Putting it on his phone

Open that URL in Safari (iOS) or Chrome (Android) → Share → **Add to Home
Screen**. On iOS it launches full-screen with no browser chrome, like a real
app. Android will add it too, though full standalone mode there wants a
`manifest.webmanifest` — a 6-line file, easy to add later if you want it.

---

## Changing the weekly lesson

Everything you edit lives in the **`CONTENT` block at the very bottom of
`index.html`**. Nothing above it needs touching — quest goals, week progress
and the position rail all read from this automatically.

```js
{
  id: "isa-29-marvelous",              // unique + STABLE. Changing it re-locks that reel's XP.
  handle: "@isaiah_prophecies",
  avatar: "🔭",
  role: "Isaiah 29 · this week's title",
  hook: "Not impressive. Impossible.",  // the headline that stops the scroll — keep it short
  body: "This is the verse this whole week is named after…",
  verse: { text: "Therefore, behold, I will proceed…", ref: "Isaiah 29:14" },
  deepDive: "Joseph Smith was fourteen years old…",   // revealed on tap
  audio: "a marvellous work ✦ main theme",
  chapter: "29",                        // builds the "open scriptures" link
  gradient: "linear-gradient(150deg,#4c1d95 0%,#a21caf 50%,#fbbf24 112%)",
  tags: ["#Isaiah29", "#Restoration"],
  likes: 74100, comments: 2890          // cosmetic social proof
}
```

Also update `dates`, `title` and `reference` at the top of the block.

**Length matters.** Keep `body` to 3–4 sentences and `deepDive` to 2–3. Reels
scroll internally if they overflow, but the feed feels best when a reel fits on
one screen. Tested at 360×640, 390×844 and 430×932.

**Reusing ids across weeks:** ids not present in the current week are dropped
from saved progress, so old weeks never inflate this week's numbers. Reuse an
id and it keeps its "already earned" state — so always use fresh ids for new
reels.

---

## Optional: drive it from a Google Sheet

Weekly edits without touching code. The CSV loader is already built and tested.

1. Build a sheet whose header row uses these column names (order doesn't
   matter, extras are ignored):
   `id, handle, avatar, role, hook, body, verse, ref, deepdive, audio, chapter, gradient, tags, likes, comments`
2. **File → Share → Publish to web → the sheet → Comma-separated values (.csv)**.
3. Near the top of the engine in `index.html`:

```js
const CONTENT_SOURCE = { mode: 'sheet', csvUrl: 'PASTE_THE_PUBLISHED_CSV_URL' };
```

`tags` is space-separated (`#Isaiah29 #Restoration`). If the sheet is
unreachable or empty the app **silently falls back to the built-in content** —
he never gets an empty feed because a spreadsheet was down.

---

## Notes and caveats

**Verse text.** Quotations are King James Version (public domain), kept short
and, where marked with `…`, quoted in part. Every reel carries an *open
scriptures* link to the official text. Worth spot-checking a verse before he
quotes it in class.

**Interpretation.** The reels present the standard Latter-day Saint reading of
Isaiah 29 (sealed book → Book of Mormon, marvelous work → Restoration), which
is what Come, Follow Me teaches. Other Christian traditions read these passages
differently; the app doesn't pretend otherwise, it just doesn't cover it.

**His data never leaves the phone.** XP, likes, streak and quest progress live
in `localStorage` on that one device. Nothing is uploaded, no account, no
analytics, no network calls except the font. Clearing site data resets his
progress; the app is written to work fine even when storage is blocked
entirely (private browsing), it just won't remember anything.

**Offline.** Tailwind is compiled and inlined rather than loaded from a CDN, so
the app works on filtered school wifi, in airplane mode, and with no flash of
unstyled content. The only network request is Google Fonts, which degrades
cleanly to the system font.

**Rebuilding the CSS.** Only needed if you add *new Tailwind utility classes*
to the markup — ordinary weekly content edits never require it, because reel
colours are raw CSS gradients:

```bash
printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > in.css
npx tailwindcss@3 -i in.css -o out.css --minify --content index.html
# paste out.css into the inlined <style> block
```

---

## Tested

Driven in a real headless Chromium at three viewport sizes:

- XP arithmetic verified step by step across view / like / dig / quest awards
- Streak increments on a consecutive day, resets after a gap
- Level-up fires exactly on the XP threshold
- Progress survives reload
- Renders with **zero errors when `localStorage` is blocked**
- No reel content is ever clipped or unreachable at 360×640, 390×844 or 430×932

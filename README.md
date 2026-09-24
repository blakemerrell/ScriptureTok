# ScriptureTok

The weekly **Come, Follow Me** lesson as a full-screen, swipeable feed, built
so the lesson is understood, not just scrolled past.

Live at **https://blakemerrell.github.io/ScriptureTok/**

**Loaded:** September 21–27, 2026 · *A Marvellous Work and a Wonder* ·
Isaiah 13–14; 22; 24–30; 35 · 10 reels, then from Monday September 28 ·
*Comfort Ye My People* · Isaiah 40–49 · 11 reels.

---

## How it works

Each reel is one idea from the lesson: a headline, a few plain sentences, the
verse itself, and **one question** answerable from what's on the screen.

| | |
|---|---|
| **XP only for understanding** | Scrolling, tapping and opening the app earn nothing. A right answer on the first try earns 20 XP. |
| **One try** | A wrong answer shows the right one and the words in the verse that settle it. |
| **Daily warm-up** | On a new day, up to 3 earlier questions come back before the feed, missed ones first, with no verse to look at. Remembering one earns 15 XP. |
| **Reading bonus** | After a reel's question, a bonus question whose answer is only in the chapter (or the lesson page), never in the app. One try, 25 XP. The link opens the chapter at the top, not at the answer. |
| **Pictures and clips** | At most 4 a week, only where they show something the words can't. Clips load nothing until tapped, then play just the chosen stretch in YouTube's privacy-mode player. |
| **Streak** | Days in a row with at least one question answered. A **streak freeze** (earned by solving the weekly puzzle) covers one missed day and is used automatically; the count shows next to the streak. |
| **Notes** | After a reel, he can write what it means to him in his own words: 10 XP once per reel (12+ words, not filler). "Put it in my scriptures" copies the note and opens that verse in Gospel Library to paste it as a note there. No outside app can read Gospel Library notes, so the XP comes from writing it here. Notes are kept across weeks as a journal on his phone; a parent can read them in the parent screen, and the note box tells him so. |
| **🎮 Games** | Next to the streak. **Weekly puzzle**: a Connections-style sort of 16 ideas into the lesson's 4 sections, unlocked once every reel is answered; 4 mistakes a day, repeat guesses are free, a lost try resets the next day; solving pays 40 XP and a streak freeze. **Who said it?**: match lines quoted exactly from scripture to their speaker, 5 XP each on the first try; one line also comes back in each day's warm-up. **Verse Word**: a Wordle-style daily word with its verse as the clue ("a ____ from the storm"), six tries, 10 XP. **Scripture Climb**: a Millionaire-style ladder of ten questions (reel questions, then reading-only bonuses) from 100 to 32,000, safe at 1,000, with 50:50, Read it, and Ask a parent lifelines; the first climb each day pays 2 XP per right answer. **Scripture Showdown**: below. |
| **Live game** | Kahoot-style. A TV or laptop hosts (`…/#host`): it shows a 4-digit code, then each question, and keeps score. Phones and tablets join with the code (`…/#join`, or `…/#join-1234`) and answer on their own screens in real time; the same answers appear in the same colors everywhere. 500 points for a right answer plus up to 500 for speed, 20 seconds a question, a leaderboard after each, and a family total at the end. No accounts needed to play; it never changes XP. Runs through Firebase across devices (`FIREBASE_CONFIG` in `index.html`, rules in `firestore.rules`); until that's set, it runs between tabs of one browser, which is also how the tests play it. |
| **Year trail** | The first card shows the 52 weeks of Come, Follow Me 2026 with this week marked; each finished week turns green. |
| **Scripture Showdown** | A quiz-show board game for the whole family, built from the week's checked questions. Columns are the lesson's sections; reel questions are the low values, reading-only bonus questions the high ones, one of them a Daily Double. A parent hosts on a laptop hooked to the TV and taps who got each one; scores add up to a family total and a family best. Open it from the first or last card, or bookmark `…/ScriptureTok/#family`. It never changes his XP. |
| **Family rewards** | A parent sets rewards at XP marks behind a 4-digit PIN ("Pick Friday's movie at 300 XP"). He sees his progress on the first and last cards and gets "Reward unlocked, show a parent" when he crosses one; only the parent can mark it given. The PIN keeps an 11-year-old from editing his own rewards; it isn't security. |
| **Week report** | The last card lists every reel with ✓ / ✕, and points to the real reading for the week. |
| **Sections match church** | Reels are grouped under the lesson's own section headings, so what he reads lines up with class on Sunday. |

Progress lives in `localStorage` on that one device: no account, no
analytics, no network calls except the font. It still works with storage
blocked (private browsing); it just won't remember.

---

## Where the content comes from

- **Scripture text:** quoted exactly from the standard works (KJV Bible, Book
  of Mormon, D&C, Pearl of Great Price). The check script compares every quote
  against the public-domain
  [bcbooks/scriptures-json](https://github.com/bcbooks/scriptures-json) data,
  pinned to one commit.
- **The lesson:** the official Come, Follow Me page on
  churchofjesuschrist.org supplies the title, dates, reading block and section
  headings. Reels are written in our own words and link back to it. Don't paste
  the manual's paragraphs in: the site is public, and the Church's terms of use
  cover personal and family use.
- **The magazines:** each month's Friend (its "Come, Follow Me Weekly
  Scripture Fun" has a family idea for every week), For the Strength of Youth
  and the Liahona often tie to the week's chapters. Bonus questions can come
  from them; the check script fetches the page and confirms the answer is on it.
- **Videos:** clips only from the approved channels in `tools/verify.mjs`:
  the Church's own channel, Scripture Central, followHIM Podcast, Don't Miss
  This, and Talking Scripture.
- **History:** a historical claim goes in only when it can be tied to a
  scripture source (for example, Charles Anthon via Joseph Smith—History 1:64–65).

---

## Changing the weekly lesson

Everything you edit is the **`CONTENT` block at the bottom of `index.html`**.
Each week is one `WEEKS.push({ … })`. **Add next week any time before its
Monday**: the app opens on the week whose dates include today, so it switches
by itself (and last week turns green on the year trail). Keep weeks in date
order and drop ones older than last week. The comment above the block
describes every field. One reel, the short version:

```js
{
  id: "isa25-refuge",                 // unique and stable
  section: 1,                          // index into the week's `sections`
  hook: "He doesn't promise no storms. He promises shelter.",
  body: "Isaiah calls the Lord “a refuge from the storm, a shadow from the heat.” …",
  verse: { text: "For thou hast been a strength to the poor, …", ref: "Isaiah 25:4" },
  question: {
    q: "What does Isaiah 25:4 promise?",
    right: "A safe place during hard times",
    wrong: ["That hard times will never come", "That storms are a punishment"],
    why: "He is “a refuge from the storm”: a shelter while the storm is still going."
  },
  gradient: "linear-gradient(150deg,#082f49 0%,#0369a1 50%,#38bdf8 100%)",
  blobA: "rgba(125,211,252,.45)", blobB: "rgba(0,0,0,.4)"
}
```

Rules the check script enforces:

- The verse box is the scripture text exactly. Use `…` where words are left out.
- Any scripture quoted in a hook, body, question or answer goes in
  “curly quotes” followed by its reference, like
  `“Thy dead men shall live” (Isaiah 26:19)` or `(verse 6)` for the same
  chapter. A quote with no reference must come from the reel's own verse box.
- Every reference named anywhere must exist.
- Every lesson section needs at least one reel, and at least 3 questions
  (reel questions plus bonuses) so it fills a column on the family board.
- Bodies stay under 75 words and hooks under 60 characters.
- A bonus's `find` words must be in its source verse, or on the Gospel
  Library page it cites (lesson, Friend, For the Strength of Youth, Liahona),
  and must not appear anywhere in the app. A reel can have several bonuses;
  each shows after the one before is answered.
- Pictures live in `media/`, under 150 KB, with alt text, a credit, and a
  link to their Media Library or Wikimedia Commons page.
- Clips: under 3 minutes, from a channel on the approved list in
  `tools/verify.mjs` (checked against YouTube's record of who owns the
  video). A clip stays **hidden in the app until a parent watches it** and
  sets `previewed: true`; the private preview shows it, marked "not approved
  yet", so it can be reviewed.

Two more blocks at the top of `WEEK_CONTENT` feed the games:

- `puzzle.groups`: exactly 4 groups of 4 tiles, one group per lesson
  section. Each tile is `{ text, ref }`; the ref must be inside the week's
  reading.
- `sayings`: at least 6 `{ id, text, ref, speaker, wrong: [two], why }`.
  `text` must be quoted exactly from `ref`.
- `words`: Verse Word, one a day. `{ word, clue, ref }`: a 4–7 letter word in
  capitals, and the verse's own words with `____` where the word goes. The
  check puts the word in the blank and matches it against the verse.

Then run:

```bash
node tools/verify.mjs --online   # quotes, references, and every Gospel Library page the week cites
```

and push to `main`. The deploy runs the same check and **refuses to publish**
if anything fails. (If the Church website itself is down, that's a warning,
not a failure, so an outage can't block a deploy.)

Answer order is shuffled in the app, so always put the right answer in
`right`. Changing a reel's `id` resets that reel's answer.

**Rebuilding the CSS** is only needed if you add new Tailwind classes to the
markup: `sh tools/build-css.sh`.

---

## Hosting

Every push to `main` redeploys through `.github/workflows/pages.yml` (about
a minute). Setting it up on a new repo:

1. The repo must be **public** (Pages on a private repo needs a paid plan, and
   the site itself is public either way).
2. **Settings → Pages → Source: GitHub Actions.** The workflow can't switch
   this on by itself.
3. Push to `main`, or re-run the workflow from the Actions tab.

**On his phone:** open the link in Safari → Share → **Add to Home Screen**. On
iOS it launches full-screen like an app. On Android, Chrome's **Add to Home
screen** installs it full-screen too (`manifest.webmanifest` and `icons/`).

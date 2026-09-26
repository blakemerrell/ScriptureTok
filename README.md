# Treasure Up

*"Treasure up in your minds continually the words of life"* (D&C 84:85). Formerly ScriptureTok.

The weekly **Come, Follow Me** lesson as a short Duolingo-style lesson each
day, built so the lesson is understood, not just scrolled past. One page
shows the week: today's lesson, the week's plan, how it's going, and every
reel to look back at.

Live at **https://blakemerrell.github.io/TreasureUp/**

**Loaded:** September 21–27, 2026 · *A Marvellous Work and a Wonder* ·
Isaiah 13–14; 22; 24–30; 35 · 10 reels, then from Monday September 28 ·
*Comfort Ye My People* · Isaiah 40–49 · 11 reels.

---

## How it works

Each reel is one idea from the lesson: a headline, a few plain sentences, the
verse itself, and **one question** answerable from what's on the screen.

| | |
|---|---|
| **XP only for understanding** | Reading, tapping and opening the app earn nothing. A right answer on the first try earns 20 XP. |
| **One try** | A wrong answer shows the right one and the words in the verse that settle it. |
| **Daily warm-up** | On a new day, up to 3 earlier questions come back at the start of the day's lesson, missed ones first, with no verse to look at. Remembering one earns 15 XP. |
| **Reading bonus** | Once a reel is answered, its own screen (from Look back) has a bonus question whose answer is only in the chapter (or the lesson page), never in the app. One try, 25 XP. The link opens the chapter at the top, not at the answer. |
| **The week's plan** | The app opens on its page, at the top: **Today** (today's section, what's left from earlier days first, and how much is done) and the week map: the lesson's sections one a day (Mon–Thu for a four-section week), Friday's deep dive, Saturday's puzzle, Sunday for church and a family game. It's a suggested pace, not a lock: everything stays open and reading ahead is fine. When today's part is done the card says **✓ Done for today** and what's tomorrow. Sunday's row opens the games. |
| **Today's lesson** | **▶ Start today's lesson** on the Today card plays that part of the plan one screen at a time, Duolingo-style: what's left of the warm-up, then for each reel read it (picture, text, verse), answer its question and fill in a missing word of the verse; then put a phrase of a verse in order, match each idea to its verse, and Go deeper. Friday's lesson is the two deep-dive pieces; Saturday's opens the puzzle. Each row of the week map opens that part's lesson. Each answer is recorded once, the first time, and XP, the streak, the plan and the family's copy all see it. The practice steps (fill in the word, order, match, who said it) are built from the week's checked text and pay nothing. A missed step comes back at the end until he gets it right; only the first try counts. Leaving partway keeps what he answered and reopening picks up there; a finished part replays as practice. The last screen shows XP, % right first time, time, the streak, and any new level or reward. A reel's clip plays on its Read screen and stops when he moves on. Or `…/#lesson`. |
| **Look back** | Below the plan, every reel and Go-deeper reading of the week by section, ✓ / ✕. One he has answered opens on its own screen as it was: picture, clip, verse and his answer, then its reading bonus and a note. One he hasn't opens its day's lesson. |
| **Your week** | Big numbers on the page: reels done, right first time, bonus finds, went deeper, notes, the puzzle, and "A perfect week!" or "You finished the week!" at the end. |
| **Go deeper** | The last step of each section's lesson, after its reels: a longer reading the lesson points to ("Read Isaiah 14:12–17") with one question only that reading answers. Friday adds two pieces: the children's part of the lesson and that month's Friend, For the Strength of Youth or Liahona. 25 XP each, first try, checked by `tools/verify.mjs` like the bonuses (the answer must be inside the passage it asks him to read). |
| **Scripture links** | Every scripture reference he can read is a link to it in Gospel Library, opening in a new tab: in the text, questions, answers' why lines, verse boxes, the week's reading, notes and the games. "(verse 22)" or "chapter 40" means the chapter of the verse the text belongs to, the same way the content checker reads it. Where a step tests memory (the warm-up, fill in the missing word, put the words in order, Verse Word's hints, Scripture Climb and the TV games before the answer shows), the link appears once he has answered. The app knows every book of the standard works; the checker fails if one is missing or if content names a reference that isn't real. |
| **Pictures and clips** | A picture on each reel it fits (Church Media Library art or public-domain photos, credited and linked), shown whole and undimmed at the top of the reel with the text below it, in the lesson and on the reel's own screen. At most 2 clips a week, only where they show something the words can't. Clips load nothing until tapped, then play just the chosen stretch in YouTube's privacy-mode player. |
| **Streak** | Days in a row with at least one question answered. A **streak freeze** (earned by solving the weekly puzzle) covers one missed day and is used automatically; the count shows next to the streak. |
| **Notes** | On an answered reel's own screen (from Look back), he can write what it means to him in his own words: 10 XP once per reel (12+ words, not filler). "Put it in my scriptures" copies the note and opens that verse in Gospel Library to paste it as a note there. No outside app can read Gospel Library notes, so the XP comes from writing it here. Notes are kept across weeks as a journal on his phone; a parent can read them in the parent screen, and the note box tells him so. |
| **🎮 Games** | Next to the streak. **Weekly puzzle**: a Connections-style sort of 16 ideas into the lesson's 4 sections, unlocked once every reel is answered; 4 mistakes a day, repeat guesses are free, a lost try resets the next day; solving pays 40 XP and a streak freeze. **Who said it?**: match lines quoted exactly from scripture to their speaker, 5 XP each on the first try; one line also comes back in each day's warm-up. **Verse Word**: real Wordle rules (six tries, green/yellow/gray letters, and every guess must be a word from the Bible or Book of Mormon, per `scripture-words.js`, rebuilt by `node tools/build-words.mjs`), with hints that unlock: after 2 guesses the chapter, after 4 the verse with a blank. 15 XP solved in 1–2, 10 in 3–4, 5 in 5–6. **Scripture Climb**: a Millionaire-style ladder of ten questions (reel questions, then reading-only bonuses) from 100 to 32,000 (a miss ends the climb and keeps the highest rung reached), with 50:50, Read it, and Ask a parent lifelines; the first climb each day pays 2 XP per right answer. **Scripture Showdown** and **Babylon Falls**: below. |
| **Babylon Falls** | A Risk-style map game for 2 to 5 players, about the fall of Babylon (Isaiah 45:1; Daniel 5). The map of the ancient Near East goes on a computer or TV (`…/#babylon`); everyone plays on their own phone or tablet with the join code (`…/#babylon-join-1234`) and picks a kingdom: Persia, Media, Lydia, Babylon or Egypt. No TV? **Play on this one screen** (`…/#babylon-here`): type a name next to each kingdom that's playing and pass the phone, tablet or computer around; a "Pass to Dad" screen comes between turns, and the game is kept on the device to continue later. Each kingdom starts at home with 4 armies; the other lands are neutral. It opens with the narrator's story (Isaiah 45:1, Isaiah 13:19, Jeremiah 51:58, Daniel 5:27), how to win, each turn, and the dice. Each turn: answer a question for armies (easy, a reel's own question from this week or an earlier one, 3; a **hunt** through a chapter, 5, where the question names only the chapter and its link opens the chapter at the top; a miss 1; plus 1 for every 3 lands), place them, attack neighbours with dice as in Risk (Babylon's walls give its defender 3 dice), and optionally move armies once. A timer (30 seconds, hunts 3 minutes; running out counts as a miss) can be turned to Relaxed. A narrator tells what happens ("Elam falls to Persia!"), read aloud on the big screen unless its voice is off. A 💡 Coach on each player's turn explains the choices and gives the real odds of an attack ("you'd take it about 93% of the time, losing about 2 armies"). The dice tumble across the map and land on their spots. A right hard answer can win a prophecy card that quotes its verse ("The two leaved gates" lets you ignore the walls; "Weighed in the balances" halves Babylonia's armies). After 5, 8 or 12 rounds the most land wins, Babylonia counting 3. The question shows on the map screen too so the family reads along, then the answer and why. The computer runs the game: phones send moves that it checks, so nobody can cheat from a phone (`firestore.rules`, `/risk`). A reload picks the game back up; Exit mid-game needs a second tap. It never changes XP. The board is `content/boards.js`, checked by `tools/verify.mjs`. |
| **Live game** | Kahoot-style. A TV or laptop hosts (`…/#host`): it shows a 4-digit code, then each question, and keeps score. Phones and tablets join with the code (`…/#join`, or `…/#join-1234`) and answer on their own screens in real time; the same answers appear in the same colors everywhere. 500 points for a right answer plus up to 500 for speed, 20 seconds a question, a leaderboard after each, and a family total at the end. No accounts needed to play; it never changes XP. Runs through Firebase across devices (`FIREBASE_CONFIG` in `index.html`, rules in `firestore.rules`); until that's set, it runs between tabs of one browser, which is also how the tests play it. |
| **👪 Family** | Optional, next to 🎮. Once a device is in a family, 💬 takes 👪's place in the top bar and opens straight to the chat (People is the other tab). A parent signs in (Google, or a sign-in link by email) and starts a family. Grown-ups (grandparents, friends, roommates, the other parent) are added by email and sign in with that address; a child is added by first name and joins by opening a one-time link on their own phone or tablet, with no account. Links work once, for 7 days. **People** shows each person's level, XP, streak and this week's right answers, and a family total. Each person's progress is saved to the family, so a new device ("Link another device") or a parent's second phone picks up where the other left off. Progress on a device belongs to one person: if a device already has progress when someone joins or signs in there, it asks whose it is, and someone else's is set aside on the device (it comes back when they sign out) instead of being mixed in. Two devices for the same person stay in step: an idle one catches up by itself, and if both changed while apart (say one was offline) they're merged, keeping every answer and note from both. People shows when this device last saved to the family. Parents see every device joined as a child and can remove one; a child whose devices are all removed is listed under "Taken out", with **Add back** (the saved progress comes too) or **Delete saved progress**. Whoever started the family always stays a parent. Email sign-in links are limited to 5 a day on Firebase's free plan; Google sign-in has no limit. **Chat** is one family chat, text and emoji only: no private messages, links or photos, nobody can delete a message, and a parent can hide one (everyone sees it was hidden; parents can still read it and unhide it). A dot on 💬 means a new message. `firestore.rules` enforces all of it. |
| **Year trail** | The page shows the 52 weeks of Come, Follow Me 2026 with this week marked; each finished week turns green. |
| **Scripture Showdown** | A quiz-show board game for the whole family, built from the week's checked questions. Columns are the lesson's sections; reel questions are the low values, reading-only bonus questions the high ones, one of them a Daily Double. A parent hosts on a laptop hooked to the TV and taps who got each one; scores add up to a family total and a family best. Open it from 🎮 (or Sunday's row on the week map), or bookmark `…/TreasureUp/#family`. It never changes his XP. |
| **Family rewards** | A parent sets rewards at XP marks behind a 4-digit PIN ("Pick Friday's movie at 300 XP"). He sees his progress on the page and gets "Reward unlocked, show a parent" when he crosses one (on a lesson's last screen, if it happened there); only the parent can mark it given. The PIN keeps an 11-year-old from editing his own rewards; it isn't security. |
| **Sections match church** | Reels are grouped under the lesson's own section headings, so what he reads lines up with class on Sunday. |

Progress lives in `localStorage` on that one device: no account, no
analytics, no network calls except the font. It still works with storage
blocked (private browsing); it just won't remember. A device that joins a
family also saves a copy to the family's Firebase project.

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

All content is **`content/weeks.js`** (see `content/README.md` for every
field). Blake reviews, approves, changes and publishes it from **developer
mode** on the test site (`…/TreasureUp-test/#dev`); new weeks arrive there as
drafts. **Add next week any time before its Monday**: the app opens on the
week whose dates include today, so it switches by itself (and last week turns
green on the year trail). Keep weeks in date order and drop ones older than
last week. One reel, the short version (as JSON in the file):

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

Three more fields feed the games:

- `puzzle.groups`: exactly 4 groups of 4 tiles, one group per lesson
  section. Each tile is `{ text, ref }`; the ref must be inside the week's
  reading.
- `sayings`: at least 6 `{ id, text, ref, speaker, wrong: [two], why }`.
  `text` must be quoted exactly from `ref`.
- `words`: Verse Word, one a day. `{ word, clue, ref }`: a 4–7 letter word in
  capitals, and the verse's own words with `____` where the word goes (shown
  as the last hint). The check puts the word in the blank and matches it
  against the verse, and makes sure the word is in `scripture-words.js` so it
  can be typed as a guess.

Then run:

```bash
node tools/verify.mjs --online   # quotes, references, and every Gospel Library page the week cites
```

and push to `main`. The deploy runs the same check and **refuses to publish**
if anything fails. The live app's deploy also refuses any week (from October
5, 2026 on) that isn't fully approved in developer mode. (If the Church website itself is down, that's a warning,
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

**Family setup** (once per Firebase project; both are done for the test
project, `scripturetok-test`):

1. **Authentication → Sign-in method:** turn on **Google**, **Email/Password**
   with **Email link (passwordless sign-in)**, and **Anonymous** (for live-game
   players and children's devices) with **Auto clean-up OFF**, since it
   deletes anonymous accounts 30 days after they're made, which would drop a
   child's device from the family.
2. **Authentication → Settings → Authorized domains:** add
   `blakemerrell.github.io`.
3. **Firestore → Rules:** paste all of `firestore.rules` and publish.

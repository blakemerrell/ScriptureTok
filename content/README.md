# Content

Every week the app knows lives in **`content/weeks.js`**: a comment, then
`window.TU_WEEKS = <JSON>;`. Everything after the equals sign is plain JSON,
because developer mode reads and writes it as JSON. Keep it that way when
editing by hand.

## Developer mode

`https://blakemerrell.github.io/TreasureUp-test/#dev` (also linked from the
Parents screen on the test site). It is for Blake and the people he adds by
name and email, each signed in with Google; the Firebase rules enforce that.

- Every week the test site has, each piece shown as he'll see it: the week
  itself, each reel (picture, text, verse, question, bonuses, clip), each Go
  deeper, the puzzle, each Who-said-it line, and the Verse Words.
- **Approve** a piece, or **Edit** it (a form, or the raw JSON). Changes
  collect until **Save and check**, which commits `content/weeks.js` to the
  test repo. The deploy runs `tools/verify.mjs`; developer mode shows either
  "Checked, and on the test site" or the checker's own findings.
- A piece's approval is a fingerprint of its content, so editing it after
  approval shows "Changed since approved" until it's approved again.
  Approving a reel with a clip marks the clip watched.
- **Publish to the live app** appears once every piece of a week is approved.
  It copies any pictures the live app lacks, then the week, to the live repo.
  The live deploy runs the check with `--require-approval` (weeks from
  October 5, 2026 on); if it refuses, developer mode puts the live file back.
- The GitHub token Blake connects (Contents: Read and write on TreasureUp and
  TreasureUp-test) is kept in the test Firebase project, readable only by the
  people on the list. Only Blake can change the list or the token.

Developer mode commits straight to the repos, so **before editing content in
git, pull first**: `git fetch test origin` and merge `test/main` (and
`origin/main`) into your branch.

## Fields

Each week is one entry in the list in weeks.js. Add next week after
the last one any time before its Monday; the app opens on the week whose dates
include today, so it switches by itself. Weeks stay in date order.
Drop weeks older than last week to keep the file small.

Run  node tools/verify.mjs  after every edit. It checks every quote
word for word against the scripture text, checks every reference
exists, and fails the deploy if anything doesn't match.

Week:
  dates, title, reference   exactly as the lesson page prints them
  lesson                    link to the lesson page
  sections                  the lesson's section headings, in order

deep (Go deeper): one per section, plus Friday's pieces.
  id, section (index) or day: "friday" with a title
  read      what he reads: a passage ("Isaiah 14:12–17", the one the
            lesson points to), "lesson", or a Gospel Library page
  intro     a sentence or two on why it's worth reading
  q, right, wrong, why, source, find   as for a bonus: answerable only
            from the reading, and `find` must be inside `read`
  A section's reading opens once its reels are answered. The cover
  plans the week: a section a day, Friday's deep dive, Saturday's
  puzzle, Sunday's family game.

Each reel:
  id        unique and stable. Changing it resets that reel's answer.
  section   index into `sections`
  hook      the headline. Short.
  body      plain words an 11-year-old reads easily. 75 words max.
            Scripture quoted here goes in “curly quotes” followed by
            its reference, e.g. “Thy dead men shall live” (Isaiah 26:19).
            A quote with no reference must come from this reel's verse.
            Every reference he reads becomes a link to it in Gospel
            Library: "Isaiah 28:16", "Isaiah 22", "1 Peter 2:6", and
            "(verse 22)" or "chapter 40", which mean this reel's own
            chapter (a Go-deeper reading's passage, a saying's verse).
            The checker fails a reference that isn't real, or a "verse 4"
            with no verse of its own to be read against.
  verse     { text, ref }: quoted from the scripture text exactly.
            Use … where words are left out.
  question  { q, right, wrong: [two wrong answers], why }
            Must be answerable from this reel. `why` shows after he
            answers and points to the words that settle it.
  bonus     optional { q, right, wrong, why, source, find }, or a list
            of them (they show one after another). Answerable ONLY from
            the reading. `source` is a verse ("Isaiah 22:15"), "lesson",
            or a Gospel Library page: the Friend, For the Strength of
            Youth, the Liahona or the manual (a churchofjesuschrist.org
            /study/… link). `find` is the exact words that settle it:
            they must be in the source and nowhere in the app. For a web
            page, write `why` in your own words, no “quotes”.
  hunt      optional, on a bonus or Go deeper whose question names a verse:
            the same question naming only the chapter, for the map game's
            chapter hunts ("In Isaiah 14, what do people ask…"). The answer
            (`find`) must be in that chapter just once; the checker says so.
            A question that names a verse and has no hunt stays out of the
            map game.
  media     optional. A picture on any reel it truly fits (a picture of
            Jesus Christ never goes on a reel about Satan); at most 2
            clips a week, only where they show something the words can't.
            image: { src: "media/….jpg", alt, credit, link }
                   link = its Media Library or Wikimedia Commons page
            video: { youtube, start, end, title, channel, previewed }
                   seconds; 3 minutes max; channel must be approved
                   in tools/verify.mjs; set previewed: true only after
                   a parent has watched the clip. Deploys refuse
                   clips that aren't previewed.
  gradient, blobA, blobB   colours

## The games' fields

- `puzzle.groups`: exactly 4 groups of 4 tiles, one group per lesson
  section. Each tile is `{ text, ref }`; the ref must be inside the week's
  reading.
- `sayings`: at least 6 `{ id, text, ref, speaker, wrong: [two], why }`.
  `text` must be quoted exactly from `ref`.
- `words`: Verse Word, one a day. `{ word, clue, ref }`: a 4–7 letter word in
  capitals, and the verse's own words with `____` where the word goes. The
  word must be in `scripture-words.js` so it can be typed as a guess.
- `approved` (and `wordsApproved` for the Verse Words): written by developer
  mode. Don't write these by hand.

## The map game's board (content/boards.js)

Babylon Falls plays on the first board in `window.TU_BOARDS`. It isn't tied
to a week: the questions come from the weeks in weeks.js.

- `lands`: `{ id, name, ring, label }`: the outline as `[x, y]` points on a
  `size` map, and where the name and armies sit.
- `links`: the borders, each pair once. Every land must be reachable.
- `kingdoms`: `{ id, name, home, color }`, 2 to 5, each with its own home land.
- `walls`: the land whose defender rolls 3 dice (Babylonia).
- `cards`: prophecy cards, `{ id, title, quote, ref, does }`. `quote` must be
  the verse's exact words; `does` is what playing it does, and the game's
  code has to know the card's `id`.
- `intro`: the line on the first screen; its references must be real.

The map outlines were drawn by a script from a hand-drawn coastline and
seed points; to change a border, change the outline and `links` together.
tools/verify.mjs checks all of this.

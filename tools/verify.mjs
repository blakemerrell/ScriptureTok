#!/usr/bin/env node
// Checks the week's content in index.html before it ships.
//
//   node tools/verify.mjs                       content, scripture and media checks
//   node tools/verify.mjs --online              also checks against the live Gospel Library pages:
//                                               the lesson page, and every magazine or manual page a
//                                               bonus cites (CI runs this). --lesson means the same.
//   (every week in the WEEKS list is checked. A clip nobody has watched yet is a note, not a
//   failure: the app hides it until previewed: true.)
//
// What it checks:
//   - every verse box quotes the scripture text exactly (… marks left-out words)
//   - every “quote” in a hook, body, question or answer is really in the verse it cites
//   - every reference named anywhere exists
//   - every bonus answer is in its chapter, or on the Gospel Library page it cites (the lesson,
//     the Friend, For the Strength of Youth, the Liahona), and NOWHERE in the app, so the
//     only way to get it is to read. A page that won't load is a warning, not a failure, so a
//     Church website outage can't block a deploy; words that aren't on the page are a failure.
//   - every picture has a description, a credit and a source link, and is small enough
//   - every clip comes from an approved channel (asked of YouTube itself), is under
//     3 minutes, and has been watched by a parent (previewed: true)
//   - every lesson section has a reel, every question is well formed, reels stay short
//
// Scripture text comes from the public-domain bcbooks/scriptures-json data,
// pinned to one commit so a check today gives the same answer as tomorrow.
// It is downloaded once into tools/.scripture-cache/ (or $SCRIPTURE_CACHE).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = process.env.SCRIPTURE_CACHE || path.join(ROOT, 'tools', '.scripture-cache');
const DATA_COMMIT = '3bda76e40add4582165340ea6b1198dc6ad26ae1';
const DATA_URL = `https://raw.githubusercontent.com/bcbooks/scriptures-json/${DATA_COMMIT}/`;
const VOLUMES = ['old-testament', 'new-testament', 'book-of-mormon', 'doctrine-and-covenants', 'pearl-of-great-price'];

const LIMITS = { bodyWords: 75, hookChars: 60, whyWords: 40, choiceChars: 60 };
const MEDIA = {
  maxPerWeek: 4,
  maxImageKB: 150,
  maxClipSeconds: 180,
  imageHosts: ['www.churchofjesuschrist.org', 'commons.wikimedia.org'],
  // YouTube channels a clip may come from, exactly as YouTube names them.
  // Add one only after deciding it's a source you trust for him.
  // Approved by Blake 2026-09-24: Come, Follow Me series and the Church's own channel.
  channels: [
    'The Church of Jesus Christ of Latter-day Saints',
    'Scripture Central',       // John Hilton III and others
    'followHIM Podcast',       // Hank Smith & John Bytheway
    "Don't Miss This",         // Emily Belle Freeman & David Butler
    'Talking Scripture',
    // Added by Blake 2026-09-24 (names confirmed with YouTube):
    'BibleProject',            // not Latter-day Saint: watch for readings that differ from the lesson
    'Church History Matters Podcast',
    'Gospel For Kids',
    'Latter Day Kids',
    'LDS Come Follow Me',
    'Line Upon Line — for Come Follow Me (Overviews for All Ages)'
  ]
};

const args = new Set(process.argv.slice(2));
const failures = [];
const notes = [];
let weekLabel = '';   // "Week 40 · " when checking several weeks
const fail = (where, msg) => failures.push(`${weekLabel}${where}: ${msg}`);
const note = msg => notes.push(`${weekLabel}${msg}`);

// ---------- scripture ----------

async function loadVolume(name) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `${DATA_COMMIT.slice(0, 7)}-${name}.json`);
  if (!fs.existsSync(file)) {
    const res = await fetch(DATA_URL + name + '.json');
    if (!res.ok) throw new Error(`Could not download ${name}: HTTP ${res.status}`);
    fs.writeFileSync(file, await res.text());
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function loadScripture() {
  const verses = new Map();   // "Isaiah 14:13" -> text
  const books = new Set();
  for (const name of VOLUMES) {
    const data = await loadVolume(name);
    const chapters = data.sections
      ? data.sections                                   // D&C is sections, not books
      : data.books.flatMap(b => b.chapters);
    for (const c of chapters) {
      for (const v of c.verses) {
        verses.set(v.reference, v.text);
        books.add(v.reference.replace(/ \d+:\d+$/, ''));
      }
    }
  }
  return { verses, books: [...books].sort((a, b) => b.length - a.length) };
}

// ---------- the week ----------

// Every week in index.html, by running its content script with a stand-in
// for the app (which would otherwise pick today's week and start up).
function loadWeeks() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const start = html.indexOf('const WEEKS = [];');
  const end = html.indexOf('</script>', start);
  if (start < 0 || end < 0) throw new Error('Could not find the WEEKS block in index.html');
  const stub = { pickWeek: w => w[0], boot() {} };
  return new Function('ScriptureTok', html.slice(start, end) + '\n;return WEEKS;')(stub);
}

// "September 28–October 4, 2026" -> "2026-09-28" (same rule as the app).
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function weekStart(dates) {
  const m = /^([A-Z][a-z]+) (\d{1,2})–(?:[A-Z][a-z]+ )?\d{1,2}, (\d{4})$/.exec(dates || '');
  if (!m || MONTHS.indexOf(m[1]) < 0) return null;
  return m[3] + '-' + String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0') + '-' + m[2].padStart(2, '0');
}

// A Gospel Library page as plain text, or null if it won't load.
async function fetchPageText(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) { notes.push(`couldn't load ${url} (HTTP ${res.status}); its bonus answers weren't checked`); return null; }
    return (await res.text())
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)))
      .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ');
  } catch (e) {
    notes.push(`couldn't reach ${url} (${e.message}); its bonus answers weren't checked`);
    return null;
  }
}

const bonusesOf = r => !r.bonus ? [] : Array.isArray(r.bonus) ? r.bonus : [r.bonus];
const GOSPEL_LIBRARY = /^https:\/\/www\.churchofjesuschrist\.org\/study\//;
// "lesson" is short for the week's lesson page.
const webSource = (b, week) => b.source === 'lesson' ? week.lesson : GOSPEL_LIBRARY.test(b.source || '') ? b.source : null;

// ---------- matching ----------

// Lowercased, one kind of apostrophe, no quote marks, single spaces.
const norm = s => s.toLowerCase()
  .replace(/[‘’]/g, "'").replace(/[“”"]/g, '')
  .replace(/\s+/g, ' ').trim();
const trimPunct = s => s.replace(/^[\s.,;:!?'—-]+|[\s.,;:!?'—-]+$/g, '');

// Is every …-separated piece of `quote` in `source`, in order?
function quoteMatches(quote, source) {
  const src = norm(source);
  let from = 0;
  for (const piece of quote.split('…').map(p => trimPunct(norm(p))).filter(Boolean)) {
    const at = src.indexOf(piece, from);
    if (at < 0) return false;
    from = at + piece.length;
  }
  return true;
}

// "Isaiah 14:13–14" -> ["Isaiah 14:13", "Isaiah 14:14"]
function expand(ref) {
  const m = /^(.+) (\d+):(\d+)(?:[–-](\d+))?$/.exec(ref.trim());
  if (!m) return null;
  const [, book, ch, a, b] = m;
  const out = [];
  for (let v = Number(a); v <= Number(b || a); v++) out.push(`${book} ${ch}:${v}`);
  return out;
}

async function main(scripture, week, pages, online) {
  const { verses, books } = scripture;

  const textOf = ref => {
    const refs = expand(ref);
    if (!refs || !refs.every(r => verses.has(r))) return null;
    return refs.map(r => verses.get(r)).join(' ');
  };

  // Resolve "(verse 13)" / "(verses 13–14)" against a home reference's chapter.
  const resolve = (ref, homeRef) => {
    const rel = /^verses? (\d+(?:[–-]\d+)?)$/.exec(ref.trim());
    if (rel) {
      const home = /^(.+ \d+):/.exec(homeRef || '');
      return home ? `${home[1]}:${rel[1]}` : null;
    }
    return ref.trim();
  };

  const bookPattern = books.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const anyRef = new RegExp(`(?:${bookPattern}) \\d+:\\d+(?:[–-]\\d+)?`, 'g');

  // Quotes, references and punctuation in one piece of text he reads.
  // A quote with no reference after it must come from `homeRef`.
  function checkText(where, field, text, homeRef) {
    if (!text) return;
    if (/"/.test(text)) fail(where, `${field} uses a straight " quote; use “curly quotes” so the quote gets checked`);
    if ((text.match(/“/g) || []).length !== (text.match(/”/g) || []).length) fail(where, `${field} has unbalanced “quotes”`);

    for (const m of text.matchAll(/“([^”]+)”(\s*\(([^)]+)\))?/g)) {
      const quote = m[1];
      const cited = m[3] ? resolve(m[3], homeRef) : homeRef;
      const source = cited ? textOf(cited) : null;
      if (source == null) fail(where, `${field}: can't find ${m[3] ? '"' + m[3] + '"' : 'a verse'} to check “${quote}” against`);
      else if (!quoteMatches(quote, source)) fail(where, `${field}: “${quote}” is not in ${cited}`);
    }
    for (const m of text.matchAll(anyRef)) {
      if (textOf(m[0]) == null) fail(where, `${field}: reference "${m[0]}" does not exist`);
    }
    for (const m of text.matchAll(/\(verses? (\d+(?:[–-]\d+)?)\)/g)) {
      const ref = resolve(`verse ${m[1]}`, homeRef);
      if (!ref || textOf(ref) == null) fail(where, `${field}: "(verse ${m[1]})" does not exist in ${(homeRef || '?').replace(/:.*/, '')}`);
    }
  }

  function checkQuestion(where, q, label) {
    if (!q.q || !q.right || !q.why) fail(where, `${label} needs q, right and why`);
    if (!Array.isArray(q.wrong) || q.wrong.length !== 2) fail(where, `${label} needs exactly two wrong answers`);
    const choices = [q.right, ...(q.wrong || [])];
    if (new Set(choices).size !== choices.length) fail(where, `${label}: answer choices must all be different`);
    for (const c of choices) if (c && c.length > LIMITS.choiceChars) fail(where, `${label}: choice "${c}" is over ${LIMITS.choiceChars} characters`);
    const whyWords = (q.why || '').split(/\s+/).filter(Boolean).length;
    if (whyWords > LIMITS.whyWords) fail(where, `${label}: why is ${whyWords} words (max ${LIMITS.whyWords})`);
  }

  // ----- week-level -----
  for (const k of ['dates', 'title', 'reference', 'lesson']) {
    if (!week[k]) fail('week', `missing ${k}`);
  }
  if (!Array.isArray(week.sections) || !week.sections.length) fail('week', 'no sections');
  if (!Array.isArray(week.reels) || !week.reels.length) fail('week', 'no reels');

  const ids = new Set();
  const used = new Set();
  let mediaCount = 0;

  // Everything he can read in the app without opening the reading.
  const appText = norm(week.reels.map(r => [
    r.hook, r.body, r.verse && r.verse.text,
    r.question && [r.question.q, r.question.right, ...(r.question.wrong || []), r.question.why].join(' '),
    ...bonusesOf(r).map(b => [b.q, ...(b.wrong || [])].join(' '))
  ].join(' ')).join(' '));

  for (const [n, r] of week.reels.entries()) {
    const where = r.id || `reel ${n + 1}`;

    if (!r.id || !/^[a-z0-9-]+$/.test(r.id)) fail(where, 'id must be lowercase letters, digits and dashes');
    if (ids.has(r.id)) fail(where, 'duplicate id');
    ids.add(r.id);

    if (!Number.isInteger(r.section) || !week.sections[r.section]) fail(where, 'section must be an index into sections');
    used.add(r.section);

    for (const k of ['hook', 'body']) if (!r[k]) fail(where, `missing ${k}`);
    if (r.hook && r.hook.length > LIMITS.hookChars) fail(where, `hook is ${r.hook.length} characters (max ${LIMITS.hookChars})`);
    const words = (r.body || '').split(/\s+/).filter(Boolean).length;
    if (words > LIMITS.bodyWords) fail(where, `body is ${words} words (max ${LIMITS.bodyWords})`);

    // Verse box: must be the scripture text, exactly.
    const boxText = r.verse && r.verse.ref ? textOf(r.verse.ref) : null;
    if (!r.verse || !r.verse.text || !r.verse.ref) fail(where, 'missing verse text or ref');
    else if (boxText == null) fail(where, `verse ref "${r.verse.ref}" not found`);
    else if (!quoteMatches(r.verse.text, boxText)) {
      fail(where, `verse text does not match ${r.verse.ref}\n      app : ${r.verse.text}\n      real: ${boxText}`);
    }

    // The reel's own question.
    const q = r.question || {};
    checkQuestion(where, q, 'question');
    const home = r.verse && r.verse.ref;
    checkText(where, 'hook', r.hook, home);
    checkText(where, 'body', r.body, home);
    checkText(where, 'question', q.q, home);
    checkText(where, 'why', q.why, home);
    checkText(where, 'right answer', q.right, home);
    checkText(where, 'wrong answers', (q.wrong || []).join(' | '), home);

    // Bonuses: answerable only from the reading.
    for (const [bn, b] of bonusesOf(r).entries()) {
      const label = bonusesOf(r).length > 1 ? `bonus ${bn + 1}` : 'bonus';
      checkQuestion(where, b, label);
      const url = webSource(b, week);
      if (!b.source || !b.find) fail(where, `${label} needs source and find`);
      else if (url) {
        if (/[“”]/.test(b.why)) fail(where, `${label} from a web page: don't put its words in “quotes” (only scripture quotes get checked)`);
        if (!online) note(`${where}: ${label} answer from ${url.replace(/\?.*/, '')} not checked (run with --online)`);
        else if (pages.get(url) != null && !norm(pages.get(url)).includes(trimPunct(norm(b.find)))) {
          fail(where, `${label}: "${b.find}" is not on ${url} (check the link and the exact wording; a mistyped link still loads a page)`);
        }
      } else if (/^https?:/.test(b.source)) {
        fail(where, `${label} source must be a verse, "lesson", or a Gospel Library page (churchofjesuschrist.org/study/…)`);
      } else {
        const src = textOf(b.source);
        if (src == null) fail(where, `${label} source "${b.source}" not found`);
        else if (!quoteMatches(b.find, src)) fail(where, `${label}: "${b.find}" is not in ${b.source}`);
        checkText(where, `${label} why`, b.why, b.source);
        checkText(where, `${label} question`, b.q, b.source);
      }
      if (b.find && appText.includes(trimPunct(norm(b.find)))) {
        fail(where, `${label}: "${b.find}" already appears in the app, so he doesn't need the reading to answer it`);
      }
    }

    // Media.
    const media = r.media || {};
    if (media.image) {
      mediaCount++;
      const im = media.image;
      if (!im.src || !/^media\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/.test(im.src)) fail(where, 'image src must be media/<lowercase-name>.jpg|png|webp');
      else {
        const file = path.join(ROOT, im.src);
        if (!fs.existsSync(file)) fail(where, `image file ${im.src} is missing`);
        else {
          const kb = Math.round(fs.statSync(file).size / 1024);
          if (kb > MEDIA.maxImageKB) fail(where, `image ${im.src} is ${kb} KB (max ${MEDIA.maxImageKB})`);
        }
      }
      if (!im.alt || im.alt.length < 20) fail(where, 'image needs an alt description he could picture (20+ characters)');
      if (!im.credit) fail(where, 'image needs a credit');
      let host = null;
      try { host = new URL(im.link).host; } catch (e) {}
      if (!MEDIA.imageHosts.includes(host)) fail(where, `image link must point to its page on ${MEDIA.imageHosts.join(' or ')}`);
    }
    if (media.video) {
      mediaCount++;
      const v = media.video;
      if (!/^[A-Za-z0-9_-]{11}$/.test(v.youtube || '')) fail(where, 'video.youtube must be an 11-character YouTube id');
      if (!(Number.isInteger(v.start) && Number.isInteger(v.end) && v.end > v.start)) fail(where, 'video needs whole-second start < end');
      else if (v.end - v.start > MEDIA.maxClipSeconds) fail(where, `clip is ${v.end - v.start}s (max ${MEDIA.maxClipSeconds})`);
      if (!v.title) fail(where, 'video needs a title');
      if (!MEDIA.channels.includes(v.channel)) fail(where, `channel "${v.channel}" isn't on the approved list in tools/verify.mjs`);
      // An unwatched clip is never shown in the app (only in the private
      // preview, marked, so a parent can review it). So it's a note, not a failure.
      if (v.previewed !== true) note(`${where}: clip ${v.youtube} ${v.start}–${v.end}s is hidden until a parent watches it and sets previewed: true`);
      // Ask YouTube who actually owns the video, so a typo'd id can't slip in another channel's clip.
      if (/^[A-Za-z0-9_-]{11}$/.test(v.youtube || '')) {
        const res = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + v.youtube));
        if (!res.ok) fail(where, `YouTube doesn't know video ${v.youtube} (HTTP ${res.status})`);
        else {
          const meta = await res.json();
          if (meta.author_name !== v.channel) fail(where, `video ${v.youtube} belongs to "${meta.author_name}", not "${v.channel}"`);
        }
      }
    }
  }

  if (mediaCount > MEDIA.maxPerWeek) fail('week', `${mediaCount} pictures and clips (max ${MEDIA.maxPerWeek}); keep it a lesson, not a video feed`);
  week.sections.forEach((s, i) => { if (!used.has(i)) fail('week', `section "${s}" has no reel`); });
  // The family board uses each section as a column; it needs at least 3 questions.
  week.sections.forEach((s, i) => {
    const n = week.reels.filter(r => r.section === i).reduce((k, r) => k + 1 + bonusesOf(r).length, 0);
    if (used.has(i) && n < 3) fail('week', `section "${s}" has ${n} question${n === 1 ? '' : 's'}; the family board needs at least 3 per section (add a bonus)`);
  });

  // Weekly puzzle: 4 groups of 4, one per section, every tile from this week's reading.
  if (week.puzzle) {
    const where = 'puzzle';
    const block = new Set();                                      // "Isaiah 13–14; 22; 24–30; 35"
    const bm = /^(.+?) (\d.*)$/.exec(week.reference || '');
    if (bm) for (const part of bm[2].split(';')) {
      const [a, z] = part.trim().split(/[–-]/).map(Number);
      for (let c = a; c <= (z || a); c++) block.add(`${bm[1]} ${c}`);
    }
    const groups = week.puzzle.groups || [];
    if (groups.length !== 4) fail(where, `needs exactly 4 groups (has ${groups.length})`);
    const secs = new Set(), texts = new Set();
    for (const [gi, g] of groups.entries()) {
      if (!week.sections[g.section]) fail(where, `group ${gi + 1}: section must be an index into sections`);
      if (secs.has(g.section)) fail(where, `group ${gi + 1}: two groups use the same section`);
      secs.add(g.section);
      if (!Array.isArray(g.tiles) || g.tiles.length !== 4) fail(where, `group ${gi + 1} needs exactly 4 tiles`);
      for (const t of g.tiles || []) {
        if (!t.text || t.text.length > 24) fail(where, `tile "${t.text}" must be 1–24 characters`);
        if (texts.has(t.text)) fail(where, `tile "${t.text}" appears twice`);
        texts.add(t.text);
        if (/[“”"]/.test(t.text || '')) fail(where, `tile "${t.text}": no quote marks on tiles`);
        if (!t.ref || textOf(t.ref) == null) fail(where, `tile "${t.text}": reference "${t.ref}" does not exist`);
        else if (block.size && !block.has(t.ref.replace(/:.*/, ''))) fail(where, `tile "${t.text}": ${t.ref} is outside this week's reading (${week.reference})`);
      }
    }
  }

  // Who said it?: every line quoted exactly from its reference.
  if (week.sayings) {
    const ids = new Set();
    if (week.sayings.length < 6) fail('sayings', `needs at least 6 lines (has ${week.sayings.length})`);
    for (const x of week.sayings) {
      const where = x.id || 'saying';
      if (!x.id || ids.has(x.id)) fail(where, 'each saying needs a unique id');
      ids.add(x.id);
      const src = x.ref ? textOf(x.ref) : null;
      if (src == null) fail(where, `reference "${x.ref}" does not exist`);
      else if (!quoteMatches(x.text || '', src)) fail(where, `"${x.text}" is not in ${x.ref}`);
      const choices = [x.speaker, ...(x.wrong || [])];
      if (!x.speaker || !Array.isArray(x.wrong) || x.wrong.length !== 2 || new Set(choices).size !== 3) fail(where, 'needs a speaker and two different wrong speakers');
      if (!x.why) fail(where, 'needs a why');
      else if (x.why.split(/\s+/).length > LIMITS.whyWords) fail(where, `why is over ${LIMITS.whyWords} words`);
      checkText(where, 'why', x.why, x.ref);
    }
  }

  // Verse Word: each word, put in its clue's blank, must be the verse's own words.
  if (week.words) {
    const seen = new Set();
    for (const w of week.words) {
      const where = 'word ' + (w.word || '?');
      if (!/^[A-Z]{4,7}$/.test(w.word || '')) fail(where, 'word must be 4–7 capital letters');
      if (seen.has(w.word)) fail(where, 'appears twice');
      seen.add(w.word);
      if ((w.clue || '').split('____').length !== 2) fail(where, 'clue needs exactly one ____ where the word goes');
      const src = w.ref ? textOf(w.ref) : null;
      if (src == null) fail(where, `reference "${w.ref}" does not exist`);
      else if (!quoteMatches((w.clue || '').replace('____', w.word || ''), src)) fail(where, `"${(w.clue || '').replace('____', w.word)}" is not in ${w.ref}`);
    }
  }

  const lessonText = pages.get(week.lesson);
  if (online && lessonText != null) {
    for (const [label, want] of [['title', week.title], ['reference', week.reference], ['dates', week.dates.replace(/, \d{4}$/, '')], ...week.sections.map(s => ['section', s])]) {
      if (!lessonText.includes(want)) fail('lesson', `${label} "${want}" is not on the lesson page`);
    }
  }
}

const scripture = await loadScripture();
const weeks = loadWeeks();
const online = args.has('--online') || args.has('--lesson');
const pages = new Map();
if (online) {
  const urls = new Set(weeks.flatMap(week => [week.lesson, ...week.reels.flatMap(r => bonusesOf(r).map(b => webSource(b, week)).filter(Boolean))]));
  await Promise.all([...urls].map(async u => pages.set(u, await fetchPageText(u))));
}

// Weeks: parseable dates, in order, one week each, no reel id reused.
const starts = weeks.map(w => weekStart(w.dates));
starts.forEach((d, i) => { if (!d) failures.push(`${weeks[i].title || 'a week'}: dates "${weeks[i].dates}" must read like "September 28–October 4, 2026"`); });
for (let i = 1; i < starts.length; i++) if (starts[i] && starts[i - 1] && starts[i] <= starts[i - 1]) failures.push(`weeks must be in date order: "${weeks[i].title}" comes before "${weeks[i - 1].title}"`);
const seenIds = new Map();
weeks.forEach(w => w.reels.forEach(r => { if (seenIds.has(r.id)) failures.push(`reel id "${r.id}" is used in both "${seenIds.get(r.id)}" and "${w.title}"`); seenIds.set(r.id, w.title); }));

for (const week of weeks) {
  const num = (/\/(\d+)\?/.exec(week.lesson || '') || [])[1];
  weekLabel = weeks.length > 1 ? `Week ${num || '?'} · ` : '';
  await main(scripture, week, pages, online);
}
weekLabel = '';

for (const n of notes) console.log('  · ' + n);
if (failures.length) {
  console.error(`✗ ${failures.length} problem${failures.length === 1 ? '' : 's'}:\n`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
for (const week of weeks) {
  const quotes = week.reels.reduce((n, r) => n + 1 + [r.hook, r.body, r.question.q, r.question.why, ...bonusesOf(r).map(b => b.why)].join(' ').split('“').length - 1, 0);
  const bonuses = week.reels.reduce((n, r) => n + bonusesOf(r).length, 0);
  const extras = [week.puzzle && 'the weekly puzzle', week.sayings && `${week.sayings.length} Who-said-it lines`, week.words && `${week.words.length} Verse Words`].filter(Boolean);
  console.log(`✓ ${week.title} (${week.dates}): ${week.reels.length} reels, ${quotes} quotes and ${bonuses} bonus answers checked` +
    (extras.length ? `, plus ${extras.join(' and ')}` : ''));
}
if (online) {
  const loaded = [...pages.values()].filter(t => t != null).length;
  console.log(`✓ ${loaded} of ${pages.size} Gospel Library pages checked live`);
}

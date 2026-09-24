#!/usr/bin/env node
// Checks the week's content in index.html before it ships.
//
//   node tools/verify.mjs                       content, scripture and media checks (CI runs this)
//   node tools/verify.mjs --lesson              also checks the week against the live lesson page
//   node tools/verify.mjs --allow-unpreviewed   for a private preview: clips nobody has watched yet pass
//
// What it checks:
//   - every verse box quotes the scripture text exactly (… marks left-out words)
//   - every “quote” in a hook, body, question or answer is really in the verse it cites
//   - every reference named anywhere exists
//   - every bonus answer is in its chapter (or on the lesson page) and NOWHERE in the app,
//     so the only way to get it is to read
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
  channels: ['Scripture Central', 'The Church of Jesus Christ of Latter-day Saints']
};

const args = new Set(process.argv.slice(2));
const failures = [];
const notes = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);

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

function loadWeek() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const start = html.indexOf('const WEEK_CONTENT = ');
  const end = html.indexOf('ScriptureTok.boot(WEEK_CONTENT)');
  if (start < 0 || end < 0) throw new Error('Could not find the WEEK_CONTENT block in index.html');
  const literal = html.slice(start + 'const WEEK_CONTENT = '.length, end).trim().replace(/;$/, '');
  return new Function('return (' + literal + ')')();
}

async function fetchLessonText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) { fail('lesson', `HTTP ${res.status} from ${url}`); return null; }
  return (await res.text())
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ');
}

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

async function main(scripture, week, lessonText) {
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
    r.bonus && [r.bonus.q, ...(r.bonus.wrong || [])].join(' ')
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

    // Bonus: answerable only from the reading.
    if (r.bonus) {
      const b = r.bonus;
      checkQuestion(where, b, 'bonus');
      if (!b.source || !b.find) fail(where, 'bonus needs source and find');
      else if (b.source === 'lesson') {
        if (/[“”]/.test(b.why)) fail(where, 'bonus from the lesson: don\'t put the lesson\'s words in “quotes” (they can only be checked against scripture)');
        if (lessonText == null) notes.push(`${where}: bonus answer from the lesson not checked (run with --lesson)`);
        else if (!norm(lessonText).includes(norm(b.find))) fail(where, `bonus: "${b.find}" is not on the lesson page`);
      } else {
        const src = textOf(b.source);
        if (src == null) fail(where, `bonus source "${b.source}" not found`);
        else if (!quoteMatches(b.find, src)) fail(where, `bonus: "${b.find}" is not in ${b.source}`);
        checkText(where, 'bonus why', b.why, b.source);
        checkText(where, 'bonus question', b.q, b.source);
      }
      if (b.find && appText.includes(trimPunct(norm(b.find)))) {
        fail(where, `bonus: "${b.find}" already appears in the app, so he doesn't need the reading to answer it`);
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
      if (v.previewed !== true) {
        if (args.has('--allow-unpreviewed')) notes.push(`${where}: clip not watched yet (allowed for this preview only)`);
        else fail(where, 'clip has not been watched by a parent yet: watch it, then set previewed: true');
      }
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
    const n = week.reels.filter(r => r.section === i).reduce((k, r) => k + 1 + (r.bonus ? 1 : 0), 0);
    if (used.has(i) && n < 3) fail('week', `section "${s}" has ${n} question${n === 1 ? '' : 's'}; the family board needs at least 3 per section (add a bonus)`);
  });

  if (lessonText != null) {
    for (const [label, want] of [['title', week.title], ['reference', week.reference], ['dates', week.dates.replace(/, \d{4}$/, '')], ...week.sections.map(s => ['section', s])]) {
      if (!lessonText.includes(want)) fail('lesson', `${label} "${want}" is not on the lesson page`);
    }
  }
}

const scripture = await loadScripture();
const week = loadWeek();
const lessonText = args.has('--lesson') ? await fetchLessonText(week.lesson) : null;
await main(scripture, week, lessonText);

for (const n of notes) console.log('  · ' + n);
if (failures.length) {
  console.error(`✗ ${failures.length} problem${failures.length === 1 ? '' : 's'}:\n`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
const quotes = week.reels.reduce((n, r) => n + 1 + [r.hook, r.body, r.question.q, r.question.why, r.bonus && r.bonus.why].join(' ').split('“').length - 1, 0);
const bonuses = week.reels.filter(r => r.bonus).length;
console.log(`✓ ${week.title} (${week.dates}): ${week.reels.length} reels, ${quotes} quotes and ${bonuses} bonus answers checked against the text` +
  (lessonText != null ? ', matches the lesson page' : ''));

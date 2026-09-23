#!/usr/bin/env node
// Checks the week's content in index.html before it ships.
//
//   node tools/verify.mjs            content + scripture checks (CI runs this)
//   node tools/verify.mjs --lesson   also checks the week against the live lesson page
//
// What it checks:
//   - every verse box quotes the scripture text exactly (… marks left-out words)
//   - every “quote” in a hook, body, question or answer is really in the verse it cites
//   - every reference named anywhere exists
//   - every lesson section has at least one reel, every question is well formed
//   - reels stay short enough to read comfortably
//
// Scripture text comes from the public-domain bcbooks/scriptures-json data,
// pinned to one commit so a check today gives the same answer as tomorrow.
// It is downloaded once into tools/.scripture-cache/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = process.env.SCRIPTURE_CACHE || path.join(ROOT, 'tools', '.scripture-cache');
const DATA_COMMIT = '3bda76e40add4582165340ea6b1198dc6ad26ae1';
const DATA_URL = `https://raw.githubusercontent.com/bcbooks/scriptures-json/${DATA_COMMIT}/`;
const VOLUMES = ['old-testament', 'new-testament', 'book-of-mormon', 'doctrine-and-covenants', 'pearl-of-great-price'];

const LIMITS = { bodyWords: 75, hookChars: 60, whyWords: 40, choiceChars: 60 };

const failures = [];
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

function main(scripture, week) {
  const { verses, books } = scripture;

  const textOf = ref => {
    const refs = expand(ref);
    if (!refs || !refs.every(r => verses.has(r))) return null;
    return refs.map(r => verses.get(r)).join(' ');
  };

  // Resolve "(verse 13)" / "(verses 13–14)" against the reel's own chapter.
  const resolve = (ref, homeRef) => {
    const rel = /^verses? (\d+(?:[–-]\d+)?)$/.exec(ref.trim());
    if (rel) {
      const home = /^(.+ \d+):/.exec(homeRef);
      return home ? `${home[1]}:${rel[1]}` : null;
    }
    return ref.trim();
  };

  const bookPattern = books.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const anyRef = new RegExp(`(?:${bookPattern}) \\d+:\\d+(?:[–-]\\d+)?`, 'g');

  // ----- week-level -----
  for (const k of ['dates', 'title', 'reference', 'lesson']) {
    if (!week[k]) fail('week', `missing ${k}`);
  }
  if (!Array.isArray(week.sections) || !week.sections.length) fail('week', 'no sections');
  if (!Array.isArray(week.reels) || !week.reels.length) fail('week', 'no reels');

  const ids = new Set();
  const used = new Set();

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

    // Question.
    const q = r.question || {};
    if (!q.q || !q.right || !q.why) fail(where, 'question needs q, right and why');
    if (!Array.isArray(q.wrong) || q.wrong.length !== 2) fail(where, 'question needs exactly two wrong answers');
    const choices = [q.right, ...(q.wrong || [])];
    if (new Set(choices).size !== choices.length) fail(where, 'answer choices must all be different');
    for (const c of choices) if (c && c.length > LIMITS.choiceChars) fail(where, `choice "${c}" is over ${LIMITS.choiceChars} characters`);
    const whyWords = (q.why || '').split(/\s+/).filter(Boolean).length;
    if (whyWords > LIMITS.whyWords) fail(where, `why is ${whyWords} words (max ${LIMITS.whyWords})`);

    // Every quote and every reference in the words he reads.
    const fields = { hook: r.hook, body: r.body, 'question': q.q, 'why': q.why, 'right answer': q.right, 'wrong answers': (q.wrong || []).join(' | ') };
    for (const [field, text] of Object.entries(fields)) {
      if (!text) continue;
      if (/"/.test(text)) fail(where, `${field} uses a straight " quote; use “curly quotes” so the quote gets checked`);
      if ((text.match(/“/g) || []).length !== (text.match(/”/g) || []).length) fail(where, `${field} has unbalanced “quotes”`);

      for (const m of text.matchAll(/“([^”]+)”(\s*\(([^)]+)\))?/g)) {
        const quote = m[1];
        const cited = m[3] ? resolve(m[3], r.verse.ref) : r.verse.ref;
        const source = cited ? textOf(cited) : null;
        if (source == null) fail(where, `${field}: can't find ${m[3] ? '"' + m[3] + '"' : 'the verse box'} for “${quote}”`);
        else if (!quoteMatches(quote, source)) fail(where, `${field}: “${quote}” is not in ${cited}`);
      }

      for (const m of text.matchAll(anyRef)) {
        if (textOf(m[0]) == null) fail(where, `${field}: reference "${m[0]}" does not exist`);
      }
      for (const m of text.matchAll(/\(verses? (\d+(?:[–-]\d+)?)\)/g)) {
        const ref = resolve(`verse ${m[1]}`, r.verse.ref);
        if (!ref || textOf(ref) == null) fail(where, `${field}: "(verse ${m[1]})" does not exist in ${r.verse.ref.replace(/:.*/, '')}`);
      }
    }
  }

  week.sections.forEach((s, i) => { if (!used.has(i)) fail('week', `section "${s}" has no reel`); });
}

async function checkLesson(week) {
  const res = await fetch(week.lesson, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) { fail('lesson', `HTTP ${res.status} from ${week.lesson}`); return; }
  const page = (await res.text())
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ');
  for (const [label, want] of [['title', week.title], ['reference', week.reference], ['dates', week.dates.replace(/, \d{4}$/, '')], ...week.sections.map(s => ['section', s])]) {
    if (!page.includes(want)) fail('lesson', `${label} "${want}" is not on the lesson page`);
  }
}

const scripture = await loadScripture();
const week = loadWeek();
main(scripture, week);
if (process.argv.includes('--lesson')) await checkLesson(week);

if (failures.length) {
  console.error(`✗ ${failures.length} problem${failures.length === 1 ? '' : 's'}:\n`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
const quotes = week.reels.reduce((n, r) => n + 1 + [r.hook, r.body, r.question.q, r.question.why].join(' ').split('“').length - 1, 0);
console.log(`✓ ${week.title} (${week.dates}): ${week.reels.length} reels, ${quotes} quotes checked against the text` +
  (process.argv.includes('--lesson') ? ', matches the lesson page' : ''));

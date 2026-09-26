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
  // A picture on any reel it fits (Blake, 2026-09-24: "most reels should get
  // a pic"), one per reel. Clips stay few: a lesson, not a video feed.
  maxClipsPerWeek: 2,
  maxImageKB: 150,
  maxClipSeconds: 180,
  imageHosts: ['www.churchofjesuschrist.org', 'commons.wikimedia.org'],
  // YouTube channels a clip may come from, exactly as YouTube names them.
  // Add one only after deciding it's a source you trust for him.
  // Approved by Blake 2026-09-24: Come, Follow Me series and the Church's own channel.
  channels: [
    'The Church of Jesus Christ of Latter-day Saints',   // @churchofjesuschrist, the official channel (confirmed 2026-09-24)
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
    'Line Upon Line — for Come Follow Me (Overviews for All Ages)',
    'Thumb Follow Me'          // kids' Bible stories; name confirmed with YouTube 2026-09-24
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

// The books the app can link (BOOK_PATHS in index.html), so every
// reference he reads can be a link to Gospel Library.
function appBooks() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const i = html.indexOf('const BOOK_PATHS = {');
  const j = html.indexOf('\n  };\n', i);
  if (i < 0 || j < 0) throw new Error('Could not find BOOK_PATHS in index.html');
  return Object.keys(new Function('return ' + html.slice(html.indexOf('{', i), j) + '}')());
}
// The app's other names for a book, as the scripture data names it.
const BOOK_ALIAS = { 'Psalm': 'Psalms', 'Song of Solomon': "Solomon's Song", 'Solomon’s Song': "Solomon's Song", 'Doctrine and Covenants': 'D&C' };

// ---------- the week ----------

// Every week in index.html, by running its content script with a stand-in
// for the app (which would otherwise pick today's week and start up).
// ---------- approval (developer mode) ----------
// Each piece of a week carries `approved`: a fingerprint of its content
// when Blake approved it in developer mode. Any later change makes the
// fingerprint stop matching. Must match the app's approvalHash exactly.
const canonJson = v => Array.isArray(v) ? '[' + v.map(canonJson).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonJson(v[k])).join(',') + '}'
  : JSON.stringify(v === undefined ? null : v);
function approvalHash(v) {
  const c = canonJson(v);
  let h = 0x811c9dc5;
  for (let i = 0; i < c.length; i++) { h ^= c.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
const withoutApproval = o => { const c = Object.assign({}, o); delete c.approved; return c; };
// The pieces a week is reviewed in, with the fingerprint each should carry.
function reviewItems(week) {
  const items = [{ key: 'week', approved: week.approved, hash: approvalHash({ dates: week.dates, title: week.title, reference: week.reference, lesson: week.lesson, sections: week.sections }) }];
  for (const r of week.reels || []) items.push({ key: 'reel:' + r.id, approved: r.approved, hash: approvalHash(withoutApproval(r)) });
  for (const d of week.deep || []) items.push({ key: 'deep:' + d.id, approved: d.approved, hash: approvalHash(withoutApproval(d)) });
  if (week.puzzle) items.push({ key: 'puzzle', approved: week.puzzle.approved, hash: approvalHash(withoutApproval(week.puzzle)) });
  for (const x of week.sayings || []) items.push({ key: 'say:' + x.id, approved: x.approved, hash: approvalHash(withoutApproval(x)) });
  if (week.words) items.push({ key: 'words', approved: week.wordsApproved, hash: approvalHash(week.words) });
  return items;
}
// Weeks from here on can't go live without every piece approved; the two
// weeks before went live before developer mode existed.
const REVIEW_FROM = '2026-10-05';

// content/weeks.js: a comment, then `window.TU_WEEKS = <JSON>;`. The same
// rule developer mode uses to read and write it.
const WEEKS_MARK = 'window.TU_WEEKS = ';
function loadWeeks() {
  const text = fs.readFileSync(path.join(ROOT, 'content', 'weeks.js'), 'utf8');
  const at = text.indexOf(WEEKS_MARK), end = text.lastIndexOf(';');
  if (at < 0 || end < at) throw new Error('content/weeks.js must be a comment, then window.TU_WEEKS = <JSON>;');
  try { return JSON.parse(text.slice(at + WEEKS_MARK.length, end)); }
  catch (e) { throw new Error('content/weeks.js is not valid JSON after window.TU_WEEKS = (' + e.message + ')'); }
}

// The map game's boards (content/boards.js): a map that holds together, and
// prophecy cards that quote scripture exactly.
const BOARDS_MARK = 'window.TU_BOARDS = ';
function loadBoards() {
  const file = path.join(ROOT, 'content', 'boards.js');
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  const at = text.indexOf(BOARDS_MARK), end = text.lastIndexOf(';');
  if (at < 0 || end < at) throw new Error('content/boards.js must be a comment, then window.TU_BOARDS = <JSON>;');
  try { return JSON.parse(text.slice(at + BOARDS_MARK.length, end)); }
  catch (e) { throw new Error('content/boards.js is not valid JSON after window.TU_BOARDS = (' + e.message + ')'); }
}
function checkBoards(boards, { verses }) {
  const textOf = ref => { const refs = expand(ref); return refs && refs.every(r => verses.has(r)) ? refs.map(r => verses.get(r)).join(' ') : null; };
  for (const b of boards) {
    const where = `board ${b.id || '?'}`;
    const ids = new Set((b.lands || []).map(l => l.id));
    if (ids.size !== (b.lands || []).length) failures.push(`${where}: land ids must be unique`);
    for (const l of b.lands || []) {
      if (!l.name || !Array.isArray(l.ring) || l.ring.length < 3) failures.push(`${where}: land ${l.id} needs a name and an outline`);
      if (!Array.isArray(l.label) || l.label[0] < 0 || l.label[1] < 0 || l.label[0] > b.size[0] || l.label[1] > b.size[1]) failures.push(`${where}: land ${l.id}'s label is off the map`);
    }
    const adj = {};
    for (const [x, y] of b.links || []) {
      if (!ids.has(x) || !ids.has(y) || x === y) { failures.push(`${where}: border ${x}–${y} names a land that isn't on the map`); continue; }
      (adj[x] = adj[x] || new Set()).add(y); (adj[y] = adj[y] || new Set()).add(x);
    }
    const first = [...ids][0], seen = new Set([first]), todo = [first];
    while (todo.length) for (const n of adj[todo.pop()] || []) if (!seen.has(n)) { seen.add(n); todo.push(n); }
    if (seen.size !== ids.size) failures.push(`${where}: every land must be reachable; can't reach ${[...ids].filter(i => !seen.has(i)).join(', ')}`);
    const homes = new Set();
    for (const k of b.kingdoms || []) {
      if (!ids.has(k.home)) failures.push(`${where}: kingdom ${k.name}'s home ${k.home} isn't on the map`);
      if (homes.has(k.home)) failures.push(`${where}: two kingdoms share the home ${k.home}`);
      homes.add(k.home);
      if (!/^#[0-9a-f]{6}$/i.test(k.color || '')) failures.push(`${where}: kingdom ${k.name} needs a color like #3b82f6`);
    }
    if ((b.kingdoms || []).length < 2) failures.push(`${where}: needs at least 2 kingdoms`);
    if (b.walls && !ids.has(b.walls)) failures.push(`${where}: walls land ${b.walls} isn't on the map`);
    for (const c of b.cards || []) {
      const src = c.ref ? textOf(c.ref) : null;
      if (!c.id || !c.title || !c.does) failures.push(`${where}: card ${c.id || '?'} needs an id, a title and what it does`);
      if (src == null) failures.push(`${where}: card ${c.id}: reference "${c.ref}" does not exist`);
      else if (!quoteMatches(c.quote || '', src)) failures.push(`${where}: card ${c.id}: "${c.quote}" is not in ${c.ref}`);
    }
    for (const m of (b.intro || '').matchAll(/\(([^)]+ \d+:\d+(?:[–-]\d+)?)\)/g)) if (textOf(m[1]) == null) failures.push(`${where}: intro reference "${m[1]}" does not exist`);
    for (const m of (b.intro || '').matchAll(/\b(Daniel|Isaiah|Ezra) (\d+)(?!:)/g)) if (!verses.has(`${m[1]} ${m[2]}:1`)) failures.push(`${where}: intro chapter "${m[0]}" does not exist`);
  }
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

  // Every reference in text he reads is a link in the app (linkRefs in
  // index.html), read the same way: each must be a real verse or chapter,
  // and "verse 12" or "chapter 40" means the chapter of the verse the text
  // belongs to (`home`), so it needs one.
  const linkable = APP_BOOKS.slice().sort((a, b) => b.length - a.length).map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const refRe = new RegExp(`(${linkable}) (\\d+)(?::(\\d+)(?:[–-](\\d+))?)?(?:[–-]\\d+)?|\\b([Vv]erses?|[Cc]hapter) (\\d+)(?:[–-](\\d+))?`, 'g');
  const listRe = /^(; ?)(\d+)(?::(\d+)(?:[–-]\d+)?)?(?:[–-]\d+)?(?! ?[A-Za-z])/;
  const exists = (book, ch, v) => verses.has(`${BOOK_ALIAS[book] || book} ${ch}:${v || 1}`);
  function checkRefs(where, field, text, home) {
    if (!text) return;
    const h = /^(.+?) (\d+)/.exec(home || '');
    const hb = h && APP_BOOKS.includes(h[1]) ? h : null;
    let m;
    refRe.lastIndex = 0;
    while ((m = refRe.exec(text))) {
      if (m[1] && m.index > 0 && /[A-Za-z0-9]/.test(text[m.index - 1])) continue;
      if (m[1]) {
        if (!exists(m[1], m[2], m[3]) || (m[4] && !exists(m[1], m[2], m[4]))) fail(where, `${field}: "${m[0]}" is not a real reference`);
        let at = m.index + m[0].length;
        for (let x; (x = listRe.exec(text.slice(at)));) {
          if (!exists(m[1], x[2], x[3])) fail(where, `${field}: "${m[1]} ${x[0].slice(x[1].length)}" is not a real reference`);
          at += x[0].length;
        }
        refRe.lastIndex = at;
      } else if (!hb) {
        fail(where, `${field}: "${m[0]}" has no verse to be read against; write the full reference (like "Isaiah 22:22")`);
      } else if (/^c/i.test(m[5]) ? !exists(hb[1], m[6]) : !exists(hb[1], hb[2], m[6]) || (m[7] && !exists(hb[1], hb[2], m[7]))) {
        fail(where, `${field}: "${m[0]}" is not in ${/^c/i.test(m[5]) ? hb[1] : hb[1] + ' ' + hb[2]}`);
      }
    }
  }
  checkRefs('week', 'reference', week.reference, null);
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
  let clipCount = 0;

  // Everything he can read in the app without opening the reading.
  const appText = norm(week.reels.map(r => [
    r.hook, r.body, r.verse && r.verse.text,
    r.question && [r.question.q, r.question.right, ...(r.question.wrong || []), r.question.why].join(' '),
    ...bonusesOf(r).map(b => [b.q, ...(b.wrong || [])].join(' '))
  ].join(' ')).join(' ') + ' ' + (week.deep || []).map(d => [d.intro, d.q, ...(d.wrong || [])].join(' ')).join(' '));

  // A question only the reading answers (a bonus, or a Go-deeper item):
  // its answer words are in the verse or Gospel Library page it cites, and
  // nowhere in the app.
  function checkReading(where, label, b) {
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
    for (const [f, t] of [['hook', r.hook], ['body', r.body], ['question', q.q], ['why', q.why], ['note prompt', r.note]]) checkRefs(where, f, t, home);
    for (const b of bonusesOf(r)) {
      const bh = b.source && textOf(b.source) != null ? b.source : home;
      checkRefs(where, 'bonus question', b.q, bh);
      checkRefs(where, 'bonus why', b.why, bh);
    }

    // Bonuses: answerable only from the reading.
    for (const [bn, b] of bonusesOf(r).entries()) {
      checkReading(where, bonusesOf(r).length > 1 ? `bonus ${bn + 1}` : 'bonus', b);
    }

    // Media.
    const media = r.media || {};
    if (media.image) {
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
      // A picture of the Savior never goes on a reel about Satan: next to
      // that headline it reads as a picture of him. (Found by Blake on the
      // Lucifer reel, 2026-09-24.)
      const showsChrist = /\b(Jesus|Christ|Christus|Savior|Saviour|Messiah)\b/i.test((im.alt || '') + ' ' + (im.credit || ''));
      const aboutSatan = /\b(Lucifer|Satan|devil|adversary)\b/i.test([r.hook, r.body, r.verse && r.verse.text].join(' '));
      if (showsChrist && aboutSatan) fail(where, `the picture shows Jesus Christ, but this reel is about Satan; next to "${r.hook}" it reads as a picture of him`);
      if (!im.credit) fail(where, 'image needs a credit');
      let host = null;
      try { host = new URL(im.link).host; } catch (e) {}
      if (!MEDIA.imageHosts.includes(host)) fail(where, `image link must point to its page on ${MEDIA.imageHosts.join(' or ')}`);
    }
    if (media.video) {
      clipCount++;
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

  // Go deeper: a reading per section (the one the lesson points to) and
  // Friday's pieces, each with a question only that reading answers.
  const days = new Set();
  for (const d of week.deep || []) {
    const where = d.id || 'a Go-deeper item';
    if (!d.id || !/^[a-z0-9-]+$/.test(d.id)) fail(where, 'id must be lowercase letters, digits and dashes');
    if (ids.has(d.id)) fail(where, 'duplicate id');
    ids.add(d.id);
    const friday = d.day === 'friday';
    if (!friday && !(Number.isInteger(d.section) && week.sections[d.section])) fail(where, 'needs a section (an index into sections) or day: "friday"');
    if (!friday && days.has(d.section)) fail(where, `section ${d.section} already has a Go-deeper reading (one per section)`);
    days.add(d.section);
    if (friday && !d.title) fail(where, 'a Friday piece needs a title');
    if (!d.intro) fail(where, 'missing intro');
    const introWords = (d.intro || '').split(/\s+/).filter(Boolean).length;
    if (introWords > LIMITS.whyWords + 5) fail(where, `intro is ${introWords} words (max ${LIMITS.whyWords + 5})`);
    // What he's asked to read: a passage, the lesson, or a Gospel Library page.
    const passage = /^https?:|^lesson$/.test(d.read || '') ? null : d.read;
    if (!d.read) fail(where, 'missing read');
    else if (passage) {
      const text = textOf(passage);
      if (text == null) fail(where, `read "${passage}" not found`);
      else if (d.find && !quoteMatches(d.find, text)) fail(where, `the answer "${d.find}" is not in ${passage}, the passage it asks him to read`);
    } else if (!webSource({ source: d.read }, week)) fail(where, 'read must be a passage, "lesson", or a Gospel Library page');
    checkText(where, 'intro', d.intro, passage);
    checkReading(where, 'question', d);
    const dh = d.source && textOf(d.source) != null ? d.source : passage;
    checkRefs(where, 'intro', d.intro, passage);
    checkRefs(where, 'question', d.q, dh);
    checkRefs(where, 'why', d.why, dh);
  }

  if (clipCount > MEDIA.maxClipsPerWeek) fail('week', `${clipCount} clips (max ${MEDIA.maxClipsPerWeek}); keep it a lesson, not a video feed`);
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
      checkRefs(where, 'why', x.why, x.ref);
    }
  }

  // Verse Word: each word, put in its clue's blank, must be the verse's own words,
  // and must be on the guess list (scripture-words.js) so it can be typed.
  if (week.words) {
    const seen = new Set();
    const listFile = path.join(ROOT, 'scripture-words.js');
    const guessable = fs.existsSync(listFile) ? new Set((/"([A-Z ]+)"/.exec(fs.readFileSync(listFile, 'utf8')) || [, ''])[1].split(' ')) : null;
    if (!guessable) fail('words', 'scripture-words.js is missing: run node tools/build-words.mjs');
    for (const w of week.words) {
      const where = 'word ' + (w.word || '?');
      if (!/^[A-Z]{4,7}$/.test(w.word || '')) fail(where, 'word must be 4–7 capital letters');
      if (seen.has(w.word)) fail(where, 'appears twice');
      if (guessable && w.word && !guessable.has(w.word)) fail(where, 'is not in scripture-words.js, so nobody could type it as a guess');
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
const APP_BOOKS = appBooks();
{
  const missing = scripture.books.filter(b => !APP_BOOKS.includes(b));
  if (missing.length) failures.push(`index.html: BOOK_PATHS has no Gospel Library link for ${missing.join(', ')}`);
}
const weeks = loadWeeks();
const boards = loadBoards();
checkBoards(boards, scripture);
const online = args.has('--online') || args.has('--lesson');
const pages = new Map();
if (online) {
  const urls = new Set(weeks.flatMap(week => [week.lesson, ...week.reels.flatMap(r => bonusesOf(r).map(b => webSource(b, week)).filter(Boolean)),
    ...(week.deep || []).map(d => webSource(d, week)).filter(Boolean)]));
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
  // The live app only takes weeks Blake approved in developer mode.
  if (args.has('--require-approval') && weekStart(week.dates) >= REVIEW_FROM) {
    for (const it of reviewItems(week)) {
      if (!it.approved) failures.push(`${weekLabel}${it.key}: not approved yet (approve it in developer mode, then publish)`);
      else if (it.approved !== it.hash) failures.push(`${weekLabel}${it.key}: changed since it was approved (approve it again in developer mode)`);
    }
  }
}
weekLabel = '';

for (const n of notes) console.log('  · ' + n);
if (failures.length) {
  console.error(`✗ ${failures.length} problem${failures.length === 1 ? '' : 's'}:\n`);
  for (const f of failures) console.error('  - ' + f);
  // In GitHub Actions each problem is also an annotation on the commit,
  // which is how developer mode shows Blake what the checker found.
  if (process.env.GITHUB_ACTIONS) {
    const clean = t => t.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    for (const f of failures.slice(0, 10)) console.log(`::error title=Content check::${clean(f)}`);
  }
  process.exit(1);
}
for (const week of weeks) {
  const quotes = week.reels.reduce((n, r) => n + 1 + [r.hook, r.body, r.question.q, r.question.why, ...bonusesOf(r).map(b => b.why)].join(' ').split('“').length - 1, 0);
  const bonuses = week.reels.reduce((n, r) => n + bonusesOf(r).length, 0);
  const extras = [(week.deep || []).length && `${week.deep.length} Go-deeper readings`, week.puzzle && 'the weekly puzzle', week.sayings && `${week.sayings.length} Who-said-it lines`, week.words && `${week.words.length} Verse Words`].filter(Boolean);
  console.log(`✓ ${week.title} (${week.dates}): ${week.reels.length} reels, ${quotes} quotes and ${bonuses} bonus answers checked` +
    (extras.length ? `, plus ${extras.join(' and ')}` : ''));
}
if (boards.length) console.log(`✓ ${boards.map(b => `${b.title}: ${b.lands.length} lands, ${b.links.length} borders, ${b.kingdoms.length} kingdoms, ${b.cards.length} prophecy cards`).join('; ')}`);
if (online) {
  const loaded = [...pages.values()].filter(t => t != null).length;
  console.log(`✓ ${loaded} of ${pages.size} Gospel Library pages checked live`);
}

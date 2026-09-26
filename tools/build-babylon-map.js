// Draws Babylon Falls' map into content/boards.js: several seed points per
// land along its real extent, their Voronoi cells merged and clipped to a
// hand-drawn coastline, then the borders worked out from the shapes and
// compared with the ones wanted (WANT). Kingdoms, cards and the rest of the
// board are kept as they are.
//   npm install --no-save d3-delaunay@6 polygon-clipping@0.15 polylabel@1
//   node tools/build-babylon-map.js
const { Delaunay } = require('d3-delaunay');
const pc = require('polygon-clipping');
const polylabel = require('polylabel');
const W = 1000, H = 620;
const SEAS = {
  'Mediterranean': [[0,285],[70,300],[150,292],[240,300],[305,296],[345,318],[352,360],[342,405],[322,445],[292,478],[240,470],[190,482],[140,470],[80,478],[0,470]],
  'Black Sea': [[40,0],[40,40],[120,62],[230,55],[330,66],[420,52],[470,30],[500,0]],
  'Caspian Sea': [[790,0],[782,50],[800,110],[838,160],[880,165],[905,120],[900,50],[890,0]],
  'Persian Gulf': [[676,478],[722,466],[790,492],[860,528],[940,546],[1000,552],[1000,620],[770,620],[735,575],[700,525]],
  'Red Sea': [[296,528],[314,522],[352,578],[378,620],[330,620],[300,570]]
};
const LANDS = {
  lydia: ['Lydia', [[55,120],[95,215],[150,170],[120,260]]],
  cappadocia: ['Cappadocia', [[240,105],[330,125],[290,185],[390,120]]],
  cilicia: ['Cilicia', [[215,262],[290,262],[345,255]]],
  armenia: ['Armenia', [[500,60],[580,55],[660,80],[730,40]]],
  assyria: ['Assyria', [[440,180],[520,195],[570,245],[470,235]]],
  media: ['Media', [[700,150],[770,215],[730,285],[860,215],[950,180],[950,280]]],
  syria: ['Syria', [[372,300],[410,290],[455,300],[490,350],[440,380]]],
  phoenicia: ['Phoenicia', [[366,345],[370,392]]],
  judah: ['Judah', [[360,425],[385,462],[315,500]]],
  arabia: ['Arabia', [[430,520],[520,470],[560,560],[630,530],[410,600],[670,590]]],
  babylonia: ['Babylonia', [[585,320],[620,385],[655,445],[560,390]]],
  elam: ['Elam', [[730,350],[755,420],[790,360]]],
  persis: ['Persis', [[850,420],[905,470],[880,350],[965,410]]],
  egypt: ['Egypt', [[80,540],[180,520],[230,585],[255,505],[120,600]]]
};
let land = [[[[0,0],[W,0],[W,H],[0,H],[0,0]]]];
for (const s of Object.values(SEAS)) land = pc.difference(land, [[...s, s[0]]]);
const seeds = [], owner = [];
for (const [id, [, pts]] of Object.entries(LANDS)) for (const p of pts) { seeds.push(p); owner.push(id); }
const del = Delaunay.from(seeds), vor = del.voronoi([0, 0, W, H]);
const area = r => Math.abs(r.reduce((s, p, k) => { const q = r[(k + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
const inRing = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
const onLand = pt => land.some(poly => inRing(pt, poly[0]) && !poly.slice(1).some(h => inRing(pt, h)));
const out = Object.entries(LANDS).map(([id, [name]]) => {
  const cells = seeds.map((_, i) => i).filter(i => owner[i] === id).map(i => [[vor.cellPolygon(i)]]);
  let shape = cells.reduce((acc, c) => pc.union(acc, c));
  shape = pc.intersection(shape, land);
  const piece = shape.sort((a, b) => area(b[0]) - area(a[0]))[0];
  const ring = piece[0].map(([x, y]) => [Math.round(x), Math.round(y)]);
  const lab = polylabel([piece[0]], 1);
  return { id, name, ring, label: [Math.round(lab[0]), Math.round(lab[1])] };
});
// Neighbours: a Voronoi edge between two lands' cells, running over land.
const len = {};
for (let i = 0; i < seeds.length; i++) for (const j of del.neighbors(i)) {
  if (j < i || owner[i] === owner[j]) continue;
  const a = vor.cellPolygon(i), b = vor.cellPolygon(j);
  const shared = a.filter(p => b.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.01));
  if (shared.length < 2) continue;
  const [p, q] = shared, L = Math.hypot(q[0] - p[0], q[1] - p[1]);
  let landLen = 0;
  for (let t = 0.025; t < 1; t += 0.05) if (onLand([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])) landLen += L * 0.05;
  const key = [owner[i], owner[j]].sort().join('|');
  len[key] = (len[key] || 0) + landLen;
}
const links = Object.entries(len).filter(([, l]) => l >= 10).map(([k]) => k.split('|')).sort();
const fs = require('fs'), path = require('path');
const file = path.join(__dirname, '..', 'content', 'boards.js'), MARK = 'window.TU_BOARDS = ';
const text = fs.readFileSync(file, 'utf8'), at = text.indexOf(MARK), end = text.lastIndexOf(';');
const boards = JSON.parse(text.slice(at + MARK.length, end));
const b = boards.find(x => x.id === 'babylon');
Object.assign(b, { size: [W, H], lands: out, links, seas: Object.entries(SEAS).map(([name, ring]) => ({ name, ring })) });
const WANT = { lydia: 'cappadocia cilicia', cappadocia: 'armenia assyria cilicia lydia', cilicia: 'assyria cappadocia lydia syria', armenia: 'assyria cappadocia media',
  assyria: 'armenia babylonia cappadocia cilicia media syria', media: 'armenia assyria babylonia elam persis', syria: 'arabia assyria babylonia cilicia judah phoenicia',
  phoenicia: 'judah syria', judah: 'arabia egypt phoenicia syria', arabia: 'babylonia egypt judah syria', babylonia: 'arabia assyria elam media syria',
  elam: 'babylonia media persis', persis: 'elam media', egypt: 'arabia judah' };
const adj = {}; for (const [a, b] of links) { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); }
let bad = 0;
for (const id of Object.keys(LANDS)) { const got = (adj[id] || []).sort().join(' '); const ok = got === WANT[id]; if (!ok) bad++; console.log((ok ? '  ' : '✗ ') + id.padEnd(11), got, ok ? '' : '   want: ' + WANT[id]); }
console.log(bad ? bad + ' lands off' : 'all neighbours as intended');
if (bad) process.exit(1);
fs.writeFileSync(file, text.slice(0, at + MARK.length) + JSON.stringify(boards) + text.slice(end));
console.log('wrote', path.relative(process.cwd(), file));

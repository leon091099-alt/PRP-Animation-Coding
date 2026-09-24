// build-geo.mjs – einmaliger Geo-Build für RiverBridge.
// Quellen (Cache in scripts/.cache, siehe scripts/fetch-geo.mjs):
//   OSM simplified land polygons (Küste/Land), Natural Earth 10m (Stadtflächen, Seen),
//   OSM waterway=river|canal via Overpass (Nebengewässer + Flussnetz), AWS Terrain Tiles (Relief).
// Ergebnis: scripts/out/geo.json, scripts/out/preview-*.svg und Inline-Block in src/RiverBridge.tsx.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as shapefile from 'shapefile';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'scripts/.cache');
const OUT = path.join(ROOT, 'scripts/out');
fs.mkdirSync(OUT, { recursive: true });

const PLATE_DEPTH = 6.5;
const MARGIN = 0.06; // Innenrand: BBox füllt die inneren 88 %
const HN = 96; // Heightmap-Auflösung (Runtime-Grid 192² interpoliert)
const Q = 4095;
// Nebengewässer (Spec 5.2): Douglas-Peucker 150 m, Mindestlänge 3 km
const MINOR_DP_KM = 0.15, MINOR_MIN_KM = 3;

// ---------------------------------------------------------------- Seiten
const SIDES = {
  cn: {
    bbox: { lat0: 21.95, lat1: 23.45, lng0: 112.7, lng1: 114.7 },
    mouth: [22.15, 113.9],
    mouthDir: [0, 1], // Süden (+z)
    veins: [
      { id: 'pearl', order: 1, water: 'pearl',
        guide: [[23.115, 113.265], [23.1, 113.4], [23.07, 113.52], [22.92, 113.62], [22.8, 113.66], [22.62, 113.74], [22.45, 113.8], [22.3, 113.85], [22.15, 113.9]] },
      { id: 'foshan', order: 2, parent: 'pearl', city: 'foshan',
        guide: [[23.022, 113.122], [23.08, 113.2], [23.115, 113.265]] },
      { id: 'dongjiang', order: 2, parent: 'pearl', city: 'huizhou', water: 'dongjiang',
        guide: [[23.112, 114.416], [23.08, 114.25], [23.11, 114.05], [23.1, 113.88], [23.06, 113.7], [23.03, 113.58], [23.07, 113.52]] },
      { id: 'shenzhen', order: 3, parent: 'pearl', city: 'shenzhen',
        guide: [[22.543, 114.058], [22.5, 113.93], [22.45, 113.8]] },
      { id: 'hongkong', order: 3, parent: 'pearl', city: 'hongkong', sea: true,
        guide: [[22.302, 114.177], [22.29, 114.05], [22.3, 113.85]] },
      { id: 'guangzhou', order: 3, parent: 'pearl', city: 'guangzhou', procedural: true },
      { id: 'dongguan', order: 3, parent: 'dongjiang', city: 'dongguan', procedural: true },
    ],
    hair: [/流溪河|Liuxi/, /增江|Zengjiang/, /沙湾水道|Shawan/, /潭江|Tanjiang/, /西江|Xijiang/, /北江|Beijiang/, /洪奇沥|Hongqili/, /蕉门|Jiaomen/, /西福河/, /石马河|Shima/, /淡水河|Danshui/, /西枝江|Xizhi/],
  },
  rh: {
    bbox: { lat0: 50.7, lat1: 52.2, lng0: 3.3, lng1: 7.3 },
    mouth: [51.98, 4.06],
    mouthDir: [-1, 0], // Westen (-x)
    veins: [
      { id: 'rhine', order: 1, city: 'koeln', water: 'rhine',
        guide: [[50.938, 6.96], [51.03, 6.985], [51.13, 6.88], [51.228, 6.773], [51.34, 6.72], [51.434, 6.762], [51.56, 6.64], [51.66, 6.61], [51.79, 6.35], [51.84, 6.1], [51.86, 5.87], [51.89, 5.43], [51.83, 4.97], [51.81, 4.67], [51.905, 4.48], [51.94, 4.25], [51.98, 4.06]] },
      { id: 'maas', order: 2, parent: 'rhine', water: 'maas',
        guide: [[51.37, 6.17], [51.52, 6.1], [51.66, 5.96], [51.76, 5.75], [51.76, 5.52], [51.73, 5.3], [51.72, 5.1], [51.705, 4.9], [51.71, 4.75], [51.78, 4.68], [51.81, 4.67]] },
      { id: 'ruhr', order: 2, parent: 'rhine', name: /^Ruhr$/ },
      { id: 'schelde', order: 2, root: true, city: 'antwerpen', water: 'scheldt',
        guide: [[51.219, 4.402], [51.3, 4.29], [51.37, 4.1], [51.42, 3.85], [51.44, 3.58]] },
      { id: 'srkanaal', order: 3, parent: 'rhine', canal: true,
        guide: [[51.25, 4.39], [51.3, 4.33], [51.43, 4.23], [51.55, 4.21], [51.64, 4.26], [51.69, 4.4], [51.7, 4.58], [51.76, 4.63], [51.81, 4.67]] },
    ],
    hair: [/^Lippe$/, /^Erft$/, /^Wupper$/, /^Niers$/, /^Emscher$/, /^Lek$/, /^Gelderse IJssel$|^IJssel$/, /^Dommel$/, /^Roer$|^Rur$/, /^Düssel$/, /^Schwalm$|^Swalm$/],
  },
};

const CITIES = {
  shenzhen: [22.543, 114.058], hongkong: [22.302, 114.177], guangzhou: [23.129, 113.264],
  dongguan: [23.021, 113.752], huizhou: [23.112, 114.416], foshan: [23.022, 113.122],
  koeln: [50.938, 6.96], duesseldorf: [51.228, 6.773], duisburg: [51.434, 6.762],
  rotterdam: [51.922, 4.479], antwerpen: [51.219, 4.402],
};

// ---------------------------------------------------------------- Geometrie-Helfer
function extentOf(b) {
  const k = MARGIN / (1 - 2 * MARGIN);
  const dLat = b.lat1 - b.lat0, dLng = b.lng1 - b.lng0;
  return { lat0: b.lat0 - dLat * k, lat1: b.lat1 + dLat * k, lng0: b.lng0 - dLng * k, lng1: b.lng1 + dLng * k };
}
const toUV = (E) => (lat, lng) => [(lng - E.lng0) / (E.lng1 - E.lng0), (E.lat1 - lat) / (E.lat1 - E.lat0)];
function kmProj(latc) {
  const kx = 111.32 * Math.cos((latc * Math.PI) / 180), ky = 110.57;
  return (lat, lng) => [lng * kx, lat * ky];
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const q = [a[0] + t * dx, a[1] + t * dy];
  return [dist(p, q), q, t];
}
function nearestOnLine(p, line) {
  let best = [Infinity, null, 0];
  for (let i = 0; i < line.length - 1; i++) {
    const r = segDist(p, line[i], line[i + 1]);
    if (r[0] < best[0]) best = [r[0], r[1], i + r[2]];
  }
  return best;
}
function lineLen(l) { let s = 0; for (let i = 1; i < l.length; i++) s += dist(l[i - 1], l[i]); return s; }
function douglasPeucker(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) { const d = segDist(pts[i], pts[a], pts[b])[0]; if (d > md) { md = d; mi = i; } }
    if (md > tol && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function ringArea(r) { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return s / 2; }
// Sutherland–Hodgman gegen [0,1]²
function clipRing(ring) {
  let out = ring;
  const edges = [[0, 0, 1], [0, 1, -1], [1, 0, 1], [1, 1, -1]]; // axis, value, sign (inside if sign*(p-v)>=0)
  for (const [ax, v, s] of edges) {
    const inp = out; out = [];
    if (!inp.length) break;
    for (let i = 0; i < inp.length; i++) {
      const cur = inp[i], prev = inp[(i + inp.length - 1) % inp.length];
      const ci = s * (cur[ax] - v) >= 0, pi = s * (prev[ax] - v) >= 0;
      if (ci) {
        if (!pi) out.push(intersect(prev, cur, ax, v));
        out.push(cur);
      } else if (pi) out.push(intersect(prev, cur, ax, v));
    }
  }
  return out;
}
function intersect(a, b, ax, v) { const t = (v - a[ax]) / (b[ax] - a[ax]); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
// Polylinie an [0,1]² clippen → Teilstücke
function clipLine(line, pad = 0) {
  const inside = (p) => p[0] >= -pad && p[0] <= 1 + pad && p[1] >= -pad && p[1] <= 1 + pad;
  const parts = []; let cur = [];
  for (let i = 0; i < line.length; i++) {
    if (inside(line[i])) cur.push(line[i]);
    else { if (cur.length > 1) parts.push(cur); cur = []; }
  }
  if (cur.length > 1) parts.push(cur);
  return parts;
}

// ---------------------------------------------------------------- Encoding (12 bit je Koordinate)
// Delta-Varint: je Linie n, erster Punkt absolut, danach ZigZag-Deltas (12-bit-Raster)
function encodeLines(lines) {
  const bytes = [];
  const vu = (v) => { while (v > 127) { bytes.push((v & 127) | 128); v >>>= 7; } bytes.push(v); };
  const zz = (v) => vu(v >= 0 ? v * 2 : -v * 2 - 1);
  for (const l of lines) {
    vu(l.length);
    let px = 0, py = 0;
    l.forEach((p, i) => {
      const x = Math.round(Math.max(0, Math.min(1, p[0])) * Q), y = Math.round(Math.max(0, Math.min(1, p[1])) * Q);
      if (i === 0) { vu(x); vu(y); } else { zz(x - px); zz(y - py); }
      px = x; py = y;
    });
  }
  return Buffer.from(bytes).toString('base64');
}
function quantDedupe(l) {
  const out = [];
  for (const p of l) {
    const q = [Math.round(p[0] * Q) / Q, Math.round(p[1] * Q) / Q];
    if (!out.length || out[out.length - 1][0] !== q[0] || out[out.length - 1][1] !== q[1]) out.push(q);
  }
  return out;
}

// ---------------------------------------------------------------- Laden
function mercToLatLng(x, y) {
  const lng = (x / 20037508.34) * 180;
  const lat = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360) / Math.PI - 90;
  return [lat, lng];
}
async function loadLand(E, key) {
  const cf = path.join(CACHE, `land-${key}.json`);
  if (fs.existsSync(cf)) return JSON.parse(fs.readFileSync(cf, 'utf8'));
  const src = await shapefile.open(path.join(CACHE, 'simplified-land-polygons-complete-3857/simplified_land_polygons.shp'));
  const rings = [];
  for (;;) {
    const r = await src.read();
    if (r.done) break;
    const g = r.value.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const poly of polys) for (const [x, y] of poly[0]) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
    const [la0, lo0] = mercToLatLng(minx, miny), [la1, lo1] = mercToLatLng(maxx, maxy);
    if (lo1 < E.lng0 || lo0 > E.lng1 || la1 < E.lat0 || la0 > E.lat1) continue;
    for (const poly of polys) for (const ring of poly) rings.push(ring.map(([x, y]) => mercToLatLng(x, y)));
  }
  fs.writeFileSync(cf, JSON.stringify(rings));
  return rings;
}
function loadGeoJSON(name) { return JSON.parse(fs.readFileSync(path.join(CACHE, name + '.geojson'), 'utf8')); }
function polygonsInExtent(gj, E) {
  const rings = [];
  for (const f of gj.features) {
    const g = f.geometry; if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) for (const ring of poly) {
      if (ring.some(([lng, lat]) => lng >= E.lng0 && lng <= E.lng1 && lat >= E.lat0 && lat <= E.lat1)) rings.push(ring.map(([lng, lat]) => [lat, lng]));
    }
  }
  return rings;
}
function loadOSM(side) {
  const dir = path.join(CACHE, 'osm');
  const ways = new Map();
  if (!fs.existsSync(dir)) return ways;
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith(side + '_')) continue;
    let d; try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { console.warn('  ! OSM-Kachel defekt:', f); continue; }
    for (const el of d.elements || []) if (el.type === 'way' && el.geometry) ways.set(el.id, el);
  }
  return ways;
}

// ---------------------------------------------------------------- Relief
function loadHeight(E, latc) {
  const z = 9, n = 2 ** z, tiles = new Map();
  const tile = (x, y) => {
    const k = x + '_' + y;
    if (!tiles.has(k)) {
      const f = path.join(CACHE, `tiles/${z}_${x}_${y}.png`);
      tiles.set(k, fs.existsSync(f) ? PNG.sync.read(fs.readFileSync(f)) : null);
    }
    return tiles.get(k);
  };
  const elev = (lat, lng) => {
    const fx = ((lng + 180) / 360) * n * 256;
    const s = Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180));
    const fy = ((1 - s / Math.PI) / 2) * n * 256;
    const px = (X, Y) => {
      const t = tile(Math.floor(X / 256), Math.floor(Y / 256)); if (!t) return 0;
      const i = ((Y % 256) * 256 + (X % 256)) * 4;
      return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768;
    };
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    return (px(x0, y0) * (1 - tx) + px(x0 + 1, y0) * tx) * (1 - ty) + (px(x0, y0 + 1) * (1 - tx) + px(x0 + 1, y0 + 1) * tx) * ty;
  };
  // Box-Filter über 3×3 Unterproben → glatte Heightmap
  const H = new Float32Array(HN * HN);
  for (let j = 0; j < HN; j++) for (let i = 0; i < HN; i++) {
    let s = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const u = (i + 0.5 + a / 3) / HN, v = (j + 0.5 + b / 3) / HN;
      s += Math.max(0, elev(E.lat1 - v * (E.lat1 - E.lat0), E.lng0 + u * (E.lng1 - E.lng0)));
    }
    H[j * HN + i] = s / 9;
  }
  return H;
}

// ---------------------------------------------------------------- Graph / Pfadsuche
class Heap {
  constructor() { this.a = []; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
  get size() { return this.a.length; }
}
function buildGraph(ways, km, filter = () => true) {
  const nodes = new Map(); // id → {p:[x,y], ll:[lat,lng], adj: [[id, len]]}
  for (const w of ways.values()) {
    if (!filter(w)) continue;
    for (let i = 0; i < w.nodes.length; i++) {
      const id = w.nodes[i], g = w.geometry[i];
      if (!g) continue;
      if (!nodes.has(id)) nodes.set(id, { p: km(g.lat, g.lon), ll: [g.lat, g.lon], adj: [] });
      if (i > 0 && w.geometry[i - 1]) {
        const a = nodes.get(w.nodes[i - 1]), b = nodes.get(id);
        const l = dist(a.p, b.p);
        a.adj.push([id, l, w]); b.adj.push([w.nodes[i - 1], l, w]);
      }
    }
  }
  return nodes;
}
function dijkstra(adjOf, start, goal) {
  const d = new Map([[start, 0]]), prev = new Map(), h = new Heap(); h.push(0, start);
  while (h.size) {
    const [c, u] = h.pop();
    if (u === goal) break;
    if (c > d.get(u)) continue;
    for (const [v, w] of adjOf(u)) {
      const nc = c + w;
      if (nc < (d.get(v) ?? Infinity)) { d.set(v, nc); prev.set(v, u); h.push(nc, v); }
    }
  }
  if (!d.has(goal)) return null;
  const path = [goal]; while (path[path.length - 1] !== start) path.push(prev.get(path[path.length - 1]));
  return path.reverse();
}
function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}
// Guide-Polylinie (lat,lng) auf OSM-Gewässernetz einrasten; wo kein Netz ist, trägt die Guide selbst.
function snapGuide(graph, km, guideLL, { corridor = 4, tol = 1.6, canal = false } = {}) {
  const g = densify(guideLL.map(([la, lo]) => km(la, lo)), 0.3);
  const cand = [];
  for (const [id, n] of graph) {
    const [d] = nearestOnLine(n.p, g);
    if (d < corridor) cand.push(id);
  }
  const cset = new Set(cand);
  const adj = new Map();
  const add = (a, b, w) => { if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []); adj.get(a).push([b, w]); adj.get(b).push([a, w]); };
  for (const id of cand) {
    const n = graph.get(id);
    for (const [v, l, w] of n.adj) {
      if (!cset.has(v) || id > v) continue;
      const m = graph.get(v);
      const mid = [(n.p[0] + m.p[0]) / 2, (n.p[1] + m.p[1]) / 2];
      const dg = nearestOnLine(mid, g)[0];
      const isCanal = w.tags.waterway === 'canal';
      add(id, v, l * (1 + (dg / tol) ** 2) * (isCanal && !canal ? 1.6 : 1));
    }
  }
  const gid = (i) => 'g' + i;
  for (let i = 1; i < g.length; i++) add(gid(i - 1), gid(i), dist(g[i - 1], g[i]) * 3.2);
  // Anschlüsse Guide ↔ Netz
  for (let i = 0; i < g.length; i++) {
    for (const id of cand) {
      const d = dist(graph.get(id).p, g[i]);
      if (d < 0.7) add(gid(i), id, d * 3.2 + 0.25);
    }
  }
  const p = dijkstra((u) => adj.get(u) || [], gid(0), gid(g.length - 1));
  if (!p) return guideLL;
  const kmInv = (xy) => { // für Guide-Punkte: zurückrechnen
    const i = +xy.slice(1); return g[i];
  };
  const pts = p.map((id) => (typeof id === 'string' ? kmInv(id) : graph.get(id).p));
  const virt = p.map((id) => typeof id === 'string');
  const osmShare = virt.filter((v) => !v).length / p.length;
  return { km: wobbleVirtual(pts, virt, guideLL.length * 5.1), osmShare };
}
// Abschnitte ohne OSM-Gewässer (Mündungstrichter, Meer): leichte Perlin-Schwingung statt Gerade
function wobbleVirtual(pts, virt, seed) {
  const out = pts.map((p) => p.slice());
  const n = smoothNoise(seed);
  let i = 0;
  while (i < pts.length) {
    if (!virt[i]) { i++; continue; }
    let j = i; while (j + 1 < pts.length && virt[j + 1]) j++;
    const run = pts.slice(i, j + 1), s = [0];
    for (let k = 1; k < run.length; k++) s.push(s[k - 1] + dist(run[k - 1], run[k]));
    const L = s[s.length - 1];
    if (L > 3) for (let k = 1; k < run.length - 1; k++) {
      const a = run[k - 1], b = run[k + 1], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
      const t = s[k] / L, off = n((s[k] / 9) + i) * Math.min(1.4, L * 0.05) * Math.sin(Math.PI * t);
      out[i + k] = [run[k][0] - (ty / tl) * off, run[k][1] + (tx / tl) * off];
    }
    i = j + 1;
  }
  return out;
}
// Zickzack aus parallelen OSM-Armen glätten: 250-m-Raster, gleitender Mittelwert ±0.75 km, Enden fix
function smoothLine(pts, win = 3) {
  const d = densify(pts, 0.25);
  const out = d.map((p, i) => {
    if (i < 1 || i > d.length - 2) return p;
    const w = Math.min(win, i, d.length - 1 - i);
    let x = 0, y = 0; for (let k = -w; k <= w; k++) { x += d[i + k][0]; y += d[i + k][1]; }
    return [x / (2 * w + 1), y / (2 * w + 1)];
  });
  return douglasPeucker(out, 0.05);
}
function longestNamedPath(ways, km, re) {
  const sel = new Map([...ways].filter(([, w]) => re.test(w.tags.name || '') || re.test(w.tags['name:en'] || '') || re.test(w.tags['name:de'] || '') || re.test(w.tags['name:zh'] || '')));
  if (!sel.size) return null;
  const graph = buildGraph(sel, km);
  const adjOf = (u) => graph.get(u).adj.map(([v, l]) => [v, l]);
  // Komponente mit größter Länge → Durchmesser (2× Dijkstra)
  const seen = new Set(); let best = null;
  for (const id of graph.keys()) {
    if (seen.has(id)) continue;
    const comp = []; const st = [id]; seen.add(id);
    while (st.length) { const u = st.pop(); comp.push(u); for (const [v] of graph.get(u).adj) if (!seen.has(v)) { seen.add(v); st.push(v); } }
    const far = (s) => { const d = new Map([[s, 0]]), h = new Heap(); h.push(0, s); let fu = s; while (h.size) { const [c, u] = h.pop(); if (c > d.get(u)) continue; if (c > d.get(fu)) fu = u; for (const [v, w] of adjOf(u)) { if (c + w < (d.get(v) ?? Infinity)) { d.set(v, c + w); h.push(c + w, v); } } } return [fu, d.get(fu)]; };
    const [a] = far(comp[0]); const [b, len] = far(a);
    if (!best || len > best.len) best = { a, b, len };
  }
  const p = dijkstra(adjOf, best.a, best.b);
  // Fließrichtung aus OSM (Weg-Richtung = Fließrichtung): Mehrheit der Kanten prüfen
  return { km: p.map((id) => graph.get(id).p), ids: p, graph };
}
function smoothNoise(seed) {
  const r = (i) => { const x = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); };
  return (t) => { const i = Math.floor(t), f = t - i, s = f * f * (3 - 2 * f); return (r(i) * (1 - s) + r(i + 1) * s) * 2 - 1; };
}
function catmull(pts, n) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// ---------------------------------------------------------------- Hauptlauf
const result = {};
const report = [];
for (const [key, S] of Object.entries(SIDES)) {
  console.log(`\n== ${key}`);
  const E = extentOf(S.bbox);
  const latc = (E.lat0 + E.lat1) / 2;
  const uv = toUV(E);
  const km = kmProj(latc);
  const w = PLATE_DEPTH * ((E.lng1 - E.lng0) * Math.cos((latc * Math.PI) / 180)) / (E.lat1 - E.lat0);
  const kmPerU = (E.lng1 - E.lng0) * 111.32 * Math.cos((latc * Math.PI) / 180);
  const kmPerV = (E.lat1 - E.lat0) * 110.57;
  const kmToUV = ([x, y]) => uv(y / 110.57, x / (111.32 * Math.cos((latc * Math.PI) / 180)));
  const uvTol = (kmTol) => kmTol / kmPerV; // ~isotrop, da Platte maßstabstreu

  // Land
  const landLL = await loadLand(E, key);
  let land = [];
  for (const r of landLL) {
    let ring = clipRing(r.map(([la, lo]) => uv(la, lo)));
    if (ring.length < 3) continue;
    ring = douglasPeucker(ring, uvTol(0.12));
    if (ring.length < 3 || Math.abs(ringArea(ring)) < 2e-6) continue;
    land.push(quantDedupe(ring));
  }
  // Seen (NE 10m)
  const lakes = polygonsInExtent(loadGeoJSON('ne_10m_lakes'), E)
    .map((r) => douglasPeucker(clipRing(r.map(([la, lo]) => uv(la, lo))), uvTol(0.2)))
    .filter((r) => r.length > 2 && Math.abs(ringArea(r)) > 1e-5).map(quantDedupe);
  // Stadtflächen (NE 10m urban areas)
  const urban = polygonsInExtent(loadGeoJSON('ne_10m_urban_areas'), E)
    .map((r) => douglasPeucker(clipRing(r.map(([la, lo]) => uv(la, lo))), uvTol(0.3)))
    .filter((r) => r.length > 2 && Math.abs(ringArea(r)) > 1.2e-4).map(quantDedupe);

  // OSM Gewässer
  const ways = loadOSM(key);
  console.log('  OSM ways', ways.size);
  const graph = buildGraph(ways, km);

  // Nebengewässer: Wege zu langen Linien verketten, DP 150 m, ≥ 3 km
  const minor = [];
  {
    const byName = new Map();
    for (const w of ways.values()) { const k = (w.tags.name || '#' + w.id) + '|' + w.tags.waterway; if (!byName.has(k)) byName.set(k, []); byName.get(k).push(w); }
    for (const list of byName.values()) {
      // Endpunkt-Verkettung
      const segs = list.map((w) => ({ ids: w.nodes.slice(), g: w.geometry.map((p) => km(p.lat, p.lon)) }));
      const byStart = new Map();
      segs.forEach((s, i) => { const k = s.ids[0]; if (!byStart.has(k)) byStart.set(k, []); byStart.get(k).push(i); });
      const used = new Set(), incoming = new Set(segs.map((s) => s.ids[s.ids.length - 1]));
      const order = segs.map((_, i) => i).sort((a, b) => (incoming.has(segs[a].ids[0]) ? 1 : 0) - (incoming.has(segs[b].ids[0]) ? 1 : 0));
      for (const i of order) {
        if (used.has(i)) continue;
        used.add(i);
        let line = segs[i].g.slice(), end = segs[i].ids[segs[i].ids.length - 1];
        for (;;) {
          const nx = (byStart.get(end) || []).find((j) => !used.has(j));
          if (nx === undefined) break;
          used.add(nx); line = line.concat(segs[nx].g.slice(1)); end = segs[nx].ids[segs[nx].ids.length - 1];
        }
        if (lineLen(line) < MINOR_MIN_KM) continue;
        const simp = douglasPeucker(line, MINOR_DP_KM).map(kmToUV);
        for (const part of clipLine(simp)) if (part.length > 1) minor.push(quantDedupe(part));
      }
    }
  }

  // Flussnetz
  const veins = [];
  const vIndex = new Map();
  for (const v of S.veins) {
    let pts = null, info = '';
    if (v.guide && !v.procedural) {
      const r = ways.size ? snapGuide(graph, km, v.guide, { canal: !!v.canal, tol: v.sea ? 0.8 : 1.6 }) : null;
      if (r && r.km && r.osmShare >= 0.3) { pts = r.km; info = `osm ${(r.osmShare * 100) | 0}%`; }
      else { pts = proceduralAlong(v.guide.map(([a, b]) => km(a, b)), v.id.length * 3.7 + 1); info = 'guide+procedural'; }
      pts = smoothLine(douglasPeucker(pts, 0.05));
    } else if (v.name) {
      const r = longestNamedPath(ways, km, v.name);
      if (!r) { console.warn('  ! kein OSM-Verlauf für', v.id); continue; }
      pts = r.km;
      // Orientierung: Ende am Eltern-Ast
      const parent = veins[vIndex.get(v.parent)].km;
      if (nearestOnLine(pts[0], parent)[0] < nearestOnLine(pts[pts.length - 1], parent)[0]) pts.reverse();
      pts = smoothLine(douglasPeucker(pts, 0.05)); info = 'osm name';
    } else if (v.procedural) {
      const parent = veins[vIndex.get(v.parent)].km;
      const c = km(...CITIES[v.city]);
      const [, att] = nearestOnLine(c, parent);
      pts = proceduralCapillary(c, att, v.city.length * 7.31);
      info = 'procedural';
    }
    // am Eltern-Ast andocken (letzter Punkt exakt auf Elternlinie; größere Lücken über das OSM-Netz)
    if (v.parent) {
      const parent = veins[vIndex.get(v.parent)].km;
      const [d, q] = nearestOnLine(pts[pts.length - 1], parent);
      if (d > 1.5 && ways.size) {
        const inv = ([x, y]) => [y / 110.57, x / (111.32 * Math.cos((latc * Math.PI) / 180))];
        const r2 = snapGuide(graph, km, [inv(pts[pts.length - 1]), inv(q)], { tol: 1.2 });
        if (r2 && r2.km) pts = pts.concat(smoothLine(r2.km).slice(1));
        const [d2, q2] = nearestOnLine(pts[pts.length - 1], parent);
        if (d2 > 0.01) pts.push(q2);
      } else if (d > 0.01) pts.push(q);
    }
    vIndex.set(v.id, veins.length);
    veins.push({ ...v, km: pts, info });
    console.log(`  vein ${v.id.padEnd(10)} ${info.padEnd(14)} ${lineLen(pts).toFixed(1)} km, ${pts.length} pts`);
  }
  // Haaradern (Deko)
  const hair = [];
  for (const re of S.hair) {
    const r = longestNamedPath(ways, km, re);
    if (!r) { console.log('  hair –', re); continue; }
    let pts = r.km;
    // Anschluss an nächstgelegenen Ader-Ast
    let best = null;
    for (const [end, rev] of [[pts[0], true], [pts[pts.length - 1], false]]) {
      for (let i = 0; i < veins.length; i++) {
        const [d, q] = nearestOnLine(end, veins[i].km);
        if (!best || d < best.d) best = { d, q, i, rev };
      }
    }
    if (best.rev) pts = pts.slice().reverse();
    // Clip auf Plattenausdehnung (flussabwärts zusammenhängender Teil)
    const uvPts = pts.map(kmToUV);
    let startIdx = 0;
    for (let i = uvPts.length - 1; i >= 0; i--) { const p = uvPts[i]; if (p[0] < 0.01 || p[0] > 0.99 || p[1] < 0.01 || p[1] > 0.99) { startIdx = i + 1; break; } }
    pts = pts.slice(startIdx);
    if (best.d > 20 || lineLen(pts) < 8) { console.log('  hair ✗', re, best.d.toFixed(1), lineLen(pts).toFixed(1)); continue; }
    pts = smoothLine(douglasPeucker(pts, 0.05));
    if (best.d > 1.5) {
      // Anschluss über das OSM-Gewässernetz bis zur nächsten Ader
      const kmInvLL = ([x, y]) => [y / 110.57, x / (111.32 * Math.cos((latc * Math.PI) / 180))];
      const r2 = snapGuide(graph, km, [kmInvLL(pts[pts.length - 1]), kmInvLL(best.q)], { tol: 1.2 });
      if (r2 && r2.km) pts = pts.concat(smoothLine(r2.km).slice(1));
      else pts.push(best.q);
    } else if (best.d > 0.01) pts.push(best.q);
    hair.push({ id: 'hair' + hair.length, order: 4, parentIdx: best.i, km: pts, len: lineLen(pts), label: String(re) });
    console.log(`  hair ✓ ${String(re).padEnd(28)} ${lineLen(pts).toFixed(1)} km`);
  }
  hair.sort((a, b) => b.len - a.len);

  // Höhen
  const H = loadHeight(E, latc);
  let hMax = 0; for (const h of H) hMax = Math.max(hMax, h);
  const hq = Buffer.alloc(HN * HN);
  for (let i = 0; i < H.length; i++) hq[i] = Math.round(255 * Math.pow(H[i] / hMax, 0.6));

  const allVeins = [...veins.map((v, i) => ({ ...v, parentIdx: v.parent ? vIndex.get(v.parent) : -1 })), ...hair.slice(0, 10)];
  const out = {
    w: +w.toFixed(4), d: PLATE_DEPTH, ext: [E.lat0, E.lat1, E.lng0, E.lng1].map((x) => +x.toFixed(4)),
    hN: HN, hMax: Math.round(hMax), h: hq.toString('base64'),
    land: encodeLines(land), lakes: encodeLines(lakes), urban: encodeLines(urban), minor: encodeLines(minor),
    veins: allVeins.map((v) => ({
      o: v.order, p: v.parentIdx, pts: encodeLines([quantDedupe(v.km.map(kmToUV))]),
      ...(v.city ? { c: v.city } : {}), ...(v.water ? { n: v.water } : {}), ...(v.root ? { r: 1 } : {}),
    })),
    mouth: uv(...S.mouth).map((x) => +x.toFixed(4)), mouthDir: S.mouthDir,
  };
  result[key] = out;
  const sizes = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, JSON.stringify(v).length]));
  report.push([key, sizes]);
  console.log('  sizes', sizes, 'land rings', land.length, 'minor', minor.length, 'urban', urban.length);
  writePreviewSVG(key, out, { land, lakes, urban, minor, veins: allVeins.map((v) => v.km.map(kmToUV)), orders: allVeins.map((v) => v.order), cities: Object.entries(CITIES).map(([id, ll]) => [id, uv(...ll)]).filter(([, p]) => p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1), w, H, hMax });
}

// Kapillare entlang Handkoordinaten: Catmull-Rom + Perlin-Versatz (12 % der Länge), keine Geraden
function proceduralAlong(guide, seed) {
  const L = lineLen(guide), n = smoothNoise(seed);
  const d = densify(guide, L / 5); // 4 Zwischenpunkte
  const out = d.map((p, i) => {
    if (i === 0 || i === d.length - 1) return p;
    const a = d[i - 1], b = d[i + 1], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    const off = n(i * 1.37) * 0.12 * L * Math.sin((Math.PI * i) / (d.length - 1));
    return [p[0] - (ty / tl) * off, p[1] + (tx / tl) * off];
  });
  return catmull(out, 6);
}
function proceduralCapillary(city, att, seed) {
  const L = dist(city, att), n = smoothNoise(seed);
  const dx = (att[0] - city[0]) / L, dy = (att[1] - city[1]) / L;
  const ctrl = [city];
  const k = 4;
  for (let i = 1; i <= k; i++) {
    const t = i / (k + 1), off = n(i * 1.7) * 0.12 * L * Math.sin(Math.PI * t) * 1.6;
    ctrl.push([city[0] + dx * L * t - dy * off, city[1] + dy * L * t + dx * off]);
  }
  ctrl.push(att);
  return catmull(ctrl, 4);
}

function writePreviewSVG(key, out, L) {
  const W = 1000, Hh = Math.round((W * out.d) / out.w);
  const P = (p) => `${(p[0] * W).toFixed(1)},${(p[1] * Hh).toFixed(1)}`;
  const poly = (r) => 'M' + r.map(P).join('L') + 'Z';
  const line = (r) => 'M' + r.map(P).join('L');
  const widths = { 1: 5, 2: 3.2, 3: 2, 4: 1.2 };
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}"><rect width="${W}" height="${Hh}" fill="#EFEAE0"/>`;
  s += `<path d="${L.land.map(poly).join('')}" fill="#FCFAF6" stroke="#DDD5C7" stroke-width="1" fill-rule="nonzero"/>`;
  s += `<path d="${L.lakes.map(poly).join('')}" fill="#EFEAE0"/>`;
  s += `<path d="${L.urban.map(poly).join('')}" fill="#DDD5C7" fill-opacity=".55"/>`;
  s += `<path d="${L.minor.map(line).join('')}" fill="none" stroke="#DDD5C7" stroke-width="1"/>`;
  L.veins.forEach((v, i) => { s += `<path d="${line(v)}" fill="none" stroke="#102A43" stroke-width="${widths[L.orders[i]]}" stroke-linecap="round" stroke-linejoin="round" opacity="${L.orders[i] === 4 ? 0.7 : 1}"/>`; });
  for (const [id, p] of L.cities) s += `<circle cx="${p[0] * W}" cy="${p[1] * Hh}" r="5" fill="#24557A"/><text x="${p[0] * W + 8}" y="${p[1] * Hh + 4}" font-family="sans-serif" font-size="13" fill="#20252B">${id}</text>`;
  s += `<circle cx="${out.mouth[0] * W}" cy="${out.mouth[1] * Hh}" r="7" fill="none" stroke="#B3342B" stroke-width="2"/>`;
  s += '</svg>';
  fs.writeFileSync(path.join(OUT, `preview-${key}.svg`), s);
  // Relief-Vorschau (PGM → einfach als PNG)
  const png = new PNG({ width: HN, height: HN });
  for (let i = 0; i < HN * HN; i++) { const g = Math.round(255 * Math.pow(L.H[i] / L.hMax, 0.6)); png.data[i * 4] = png.data[i * 4 + 1] = png.data[i * 4 + 2] = g; png.data[i * 4 + 3] = 255; }
  fs.writeFileSync(path.join(OUT, `relief-${key}.png`), PNG.sync.write(png));
}

// ---------------------------------------------------------------- Ausgabe
const json = JSON.stringify(result);
fs.writeFileSync(path.join(OUT, 'geo.json'), json);
console.log('\nGesamt Geo-Daten:', (json.length / 1024).toFixed(1), 'KB');
const tsx = path.join(ROOT, 'src/RiverBridge.tsx');
if (fs.existsSync(tsx)) {
  const src = fs.readFileSync(tsx, 'utf8');
  const re = /(\/\/ @@GEO_BEGIN\n)[\s\S]*?(\n\/\/ @@GEO_END)/;
  if (re.test(src)) {
    fs.writeFileSync(tsx, src.replace(re, `$1const GEO: GeoData = ${json};$2`));
    console.log('→ in src/RiverBridge.tsx eingebettet');
  }
}

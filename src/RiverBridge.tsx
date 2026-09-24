'use client';

/** @label "River Bridge" */
/** @comment "3D-Karte: Perlfluss und Rhein verbinden sich. Scroll oder Autoplay." */
/** @defaultWidth 1200 */
/** @defaultHeight 760 */
/** @controls {
  "mode": { "type": "select", "label": "Modus", "default": "scroll", "options": [{"label":"Scroll (eigene Höhe)","value":"scroll"},{"label":"Scroll (Eltern-Sektion)","value":"scrollParent"},{"label":"Autoplay","value":"autoplay"}] },
  "scrollLength": { "type": "number", "label": "Scroll-Länge (vh)", "min": 150, "max": 500, "step": 10, "default": 320 },
  "scrollParentDepth": { "type": "number", "label": "Eltern-Ebene (Modus B)", "min": 1, "max": 6, "step": 1, "default": 1 },
  "autoplayDuration": { "type": "number", "label": "Autoplay-Dauer (s)", "min": 6, "max": 16, "step": 0.5, "default": 10 },
  "previewProgress": { "type": "number", "label": "Editor-Frame", "min": 0, "max": 1, "step": 0.01, "default": 1 },
  "locale": { "type": "select", "label": "Sprache", "default": "en", "options": [{"label":"English","value":"en"},{"label":"Deutsch","value":"de"},{"label":"中文","value":"zh"}] },
  "diagonalAngle": { "type": "number", "label": "Diagonale (°)", "min": 15, "max": 45, "step": 1, "default": 28 },
  "cameraTilt": { "type": "number", "label": "Kamera-Neigung (°)", "min": 35, "max": 65, "step": 1, "default": 52 },
  "reliefScale": { "type": "number", "label": "Relief", "min": 0, "max": 0.5, "step": 0.01, "default": 0.18 },
  "showContours": { "type": "toggle", "label": "Höhenlinien", "default": false },
  "showMinorWaterways": { "type": "toggle", "label": "Nebengewässer", "default": true },
  "veinDensity": { "type": "number", "label": "Haaradern", "min": 0, "max": 1, "step": 0.05, "default": 0.6 },
  "meanderBends": { "type": "number", "label": "Mäanderschleifen", "min": 3, "max": 9, "step": 2, "default": 5 },
  "meanderAmplitude": { "type": "number", "label": "Mäander-Amplitude", "min": 0.3, "max": 1.5, "step": 0.05, "default": 1 },
  "riverColor": { "type": "color", "label": "Fluss (Rhein + Verbindung)", "default": "#102A43" },
  "chinaRiverColor": { "type": "color", "label": "Fluss China", "default": "#102A43" },
  "landColor": { "type": "color", "label": "Land", "default": "#FCFAF6" },
  "waterColor": { "type": "color", "label": "Wasser", "default": "#EFEAE0" },
  "lineColor": { "type": "color", "label": "Linien", "default": "#DDD5C7" },
  "routeHintColor": { "type": "color", "label": "Seeweg-Spur", "default": "#B89A5A" },
  "labelColor": { "type": "color", "label": "Label primär", "default": "#20252B" },
  "labelSecondaryColor": { "type": "color", "label": "Label sekundär", "default": "#5B6472" },
  "waterLabelColor": { "type": "color", "label": "Gewässernamen", "default": "#24557A" },
  "showSeal": { "type": "toggle", "label": "Siegel 信", "default": true },
  "flowLoop": { "type": "toggle", "label": "Idle-Fluss", "default": true },
  "mouseParallax": { "type": "toggle", "label": "Maus-Parallaxe", "default": true }
} */

/*
 * River Bridge – PearlRhine Partners · Spec v2
 *
 * Prüfpunkte (geprüft am Revyme-Quellcode github.com/revyme-web/builder, 09/2026):
 * 1. three: Der Canvas-Runtime (src/canvas/code-component-runtime.ts) erkennt `from 'three'` und lädt
 *    das lokal installierte npm-Paket `three` (kein CDN). Im Next.js-Export ist es ein normaler
 *    npm-Import → `three` muss in package.json stehen, wird mitgebündelt und vom eigenen Host
 *    ausgeliefert. Unterpfade aus `three/examples/jsm` sind im Canvas NICHT gemappt (nur GLTFLoader)
 *    → RoundedBox wird hier selbst gebaut, keine weiteren Imports. Der Canvas lädt three asynchron;
 *    ist das Modul beim ersten Kompilieren noch leer, zeigt die Komponente das statische SVG
 *    (gleiche Daten, Endzustand). Keine Laufzeit-Requests, alle Geo-Daten inline.
 * 2. Eigenhöhe (Modus A): Die Komponente setzt `height: {scrollLength}vh` auf ihr Wurzelelement und
 *    überschreibt damit die im Builder gesetzte Höhe; `position: sticky` scheitert, sobald ein
 *    Vorfahr `overflow: hidden` trägt. Im Editor (useStaticCanvas) wird nie Eigenhöhe gesetzt.
 *    Bei Layout-Konflikten Modus B verwenden (Sektion + Sticky nativ in Revyme, p aus Eltern-Element).
 * 3. Revyme-MCP: Revyme bietet einen MCP-Connector für externe Agenten (src/editor/agent/external-run).
 *    In dieser Arbeitsumgebung ist er nicht verbunden → Übergabe als Datei (Einbau siehe README).
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { withResponsiveProps, useStaticCanvas } from '@revyme/runtime';

// ============================================================================ Typen
interface GeoVein { o: number; p: number; pts: string; c?: string; n?: string; r?: number }
interface GeoSide {
  w: number; d: number; ext: number[]; hN: number; hMax: number; h: string;
  land: string; lakes: string; urban: string; minor: string; veins: GeoVein[];
  mouth: number[]; mouthDir: number[];
}
interface GeoData { cn: GeoSide; rh: GeoSide }
type SideKey = 'cn' | 'rh';
type Locale = 'en' | 'de' | 'zh';
type V2 = [number, number];

interface RBProps {
  mode: 'scroll' | 'scrollParent' | 'autoplay'; scrollLength: number; scrollParentDepth: number;
  autoplayDuration: number; previewProgress: number; locale: Locale; diagonalAngle: number;
  cameraTilt: number; reliefScale: number; showContours: boolean; showMinorWaterways: boolean;
  veinDensity: number; meanderBends: number; meanderAmplitude: number; riverColor: string;
  chinaRiverColor: string; landColor: string; waterColor: string; lineColor: string;
  routeHintColor: string; labelColor: string; labelSecondaryColor: string; waterLabelColor: string;
  showSeal: boolean; flowLoop: boolean; mouseParallax: boolean;
}

const DEFAULTS: RBProps = {
  mode: 'scroll', scrollLength: 320, scrollParentDepth: 1, autoplayDuration: 10, previewProgress: 1,
  locale: 'en', diagonalAngle: 28, cameraTilt: 52, reliefScale: 0.18, showContours: false,
  showMinorWaterways: true, veinDensity: 0.6, meanderBends: 5, meanderAmplitude: 1,
  riverColor: '#102A43', chinaRiverColor: '#102A43', landColor: '#FCFAF6', waterColor: '#EFEAE0',
  lineColor: '#DDD5C7', routeHintColor: '#B89A5A', labelColor: '#20252B', labelSecondaryColor: '#5B6472',
  waterLabelColor: '#24557A', showSeal: true, flowLoop: true, mouseParallax: true,
};

// Markenpalette (fixe Rollen ohne Control)
const IVORY = '#F7F4EE';
const RHINE = '#24557A';
const SLATE = '#5B6472';
const SEAL = '#B3342B';

// ============================================================================ Inhalte
interface CityDef { id: string; side: SideKey; ll: V2; en: string; de: string; zh: string; primary?: boolean; pos: 'r' | 'l' | 't' | 'rb' | 'lb' | 'b' }
const CITIES: CityDef[] = [
  { id: 'shenzhen', side: 'cn', ll: [22.543, 114.058], en: 'Shenzhen', de: 'Shenzhen', zh: '深圳', primary: true, pos: 'r' },
  { id: 'hongkong', side: 'cn', ll: [22.302, 114.177], en: 'Hong Kong', de: 'Hongkong', zh: '香港', pos: 'rb' },
  { id: 'guangzhou', side: 'cn', ll: [23.129, 113.264], en: 'Guangzhou', de: 'Guangzhou', zh: '广州', pos: 't' },
  { id: 'dongguan', side: 'cn', ll: [23.021, 113.752], en: 'Dongguan', de: 'Dongguan', zh: '东莞', pos: 'r' },
  { id: 'huizhou', side: 'cn', ll: [23.112, 114.416], en: 'Huizhou', de: 'Huizhou', zh: '惠州', pos: 't' },
  { id: 'foshan', side: 'cn', ll: [23.022, 113.122], en: 'Foshan', de: 'Foshan', zh: '佛山', pos: 'l' },
  { id: 'koeln', side: 'rh', ll: [50.938, 6.96], en: 'Cologne', de: 'Köln', zh: '科隆', primary: true, pos: 'r' },
  { id: 'duesseldorf', side: 'rh', ll: [51.228, 6.773], en: 'Düsseldorf', de: 'Düsseldorf', zh: '杜塞尔多夫', pos: 'r' },
  { id: 'duisburg', side: 'rh', ll: [51.434, 6.762], en: 'Duisburg', de: 'Duisburg', zh: '杜伊斯堡', pos: 'r' },
  { id: 'rotterdam', side: 'rh', ll: [51.922, 4.479], en: 'Rotterdam', de: 'Rotterdam', zh: '鹿特丹', pos: 't' },
  { id: 'antwerpen', side: 'rh', ll: [51.219, 4.402], en: 'Antwerp', de: 'Antwerpen', zh: '安特卫普', pos: 'l' },
];
const POP_ORDER = ['shenzhen', 'koeln', 'guangzhou', 'duesseldorf', 'hongkong', 'rotterdam', 'dongguan', 'duisburg', 'foshan', 'antwerpen', 'huizhou'];
const WATER_NAMES: Record<string, Record<Locale, string>> = {
  pearl: { en: 'Pearl River', de: 'Perlfluss', zh: '珠江' },
  dongjiang: { en: 'Dongjiang', de: 'Dongjiang', zh: '东江' },
  rhine: { en: 'Rhine', de: 'Rhein', zh: '莱茵河' },
  maas: { en: 'Maas', de: 'Maas', zh: '马斯河' },
  scheldt: { en: 'Scheldt', de: 'Schelde', zh: '斯海尔德河' },
};
// Label-Anker entlang der Ader (0 = Quelle/Stadt, 1 = Mündung)
const WATER_ANCHOR: Record<string, number> = { pearl: 0.5, dongjiang: 0.3, rhine: 0.66, maas: 0.3, scheldt: 0.55 };
const WATER_PRIORITY = ['pearl', 'rhine', 'dongjiang', 'maas', 'scheldt'];
const PLATE_TITLES: Record<SideKey, Record<Locale, string>> = {
  cn: { en: 'Pearl River Delta', de: 'Perlflussdelta', zh: '珠江三角洲' },
  rh: { en: 'Rhine corridor', de: 'Rheinkorridor', zh: '莱茵河走廊' },
};
const ARIA: Record<Locale, string> = {
  en: 'Map: the Pearl River Delta in China and the Rhine region in Germany, connected by their rivers.',
  de: 'Karte: Perlflussdelta in China und Rheinregion in Deutschland, verbunden durch ihre Flüsse.',
  zh: '地图：中国珠江三角洲与德国莱茵地区通过河流相连。',
};
const FONT_SANS = "'Source Sans 3', 'Noto Sans SC', system-ui, sans-serif";
const FONT_SERIF = "'Source Serif 4', 'Noto Serif SC', Georgia, serif";

// ============================================================================ Mathe
const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = {
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  outBack: (t: number, s = 1.2) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
};
const phase = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const d2 = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Zentripetale Catmull-Rom-Kurve, gleichmäßig nach Bogenlänge neu abgetastet
function resample(pts: V2[], step: number): V2[] {
  if (pts.length < 2) return pts.slice();
  const dense: V2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const t01 = Math.pow(d2(p0, p1) || 1e-4, 0.5), t12 = Math.pow(d2(p1, p2) || 1e-4, 0.5), t23 = Math.pow(d2(p2, p3) || 1e-4, 0.5);
    const n = Math.max(2, Math.ceil(d2(p1, p2) / (step * 0.5)));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const out: V2 = [0, 0];
      for (let c = 0; c < 2; c++) {
        const m1 = p2[c] - p1[c] + t12 * ((p1[c] - p0[c]) / t01 - (p2[c] - p0[c]) / (t01 + t12));
        const m2 = p2[c] - p1[c] + t12 * ((p3[c] - p2[c]) / t23 - (p3[c] - p1[c]) / (t12 + t23));
        const a = 2 * p1[c] - 2 * p2[c] + m1 + m2, b = -3 * p1[c] + 3 * p2[c] - 2 * m1 - m2;
        out[c] = a * t * t * t + b * t * t + m1 * t + p1[c];
      }
      dense.push(out);
    }
  }
  dense.push(pts[pts.length - 1]);
  const out: V2[] = [dense[0]];
  let acc = 0;
  for (let i = 1; i < dense.length; i++) {
    let seg = d2(dense[i - 1], dense[i]);
    let prev = dense[i - 1];
    while (acc + seg >= step) {
      const t = (step - acc) / seg;
      const q: V2 = [prev[0] + (dense[i][0] - prev[0]) * t, prev[1] + (dense[i][1] - prev[1]) * t];
      out.push(q); seg -= step - acc; acc = 0; prev = q;
    }
    acc += seg;
  }
  if (d2(out[out.length - 1], dense[dense.length - 1]) > step * 0.25) out.push(dense[dense.length - 1]);
  else out[out.length - 1] = dense[dense.length - 1];
  return out;
}
function cumLen(pts: V2[]) { const s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + d2(pts[i - 1], pts[i])); return s; }
function tangents(pts: V2[]): V2[] {
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l] as V2;
  });
}
function nearestIndex(pts: V2[], q: V2) { let bi = 0, bd = Infinity; for (let i = 0; i < pts.length; i++) { const d = d2(pts[i], q); if (d < bd) { bd = d; bi = i; } } return [bi, bd]; }

// ============================================================================ Daten dekodieren
function b64(s: string) { const bin = atob(s); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
// Delta-Varint-Linien (siehe scripts/build-geo.mjs → encodeLines)
function decodeLines(s: string): V2[][] {
  const b = b64(s), out: V2[][] = [];
  let i = 0;
  const vu = () => { let v = 0, sh = 0, c; do { c = b[i++]; v += (c & 127) * Math.pow(2, sh); sh += 7; } while (c & 128); return v; };
  const zz = () => { const v = vu(); return v % 2 ? -(v + 1) / 2 : v / 2; };
  while (i < b.length) {
    const n = vu(), l: V2[] = [];
    let x = 0, y = 0;
    for (let k = 0; k < n; k++) {
      if (k === 0) { x = vu(); y = vu(); } else { x += zz(); y += zz(); }
      l.push([x / 4095, y / 4095]);
    }
    out.push(l);
  }
  return out;
}

interface VeinModel { order: number; pts: V2[]; s: number[]; L: number; net: number[]; city?: string; water?: string; ys: number[] }
interface CityModel extends CityDef { local: V2; net: number; y: number }
interface SideModel {
  key: SideKey; w: number; d: number; geo: GeoSide;
  land: V2[][]; lakes: V2[][]; urban: V2[][]; minor: V2[][];
  heights: Float32Array; hN: number; mask: Float32Array; mW: number; mH: number;
  veins: VeinModel[]; netMax: number; cities: CityModel[]; mouth: V2; mouthDir: V2;
  llToUV: (ll: V2) => V2;
}
const SEA_Y = -0.03;
const RELIEF_K = 1.5; // Welt-Einheiten je km Höhe bei reliefScale 1

function decodeSide(key: SideKey, g: GeoSide): SideModel {
  const q = b64(g.h), hN = g.hN;
  const heights = new Float32Array(hN * hN);
  for (let i = 0; i < q.length; i++) heights[i] = g.hMax * Math.pow(q[i] / 255, 1 / 0.6);
  blur(heights, hN, hN, 1); // Reliefmodell: weiche Formen statt Rauschen
  const [lat0, lat1, lng0, lng1] = g.ext;
  const land = decodeLines(g.land), lakes = decodeLines(g.lakes);
  // Landmaske (für Relief + Meeresniveau), geglättet
  const mW = 256, mH = Math.max(8, Math.round((256 * g.d) / g.w));
  const mask = new Float32Array(mW * mH);
  const cv = makeCanvas(mW, mH), ctx = cv.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, mW, mH);
  ctx.fillStyle = '#fff'; ctx.beginPath(); for (const r of land) ringPath(ctx, r, mW, mH); ctx.fill('evenodd');
  ctx.fillStyle = '#000'; ctx.beginPath(); for (const r of lakes) ringPath(ctx, r, mW, mH); ctx.fill('evenodd');
  const img = ctx.getImageData(0, 0, mW, mH).data;
  for (let i = 0; i < mask.length; i++) mask[i] = img[i * 4] / 255;
  blur(mask, mW, mH, 1);
  const llToUV = (ll: V2): V2 => [(ll[1] - lng0) / (lng1 - lng0), (lat1 - ll[0]) / (lat1 - lat0)];
  const m: SideModel = {
    key, w: g.w, d: g.d, geo: g, land, lakes, urban: decodeLines(g.urban), minor: decodeLines(g.minor),
    heights, hN, mask, mW, mH, veins: [], netMax: 1, cities: [], mouth: [0, 0], mouthDir: g.mouthDir as V2, llToUV,
  };
  m.mouth = uvToLocal(m, g.mouth as V2);
  return m;
}
function blur(a: Float32Array, W: number, H: number, passes: number) {
  const t = new Float32Array(a.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, n = 0;
      for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const xx = x + c, yy = y + b; if (xx >= 0 && yy >= 0 && xx < W && yy < H) { s += a[yy * W + xx]; n++; } }
      t[y * W + x] = s / n;
    }
    a.set(t);
  }
}
const uvToLocal = (m: { w: number; d: number }, uv: V2): V2 => [(uv[0] - 0.5) * m.w, (uv[1] - 0.5) * m.d];
function bilinear(arr: Float32Array, W: number, H: number, u: number, v: number) {
  const x = clamp(u * W - 0.5, 0, W - 1), y = clamp(v * H - 0.5, 0, H - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1), tx = x - x0, ty = y - y0;
  return (arr[y0 * W + x0] * (1 - tx) + arr[y0 * W + x1] * tx) * (1 - ty) + (arr[y1 * W + x0] * (1 - tx) + arr[y1 * W + x1] * tx) * ty;
}
// Geländehöhe (Welt) an lokaler Position – identisch zur Terrain-Geometrie
function terrainY(m: SideModel, x: number, z: number, relief: number) {
  const u = x / m.w + 0.5, v = z / m.d + 0.5;
  const e = bilinear(m.heights, m.hN, m.hN, u, v);
  const lm = smooth(0.35, 0.65, bilinear(m.mask, m.mW, m.mH, u, v));
  const edge = smooth(0, 0.025, Math.min(u, 1 - u, v, 1 - v));
  return lerp(SEA_Y, (e / 1000) * relief * RELIEF_K * edge, lm);
}

// Flussnetz: Glätten, Netz-Distanz zur Mündung (aNet) je Seite
const VEIN_W: Record<number, [number, number]> = { 1: [0.16, 0.1], 2: [0.09, 0.05], 3: [0.04, 0.015], 4: [0.02, 0] };
function buildVeins(m: SideModel, density: number, relief: number) {
  const src = m.geo.veins;
  const hair = src.map((v, i) => (v.o === 4 ? i : -1)).filter((i) => i >= 0);
  const keepHair = new Set(hair.slice(0, Math.round(hair.length * clamp(density))));
  const models: (VeinModel | null)[] = [];
  src.forEach((v, i) => {
    if (v.o === 4 && !keepHair.has(i)) { models.push(null); return; }
    const raw = decodeLines(v.pts)[0].map((uv) => uvToLocal(m, uv));
    const pts = resample(raw, 0.03);
    const s = cumLen(pts), L = s[s.length - 1];
    let base = 0;
    const parent = v.p >= 0 && !v.r ? models[v.p] : null;
    if (parent) { const [pi] = nearestIndex(parent.pts, pts[pts.length - 1]); base = parent.net[pi]; }
    models.push({ order: v.o, pts, s, L, net: s.map((x) => L - x + base), city: v.c, water: v.n, ys: pts.map((p) => terrainY(m, p[0], p[1], relief)) });
  });
  m.veins = models.filter(Boolean) as VeinModel[];
  m.netMax = Math.max(...m.veins.map((v) => v.net[0]));
  m.cities = CITIES.filter((c) => c.side === m.key).map((c) => {
    const local = uvToLocal(m, m.llToUV(c.ll));
    let net = 0;
    const own = m.veins.find((v) => v.city === c.id);
    if (own) net = own.net[0];
    else for (const v of m.veins) { const [i, dd] = nearestIndex(v.pts, local); if (dd < 0.35) net = Math.max(net, v.net[i]); }
    return { ...c, local, net: net / m.netMax, y: terrainY(m, local[0], local[1], relief) };
  });
}

// ============================================================================ Karten-Textur (Ebenen 1–5)
function makeCanvas(w: number, h: number): HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    try { const c = new OffscreenCanvas(w, h); if (c.getContext('2d')) return c as unknown as HTMLCanvasElement; } catch { /* Safari < 16.4 */ }
  }
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
function ringPath(ctx: CanvasRenderingContext2D, r: V2[], W: number, H: number, close = true) {
  if (!r.length) return;
  ctx.moveTo(r[0][0] * W, r[0][1] * H);
  for (let i = 1; i < r.length; i++) ctx.lineTo(r[i][0] * W, r[i][1] * H);
  if (close) ctx.closePath();
}
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function contourSegments(m: SideModel, step: number): V2[][] {
  // Marching Squares auf 2× hochgetasteter Heightmap, nur über Land
  const N = m.hN * 2, f = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N, v = (j + 0.5) / N;
    f[j * N + i] = bilinear(m.heights, m.hN, m.hN, u, v) * (bilinear(m.mask, m.mW, m.mH, u, v) > 0.5 ? 1 : 0);
  }
  const segs: V2[][] = [];
  const P = (i: number, j: number): V2 => [(i + 0.5) / N, (j + 0.5) / N];
  for (let lvl = step; lvl < m.geo.hMax; lvl += step) {
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
      const a = f[j * N + i], b = f[j * N + i + 1], c = f[(j + 1) * N + i + 1], d = f[(j + 1) * N + i];
      const idx = (a > lvl ? 8 : 0) | (b > lvl ? 4 : 0) | (c > lvl ? 2 : 0) | (d > lvl ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const lp = (p: V2, q: V2, va: number, vb: number): V2 => { const t = (lvl - va) / (vb - va); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; };
      const top = () => lp(P(i, j), P(i + 1, j), a, b), right = () => lp(P(i + 1, j), P(i + 1, j + 1), b, c);
      const bottom = () => lp(P(i, j + 1), P(i + 1, j + 1), d, c), left = () => lp(P(i, j), P(i, j + 1), a, d);
      const table: Record<number, (() => V2)[][]> = {
        1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]], 5: [[left, top], [bottom, right]],
        6: [[top, bottom]], 7: [[left, top]], 8: [[left, top]], 9: [[top, bottom]], 10: [[left, bottom], [top, right]],
        11: [[top, right]], 12: [[left, right]], 13: [[bottom, right]], 14: [[left, bottom]],
      };
      for (const [e1, e2] of table[idx]) segs.push([e1(), e2()]);
    }
  }
  return segs;
}
function bakeMapTexture(m: SideModel, P: RBProps, size: number) {
  const W = size, H = Math.round((size * m.d) / m.w);
  const cv = makeCanvas(W, H), ctx = cv.getContext('2d') as CanvasRenderingContext2D;
  const k = W / 2048;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath(); roundRectPath(ctx, 0, 0, W, H, (0.25 / m.w) * W); ctx.clip();
  ctx.fillStyle = P.waterColor; ctx.fillRect(0, 0, W, H);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // 1 Land / Meer
  ctx.beginPath(); for (const r of m.land) ringPath(ctx, r, W, H); ctx.fillStyle = P.landColor; ctx.fill('evenodd');
  ctx.beginPath(); for (const r of m.lakes) ringPath(ctx, r, W, H); ctx.fillStyle = P.waterColor; ctx.fill('evenodd');
  // 2 Stadtflächen
  ctx.globalAlpha = 0.55; ctx.beginPath(); for (const r of m.urban) ringPath(ctx, r, W, H); ctx.fillStyle = P.lineColor; ctx.fill('evenodd'); ctx.globalAlpha = 1;
  // 3 Nebengewässer
  if (P.showMinorWaterways) {
    ctx.beginPath(); for (const l of m.minor) ringPath(ctx, l, W, H, false);
    ctx.strokeStyle = P.lineColor; ctx.lineWidth = 2.2 * k; ctx.stroke();
  }
  // 4 Höhenlinien (100 m)
  if (P.showContours) {
    ctx.globalAlpha = 0.4; ctx.beginPath(); for (const s of contourSegments(m, 100)) ringPath(ctx, s, W, H, false);
    ctx.strokeStyle = P.lineColor; ctx.lineWidth = 1.6 * k; ctx.stroke(); ctx.globalAlpha = 1;
  }
  // 5 Küstenlinie
  ctx.beginPath(); for (const r of m.land) ringPath(ctx, r, W, H); for (const r of m.lakes) ringPath(ctx, r, W, H);
  ctx.strokeStyle = P.lineColor; ctx.lineWidth = 2.6 * k; ctx.stroke();
  ctx.restore();
  return cv;
}

// ============================================================================ Komposition & Mäander (reine Mathe, auch für SVG-Fallback)
interface Resp { bp: 'desk' | 'tab' | 'mob'; diag: number; tilt: number; gap: number; spread: number; fov: number; plateScale: number; waterMax: number; texSize: number; bends: number; parallax: boolean; labelPx: number; primaryPx: number; twoLine: boolean }
function responsive(width: number, P: RBProps): Resp {
  if (width < 640) return { bp: 'mob', diag: 62, tilt: Math.min(65, P.cameraTilt + 12), gap: 1.3, spread: 1.3, fov: 32, plateScale: 0.85, waterMax: 0, texSize: 1024, bends: 3, parallax: false, labelPx: 12, primaryPx: 13, twoLine: false };
  if (width < 1024) return { bp: 'tab', diag: 38, tilt: P.cameraTilt, gap: 1.8, spread: 1, fov: 32, plateScale: 1, waterMax: 2, texSize: 2048, bends: P.meanderBends, parallax: P.mouseParallax, labelPx: 13, primaryPx: 15, twoLine: true };
  return { bp: 'desk', diag: P.diagonalAngle, tilt: P.cameraTilt, gap: 2.1, spread: 1, fov: 28, plateScale: 1, waterMax: 3, texSize: 2048, bends: P.meanderBends, parallax: P.mouseParallax, labelPx: 14, primaryPx: 16, twoLine: true };
}
const PLATE_DIST = 15.65; // |(-7,3.5) → (7,-3.5)|
function plateCenters(r: Resp, tiltDeg: number, f: number): Record<SideKey, V2> {
  // Weltwinkel so wählen, dass die Achse im Bild um r.diag steigt (Kamera nordausgerichtet)
  const a = Math.atan(Math.tan((r.diag * Math.PI) / 180) / Math.sin((tiltDeg * Math.PI) / 180));
  const D = (PLATE_DIST * r.plateScale * r.spread * f) / 2;
  const dx = Math.cos(a) * D, dz = Math.sin(a) * D;
  return { cn: [-dx, dz], rh: [dx, -dz] };
}
interface Rect { minX: number; maxX: number; minZ: number; maxZ: number }
function plateRect(c: V2, m: { w: number; d: number }, s: number): Rect {
  return { minX: c[0] - (m.w * s) / 2, maxX: c[0] + (m.w * s) / 2, minZ: c[1] - (m.d * s) / 2, maxZ: c[1] + (m.d * s) / 2 };
}
// Kinoshita-Mäander entlang einer glatten Leitkurve zwischen den Mündungen
function buildMeander(A0: V2, B0: V2, cn: Rect, rh: Rect, bends: number, amp: number, scale: number, gap = 2.1, dA: V2 = [0, 1], dB: V2 = [-1, 0]) {
  // Leitkurve: Mündung → Süden aus der China-Platte → um deren Südostecke → Lücke zwischen den Platten
  // → westlich an der Rhein-Platte hoch → von Westen in die Rhein-Mündung.
  const g = gap * scale;
  // Austritt entlang der Stamm-Richtung an der Mündung (nahtloser Übergang), dann nach Süden bzw. Westen
  const tA = dA[1] > 0.3 ? (cn.maxZ + g * 0.8 - A0[1]) / dA[1] : 0;
  const A1: V2 = tA > 0 ? [A0[0] + dA[0] * tA * 0.5, cn.maxZ + g * 0.8] : [A0[0], cn.maxZ + g * 0.8];
  const A2: V2 = [cn.maxX + g, cn.maxZ + g * 0.6];
  const tB = dB[0] < -0.3 ? (rh.minX - g - B0[0]) / dB[0] : 0;
  const B1: V2 = tB > 0 ? [rh.minX - g, B0[1] + dB[1] * tB * 0.5] : [rh.minX - g, B0[1]];
  const A05: V2 = [A0[0] + dA[0] * 0.5 * scale, A0[1] + dA[1] * 0.5 * scale];
  const B05: V2 = [B0[0] + dB[0] * 0.5 * scale, B0[1] + dB[1] * 0.5 * scale];
  const M: V2 = [(cn.maxX + rh.minX) / 2, (cn.minZ + rh.maxZ) / 2];
  let guide = resample([A0, A05, A1, A2, M, B1, B05, B0], 0.05);
  // glätten (Enden fixiert → Mündungsrichtung bleibt erhalten)
  for (let it = 0; it < 40; it++) {
    const nx = guide.map((p) => p.slice() as V2);
    for (let i = 6; i < guide.length - 6; i++) for (let c = 0; c < 2; c++) nx[i][c] = (guide[i - 1][c] + guide[i][c] * 2 + guide[i + 1][c]) / 4;
    guide = nx;
  }
  guide = resample(guide, 0.05);
  const gs = cumLen(guide), Lg = gs[gs.length - 1], gt = tangents(guide);
  // lokaler Freiraum zu den Platten begrenzt die Querauslenkung (erodiert + geglättet)
  const clr = 0.5 * scale;
  const rectDist = (p: V2, r: Rect) => Math.hypot(Math.max(r.minX - p[0], 0, p[0] - r.maxX), Math.max(r.minZ - p[1], 0, p[1] - r.maxZ));
  let room = guide.map((p) => Math.max(0, Math.min(rectDist(p, cn), rectDist(p, rh)) - clr));
  const win = Math.round(1.2 / 0.05);
  room = room.map((_, i) => { let m = Infinity; for (let j = Math.max(0, i - win); j <= Math.min(room.length - 1, i + win); j++) m = Math.min(m, room[j]); return m; });
  room = room.map((_, i) => { let t = 0, n = 0; for (let j = Math.max(0, i - win); j <= Math.min(room.length - 1, i + win); j++) { t += room[j]; n++; } return t / n; });
  // Kinoshita: θ(s) = θ0 sin(2πs/λ) + θ0³ (Js cos(6πs/λ) − Jf sin(6πs/λ))
  // `bends` Schleifen im mittleren Abschnitt (55 %), gleiche Frequenz mit 30 % Amplitude zu den Mündungen
  const th0 = 1.1, Js = 0.03, Jf = 0.02, K = 1600, lam = (2 * 0.55) / bends;
  const A: number[] = [0], Nn: number[] = [0];
  for (let i = 1; i <= K; i++) {
    const s = (i - 0.5) / K, w = (2 * Math.PI * s) / lam;
    const th = th0 * Math.sin(w) + th0 * th0 * th0 * (Js * Math.cos(3 * w) - Jf * Math.sin(3 * w));
    A.push(A[i - 1] + Math.cos(th) / K); Nn.push(Nn[i - 1] + Math.sin(th) / K);
  }
  const aEnd = A[K], nEnd = Nn[K];
  let nMax = 0;
  const lat = Nn.map((n, i) => { const v = n - nEnd * (A[i] / aEnd); nMax = Math.max(nMax, Math.abs(v)); return v; });
  // natürliche Kinoshita-Proportion (Querauslenkung relativ zur Tallänge), begrenzt durch Abstand zu den Platten
  const latAmp = Math.min((nMax / aEnd) * Lg, 1.8 * scale) * amp;
  const out: V2[] = [];
  let gi = 0;
  for (let i = 0; i <= K; i++) {
    const a = A[i] / aEnd, s = a * Lg;
    while (gi < gs.length - 2 && gs[gi + 1] < s) gi++;
    const t = clamp((s - gs[gi]) / (gs[gi + 1] - gs[gi] || 1));
    const px = lerp(guide[gi][0], guide[gi + 1][0], t), pz = lerp(guide[gi][1], guide[gi + 1][1], t);
    const tx = lerp(gt[gi][0], gt[gi + 1][0], t), tz = lerp(gt[gi][1], gt[gi + 1][1], t);
    const env = (0.3 + 0.7 * smooth(0.14, 0.3, a) * smooth(0.86, 0.7, a)) * smooth(0, 0.07, a) * smooth(1, 0.93, a);
    const n = (lat[i] / (nMax || 1)) * Math.min(env * latAmp, lerp(room[gi], room[gi + 1], t) * 1.15);
    out.push([px - tz * n, pz + tx * n]);
  }
  // Platten freihalten: zwischen Austritt aus der China-Platte und Eintritt in die Rhein-Platte
  // Punkte mit Mindestabstand `clr` aus beiden Plattenrechtecken schieben, danach leicht glätten.
  let pts = resample(out, 0.04);
  const inside = (p: V2, r: Rect, m: number) => p[0] > r.minX - m && p[0] < r.maxX + m && p[1] > r.minZ - m && p[1] < r.maxZ + m;
  for (let pass = 0; pass < 6; pass++) {
    let i0 = 0, i1 = pts.length - 1;
    while (i0 < pts.length - 1 && inside(pts[i0], cn, 0)) i0++;
    while (i1 > 0 && inside(pts[i1], rh, 0)) i1--;
    i0 += 30; i1 -= 30; // ~1.2 Einheiten Austrittszone an den Mündungen nicht verschieben
    let moved = false;
    for (let i = i0; i <= i1; i++) for (const r of [cn, rh]) {
      const p = pts[i];
      if (!inside(p, r, clr)) continue;
      const dl = p[0] - (r.minX - clr), dr = r.maxX + clr - p[0], dt = p[1] - (r.minZ - clr), db = r.maxZ + clr - p[1];
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) p[0] = r.minX - clr; else if (m === dr) p[0] = r.maxX + clr; else if (m === dt) p[1] = r.minZ - clr; else p[1] = r.maxZ + clr;
      moved = true;
    }
    if (!moved) break;
    for (let it = 0; it < 4; it++) for (let i = Math.max(1, i0); i < Math.min(pts.length - 1, i1); i++) for (let c = 0; c < 2; c++) pts[i][c] = (pts[i - 1][c] + 2 * pts[i][c] + pts[i + 1][c]) / 4;
  }
  pts = resample(pts, 0.04);
  return { pts, s: cumLen(pts) };
}

// Fließrichtung des Stamms an der Mündung (letzte ~0.4 Einheiten), Fallback: Spec-Richtung
function trunkDir(m: SideModel): V2 {
  const t = m.veins.find((v) => v.order === 1);
  if (!t || t.pts.length < 4) return m.mouthDir;
  const a = t.pts[Math.max(0, t.pts.length - 14)], b = t.pts[t.pts.length - 1];
  const l = d2(a, b) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
}

// ============================================================================ Shader-Helfer
type Uniforms = Record<string, { value: any }>;
function patch(mat: THREE.Material, key: string, u: Uniforms, vHead: string, vBody: string, fHead: string, fBody: string) {
  mat.onBeforeCompile = (sh: any) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + vHead).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + vBody);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + fHead);
    sh.fragmentShader = sh.fragmentShader.includes('#include <color_fragment>')
      ? sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + fBody)
      : sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' + fBody);
  };
  mat.customProgramCacheKey = () => key;
  (mat as any).userData.u = u;
  return mat;
}

// Flaches Band entlang einer Polylinie: position = Mittellinie, aOff = halbe Breite × Normale
function ribbon(pts: V2[], ys: number[] | number, halfW: (i: number) => number, attrs: Record<string, (i: number, side: number) => number>) {
  const n = pts.length, tg = tangents(pts);
  const pos = new Float32Array(n * 6), off = new Float32Array(n * 4), nor = new Float32Array(n * 6);
  const extra: Record<string, Float32Array> = {};
  for (const k in attrs) extra[k] = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const y = typeof ys === 'number' ? ys : ys[i], hw = halfW(i), nx = -tg[i][1] * hw, nz = tg[i][0] * hw;
    for (let s = 0; s < 2; s++) {
      const j = i * 2 + s, sg = s === 0 ? 1 : -1;
      pos.set([pts[i][0], y, pts[i][1]], j * 3); nor.set([0, 1, 0], j * 3);
      off.set([nx * sg, nz * sg], j * 2);
      for (const k in attrs) extra[k][j] = attrs[k](i, sg);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  return { pos, off, nor, extra, idx };
}
function mergeRibbons(list: ReturnType<typeof ribbon>[]) {
  let nv = 0, ni = 0;
  for (const r of list) { nv += r.pos.length / 3; ni += r.idx.length; }
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(nv * 3), off = new Float32Array(nv * 2), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  const keys = list.length ? Object.keys(list[0].extra) : [];
  const ex: Record<string, Float32Array> = {}; for (const k of keys) ex[k] = new Float32Array(nv);
  let vo = 0, io = 0;
  for (const r of list) {
    pos.set(r.pos, vo * 3); nor.set(r.nor, vo * 3); off.set(r.off, vo * 2);
    for (const k of keys) ex[k].set(r.extra[k], vo);
    for (let i = 0; i < r.idx.length; i++) idx[io + i] = r.idx[i] + vo;
    vo += r.pos.length / 3; io += r.idx.length;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aOff', new THREE.BufferAttribute(off, 2));
  for (const k of keys) g.setAttribute(k, new THREE.BufferAttribute(ex[k], 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius += 0.2;
  return g;
}

// ============================================================================ Engine
const LABEL_FALLBACK: Record<string, string[]> = { r: ['rb', 'l', 't', 'b'], l: ['lb', 'r', 't', 'b'], t: ['r', 'l', 'b'], rb: ['r', 'l', 't'], lb: ['l', 'r', 'b'], b: ['r', 'l', 't'] };
function placeAt(l: Label, pos: string) {
  const pad = 9, x = l.ax!, y = l.ay!;
  if (pos === 'r') { l.x = x + pad; l.y = y - l.h / 2; }
  else if (pos === 'l') { l.x = x - pad - l.w; l.y = y - l.h / 2; }
  else if (pos === 't') { l.x = x - l.w / 2; l.y = y - pad - l.h; }
  else if (pos === 'b') { l.x = x - l.w / 2; l.y = y + pad - 2; }
  else if (pos === 'lb') { l.x = x - pad - l.w + 2; l.y = y + 1; }
  else { l.x = x + pad - 2; l.y = y + 1; }
}
interface Label { ax?: number; ay?: number; el: HTMLDivElement; kind: 'primary' | 'city' | 'water' | 'title'; prio: number; w: number; h: number; x: number; y: number; op: number; vis: boolean; side?: SideKey; city?: CityModel; water?: { side: SideKey; v: VeinModel; i: number }; pos?: string; rot?: number }
interface PlateObj { group: THREE.Group; terrain: THREE.Mesh; frame: THREE.Mesh; veins: THREE.Mesh | null; tex: THREE.CanvasTexture | null; model: SideModel; ys: Float32Array }

class RiverEngine {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera;
  host: HTMLElement; overlay: HTMLElement; P: RBProps; R!: Resp;
  models: Record<SideKey, SideModel>; plates = {} as Record<SideKey, PlateObj>;
  ground!: THREE.Mesh; light: THREE.DirectionalLight;
  conn: THREE.Mesh | null = null; aue: THREE.Mesh | null = null; gold: THREE.Mesh | null = null; ring: THREE.Mesh;
  heads!: THREE.InstancedMesh; pins!: THREE.InstancedMesh; rings!: THREE.InstancedMesh;
  meander: { pts: V2[]; s: number[] } = { pts: [], s: [0] }; meet: V2 = [0, 0];
  fitStart = { target: new THREE.Vector3(), dist: 30 }; fitEnd = { target: new THREE.Vector3(), dist: 30 };
  labels: Label[] = []; seal: HTMLDivElement; W = 1; H = 1;
  parallax = new THREE.Vector2(); parallaxTarget = new THREE.Vector2();
  disposed = false; lastP = -1; shadowsDirty = true; maxAniso = 1;
  mats: THREE.Material[] = [];
  private tmp = new THREE.Vector3();

  constructor(host: HTMLElement, overlay: HTMLElement, P: RBProps) {
    this.host = host; this.overlay = overlay; this.P = P;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    const r = this.renderer;
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.SRGBColorSpace;
    // Abweichung Spec 4.5: ACESFilmic staucht die hellen Markentöne (Card/Sand) auf fast gleiche Werte.
    // Lineare Ausgabe + kalibriertes Licht → ebene Flächen zeigen exakt die Tokenfarbe, Hänge schummern.
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.shadowMap.autoUpdate = false;
    r.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    host.appendChild(r.domElement);
    this.maxAniso = r.capabilities.getMaxAnisotropy();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.5, 400);

    // Spec-Verhältnis Hemisphere 0.9 : Key 1.4, normiert, sodass eine ebene Fläche Faktor 1 erhält.
    // three ≥ r155 rechnet physikalisch (÷π im Lambert-Term) → ×π; ältere Versionen mit Legacy-Licht nicht.
    const unit = ((r as any).useLegacyLights ? 1 : Math.PI) / (0.9 + 1.4 * LIGHT_COS);
    this.scene.add(new THREE.HemisphereLight(0xffffff, new THREE.Color('#EFEAE0'), 0.9 * unit));
    this.light = new THREE.DirectionalLight(new THREE.Color('#FFF8EE'), 1.4 * unit);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    this.light.shadow.bias = -0.0004; this.light.shadow.normalBias = 0.03;
    this.scene.add(this.light, this.light.target);

    this.models = { cn: decodeSide('cn', GEO.cn), rh: decodeSide('rh', GEO.rh) };
    // Unsichtbare Bodenebene (nur Schatten)
    const gm = new THREE.ShadowMaterial({ opacity: 0.12, color: new THREE.Color(P.riverColor), depthWrite: false });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), gm);
    this.ground.position.y = GROUND_Y; this.ground.receiveShadow = true; this.ground.renderOrder = 2;
    this.scene.add(this.ground);
    // Treffpunkt-Ring
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.88, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(RHINE), transparent: true, depthWrite: false }));
    this.scene.add(this.ring);
    // Stadtmarker (instanziert)
    const nC = CITIES.length;
    this.heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 18, 12), new THREE.MeshStandardMaterial({ roughness: 0.45 }), nC);
    this.pins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: new THREE.Color(SLATE), roughness: 0.6 }), nC);
    this.rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.17, 0.22, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(RHINE), transparent: true, opacity: 0.4, depthWrite: false }), 2);
    this.heads.castShadow = this.pins.castShadow = true;
    for (let i = 0; i < nC; i++) this.heads.setColorAt(i, new THREE.Color(SLATE));
    this.scene.add(this.heads, this.pins, this.rings);
    this.seal = document.createElement('div');
    this.seal.textContent = '信';
    this.seal.style.cssText = `position:absolute;left:0;top:0;width:12px;height:12px;background:${SEAL};color:${IVORY};font:600 9px/12px ${FONT_SERIF};text-align:center;border-radius:1.5px;opacity:0;pointer-events:none;will-change:transform`;
    overlay.appendChild(this.seal);
    this.rebuild(P, true);
  }

  // ------------------------------------------------------------------ Aufbau
  rebuild(P: RBProps, force = false) {
    const prev = this.P; this.P = P;
    const need = (...k: (keyof RBProps)[]) => force || k.some((x) => prev[x] !== P[x]);
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    const R = responsive(w, P);
    const bpChanged = !this.R || this.R.bp !== R.bp || this.R.texSize !== R.texSize;
    const sizeChanged = w !== this.W || h !== this.H;
    this.R = R; this.W = w; this.H = h;
    if (sizeChanged || force) {
      const dpr = Math.min(window.devicePixelRatio || 1, R.bp === 'mob' ? 1.25 : 1.75);
      this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h; this.camera.fov = R.fov; this.camera.updateProjectionMatrix();
    }
    const geoChanged = need('reliefScale', 'veinDensity', 'riverColor', 'chinaRiverColor', 'landColor');
    for (const k of ['cn', 'rh'] as SideKey[]) {
      if (force || geoChanged) this.buildPlate(k);
      if (force || bpChanged || need('landColor', 'waterColor', 'lineColor', 'showContours', 'showMinorWaterways')) this.bakeTexture(k);
    }
    (this.ground.material as THREE.ShadowMaterial).color.set(P.riverColor);
    this.layout();
    if (force || bpChanged || need('locale', 'labelColor', 'labelSecondaryColor', 'waterLabelColor')) this.buildLabels();
    this.seal.style.display = P.showSeal ? 'block' : 'none';
    this.shadowsDirty = true; this.lastP = -1;
  }

  private track<T extends THREE.Material>(m: T) { this.mats.push(m); return m; }

  private buildPlate(k: SideKey) {
    const m = this.models[k], P = this.P, relief = P.reliefScale;
    const old = this.plates[k];
    if (old) { this.scene.remove(old.group); old.group.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); }); }
    buildVeins(m, P.veinDensity, relief);
    const group = new THREE.Group();
    // Rahmen: abgerundete Platte, Dicke 0.35, Seiten Sand
    const r = 0.25, sh = new THREE.Shape(), hw = m.w / 2, hd = m.d / 2;
    sh.moveTo(-hw + r, -hd); sh.lineTo(hw - r, -hd); sh.quadraticCurveTo(hw, -hd, hw, -hd + r); sh.lineTo(hw, hd - r);
    sh.quadraticCurveTo(hw, hd, hw - r, hd); sh.lineTo(-hw + r, hd); sh.quadraticCurveTo(-hw, hd, -hw, hd - r);
    sh.lineTo(-hw, -hd + r); sh.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
    const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: false, curveSegments: 8 }).rotateX(Math.PI / 2);
    fg.translate(0, SEA_Y - 0.006, 0);
    const frame = new THREE.Mesh(fg, this.track(new THREE.MeshStandardMaterial({ color: new THREE.Color(P.waterColor), emissive: new THREE.Color(P.waterColor), emissiveIntensity: 0.3, roughness: 0.92 })));
    frame.castShadow = true;
    group.add(frame);
    // Terrain 192² mit Relief
    const tg = new THREE.PlaneGeometry(m.w, m.d, 191, 191).rotateX(-Math.PI / 2);
    const pa = tg.attributes.position as THREE.BufferAttribute;
    const ys = new Float32Array(pa.count);
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), z = pa.getZ(i);
      const onEdge = Math.abs(Math.abs(x) - hw) < 1e-4 || Math.abs(Math.abs(z) - hd) < 1e-4;
      ys[i] = onEdge ? SEA_Y - 0.004 : terrainY(m, x, z, relief);
      pa.setY(i, ys[i]);
    }
    tg.computeVertexNormals();
    const tm = this.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0, alphaTest: 0.5 }));
    const tu: Uniforms = { uTexMix: { value: 0 }, uBlank: { value: new THREE.Color(P.landColor) } };
    patch(tm, 'terrain', tu, '', '', 'uniform float uTexMix; uniform vec3 uBlank;', 'diffuseColor.rgb = mix(uBlank, diffuseColor.rgb, uTexMix);');
    const terrain = new THREE.Mesh(tg, tm);
    terrain.receiveShadow = false; // flache Platte → sonst Schattenakne auf der Kartenfläche
    group.add(terrain);
    // Flussnetz: alle Bänder einer Seite in einem Mesh
    const color = k === 'cn' ? P.chinaRiverColor : P.riverColor;
    const list = m.veins.map((v) => {
      const [w0, w1] = VEIN_W[v.order];
      return ribbon(v.pts, v.ys.map((y) => y + 0.015 + (v.order === 1 ? 0.002 : 0)), (i) => 0.5 * lerp(w1, w0, v.s[i] / v.L), {
        aNet: (i) => v.net[i] / m.netMax, aDelay: () => (v.order === 4 ? 0.12 : 0), aMix: () => (v.order === 4 ? 0.3 : 0), aFlow: (i) => (v.order === 1 ? v.net[i] : -1),
      });
    });
    const vm = this.track(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color), roughness: 0.35, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.55, specularIntensity: 0.15 }));
    const vu: Uniforms = { uProgress: { value: 0 }, uTime: { value: 0 }, uFlow: { value: 0 }, uFlowSpeed: { value: 1 }, uLand: { value: new THREE.Color(P.landColor) }, uIvory: { value: new THREE.Color(IVORY) } };
    patch(vm, 'vein', vu,
      'attribute vec2 aOff; attribute float aNet; attribute float aDelay; attribute float aMix; attribute float aFlow; uniform float uProgress; varying float vNet; varying float vThr; varying float vMix; varying float vFlow;',
      'float thr = 1.0 - (uProgress * (1.0 + aDelay) - aDelay); transformed.xz += aOff * mix(smoothstep(thr, thr + 0.015, aNet), 1.0, smoothstep(0.985, 1.0, uProgress)); vNet = aNet; vThr = thr; vMix = aMix; vFlow = aFlow;',
      'uniform float uTime; uniform float uFlow; uniform float uFlowSpeed; uniform vec3 uLand; uniform vec3 uIvory; varying float vNet; varying float vThr; varying float vMix; varying float vFlow;',
      'if (vNet < vThr) discard; diffuseColor.rgb = mix(diffuseColor.rgb, uLand, vMix); if (vFlow >= 0.0 && uFlow > 0.0) { float ph = fract((vFlow + uTime * uFlowSpeed) / 2.4); if (ph < 0.05) diffuseColor.rgb = mix(diffuseColor.rgb, uIvory, 0.5 * uFlow); }');
    const veins = new THREE.Mesh(mergeRibbons(list), vm);
    const trunk = m.veins.find((v) => v.order === 1);
    vu.uFlowSpeed.value = (trunk ? trunk.L : 8) / 12;
    group.add(veins);
    this.scene.add(group);
    this.plates[k] = { group, terrain, frame, veins, tex: old ? old.tex : null, model: m, ys };
    if (old && old.tex) (tm as any).map = old.tex;
  }

  private bakeTexture(k: SideKey) {
    const pl = this.plates[k];
    const cv = bakeMapTexture(pl.model, this.P, this.R.texSize);
    if (pl.tex) pl.tex.dispose();
    const tex = new THREE.CanvasTexture(cv as any);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, this.maxAniso);
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
    pl.tex = tex;
    const mat = pl.terrain.material as THREE.MeshStandardMaterial;
    mat.map = tex; mat.needsUpdate = true;
    (mat as any).userData.u.uBlank.value.set(this.P.landColor);
  }

  // Endlage, Mäander, Kamera-Fits
  private layout() {
    const R = this.R, P = this.P, s = R.plateScale;
    for (const k of ['cn', 'rh'] as SideKey[]) this.plates[k].group.scale.setScalar(s);
    const cEnd = plateCenters(R, R.tilt, 1);
    const rc = plateRect(cEnd.cn, this.models.cn, s), rr = plateRect(cEnd.rh, this.models.rh, s);
    // Verbindung beginnt 0.06 innerhalb der Mündung → nahtlose Überlappung mit dem Stamm
    const dir = (k: SideKey) => trunkDir(this.models[k]);
    const mouthW = (k: SideKey): V2 => { const m = this.models[k], d = dir(k); return [cEnd[k][0] + (m.mouth[0] - d[0] * 0.06) * s, cEnd[k][1] + (m.mouth[1] - d[1] * 0.06) * s]; };
    this.meander = buildMeander(mouthW('cn'), mouthW('rh'), rc, rr, R.bends, P.meanderAmplitude, s, R.gap, dir('cn'), dir('rh'));
    const ms = this.meander.s, L = ms[ms.length - 1];
    const mid = ms.findIndex((x) => x >= L / 2);
    this.meet = this.meander.pts[Math.max(0, mid)];
    this.buildConnection();
    // Kamera-Fit: Start (Abstand ×1.35) und Ende (×1.0)
    const pts = (f: number, withMeander: boolean) => {
      const c = plateCenters(R, R.tilt, f), out: THREE.Vector3[] = [];
      for (const k of ['cn', 'rh'] as SideKey[]) {
        const r = plateRect(c[k], this.models[k], s);
        for (const x of [r.minX, r.maxX]) for (const z of [r.minZ, r.maxZ]) out.push(new THREE.Vector3(x, 0.1, z), new THREE.Vector3(x, SEA_Y - 0.36, z));
        for (const cm of this.models[k].cities) out.push(new THREE.Vector3(c[k][0] + cm.local[0] * s, 0.6, c[k][1] + cm.local[1] * s));
      }
      if (withMeander) for (let i = 0; i < this.meander.pts.length; i += 8) { const q = this.meander.pts[i]; out.push(new THREE.Vector3(q[0], 0, q[1])); }
      return out;
    };
    this.fitStart = this.fit(pts(1.35, false));
    this.fitEnd = this.fit(pts(1, true));
    // Schattenkamera
    const sc = this.light.shadow.camera as THREE.OrthographicCamera;
    const ext = 14 * s * 1.35;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 80; sc.updateProjectionMatrix();
    this.light.position.set(LIGHT_DIR[0] * 30, LIGHT_DIR[1] * 30, LIGHT_DIR[2] * 30); this.light.target.position.set(0, 0, 0);
  }

  private camDir(tiltDeg: number, azDeg: number) {
    const t = (tiltDeg * Math.PI) / 180, a = (azDeg * Math.PI) / 180;
    return new THREE.Vector3(Math.sin(a) * Math.cos(t), Math.sin(t), Math.cos(a) * Math.cos(t));
  }
  private placeCamera(target: THREE.Vector3, dist: number, tilt: number, az: number) {
    this.camera.position.copy(target).addScaledVector(this.camDir(tilt, az), dist);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
  }
  // Abstand + Ziel so wählen, dass alle Punkte mit 8 % Rand ins Bild passen
  private fit(points: THREE.Vector3[]) {
    // Rand 8 % (NDC 0.84); im Hochformat horizontal 5 %, da die 62°-Diagonale breitenbegrenzt ist
    const limY = 0.84, limX = this.R.bp === 'mob' ? 0.9 : 0.84, tilt = this.R.tilt;
    const target = new THREE.Vector3();
    points.forEach((p) => target.add(p)); target.divideScalar(points.length); target.y = 0;
    let dist = 30;
    for (let it = 0; it < 4; it++) {
      let lo = 4, hi = 300;
      for (let k = 0; k < 28; k++) {
        const mid = (lo + hi) / 2;
        this.placeCamera(target, mid, tilt, 0);
        let ok = true;
        for (const p of points) { const q = this.tmp.copy(p).project(this.camera); if (q.z > 1 || Math.abs(q.x) > limX || Math.abs(q.y) > limY) { ok = false; break; } }
        if (ok) hi = mid; else lo = mid;
      }
      dist = hi;
      this.placeCamera(target, dist, tilt, 0);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of points) { const q = this.tmp.copy(p).project(this.camera); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const th = Math.tan((this.camera.fov * Math.PI) / 360) * dist;
      target.x += cx * th * this.camera.aspect;
      target.z -= (cy * th) / Math.sin((tilt * Math.PI) / 180);
    }
    return { target: target.clone(), dist };
  }

  private buildConnection() {
    for (const o of [this.conn, this.aue, this.gold]) if (o) { this.scene.remove(o); o.geometry.dispose(); }
    const { pts, s } = this.meander, L = s[s.length - 1], sc = this.R.plateScale;
    const col = new THREE.Color(this.P.riverColor);
    // Verbindung (ein Mesh, keine Naht)
    const cg = mergeRibbons([ribbon(pts, CONN_Y, () => 0.08 * sc, { aConn: (i) => s[i] / L, aLen: (i) => s[i] })]);
    const cm = this.track(new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.55, specularIntensity: 0.15, side: THREE.DoubleSide }));
    const REVEAL_V = 'attribute vec2 aOff; attribute float aConn; attribute float aLen; uniform float uConn; varying float vC; varying float vLen;';
    const REVEAL_B = 'float dd = 0.5 * uConn - min(aConn, 1.0 - aConn); transformed.xz += aOff * mix(smoothstep(0.0, 0.012, dd), 1.0, smoothstep(0.985, 1.0, uConn)); vC = aConn; vLen = aLen;';
    const cu: Uniforms = { uConn: { value: 0 }, uTime: { value: 0 }, uFlow: { value: 0 }, uFlowSpeed: { value: L / 12 }, uIvory: { value: new THREE.Color(IVORY) } };
    patch(cm, 'conn', cu, REVEAL_V, REVEAL_B,
      'uniform float uConn; uniform float uTime; uniform float uFlow; uniform float uFlowSpeed; uniform vec3 uIvory; varying float vC; varying float vLen;',
      'if (min(vC, 1.0 - vC) > 0.5 * uConn + 0.0001) discard; if (uFlow > 0.0) { float a1 = fract((vLen - uTime * uFlowSpeed) / 2.4); float a2 = fract((vLen + uTime * uFlowSpeed) / 2.4 + 0.5); if (a1 < 0.05 || a2 < 0.05) diffuseColor.rgb = mix(diffuseColor.rgb, uIvory, 0.5 * uFlow); }');
    this.conn = new THREE.Mesh(cg, cm); this.conn.castShadow = true;
    // Aue (Sand, 60 %) auf Bodenhöhe
    const ag = mergeRibbons([ribbon(pts, GROUND_Y - 0.004, () => 0.175 * sc, { aConn: (i) => s[i] / L, aLen: (i) => s[i] })]);
    const am = this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(this.P.waterColor), transparent: true, opacity: 0.6, depthWrite: false }));
    patch(am, 'aue', { uConn: cu.uConn }, REVEAL_V, REVEAL_B, 'uniform float uConn; varying float vC; varying float vLen;', 'if (min(vC, 1.0 - vC) > 0.5 * uConn + 0.0001) discard;');
    this.aue = new THREE.Mesh(ag, am); this.aue.renderOrder = 1;
    // Seeweg-Vorzeichnung: gepunktete Goldspur
    const gg = mergeRibbons([ribbon(pts, GROUND_Y + 0.003, () => 0.05 * sc, { aLen: (i) => s[i] / sc, aAcross: (_i, sg) => sg })]);
    const gmat = this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(this.P.routeHintColor), transparent: true, opacity: 0, depthWrite: false }));
    patch(gmat, 'gold', {}, 'attribute vec2 aOff; attribute float aLen; attribute float aAcross; varying float vLen; varying float vAc;', 'transformed.xz += aOff; vLen = aLen; vAc = aAcross;',
      'varying float vLen; varying float vAc;', 'vec2 q = vec2((fract(vLen / 0.24) - 0.5) * 0.24, vAc * 0.05); if (length(q) > 0.038) discard;');
    this.gold = new THREE.Mesh(gg, gmat); this.gold.renderOrder = 3;
    this.scene.add(this.conn, this.aue, this.gold);
    this.ring.position.set(this.meet[0], CONN_Y + 0.004, this.meet[1]);
  }

  // ------------------------------------------------------------------ Labels (HTML-Overlay)
  private buildLabels() {
    for (const l of this.labels) l.el.remove();
    this.labels = [];
    const P = this.P, R = this.R, loc = P.locale;
    const mk = (html: string, css: string) => {
      const el = document.createElement('div');
      el.innerHTML = html;
      el.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;pointer-events:none;opacity:0;will-change:transform,opacity;${css}`;
      this.overlay.appendChild(el); return el;
    };
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
    for (const k of ['cn', 'rh'] as SideKey[]) {
      for (const c of this.models[k].cities) {
        const name = c[loc];
        const alt = loc === 'zh' ? c.en : c.zh;
        const primary = !!c.primary;
        const html = primary && R.twoLine
          ? `<div style="font:600 ${R.primaryPx}px/1.15 ${FONT_SANS};color:${P.labelColor}">${esc(name)}</div><div style="font:400 ${R.labelPx - 1}px/1.2 ${FONT_SANS};color:${P.labelSecondaryColor}">${esc(alt)}</div>`
          : `<div style="font:${primary ? 600 : 400} ${primary ? R.primaryPx : R.labelPx}px/1.15 ${FONT_SANS};color:${primary ? P.labelColor : P.labelSecondaryColor}">${esc(name)}</div>`;
        const el = mk(html, `text-align:${c.pos === 'l' ? 'right' : c.pos === 't' ? 'center' : 'left'}`);
        this.labels.push({ el, kind: primary ? 'primary' : 'city', prio: primary ? 4 : 3, w: 0, h: 0, x: 0, y: 0, op: 0, vis: false, side: k, city: c, pos: c.pos });
      }
      // Gewässernamen (max. 3 je Seite; Tablet 2; Mobil aus)
      const waters = this.models[k].veins.filter((v) => v.water).sort((a, b) => WATER_PRIORITY.indexOf(a.water!) - WATER_PRIORITY.indexOf(b.water!)).slice(0, R.waterMax);
      for (const v of waters) {
        const txt = WATER_NAMES[v.water!][loc];
        const style = loc === 'zh' ? `font:400 12px/1 ${FONT_SERIF};letter-spacing:0.12em` : `font:italic 400 12px/1 ${FONT_SERIF};letter-spacing:0.06em`;
        const el = mk(esc(txt), `${style};color:${P.waterLabelColor};transform-origin:50% 50%`);
        // Ankerpunkt: mittlerer Abschnitt der Ader (Trunk etwas stromabwärts)
        const i = Math.floor(v.pts.length * (WATER_ANCHOR[v.water!] ?? 0.5));
        this.labels.push({ el, kind: 'water', prio: 2, w: 0, h: 0, x: 0, y: 0, op: 0, vis: false, side: k, water: { side: k, v, i } });
      }
      const tEl = mk(esc(PLATE_TITLES[k][loc]), `font:500 ${R.labelPx - 1}px/1 ${FONT_SANS};letter-spacing:0.04em;color:${P.labelSecondaryColor}`);
      this.labels.push({ el: tEl, kind: 'title', prio: 3.5, w: 0, h: 0, x: 0, y: 0, op: 0, vis: false, side: k });
    }
    this.measure();
  }
  measure() { for (const l of this.labels) { l.w = l.el.offsetWidth; l.h = l.el.offsetHeight; } }

  private toScreen(x: number, y: number, z: number) {
    const q = this.tmp.set(x, y, z).project(this.camera);
    return { x: (q.x * 0.5 + 0.5) * this.W, y: (-q.y * 0.5 + 0.5) * this.H, ok: q.z < 1 };
  }

  // ------------------------------------------------------------------ renderAt(p) – zustandslos
  renderAt(p: number, time = 0, idle = 0) {
    const P = this.P, R = this.R, s = R.plateScale;
    // Phase 1 Karten
    const rise = { cn: ease.outCubic(phase(p, 0, 0.1)), rh: ease.outCubic(phase(p, 0.04, 0.14)) };
    const growth = ease.outCubic(phase(p, 0.02, 0.14));
    const texMix = ease.outCubic(phase(p, 0.03, 0.14));
    // Phase 3 Adern, 4 Annäherung, 5 Verbindung, 6 Abschluss
    const u3 = ease.inOutSine(phase(p, 0.3, 0.56));
    const e4 = ease.inOutCubic(phase(p, 0.54, 0.7));
    const u5 = ease.inOutSine(phase(p, 0.68, 0.93));
    const e6 = ease.outQuad(phase(p, 0.93, 1));
    const f = lerp(1.35, 1, e4);
    const centers = plateCenters(R, R.tilt, f);
    for (const k of ['cn', 'rh'] as SideKey[]) {
      const pl = this.plates[k], r = rise[k];
      pl.group.position.set(centers[k][0], -0.6 * (1 - r), centers[k][1]);
      pl.group.visible = r > 0.001;
      pl.terrain.scale.y = Math.max(0.02, growth);
      const tm = pl.terrain.material as any, fm = pl.frame.material as any;
      const transparent = r < 0.999;
      for (const m of [tm, fm]) { if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; } m.opacity = r; }
      tm.userData.u.uTexMix.value = texMix;
      if (pl.veins) {
        const vu = (pl.veins.material as any).userData.u;
        vu.uProgress.value = u3; vu.uTime.value = time; vu.uFlow.value = idle;
        pl.veins.visible = u3 > 0;
      }
    }
    // Marker
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    const headCol = new THREE.Color(), slate = new THREE.Color(SLATE);
    let ri = 0;
    CITIES.forEach((cd, idx) => {
      const k = cd.side, c = this.models[k].cities.find((x) => x.id === cd.id)!;
      const order = POP_ORDER.indexOf(cd.id);
      const t = phase(p, 0.12 + order * 0.014, 0.12 + order * 0.014 + 0.06);
      const sc = t > 0 ? Math.max(0, ease.outBack(t)) : 0;
      const g = this.plates[k].group.position;
      const bx = g.x + c.local[0] * s, bz = g.z + c.local[1] * s, by = g.y + c.y * Math.max(0.02, growth) * s;
      const pinH = 0.35 * s * sc;
      pv.set(bx, by, bz); sv.set(s * Math.max(sc, 1e-4), Math.max(pinH, 1e-4), s * Math.max(sc, 1e-4));
      this.pins.setMatrixAt(idx, m4.compose(pv, q, sv));
      pv.set(bx, by + pinH, bz); sv.setScalar(Math.max(1e-4, s * sc));
      this.heads.setMatrixAt(idx, m4.compose(pv, q, sv));
      const reached = smooth(0, 0.03, u3 - (1 - c.net));
      headCol.copy(slate).lerp(new THREE.Color(k === 'cn' ? P.chinaRiverColor : P.riverColor), reached);
      this.heads.setColorAt(idx, headCol);
      if (cd.primary) { pv.set(bx, by + 0.004, bz); sv.setScalar(Math.max(1e-4, s * sc)); this.rings.setMatrixAt(ri++, m4.compose(pv, q, sv)); }
      (c as any)._anchor = [bx, by + pinH + 0.06 * s, bz, sc];
    });
    this.pins.instanceMatrix.needsUpdate = this.heads.instanceMatrix.needsUpdate = this.rings.instanceMatrix.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;
    // Verbindung, Aue, Goldspur, Ring
    if (this.conn) {
      const cu = (this.conn.material as any).userData.u;
      cu.uConn.value = u5; cu.uTime.value = time; cu.uFlow.value = idle;
      this.conn.visible = this.aue!.visible = u5 > 0;
      const gold = 0.6 * ease.inOutCubic(phase(p, 0.54, 0.7)) * (1 - e6);
      (this.gold!.material as THREE.MeshBasicMaterial).opacity = gold;
      this.gold!.visible = gold > 0.001;
    }
    this.ring.visible = e6 > 0 && e6 < 1;
    this.ring.scale.setScalar(Math.max(1e-3, e6) * s);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - e6);
    // Kamera: Start-Fit → Dolly 8 % (Phase 4) → Gesamtbild (Phase 6)
    const tgt = new THREE.Vector3().lerpVectors(this.fitStart.target, this.fitEnd.target, e4);
    const dist = lerp(this.fitStart.dist, this.fitEnd.dist * 0.92, e4) * (1 + (1 / 0.92 - 1) * e6);
    const px = R.parallax ? this.parallax.x * 1.5 : 0, py = R.parallax ? this.parallax.y * 1.5 : 0;
    this.placeCamera(tgt, dist, R.tilt + py, px);
    // Schatten nur in Bewegungsphasen neu berechnen
    const moving = p < 0.16 || (p > 0.53 && p < 0.72) || (p > 0.67 && p < 1);
    if (this.shadowsDirty || (moving && p !== this.lastP)) { this.renderer.shadowMap.needsUpdate = true; this.shadowsDirty = false; }
    this.lastP = p;
    this.renderer.render(this.scene, this.camera);
    this.updateLabels(p, rise, u3, e6);
  }

  private updateLabels(p: number, rise: Record<SideKey, number>, u3: number, e6: number) {
    const s = this.R.plateScale;
    for (const l of this.labels) {
      l.vis = false; l.op = 0;
      if (l.city) {
        const a = (l.city as any)._anchor as number[];
        if (!a || a[3] <= 0) continue;
        const sp = this.toScreen(a[0], a[1], a[2]);
        l.ax = sp.x; l.ay = sp.y;
        placeAt(l, l.pos!);
        l.op = clamp(a[3] * 1.4); l.vis = sp.ok;
        l.rot = 0;
      } else if (l.water) {
        const { side, v, i } = l.water, g = this.plates[side].group.position;
        const vis = smooth(0, 0.06, u3 - (1 - v.net[i] / this.models[side].netMax));
        if (vis <= 0) continue;
        const j0 = Math.max(0, i - 6), j1 = Math.min(v.pts.length - 1, i + 6);
        const w = (j: number) => this.toScreen(g.x + v.pts[j][0] * s, g.y + v.ys[j] * s, g.z + v.pts[j][1] * s);
        const a = w(j0), b = w(j1), c = w(i);
        let ang = Math.atan2(b.y - a.y, b.x - a.x);
        if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
        const off = 11; // oberhalb der Ader
        const nx = Math.sin(ang) * off, ny = -Math.cos(ang) * off;
        l.x = c.x + nx - l.w / 2; l.y = c.y + ny - l.h / 2; l.rot = ang;
        l.op = vis; l.vis = c.ok;
      } else if (l.kind === 'title') {
        const k = l.side!, g = this.plates[k].group.position, m = this.models[k];
        if (k === 'cn') { const sp = this.toScreen(g.x - (m.w / 2) * s + 0.1, g.y + SEA_Y - 0.36, g.z + (m.d / 2) * s); l.x = sp.x; l.y = sp.y + 8; }
        else { const sp = this.toScreen(g.x + (m.w / 2) * s - 0.1, g.y + 0.02, g.z - (m.d / 2) * s); l.x = sp.x - l.w; l.y = sp.y - 10 - l.h; }
        l.op = smooth(0.4, 1, rise[k]); l.vis = true; l.rot = 0;
      }
    }
    // Kollisionsprüfung: primär > Stadt > Titel > Gewässer
    const shown: { x: number; y: number; w: number; h: number }[] = [];
    const markers: { x: number; y: number; w: number; h: number; id: string }[] = [];
    for (const k of ['cn', 'rh'] as SideKey[]) for (const c of this.models[k].cities) { const a = (c as any)._anchor; if (a && a[3] > 0) { const sp = this.toScreen(a[0], a[1], a[2]); markers.push({ x: sp.x - 5, y: sp.y - 5, w: 10, h: 10, id: c.id }); } }
    // sichtbare Hauptadern (Ordnung 1–2) als Hindernis für Stadtlabels
    for (const k of ['cn', 'rh'] as SideKey[]) {
      const g = this.plates[k].group.position, m = this.models[k];
      for (const v of m.veins) {
        if (v.order > 2) continue;
        for (let i = 0; i < v.pts.length; i += 5) {
          if (v.net[i] / m.netMax < 1 - u3) continue;
          const sp = this.toScreen(g.x + v.pts[i][0] * s, g.y + v.ys[i] * s, g.z + v.pts[i][1] * s);
          markers.push({ x: sp.x - 2, y: sp.y - 2, w: 4, h: 4, id: '~v' });
        }
      }
    }
    // sichtbare Verbindung als Hindernis (grob abgetastet)
    const cu = this.conn ? (this.conn.material as any).userData.u.uConn.value : 0;
    if (cu > 0) {
      const mp = this.meander.pts, ms = this.meander.s, L = ms[ms.length - 1];
      for (let i = 0; i < mp.length; i += 6) {
        const a = ms[i] / L;
        if (Math.min(a, 1 - a) > 0.5 * cu) continue;
        const sp = this.toScreen(mp[i][0], CONN_Y, mp[i][1]);
        markers.push({ x: sp.x - 3, y: sp.y - 3, w: 6, h: 6, id: '~m' });
      }
    }
    const sorted = this.labels.slice().sort((a, b) => b.prio - a.prio);
    for (const l of sorted) {
      if (!l.vis || l.op <= 0.01) { l.vis = false; continue; }
      // Stadtlabels: bevorzugte Seite laut Spec, bei Konflikt/Bildrand Ausweichseiten
      const cands = l.city ? [l.pos!, ...LABEL_FALLBACK[l.pos!]] : [''];
      // Hindernisse: Städte → Marker, Adern, Verbindung · Gewässer → Marker, Verbindung · Titel → Verbindung
      const blocks = (m: { id: string }) => (l.city ? m.id !== l.city.id : l.kind === 'water' ? m.id !== '~v' : m.id === '~m');
      let ok = false;
      // Primärstädte (Shenzhen, Köln) immer zeigen: zweiter Durchgang nur gegen andere Labels
      for (const strict of l.kind === 'primary' ? [true, false] : [true]) {
      if (ok) break;
      for (const c of cands) {
        if (l.city) placeAt(l, c);
        const rw = l.rot ? Math.abs(l.w * Math.cos(l.rot)) + Math.abs(l.h * Math.sin(l.rot)) : l.w;
        const rh = l.rot ? Math.abs(l.w * Math.sin(l.rot)) + Math.abs(l.h * Math.cos(l.rot)) : l.h;
        const r = { x: l.x + (l.w - rw) / 2 - 2, y: l.y + (l.h - rh) / 2 - 2, w: rw + 4, h: rh + 4 };
        const out = r.x < 4 || r.y < 4 || r.x + r.w > this.W - 6 || r.y + r.h > this.H - 4;
        const hit = (o: typeof r) => !(r.x > o.x + o.w || r.x + r.w < o.x || r.y > o.y + o.h || r.y + r.h < o.y);
        if (out || shown.some(hit) || (strict && markers.some((m) => blocks(m) && hit(m)))) continue;
        shown.push(r); ok = true; break;
      }
      }
      if (!ok) l.vis = false;
    }
    for (const l of this.labels) {
      const op = l.vis ? l.op : 0;
      l.el.style.opacity = op.toFixed(3);
      if (op > 0) l.el.style.transform = `translate(${l.x.toFixed(1)}px,${(l.y + (1 - clamp(l.op)) * 4).toFixed(1)}px)${l.rot ? ` rotate(${((l.rot * 180) / Math.PI).toFixed(2)}deg)` : ''}`;
    }
    // Siegel 信 am Treffpunkt
    const sp = this.toScreen(this.meet[0], CONN_Y, this.meet[1]);
    const so = this.P.showSeal ? e6 : 0;
    this.seal.style.opacity = so.toFixed(3);
    this.seal.style.transform = `translate(${(sp.x + 10).toFixed(1)}px,${(sp.y - 22).toFixed(1)}px)`;
  }

  resize() { this.rebuild(this.P); }

  dispose() {
    this.disposed = true;
    this.scene.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => m.dispose()); });
    for (const k of ['cn', 'rh'] as SideKey[]) this.plates[k]?.tex?.dispose();
    this.mats.forEach((m) => m.dispose());
    this.renderer.dispose();
    (this.renderer as any).forceContextLoss?.();
    this.renderer.domElement.remove();
    for (const l of this.labels) l.el.remove();
    this.seal.remove();
  }
}
// Key-Licht aus Nordwest-oben (kein THREE auf Modulebene: im Revyme-Canvas kann three noch leer sein)
const LIGHT_DIR: [number, number, number] = [-12 / 30.29, 26 / 30.29, -10 / 30.29];
const LIGHT_COS = LIGHT_DIR[1];
const GROUND_Y = SEA_Y - 0.006 - 0.35 - 0.4;
const CONN_Y = SEA_Y + 0.016;

// ============================================================================ SVG-Fallback (kein WebGL / three nicht geladen)
function fallbackSVG(P: RBProps, width: number, height: number) {
  const R = responsive(width, P), s = R.plateScale, tilt = (R.tilt * Math.PI) / 180;
  const models = { cn: decodeSideLite('cn'), rh: decodeSideLite('rh') };
  const c = plateCenters(R, R.tilt, 1);
  const rc = plateRect(c.cn, models.cn, s), rr = plateRect(c.rh, models.rh, s);
  const mouthW = (k: SideKey): V2 => [c[k][0] + models[k].mouth[0] * s, c[k][1] + models[k].mouth[1] * s];
  const mea = buildMeander(mouthW('cn'), mouthW('rh'), rc, rr, R.bends, P.meanderAmplitude, s, R.gap);
  const sy = Math.sin(tilt);
  const x0 = Math.min(rc.minX, rr.minX, ...mea.pts.map((p) => p[0])) - 1, x1 = Math.max(rc.maxX, rr.maxX, ...mea.pts.map((p) => p[0])) + 1;
  const z0 = Math.min(rc.minZ, rr.minZ, ...mea.pts.map((p) => p[1])) - 1, z1 = Math.max(rc.maxZ, rr.maxZ, ...mea.pts.map((p) => p[1])) + 1;
  const T = (x: number, z: number) => `${(x - x0).toFixed(2)},${((z - z0) * sy).toFixed(2)}`;
  const vb = `0 0 ${(x1 - x0).toFixed(2)} ${((z1 - z0) * sy).toFixed(2)}`;
  let body = '';
  const widths: Record<number, number> = { 1: 0.13, 2: 0.07, 3: 0.03, 4: 0.015 };
  (['cn', 'rh'] as SideKey[]).forEach((k) => {
    const m = models[k], cx = c[k][0], cz = c[k][1];
    const L = (uv: V2) => T(cx + (uv[0] - 0.5) * m.w * s, cz + (uv[1] - 0.5) * m.d * s);
    const r = plateRect(c[k], m, s);
    const id = `rb-clip-${k}`;
    body += `<clipPath id="${id}"><rect x="${(r.minX - x0).toFixed(2)}" y="${((r.minZ - z0) * sy).toFixed(2)}" width="${(m.w * s).toFixed(2)}" height="${(m.d * s * sy).toFixed(2)}" rx="0.25"/></clipPath>`;
    body += `<rect x="${(r.minX - x0).toFixed(2)}" y="${((r.minZ - z0) * sy + 0.12).toFixed(2)}" width="${(m.w * s).toFixed(2)}" height="${(m.d * s * sy).toFixed(2)}" rx="0.25" fill="${P.waterColor}"/>`;
    body += `<g clip-path="url(#${id})"><rect x="0" y="0" width="999" height="999" fill="${P.waterColor}"/>`;
    body += `<path d="${m.land.map((rg) => 'M' + rg.map(L).join('L') + 'Z').join('')}" fill="${P.landColor}" fill-rule="evenodd" stroke="${P.lineColor}" stroke-width="0.02"/>`;
    body += `<path d="${m.urban.map((rg) => 'M' + rg.map(L).join('L') + 'Z').join('')}" fill="${P.lineColor}" fill-opacity="0.55"/>`;
    const col = k === 'cn' ? P.chinaRiverColor : P.riverColor;
    for (const v of m.geo.veins) if (v.o < 4 || v.p >= 0) body += `<path d="M${decodeLines(v.pts)[0].map(L).join('L')}" fill="none" stroke="${col}" stroke-width="${widths[v.o] * s}" stroke-linecap="round" stroke-linejoin="round" opacity="${v.o === 4 ? 0.7 : 1}"/>`;
    body += '</g>';
    for (const cd of CITIES.filter((x) => x.side === k)) {
      const uv = m.llToUV(cd.ll), p = L(uv).split(',').map(Number);
      body += `<circle cx="${p[0]}" cy="${p[1]}" r="${cd.primary ? 0.09 : 0.06}" fill="${col}"/>`;
      body += `<text x="${p[0] + 0.14}" y="${p[1] + 0.07}" font-family="${FONT_SANS.replace(/'/g, '')}" font-size="${cd.primary ? 0.3 : 0.24}" font-weight="${cd.primary ? 600 : 400}" fill="${cd.primary ? P.labelColor : P.labelSecondaryColor}">${cd[P.locale]}</text>`;
    }
  });
  body += `<path d="M${mea.pts.map((q) => T(q[0], q[1])).join('L')}" fill="none" stroke="${P.riverColor}" stroke-width="0.14" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${body}</svg>`;
}
function decodeSideLite(k: SideKey) {
  const g = GEO[k];
  const [lat0, lat1, lng0, lng1] = g.ext;
  return {
    geo: g, w: g.w, d: g.d, land: decodeLines(g.land), urban: decodeLines(g.urban),
    mouth: uvToLocal(g, g.mouth as V2), llToUV: (ll: V2): V2 => [(ll[1] - lng0) / (lng1 - lng0), (lat1 - ll[0]) / (lat1 - lat0)],
  };
}
function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// ============================================================================ React-Komponente
function RiverBridge(input: Partial<RBProps> & Record<string, any>) {
  const props = { ...input } as any;
  const P: RBProps = { ...DEFAULTS };
  (Object.keys(DEFAULTS) as (keyof RBProps)[]).forEach((k) => { if (props[k] !== undefined && props[k] !== null && props[k] !== '') (P as any)[k] = props[k]; });
  // ungültige Werte aus dem Builder abfangen
  if (!ARIA[P.locale]) P.locale = 'en';
  if (!['scroll', 'scrollParent', 'autoplay'].includes(P.mode)) P.mode = 'scroll';
  const isStatic = useStaticCanvas();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RiverEngine | null>(null);
  const propsRef = useRef(P);
  propsRef.current = P;
  const [fallback, setFallback] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const upd = () => { setReduced(!!mq?.matches); setNarrow(window.innerWidth < 640); };
    upd();
    if (isStatic) return;
    mq?.addEventListener?.('change', upd);
    window.addEventListener('resize', upd);
    return () => { mq?.removeEventListener?.('change', upd); window.removeEventListener('resize', upd); };
  }, [isStatic]);

  // Engine-Lebenszyklus + Antrieb (Scroll / Autoplay / Editor)
  useEffect(() => {
    const root = rootRef.current, stage = stageRef.current, host = hostRef.current, overlay = overlayRef.current;
    if (!root || !stage || !host || !overlay) return;
    let engine: RiverEngine | null = null, raf = 0, visible = false, alive = true;
    let pCur = isStatic ? P.previewProgress : reduced ? 1 : 0, autoStart = -1, idleStart = -1, lastT = -1;
    const obs: (IntersectionObserver | ResizeObserver)[] = [];
    const cleanups: (() => void)[] = [];
    const showFallback = () => setFallback(fallbackSVG(propsRef.current, stage.clientWidth || 1200, stage.clientHeight || 760));

    const target = (now: number) => {
      const p = propsRef.current;
      if (isStatic) return clamp(p.previewProgress);
      if (reduced) return 1;
      if (p.mode === 'autoplay') {
        if (autoStart < 0) return 0;
        return clamp((now - autoStart) / (p.autoplayDuration * 1000));
      }
      let el: HTMLElement | null = root;
      if (p.mode === 'scrollParent') for (let i = 0; i < Math.max(1, p.scrollParentDepth) && el?.parentElement; i++) el = el.parentElement;
      const r = el!.getBoundingClientRect(), vh = window.innerHeight || 1;
      const span = r.height - vh;
      return span > 1 ? clamp(-r.top / span) : clamp((vh - r.top) / (vh + r.height));
    };
    const tick = (now: number) => {
      raf = 0;
      if (!engine || !alive) return;
      const p = propsRef.current;
      const tgt = target(now);
      // Dämpfung p += (target − p) · 0.12 je 60-Hz-Frame, bildratenunabhängig
      const dt = lastT < 0 ? 16.7 : Math.min(100, now - lastT);
      lastT = now;
      const damp = p.mode === 'autoplay' || isStatic || reduced ? 1 : 1 - Math.pow(0.88, dt / 16.7);
      pCur += (tgt - pCur) * damp;
      if (Math.abs(tgt - pCur) < 1e-4) pCur = tgt;
      // Maus-Parallaxe
      engine.parallax.lerp(engine.parallaxTarget, 0.08);
      const parMoving = engine.parallax.distanceTo(engine.parallaxTarget) > 1e-3;
      // Idle-Loop nach Abschluss
      const done = pCur >= 0.999;
      if (done && idleStart < 0) idleStart = now;
      if (!done) idleStart = -1;
      const idleOn = done && p.flowLoop && !reduced && !isStatic;
      const idle = idleOn ? smooth(0, 1200, now - idleStart) : 0;
      engine.renderAt(pCur, now / 1000, idle);
      root.dataset.progress = pCur.toFixed(3);
      const autoRunning = p.mode === 'autoplay' && autoStart >= 0 && tgt < 1;
      if (!isStatic && visible && !document.hidden && (Math.abs(tgt - pCur) > 1e-4 || parMoving || idleOn || autoRunning)) raf = requestAnimationFrame(tick);
    };
    const wake = () => { if (!raf && engine && (visible || isStatic)) { lastT = -1; raf = requestAnimationFrame(tick); } };

    const init = () => {
      if (engine || !alive) return;
      if (!hasWebGL() || !(THREE as any).WebGLRenderer) { showFallback(); return; }
      try { engine = new RiverEngine(host, overlay, propsRef.current); }
      catch (e) { console.warn('[RiverBridge] WebGL nicht verfügbar – SVG-Fallback', e); showFallback(); return; }
      engineRef.current = engine;
      if ((window as any).__RB_DEBUG) (window as any).__rbEngine = engine;
      (document as any).fonts?.ready?.then(() => { if (engine && alive) { engine.measure(); wake(); } });
      wake();
    };

    const ro = new ResizeObserver(() => { if (engine) { engine.resize(); wake(); } });
    ro.observe(stage); obs.push(ro);
    if (isStatic) { init(); }
    else {
      // Lazy-Init: 1 Viewport vor Sichtbarkeit
      const pre = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) init(); }, { rootMargin: '100% 0px 100% 0px' });
      pre.observe(root); obs.push(pre);
      const vis = new IntersectionObserver((es) => {
        for (const e of es) {
          if (e.target === stage) { visible = e.isIntersecting; if (visible) wake(); }
          if (e.target === root && e.intersectionRatio >= 0.4 && autoStart < 0 && propsRef.current.mode === 'autoplay') { autoStart = performance.now(); wake(); }
        }
      }, { threshold: [0, 0.4] });
      vis.observe(stage); vis.observe(root); obs.push(vis);
      const onScroll = () => wake();
      const onVis = () => { if (!document.hidden) wake(); };
      const onMove = (e: PointerEvent) => {
        if (!engine || !propsRef.current.mouseParallax || reduced) return;
        const r = stage.getBoundingClientRect();
        engine.parallaxTarget.set(clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1), clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1));
        wake();
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('pointermove', onMove, { passive: true });
      cleanups.push(() => { window.removeEventListener('scroll', onScroll); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pointermove', onMove); });
      (engineRef as any).wake = wake;
    }
    (engineRef as any).wake = wake;
    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      obs.forEach((o) => o.disconnect());
      cleanups.forEach((f) => f());
      engine?.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStatic, reduced, P.mode]);

  // Prop-Änderungen → gezielter Neuaufbau
  const sig = JSON.stringify(P);
  useEffect(() => {
    const e = engineRef.current;
    if (e) { e.rebuild(propsRef.current); (engineRef as any).wake?.(); }
    else if (fallback) setFallback(fallbackSVG(propsRef.current, stageRef.current?.clientWidth || 1200, stageRef.current?.clientHeight || 760));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const scrollOwn = P.mode === 'scroll' && !isStatic && !reduced;
  const len = P.scrollLength * (narrow ? 0.8 : 1);
  const baseStyle = props.style || {};
  return (
    <div
      ref={rootRef}
      data-id={props['data-id']}
      data-name={props['data-name']}
      role="img"
      aria-label={ARIA[P.locale] || ARIA.en}
      style={{ ...baseStyle, position: 'relative', height: scrollOwn ? `${len}vh` : baseStyle.height ?? '100vh' }}
    >
      <div
        ref={stageRef}
        style={scrollOwn
          ? { position: 'sticky', top: 0, height: '100vh', width: '100%', overflow: 'hidden' }
          : { position: 'absolute', inset: 0, overflow: 'hidden' }}
      >
        <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
        <div ref={overlayRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} />
        {fallback && <div aria-hidden="true" style={{ position: 'absolute', inset: '4%' }} dangerouslySetInnerHTML={{ __html: fallback }} />}
      </div>
    </div>
  );
}

export default withResponsiveProps(RiverBridge);

// ============================================================================ Geo-Daten (generiert: npm run build:geo)
// Quellen: © OpenStreetMap-Mitwirkende (ODbL) · Natural Earth (gemeinfrei) · Mapzen/AWS Terrain Tiles
// @@GEO_BEGIN
const GEO: GeoData = {"cn":{"w":7.9953,"d":6.5,"ext":[21.8477,23.5523,112.5636,114.8364],"hN":96,"hMax":962,"h":"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","land":"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","lakes":"","urban":"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","minor":"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","veins":[{"o":1,"p":-1,"pts":"WPAJmwgBAwYBGgQ2HBYGGgEwCx4DKAJCCEwAHgQUCjQoLBwWBDoBMghmJg4IGBYcDiAKIAIOBA4QLGw+bEB6CgwEAhIDBgYCIAFOBi4ICAoNCAEQEBoyFiIcRgYwCAgYCAoGCgwGDggkBioCTiR2DEgCJggSICQMHgIaCTICGAoUHBIGCAAKBRAMPih+ZpICYNwBHlIIJgY0AkABpgECJggmHExgtAEeShJWFtABEmRoggNKzAEcVly2Aw==","n":"pearl"},{"o":2,"p":0,"pts":"Fu4H+glMP2p3BhcFNQQJBgcuFwwDHAAmCAoBBgcOLQYNChESEQoDKABGIwgBCAI=","c":"foshan"},{"o":2,"p":0,"pts":"VooaoghTFCkHFxQdFg8KHwoXEAsCHQsPAEkYiwE2MQwXAhcDiwEvIwMVBhMNJQEbCUsFPwlRE3EfKxAtCBMMOTATCBUCDwMTCzlFJyEdER8DRRIbBBUDMxUdAxcEDQgRDhkeDwgTAi8HFQBNIkcWFQwjGEc4EwQZARUGRS4LAB0FDQI7GCUILyIjEC8OJwMNAkcYDwINAxkNCwArFgcBDxEJAxEAFwgVAw0HKSNfVQEC","c":"huizhou","n":"dongjiang"},{"o":3,"p":0,"pts":"E4UV+RJfNDMiFxZHTB8QGwIbCV05Iw8VAxsGHRhBUB0cKx5rPosBZhIF","c":"shenzhen"},{"o":3,"p":0,"pts":"FdsWvBeNARxTFi8WazwXCBsEIQkZFRslL0sbJxcVGQslAmMwJwoxBIEBAKsBFAkG","c":"hongkong"},{"o":3,"p":0,"pts":"Fe4J+QcCAgICAAQCBAEEAwIBBAEEAAQEAgICAgQAAgAEAAICBAAEAAICBAAC","c":"guangzhou"},{"o":3,"p":2,"pts":"Fd0Q/AkFAwkHBwkDCwQLCg8IDwQNAAsFBwUJBQcFCQUHBQkFBwMJBQsDCQMF","c":"dongguan"},{"o":4,"p":2,"pts":"dvwUKgYEBAgELAgiAQoRGAMOAhAIGhEIBwgRJAEmBioDDAcKLwgbCxUBGQQPAQUJES0HHwcHBwITEAkEWwFDCA0BHxkLAAkMAQwGCBQIBggMNAASCQodEwkCIzoBHAcOCQQbCQsKBxQBDBISBA4BDAcMCwgLBAsBFQ0JABcMDxgNCBcTCQEBAgMcESQENh82BxoBHAQcCA4MCCQQCAgCDgMOBwwhJgkQAgwaJgQOEYgBCzYHDh0gBxYEGggcDhggLgwWBBgAEA0cHRoNECFGBRwDPAseExIjBBMYSTQHChEoDxgjIAgKAi4STA5uCDQ="},{"o":4,"p":5,"pts":"fqgOKwcAQTAPFhEgCQwJAhkLCQADCAMUAwgZBQcEABYKKAEGBQgxCAkBFQsDAAcGAQwIKgEOBwYlAxUGBwgHGhksGxwCEh4yAg4DDDUsKRADCAMaCw4tHicAKyIPCAcDBQ0BOQUTBwETGAUCFw0vBQ8GDRoJCicWCQwDDgAWChIgDAoIBhYFGAkMHwwJCBc+FSIPFAsIIQEJBhlECy4JDBsKBwoDMgMOBwofCgsICw4VKA8SEwgjBA0ICwoPIAk6CxAJBB0FIQInAw0CCQYBEAISEDQKCAwBIBIEBgEaBAgKCAQDBAIeHgQMABgGEBosGCIGGhwaBAgDEC5GOGY="},{"o":4,"p":2,"pts":"UdUfxwkPAQ8NDQUJDAcmBw4RCCMCCwYFDAIODigCEgUaDRYLBAcDDzcFCwkJGwMfBA0ICwwpOiMkJzIXGhkQDQQPARUFFw8bJwsIDxoFAgcCISsACxAjAAsHCTMjPxkPFwkFMw0nBAcNAx0FCQMAJw45BjkSGQclGxMDDQYXFB0SBQoFHgcGBwEdKw0dB10HHQcPEQ0tEy0tGwsvGQcPAg0IDQc3"},{"o":4,"p":0,"pts":"EoELig4iKCY2DBgMKhAUZFKCAURWPkBGcmRwdHKaAbwBzgI6By4BtgEWrAED"},{"o":4,"p":2,"pts":"PukU2A8KCQwlCA0gHwAJCyMDGwYPGicGDQArBi0BJwQPEA0mCRQJEg0aIxwZAg0GPQcjABMODSIHBg0BExMfDQ8ZExcfOyMREwAJDB8AHQcVIyMDCwELBhMCDQMRESkDGwJDCBkQHwgLGhUYHyYbHCsUJwIZDSkENwc5CmEagwE="},{"o":4,"p":2,"pts":"RtUOpAIFBAAGAToFDgMeBB4EDCwsFCYWEAgKAhAEOAQOEBoGDBReBgoQEgYMBA4BEAcMERQHFgQSDhoKLBQYamQSFBIkBhILIgYIGBIMDAYOBBYKEAoEEAEMEQoHBgIIBgoSEjYIOhIUFgwICAAQCR4bEgsQBxgHOA0mARASBBAIHhoIDgAKHzADFCZsFGI="},{"o":4,"p":2,"pts":"SqMaqA4CCRgXFgUQDSIDEgsUHxQxAAcPFQMNAgsOEQQLAg8FIwUNFxMHDQQFFgIOCQoTBCkEDxgTBgsEHRElAhkcRxghBg0DGxMpAQsEDRQABg8IKQkjFR0BCQgTFiEEHwcPEQkFABMGBwULIQ8VBAcUDwAFAwEFAgcCEQcjPQUXBU0LJQ8RNRkNDQMTCi8DGwUJKScTHw=="},{"o":4,"p":0,"pts":"GcALjA0WAg4EGhYSICxsFBoiHiQWVhYgDC4YQC4yHgoABAcBMwQXJFccYTYXKBkoCW4peD8="},{"o":4,"p":0,"pts":"EuIKvQwyHTgVLhcYB0gAFgcmDxgDdggwDrIBYi4edlwyEygLehM8Dw=="}],"mouth":[0.588,0.8227],"mouthDir":[0,1]},"rh":{"w":10.8021,"d":6.5,"ext":[50.5977,52.3023,3.0273,7.5727],"hN":96,"hMax":565,"h":"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VVNKQTk3ODdBRUNHTFhOVlZeWlhDYHR5cWt+jXt/hYh+goVraG5saGVjXFlpY0ZBPD8/QU1cfIOVl4N0HR0iLTQ2ODEgGypBRUxTRT4xKzc8Njw7NjMsQV9kYVxMQz5JUVZTREM/PkJIS05OSVZTV1hhXFZCXnh+f3h/jYJ9ioyXjZZ4bHJvbGhoX11qeE9BPz8+QURJYXeCeHWZJicuMTMxMisdMlZZUl5gWDosO0I8QUA6NjcvVWNkV1JQREdQVllTQk1BSUdNUVVOS1NYV1dqX1NAXnWFhoSUl4WKk5Wkm6uHd3dzbWtsZWNkdGJIQT4+R1RnW2dvbWugJCstOi8oKiMbKzI0OFJFRTYsJysvND87PzZBWV9sXFZOUkNMX2FUTk5HUlBVWFpRV11dXmNfZlVJWXKNinmSsJmZmp2mq7SnhH16cG1wbWhkc3ZvQ0NAV2B5cIV/i5W0IzIyLzEmHRsfIyslQEg8MjElLjc4N0ZEQDpIVmRjUE9TT0pOYWVXU0xJVVdcX19dY2BjaG1vblFTZ4iYkYiGobGjnaauu7y5ioeEd3B0b2xpbHd5UkhCbW9wfYeOlbixIS83Ky0iHRwnJTQsUk06MTIpNzg9O0ZCRkBdYWFeWVRaSVZZZ2hVWVVQWmJkZ2ViYWVpbnFzbFZea4mWnZmGlqOnpLC4yse5n5iOfHN0cm9ubXZ+ZGNFV4B2ioidqrWoISk1KiYfHSYpLDY0U1hAODAvPEA8Q0Y/PktgV1xhWV1PXFpia2NeYGBVX2ZraWVkZ2tucXV5bk5ueoCNnp+SmqWor73E2tC7nqqOenl1dnJycG99dHZhRouKlIueq6WmIiQvMCkhHTEwMDc0Pkk+NSkzOkA+Q0lGR0ZUXmFkXGJRZ2Nmb2llZ15eZWtsamdqbHBydXp/aFF6jo+Oo6uZo6yvvs7e5sy5pLCXi318e3V1cnJ3e354So6okaWloaOfJSwqNCwjHzxBOzU3OE5HOSsyOUJHSEdEUFRlZmloZGhUamtwcGxpaWZoam5saWxvcXR4e4F8VmWHk6SdraihqrPC0tn459zVsauljIGFgnt6d3J2f4N6Y2uipKienJqXJjAsKDAmICozPzxHP0U9NDk8R1RWTEpUW1BjbW5taV9VY25xcW9rbW5vcHBycXR2eHt+fXpdVHSWoaypqaSjq77P2Or259+2q7qzmouNiYGBf3d3fYOAdlWcsaeelJ6WKS0tKCopKSIqNUJGQjo7NjlDRVJQTE9WZlRpbnFtZWBiZXBzdHRwcG5ta2tqdHp9enl+cltbYYqcm6CioZ2lqsHV5Pj78tPOx8S+pp2Zp5KNjoWAgoqShVmguJ2KjJOSMjUzLzM3NywnLEVEPTk7PDc9SE5TTFVVZVNeZG5nYWJubHN3d3h0b29vdHh1aXiBgHl0ZVBeW4iTl6GZmJylvc7k9f/49tTC5tvFr6+nm5mgo52PhIubhWGRvKiUoqCh","land":"zAQA/x8AxRlcdTAnCgkFBwoIYEcWFw9ZHjM+DAxMHgbcAXscOQISAQ8mCyQnFgUFCAwcBBsAChYPAQkCCgYLMhEcFQgVAgoCCRwFBgwICQQKIgIDGAYABBECFgYLAxAICwMMEgMJFAgLAxAQAgkVIDoaAAAKDAEQGoABLAEJFDQMAgEKEBIECQIYEhQ8BgMkGBQERSAGIhwBFg4sCAkHMwYABCAAHQgGBgkDDggCAQ0CEAoDAA4MCCwBABcEDAENBAoKHxwLLkEYAwELAgwMASATCAwSXwkbBBsFDwgKCh8FDwoMAQsCCh4HCBQADwAQBAcGDAQHAQgaAAQcBhEBRBAFBRsGBQZCBgMYSlQWAhAHAwYKAg0GEhIKAAwCCQYIBQYGBQEOBgcBDgIJAhIQEAQaLC4RFQwAChADBw8LEg4FCQYDCBgBBwoBCQAACQoABwEICQ0OAhcDEAcCBg0HEAIXAxILAAgPBQwECwcMBA0FDAMFBgEDBAMFFgMABxUKAwsKCAIHAAgLDwwFAgoECwQKAQkMBwkWDAUBCwIYBgMDDAQLAg4CCwwMAQ0LAAQLBwgFFQYACQsMBgIQAQ8KBgASBAUEDAAyBgAFBQgbBAoLDQwECQMGDQoSAwcIAwcJCwQBCwYACQ0SAg0FEgIKHAINDgwRDwAJJQkFBxAIBwkqBQgSAgsNBQYDFBYPEQ4KBgEvEwYZIiQcCwcDBwgCFwMUCwYFCQoFCQAQBwUEAAcLDhMVBikGLAAJDAoLCQoCAwkOCgsJDAQCDQMQBQUGDQUOCwAMCQ0CAg0KAAkFDAILAwILBgYFCQoKBwsYAQkIARAIEwgCAhAADwwIARQHAQgECwoBCQMSBg4AEw4JAQoGDQcYAggBCQ4DABAFAAISBg0CEgAPDAsLNS4DAicXOSEXCQQNIRECBw4CEAMPEQIjKFEjHxkRAjE9CR8IDx8NABMDEgELHQ8GFQczBUY5axkeEwIdIhMJBBgHCAwiAwMPOgAiAAsbfgsGJxUXIiUGIxhLYQIXFQIRFxMSHQ8JNwkMBA8FEAYPBxMHBAgFCQIGAwMNKTkFBQMOABEHChQxICABLAwXEBIGCREdHBkDByMYFRscHw4GBjMLFg8jBQYKHgUQHR4XAAISBwkJEAcHBRgUDAAMExMXDgUaDQopBhURBhQRBxUOBQkCDBktEQUvPzefATc1GSUHHwsFAgkFBgYJCQ0IOQoVKCEKGQQICAkDCQQKCAkBCQQKBBMECAgJAwcECBAZBAYmIwINCgIeKxYLAwcOBAMJBAoGCyoFSCAkDTYpBEcPFw4OAhEbAxoHIEEBHQoBCRAGDgoNAwsQAgofBxcOCwMjIxsfQwtnCB8UMTZJIgZCI04QBCsgJyxfBQUBCgYjE2MEFxgpdFkUAiIdJAEsGxYMCwUTHBgQAwgJBwoKAQwHAwQKCwkMDAgLGCQMCwkYDg4FHRYEJkcAJUWtATR/GytLJhIBCwYfFSerAQZDHkUiFUoOCilWMBYdSocBTLMBMD8oSxw9AxkMIg4BBRAOGQcKAhELCgkXCgRShwFq4QE2nwEIBAUHWP0BNK8BzisAAP4/HfcH2BEQBxEBAB0KAQIMBgsAFAIPAAwEAwUTEgYFHAYEBQIGAA0MDgkFDAYcEQEBCwIMCQYEDQcPCAIJByflB9ARBw4SAwMIBgMGFAkIAQcDFA0GBQUSBwkDDAEHBQYNBw4BEQEQAQkHBgYJBQgGDQcOCwIQCwcCAQ0HDgYTCAAACgYNBAoICQAOAQsIBCHsB/0RBg0PFAQLBwgGCQcGBAcHAAYDCQcICwoYBgUEBQkCBgMHBAMHCAIHAwgBCQEKAQMHCAUDBggBAwwMCgMMCAQPCA6nB58RBBcDGAgRAQ4ECwQKAwsWEAYcAwkFDgAVGwcUowSHEU4YAQcMCAIFFBQJAAMMDQECCQcKAgkBCgAJBQYhFzUDCQkMKxAmBfYFhhEMCRIMEQYLBw==","lakes":"B+0RAB+AARUkmwE+SwlNPYEBmQEGrxAATmgyIHYHQCkmVQ==","urban":"C8QfAAI+FwEjbGUAY6IBYwAMZSItXg0FpwEY2hoAGhY4FZQBACF0KycpAklaHmAYBS5ZOmwaYBB2IQ1BeJUBiwEJfU0NFSc81QEJPSs+BT0InxapAXs9HMsBPh1ISDxsI2I9EgivHHJGmgFbzgEVAiVXAWk2rQEeBgesHfUBFUcMSyI3JAkAWjt8Dq4fnwEuCgA2dDIA5gMdCBMkQc0BE9UBKZ8BJzECNygADioLyBbXAiRGDUobHk0EAGcUORIAAjMaAhIiCP8bugQtNwdxHi0kADZkD2QxEAj2HdkFJzcbBRZlJiMgLgiSAR8ICLYb+AUlBh0VE9UBYjwWLgFUHSgHkhrABiURUY0BJDswCiRKAIgBCZgdpQY+IxIkJ4wCLyEXWwetAhQKFJYBB6AX2wZTExstB19WCBwuBmwHvx7LBkkVDEkeH04BC1whJgjMF8gHQzkUaxQ2Lg4MGgJCHwYMrhngB3IWKrABBHo7M3dqCytDPQIvOnEUnwEUNgaQHoAJKxcEpwIQCijwAQ9GCI0b4wgjAx0rCkMWH0QHBWwbMAf4Ff8JIRULfTQxMjITYCM0C5gd3wkUTCIUBiIAbCcQE68BJwAAaxgCEBwInR/WCh0AM2sOSxwbIgoaKhOgAQeYGPYLLx8cnwJcSghWUwgEmAEMshbuCwBGDwgXPRM2T6kBKSsOPSIXSiAANjyQARDzFtIMHfQBEQYVOycAADU7NosBNlChAUglCHkUahwUNLMBLiAEZAevFbENKxkjOQ9REGUYDDiAAgiUFocUE1USFRafASAIInoFVE82C84aqB87MxTVAQ8tJRcFWT4KigGWASvSARUqIQ4QjBzYHigAADYUACSUAQ9CIQpBdXdsA1csswEgNAgzKAAAMxQ0DbkeqwISMi6bASQDF5ABS3wbBjU7ATkqLxSfASAiCYABFpoe5xIFcnFkPPQCTzJjBAJZGhVIBgJtKWUAaykHYTwA6wEnHRM2A38WJxwENGyaAgIE/x+SB19vSLkCGEYJxhaACQfZASEvFFMqHS4QIiwpqgI5FhGiD0UCHhMAFGwoNA9aGzRfSBPVAVAAE48BGQ8NNhchGLMBPAAmggERtxG9AQ3cARE0JxwljgEXHk0nIQQjfTL7AS4YQHoyDig1E4kCPDQHMg+QFf0BESQTAAA2EwAbPgs9PRkRGwxxHGMcGS4DLCYUqgEMpxD2A48BiwEDOSwxHcUBHuUBGBIk+gET1gEOKkJAD1gFixKVAyVVEn88NiegASejD5UDLIQBTFI7jgElABVZJzYATDxUG2JNSy8yGfgBKSE7hwElKwo/Rl8RR2VXEzNHLhstDk9MJx4pJ4MBAE8cIHAUFGwaCxxDIAAihAEyQx6PASg0E2wJlQ24BC8PHysSUyobLg4iLhNUJxwNtRSpBABsMUZrHTkkAmcSNxQAADUoBFo+HkEQHgeNE8AGF0cKS1ihAS4LDXppyAEJwA/0Bh8JGSkMSxwbIgoaKg1MGxwLuxHFBzsAT2wtDSEnJm1+WRCtARAKHu4BBUgF8Q6WCEUbHYUBSg4alAEHmxDLCCdrOyMARSAdHiwmyAEI4A3+CFkEAk2EAbUBQgUDRjeQATEwB+kMlQkfKQYzZocBFBIMdmteDbgP9AgSGEQ1IAAHqgEfLDEfCUlDFxMjCGMcBCJODPARxQkgVhYJAixb3AEdBUttAY8BFCFiFwA1GiAHsg/rCjEKAFk8eyA6B1AhQiSQC/AKFGw8JQBaH3ITtgEZHictJwMpLghKXCAUNjwAFDU+agdESShLZBcGQWsplwExQRWZATIcMhsGNy0xAisSdRQAFJ8BKAAUMxwKDCoepBKhC2IpIDQBMjk4AEAoYBNsFGpmJBJGAkwpFS9gHwwTNRQ1E2knABSfARc9PxYfDQCfAVPHAQRDGBw6ACYaCiwJ4RGiDT0TNYEBE8EBHAcgqAFeChoqK4QBCqIK+A4zBi8dFJcEICg6lAImDgwuEX4pOhHMFcgNGNwBKQARNicAADY9NTs2P0UjEBSLAoIBiAEyURZqKksQhwESLgv5BYcOABSKARhvvgInNRRpKYsBGocBOD8OPjtME7QEtg6YAUQcJBuUA1V9GwNLLicCZSUfHS15PN0BGgkiHCZMKGsoAAo7CjwMvBODDw0IXuIBBpIBGwAznwETABnFASEPFE0oGw5kCOQN6xAWTBQAJ2wANScAAJ8BJh4W6Q/3EBPUAX8VHxYANicAADYlMQ0GB8wBMRsxHABBUP8BUAIUaywqNhQqCSAvCG0UNgenEZcSKQZhOxxzLhkuOBSMARqTAo4SGXQ1GS8oS9ABRpgBMj4CQD2UAQZwLQMHLTVmI4gBKRYUoQEoMxNrJwAo0wEDTzXzASk9EoMBggPRAROwAQe5EMwSD0EKXxxRJhcDYDesARGcBv8RKzAA1AETAhOgASdrTwAoZQA5ETdPBQFhEhdsICwJWD8GSBPtDPgRPC0KLEZAWiUeJhGKAStAlwEQBTknAAA1WSEdIwBZJgAqNRQAFC4PkhKgEg2YAxsGJzgfBwDVAREvJxkBVRojGhocqgEgLTCRAg5ICooM/xIXpgEVESWNASueASMCBp0BZFMiTxicAQ6xE48Tb/ABswEAEzYMpwEiG14RFDUUNhwJIMsBUAAKUhE0B6cUnxNDOxRpEgU+bgA4HwYVrBGhExiqARoiEVhRVwKAATKIAQhuTzYA1QGfAYEBTScpCgErZt8BEgEqOHYYFhcUax5AB5oNmxRHkQEUUyQIIkYMcB0oG+QPrhMefE32ASkfJzZTCzd2KwofEReXAUQbDBkTaSRTQBcAOCc0BBxGRkIIBGcnTwNRKgREPR4ECiQJ4AvsEwdwP2IHbidbFHcoAB5jHgcJggTyFA1KGSAfCRsrADMTACifAVCgARG5DMUUD44BJwAVogFTAyEeAYYBJU8BGxQAE9UBFBEyEBJVNBFEgwEeYAmZC/IVOUAnABM2J2sIM3CTATwoFZYBBcME6xVLKw1bWgAAiAEGwxLpFx8DFNMBPGoHOic0BvYQoBo9WxY7YjwZTh8OCPsO4xsvCR+3AiApMAkCPiliKNYBCJgE4BstAiUxKIUBIB0wBAGMASFEC9kNohwPIiKOAQ1IKx0PtwEfRQyPARoDNjgDgAEHqw+ZHEtrGDcsBUg8GWAlDgedEYIdJwITnwE8Nzw4IXwZIgeUBLAdFQA1WQ41agADSCdIB7kQiB4i1QEeHzggCWwZPlMsEbsClx8QWCg1FAACMxQWEooBUgAmQu0BAD1BAJ8BJWEBPTxrIDAM7gEGhwjaHwRKVwAKYyYTJC4F3RP/HwBBKi0uECpgWfYNACdEIQU5PRUIADYVNVGMAQ9KGIYBOjQShgFRAACfASUAJzMbIAugAhkkDyMnABM0ERU9qQInbDUKAk40Eig2EcwBEnQWACnCAREUHlhgXAyMAWUEIyMBfxM0JwAA1gE7NijWARMAMI4BJBwkPyrWASAiSg8iIgA8JzCpAcoCMywpuwFZFRkvGy4hAROfAZ0CHUlLE2tbF1eHARPWASdqOQArNRFdFHUudiILBZ0BSWUApQF7RAAUNYECGENUHkQRPkGCAoME3AGTBIAB+QIZ5QreAgakAUsdSRo/UC2IARIcKht4ABQ1KAAAMygAKGsMTDAgAJUCJ18JgwEnLSEGS0IIUjY4DEgJ8Am3AwBDNQRRKRdaOGwYABQ1PCUW5gnVBS2eASECKRE5cScbE9YBNRAFJChsAGo8bCgAE4sCIhtWGTxpFDYoAAelARMnHwcJigjOBjsbE6ABGiheDixeGgQeYYsBuQEGthAAwgEADHRbFDEfTWcHlRKKASlpAqEBegcNWC8cE6ABBc0QvwEnaSZXOh43pAEH0w+nASMFFJ8BDacBVgAI3gE/cCPmEtoFEiwnoAE7NihqE2pDXx8JHR4EZA0eGQYNpQETABqjAQUxEwAoNRNNY4UBJosBGjMkFSigAROgAUL6AR4QLDMTaxQzCWsvVxKdAkh+MrgCTcoU0QVSCAA2FAYiGxI/CCA8JgJGISstCRKWATQ6lgEGEWShAQYp1gEZISHpAWMoYycEVkxKI4wBKSQSxgEnNgtQNP4BE1wXBjelARMAA40BIxETaRkKIWA/Hw0QAXwjCxE3DpEBQ04TBwt7MAdUHBwTADUoMwMdIxc8aQklJwEZRisdRs8BHgUANigACqoBMmAYPRfLAVBrAGkUAAA1FAAAnwE8ABQ1KAASLuME/x/PEBchHwYBlAE6OgByIwAnNqMBEzcUEzYfMwmhAWQALcEBNRMlM0syIWkzKg+KAXFyHRkAM2MAI4UBFxk7NFMAD5QBEAYsLxQ2GWAZCBtZO141DAUoExcUuwETazccjwEbO2wo1AET1gEoCCjdAUItDjsWRgtMHzglDBBAVJQBAKABGg44HyZXSDwwHSeHARQ1DR5nGhU0BwsLXxZVigFJADVyFRofFDYvjAEzoAISPFI7BDgrMijWARMgABYUAACgASMNFyw7mgEBWCowFGoUAABsKKABWhokLAWQAR8WOQAv8gFiogFIXxwJPuoBAYoBcqIBBqABJzE7AxRsEzQ0uAELVFGDAiU7H0A0tAInbB0DMZsBRQULZyVOJyATNTsACcMBY5kBGwNlWicBJzUUWUQYICk7vwI7hgEnugEpMTkBELkBIxsTNic1AGknABM1JwAANSfWAQnhAR0nGwozlgEfAhFvHQIDPCwuDtYBNTYANk+gAU8AAGsUNTtpE58BJwAANjsAW3R19AEdDhNvNKcBC10VA03kAxEIFTspAA0pQSoRNT0AAHso+QEHPU8cHxMnaU82EzWzATYBOyovADU8MxNrFGlQA0ApKmMOrQEsBmA7DW59aAw+fsoBFgICUSkvAFE8NBRpKAAAayoAHqYCChxQABRqEzY81AEUESjBATBFCjURWSc1AGkn1QEnADtpTU4VGQAzOwA/fRHDASgJHmweChQdTY0BDlEZFQcryQE1J2k7ahKMASpKC0xXVAOUAQ8MPNYBPiQBRjcEU2gFXhkUBy6fATYATDxSFnY3DBkgAIoCJzYAahMAANYBOzYooAE7ajBiIAoUNQxcNVphLPcDAEBBCy8xFxEjGn8sUR4yXHFkLERZAJ8BKAA2hQFCGRO/Al2/ARkVLz5L2gE3QQRTKE8DZQkdFQ4b+wETABOrAyhpPDYUaiwfECADUSdPBGdYaCAzT78CCCtICShpDCwcCgdWR4ABDCREEAZMQVQQigFRLg0eANYBTzYUaig2E2o8aiwEnAFtAEU7WQBpJRMSwQEeKgrgARQPLuUBIhMTnwEUnwEmRANGIUoaAjZrVAEoyQEQCRQ2AJ8BND8IRRMZEx5BpAERbA8jO0QTDQBpJQAVNAsNMrMBFhMaDCKUASgzAGs0YUSRAig1AGsoNjRpHAAo1gEOEQaPATQ9CCsBVS85AWcMWDwkFCMjkwFTQQCJAigAAGsUAAAzFAAANSgAADUoAAAzSIABLDMGtwEmACo1PBooTTw2MlkesQEeCkZiC4ABG1Q1DhnIATl5FRAseANeOwAAaycAO2knNDzAAgBsFAAetgEeIBNqKTcRAgkyKQgbOTVIC04ZFAcsTwwZVAXWAiAqOgAAbBYAEkBmKgw+MAcnoAF4AAmlAREnHwcMdxxdKDMUax9LLx0o9QIoNQipATRfFGsuWA7qARsFJzUfBhSgAR3GAQpEFAIS6gFSigEU0wE7NReDAQQbFAAAnwFKRQZZKDQPdEzMARSfATgJBClfuQFTUQJPOk8n1QEMKCYlHgFCZCxDKtEBR+ECMgIisQEkJRPBAhwxFDQ0NQBrXgUyIhBQEzQoAC5eIg4DVUtJHlssDlaCAQBQJ4YBKKABKAAUbBgEIi8WLCgAPMACICUfrwEU1QELOyk8GQIT1QFmHEIlDCsXQSsgHxMn0wElAB9WL20BUzghuAFYKDUAiQI8ATqlARYGBKoBHGAqIC4dCFQgFhPWAWAOIlYeAigvPAA8az9pBGkUajw2IAswkwE+NBJsRmkmOgw7FmwnABpmMj5kKAe0HNsLFjsZZQ8CE4oCHhUKUwu7GYkOIkUU1QF/OzMIAlImTgBqPDUUoAEGIwmGGpMQaA0JaR01NWQZBjF/CUpMeg2JH/EPDrYBLiASNT4AADUoAABpJBUEHz0DYzg5AgimGfMUF4gCGgQOowE2NQYzJysjLgbuGK0VHwsnigJSIhp/I58BGssZohYWgAE7aicAAI4DFFIcywE0BxSTARQLKIoCKAAUNh4AHl0AQTMFG2UmZQI5J2koAACfAYkBHykgASAm4Ri8Fw5HHx47JxsIE2wAaygzCsECWdYBEzMnNBMzMQJZ0gE7AAA2GxozWRMKFNYBKAAAahQAZIwCPAAoNgpJMiEsXihDNE4YBCifARTVAUUPCSVCiwEGghf9FgDVASsWDVQOViwWCdQVzhEGQzUASV0zCwNmEiiIATQYEwmoHfsaJTYhBQRWKkoiAQmJAR5JGwYN7A6QCQqAASg2E4oCOzMbrwIfRRM2CxMMVywdHAImPA/pFKYLUgADXBMyOUgTAAA0TxYTFRpdNgsNyQEniwE2FiigASyMEb4MIhAA9gInAB1eMQwohAEiBi4dKAASWSpaFAAUaig1ADYUAAzYAj4sBlxRGSVQE2knABM1OzY7AF1GLREdPwlfRgsCf1t9NXEFmQFWWpgB2wEOwwEPITcNFNUBKAAaXNoDlgnxDxQEIi8KZisyFGoT1gEUaiQNLF8oAgE8KjAW5gEgNAZcZAACpAEeciYeHl0YIheyAR0QRUMXKg+sARMAPuIBAVygAZ0BEYoBPRYAahQ2O8ACJzMrHjeAAQY6FhZIGRQ1KAA8aRSfAR43RjMJI0UPBHdMJSBlWD0oMwBrKAAAaSoAADU8nwFP0wEqPRwmHuwBFAAUbGQAAGosXDQEBMkBLgYkKhJSAIgBUA4kNxBIHBgwHwxLZIwCHCkinQEmDRryAiI6Jg001QEeDgA2KAAAaigAE4oCFAA/3AEQVAuyARyqAUDKAQuiATNLB78BE6ABJ2wZHRnLAQxXKAANMyUJGysTvwI1WhkSEzU9RBEPADM7AGPVATs2ADQ7aScAEzVpOCE3HF80PxQAADUobCgAFDRyExoUKGxYQSAMCWkdNR8UE1QbBCezARERUSQChwE2mQEEhwETaicAAGwlEgEiHQSBAY0CFx4juAETCxOTAScAADUnAAA1OwAVMzd6ClIpKgViFhwaDQ0lKqEBDgAaNiICLp4BD1I1ER0sFKABGiZaDywePMICKUIlEGMbPGsFKRcDCS47aUe4AUioAg0qDQELXSEwL5ACKQUdJRunAU+KAhkNDccBMxkTIwxhOzYW5gE6WhNqPKABFGlKIQZHKmoVNhymAgWEATVABywXMSh/BFkTMxNqJUwBHhQAJWIBPnczJ9UBOzU7NhM2AGoRDwV5rwGKAU+pAyECLZ4BTm4CZo8BOEuhAR6FAWTZAR5/E4sCG04zFxj9ASY/OgESJRaJARMlJkF6eChrE1V3IgBrOzU80wEnJT8wIwkUazszFx41yAIBsAFDES1RQdsBCw4MkAEUABTCAigAKGooABSWARQKGS5JzQEdKArkARsHR2MnABNpKw0Jehk1E2tHZQc5BEM4kQEbNSUoE2YhFABqJ6ABOzUGcUpFFFEJKUULJ2knaicAEzZPAAA2MSEJSSk4EQETaky0Ag9CO9MBOwAMjwELRTtrM0wHwAEnnwEVAR8sBSkCbxwfag0ENzw0PDMHyQEcdQsrLyw7NSRrgAEddNUCKAAU1QEonwEUaigAAGwoahM2AKABNzYDNAwsMCtQNgtyQ3ALkAFqbBgbAoEBMAggKiikAVJlAW8dARNwHQMYezgjFVVZOQd5QAoQPyQ2JJoBWHAILjY+KicQQ0mhAQVnHQETbh0BAGkUNQBpKAAUazwASm0aBAiyAS5SFg46HUIWJ6kDd4oCT98D2wHWATx6AFwZIhsELSUz9QFIfwN1LAooNig1UA4UDSZXFucBHAYwNgpKVJoBCjwTTiItGltJPQvDATujAQeRAREVESgFLRBBJAlUlgIUCxxXIAdDgwIXEwOfASNNMy9JFRNPAU04BTorVmgNXCY4JJYCB+YJ3RUjVgN0KiocUwJvHy8H3AmyFwsuGwgOcFbQAQW3ATW9AQmkC9YZFG4T1gEebBYzC6MBFNMBOzUAMhiOCvgbBxAfBQA2JzZPABSgASgAFGoUAAA2Ji5KVzALB11HMRNFInNePAxnFy0nEUsMACoL4Q/9FwPgATwAFDYiARrTAS0CIRtDcwsiGCxHce0YFAAANBYHJmEeLgmoAXxFLk0edwoMCmARNgBqER4rAhtAC6oBKGwuJUqZAhAgQhQ0XBoCFl0OSCPEASUAANYBPQATap8BADs2FNYBAJQEO2kZIieWASEeAkKLAgAGoQReVhohAks3uQFHAQCtAS4MFGomNwKdASwFYDwWKRXhAXQNGCUDQUsnE2snAAAzXQsZKTqhBCoMCmobbhJoFo0Qgh0fjAInNgBqEwAAoAEnMzdUA1cIGQweDAkIYRQAIpsBBbsBBxsTAQ5LQokBPGwHNBzNEPILAD45JAFZE0IM2gEcJAlEFSBDCCV/DkUvhwEbxwE7JQBFPgdQhwE6DyPDARBHFgwSdihCEpABJjQjWhSYAVCSDecJKvwBYnpCCAdUQVYWdgeKATkODGQaAIYBZwVjQw881QEPXThBPDZgDRgOUMACE2oqbgFoOQcnKBlMD2oiRAKEARMPI4EBXRxVURTVAWkQK1Q3RzUbAUM8WwCfASo1AIkCOzYAahM2FGorXiMeE44BEwITalcUSRM9fRHBARQ1IAQWFxBRIgQmYjw0C2U/eQ1PRw0eiwEKFxQCFDYqACigARRpKDUAiQIaBw4tIgcU7xKGD0aGAiw2DdABJ0A7NQBpJwAU1QEpBTs4JQQCmQE1kQEHfygAOD0YChRqUGo=","minor":"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","veins":[{"o":1,"p":-1,"pts":"5gHXG84ZBgkMLQYPDBEUFwYJBhUADwAPBxMlJwcNBQ0BDwAZEEUCEQEPCR0tQQQJEgcQDQYJAAkdLx1NO60BR5cBBy8ZJRtDD0EPMQMJDQUfCAsABQMDCQALBhUCEQVLDTUDOxN9BxcPHQMNAA8GKQEhBRcPIQMVDE8EDRIfBA8BGw8fAQ0ECw4jCBkCGwEbByMjRQkhARMCERA5AA8BDwcPCQklEwkJAwsBFQQPFisCDwETL6kBIWsp2QELVQMPESEJTwIFCg8ADwEFBw8zUVObAUFdgQGVAWtxIRcPBxEBBwUdMyElJS0TDREHSwsPCS0pGxEbCzUFDwkREwEEBiYBDAkGCQEpDyMJWQsVCREPIT8JCQ0HGQITCA0QESIHDA8KEQAJBRMVGQsrLTsXRyM5JT8HNws9Ay0HJQg1JhsKPQQfCCMJHQYPCBkoEw4JACELDQINCA0ZBwMJAiEiRQ5LGHUqmQFAmQE4DQoLGAUGCQAnDxUBFwgvHhcKXQNPEhUFJxk7A0MICQQNCgcCCwktOxcfGS0hHx0nMTtTew0DGQwRAicJFwEFCwUfDRMLBT8PNRkfEwsNCQ8HAwsIOTgXIAcCCQcVLQ0TNTtlgQELAw0KBwAvISsN","c":"koeln","n":"rhine"},{"o":2,"p":0,"pts":"WI8WwBEDBQUtFVcDHQAxBy8PfzmrAgspGT0JJwcVExsbGQkTAxcBQxM9AxkBQQcbCRUbKy05BwsJJQkTQVFjbzlJQ1snQR8XFRcNAxUGTwGXARSJAQNbHH0yWRYPBw8fBwMHBBUWDQoJAhkHCwANBhEOCQQJAxcZDQkPAB8KJQcRADMSJxQfHDU+FRAVBhUAGwUfDTcdGwUXBC8MUwo5GB8CIQlBLw8FFQMJDUerARU7BScJcwsp","n":"maas"},{"o":2,"p":0,"pts":"af8flhAAHAcMBxALKBscBwQXBRMMMxMXAA0ICw4FFgcoBxAJBgkBGxUNBgcKBQwBDAQgARADDgkICQcPLQUNISMJFQMVBCEAGQURJxsdCQkGBSIDBgkHER0HAQMEDRIZNgsMJwQhGxMDCQIJDgcWBQwRDgUIAQ4AKgEGAwQJDQMRBSsANwMNAw0TFw0LIQYRAwsNDSULBQcEBwwJGgMSBBYYLg4mABIBEAciBxQFBgUDBQsNJQUNBwsNCQ0BDQQREA8ULwghAiEDTREjBSUAbwwnAS0H"},{"o":2,"p":-1,"pts":"KNYJqhRD0wEfWSNLHS0PCw8HEQMXAh8KbTYjCh8FGxUXHTlZGyEjG21FHR0XHQ8bFTFF2QERLRUvDRMPDQ8JDwERBBUKGxR1aiUUFwgrAS0LLRNhLQ==","c":"antwerpen","n":"scheldt","r":1},{"o":3,"p":0,"pts":"RMwJ4BMdPQsTGR0JFT3HAQsrCTsBHQItACcBDwELCwklCxURDxsLKReNAhGLAgQvFm8EIwMpBRcLHwEPAA8OWRBHFk0EFwEdBhMKCUQ5KBMqDRALCAsSKwwVWHUOAxwWNBYcBhgBKgceC3Y/CgkIDQYPCD0GLwEdBUcAUwc7Ag8IERINFh0MDQwEDA4LKQ=="},{"o":4,"p":1,"pts":"cJMYuhUMEQMHAAMWJQwVEj8CGwdFAkcDDwUNWYsBSWUJFQkhFacBBRsVQwAzAScGHwANAxUHFQcrBx0JGxUfAyURJwlPD2MAGwITCCMGLww1DFUBGwkpBCkDIwUNDRcNJw8HBQcBCQgfAQUFAx8ACQUHCQsnABECIQMLBQMVAQcJESkVFwENAA0OIQEFEQMBCQJFBDMHIwcPCwEdHg0DBQcFDw9DBREHDQ0NHQcjDwsDCQQPBhMSDQQNAQ8PCQMDCgAQBjYDCgUCBwEHCQslCQ8JABsUCQEJBwUJEysJBQkGFUYnUg=="},{"o":4,"p":1,"pts":"YfsQhRUCOwE3ACkBHwMTDxEDCQNBBRsBEQQRChUcUwALACcGExAfCkEAFRVNCUMDPwkZCxcDHQUbABUKJx43FBESCQoJCB0SLwIVAB8ECw4XDh0SHQAFBRkBMQwvBRkRKwALBB0DFwQjAQkLEQELARUGGQcVBR0LFSMRBwQJDgsCCQcXAxcbDQcJDwcDBxEPEAkDGRsLABEKGQMHCQk3BAkSGQAjDh0GGwwXBBMHPw0NHQcJBw0bF0cFKwQZCicDDQApB5MB"},{"o":4,"p":0,"pts":"Y9Yf9AwLAxcRDwIRBw8CCxEJBQcXAx0JEwUPAwcJEwIfBxEHBxsBDwcdFx0rJxMVFQMJBhkDEQ0CFRURBQMHARcPDAcnDxUnGwEWBwwFAgcJBQQJAB8fGQEJBxMXHQwNHBMMCRIVCAcOGxgbIA8OIxALGikeFTALDhkUEwwZACcJKQEHBAsQCQQTBw8ZDQgJAAkJDxULAzMSEwIdEhsIISYfGA0UDQolCh0FDQYRABUIDwwTAQ0GBQkDFwULExoPBAkDBwkXIQgI"},{"o":4,"p":0,"pts":"dPMemxYLCQsDERAJASUZGSEDBwEJAi0BDQsbFxcDFw8hARMOFQkBDQYFCQklAh8DGwQTChcACwUVABMEBQ4CBg8CEwUXFR8FDQMRCA8TBgkDBwcPGQ0QMwEHCwELBB8FEQUJBwUPAB8WGxANDA8WDQoVBiEeFwgHCAkcDRYBBAQKEBYGCgAOARgBKAImBCQIIBAeBhoQLAIOAS4GKg4mAAwFBAcADREFAQMCBxAFAhcPEwwRBQUEBSAHCg0CCwEXEwkBEQYTEgUMAwoBLgpWCBoBEgcIEQQFHgMOJzwREAMcBQoREA8GCQEKCA=="},{"o":4,"p":0,"pts":"PtYfpg8FAhUXCwMrBB0QDQQJAQsLDRsNKQE9BScAPQc9DzkLFRcbCQMZAQkHHz0HCQ8HKQkNAQcEHy4JChUKCwg7UDcmKxZFBCEIIQ4ZFnV8RyIbAg8ECQgPFg8OCQYXBFMECQMJBR0rKSsJFRc1Hy0TESUVJysdDwsNCxM7Ng=="},{"o":4,"p":0,"pts":"UdoVMQQOGkwmLhYeBAwAJgIQChYaKggWAhgFFA0SHQwFCgEOBhIwPAoUABANMAMcAhoMPgEcBSwAEAgQIBIICggcAB4DDAcILQoNCgUMByQHFjVQHSoHDAMWAg4GDBYgBBwBIAcgHUQJCgkEBwIJAQUHBQsHLwUNDQsPBAsQESgHDAkIGQgHCAUOCzAJFAkIKRIREgcUAxYCGAQSA0IFMhukAQtY"},{"o":4,"p":0,"pts":"Pq8QnwYlOgcIDQIlGTEVEREZIw0FDQwPLAkSDQwNAA0JHRsfDwkHCRMfTQ8ZFQ0VARsQFxgjNAcOCyQJDAcCCQMbHQkABwILDhMoDRINBBUJCQENCAUKETwLDg8KLRARASMJCwAPCA0OFyoNEhUQMxo1PBkULQwzHFkAFUwnZg=="},{"o":4,"p":0,"pts":"LcIa1h8EAwgTCi8CGwEjBBMAFwEVBxsLIQEdGH8AHwITJIUBBlECHwEbAxEPIw0nEysJIxtJCyUNFw8fHR8LDwAHAhUBDRtFD00LIywZIg8iC04PIgkmD249Jg0yCw=="},{"o":4,"p":1,"pts":"IsEVlhQFBREDBwkJAzEICwUFDQMRDB8HDwkPAwsNEQALBA8GBxgFBAcMJRwxDAsuIRIXFi0UNwQZACcADwoPLkEWNQoNAgA="},{"o":4,"p":0,"pts":"FYIcmRQHAQ0KAwoAEgMGEQcHDQsHGwQPEwsBKwgLBh0BEwYVFAkECQElKDEk"}],"mouth":[0.2272,0.1891],"mouthDir":[-1,0]}};
// @@GEO_END

'use client';

/** @label "River Scene" */
/** @comment "China ↔ Deutschland: Städte ploppen auf, Adern wachsen vom Perlfluss-Delta über das Meer den Rhein hinauf bis Köln. Scroll oder Autoplay." */
/** @defaultWidth 1440 */
/** @defaultHeight 810 */
/** @controls {
  "mode": { "type": "select", "label": "Modus", "default": "scroll", "options": [{"label":"Scroll (eigene Höhe)","value":"scroll"},{"label":"Scroll (Eltern-Sektion)","value":"scrollParent"},{"label":"Autoplay","value":"autoplay"}] },
  "scrollLength": { "type": "number", "label": "Scroll-Länge (vh)", "min": 150, "max": 600, "step": 10, "default": 300 },
  "scrollParentDepth": { "type": "number", "label": "Eltern-Ebene (Modus B)", "min": 1, "max": 6, "step": 1, "default": 1 },
  "speed": { "type": "number", "label": "Autoplay-Tempo", "min": 0.5, "max": 2, "step": 0.1, "default": 1 },
  "previewTime": { "type": "number", "label": "Editor-Frame (s)", "min": 0, "max": 7, "step": 0.1, "default": 7 },
  "chinese": { "type": "toggle", "label": "Chinesische Schriftzeichen", "default": true },
  "cameraDrift": { "type": "toggle", "label": "Kamerafahrt", "default": true },
  "flowSpeed": { "type": "number", "label": "Fließgeschwindigkeit", "min": 0, "max": 3, "step": 0.1, "default": 1.4 },
  "fit": { "type": "select", "label": "Einpassung", "default": "auto", "options": [{"label":"Automatisch (Hochformat: Kamerafahrt)","value":"auto"},{"label":"Ganz zeigen","value":"contain"},{"label":"Füllen","value":"cover"}] },
  "background": { "type": "color", "label": "Hintergrund", "default": "#ffffff" },
  "fontFamily": { "type": "text", "label": "Schrift", "default": "\"RPM Aglet Sans\", Arial, sans-serif" }
} */

/*
 * River Scene – RPM (China ↔ Deutschland)
 * Portierung von river-scene.jsx (Motion-Editor-Vorlage) als Revyme Code Component:
 * reine SVG + HTML, keine Abhängigkeiten außer React. Bühne 1920×1080, skaliert auf die Box.
 * Szenen (s): Cities 0–1.8 · China 1.8–3.2 · Route 3.2–5.0 · Rhein 5.0–6.3 · Hold 6.3–7.0, danach Idle (Wasser fließt, Schilder schweben).
 * Im Revyme-Editor (useStaticCanvas) wird statisch der Frame `previewTime` gezeigt.
 */

import { useEffect, useRef, useState } from 'react';
import { withResponsiveProps, useStaticCanvas } from '@revyme/runtime';
const W = 1920, H = 1080;
const C = { blau: "#a4b5cb", ink: "#0f1e33", deep: "#1b3556", mid: "#3d5d85" };
const SCENES = [["Cities", 1.8], ["China", 1.4], ["Route", 1.8], ["Rhein", 1.3], ["Hold", 0.7]];
const CUES = {};
let TOTAL = 0;
for (const [n, d] of SCENES) {
  CUES[n] = TOTAL;
  TOTAL += d;
}
const Easing = {
  easeOutCubic: (t) => {
    const u = t - 1;
    return u * u * u + 1;
  },
  easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeOutBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
};
function tween(from, to, start, end, ease) {
  return (t) => t <= start ? from : t >= end ? to : from + (to - from) * ease((t - start) / (end - start));
}
const MOTION = {
  enter: (a, b, s, e) => tween(a, b, s, e, Easing.easeOutCubic),
  draw: (s, e) => tween(0, 1, s, e, Easing.easeInOutCubic),
  pop: (s, e) => tween(0, 1, s, e, Easing.easeOutBack)
};
const NODES = {
  JC: [470, -430],
  P1: [640, -60],
  P2: [620, -280],
  fos: [380, 140],
  gzh: [510, 230],
  dgg: [720, 120],
  hui: [960, 210],
  sht: [1070, 340],
  jmn: [360, -130],
  zsn: [500, -200],
  zhh: [590, -350],
  szn: [800, -190],
  hkg: [880, -310],
  SEA: [-1150, 420],
  N1: [-900, 120],
  rot: [-1050, 260],
  ant: [-1110, -60],
  dui: [-800, 60],
  dus: [-760, -60],
  kol: [-630, -220]
};
function spreadNodes() {
  const spread = (ids, c, kx, kz) => ids.forEach((id) => {
    const p = NODES[id];
    NODES[id] = [c[0] + (p[0] - c[0]) * kx, c[1] + (p[1] - c[1]) * kz];
  });
  spread(["JC", "P1", "P2", "fos", "gzh", "dgg", "hui", "sht", "jmn", "zsn", "zhh", "szn", "hkg"], [680, -20], 1.2, 1.15);
  spread(["N1", "rot", "ant", "dui", "dus", "kol"], [-860, 20], 1.25, 1.2);
}
spreadNodes();
const CITIES = [
  { id: "rot", en: "Rotterdam", zh: "\u9E7F\u7279\u4E39", h: 230 },
  { id: "ant", en: "Antwerp", zh: "\u5B89\u7279\u536B\u666E", h: 190 },
  { id: "dui", en: "Duisburg", zh: "\u675C\u4F0A\u65AF\u5821", h: 270 },
  { id: "dus", en: "D\xFCsseldorf", zh: "\u675C\u585E\u5C14\u591A\u592B", h: 100 },
  { id: "kol", en: "Cologne", zh: "\u79D1\u9686", h: 140, goal: true },
  { id: "fos", en: "Foshan", zh: "\u4F5B\u5C71", h: 160 },
  { id: "gzh", en: "Guangzhou", zh: "\u5E7F\u5DDE", h: 260 },
  { id: "dgg", en: "Dongguan", zh: "\u4E1C\u839E", h: 270 },
  { id: "hui", en: "Huizhou", zh: "\u60E0\u5DDE", h: 70 },
  { id: "sht", en: "Shantou", zh: "\u6C55\u5934", h: 330 },
  { id: "jmn", en: "Jiangmen", zh: "\u6C5F\u95E8", h: 240 },
  { id: "zsn", en: "Zhongshan", zh: "\u4E2D\u5C71", h: 150 },
  { id: "zhh", en: "Zhuhai", zh: "\u73E0\u6D77", h: 110 },
  { id: "szn", en: "Shenzhen", zh: "\u6DF1\u5733", h: 190 },
  { id: "hkg", en: "Hong Kong", zh: "\u9999\u6E2F", h: 160 }
].map((c, i) => ({ ...c, p: NODES[c.id], order: i }));
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function catmull(ctrl, per) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[i - 1] || ctrl[i], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[i + 2] || p2;
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}
function resample(pts, step) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = step - carry;
    while (d <= L) {
      const t = d / L;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      d += step;
    }
    carry = L - (d - step);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function noise(x, seed) {
  const i = Math.floor(x), t = x - i, h = (k) => hash(i + k + seed * 101) * 2 - 1;
  const p0 = h(-1), p1 = h(0), p2 = h(1), p3 = h(2);
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}
function fbm(x, seed) {
  return noise(x, seed) * 0.7 + noise(x * 2.1, seed + 7) * 0.3;
}
function vein(ctrl, seed, amp = 6, bow = 0.12) {
  if (ctrl.length === 2) {
    const [a, b] = ctrl, dx = b[0] - a[0], dz = b[1] - a[1], L2 = Math.hypot(dx, dz), nx = -dz / L2, nz = dx / L2;
    const k = 1 + Math.floor(hash(seed * 3) * 3), mids = [];
    for (let j = 1; j <= k; j++) {
      const t = j / (k + 1) + (hash(seed * 11 + j) - 0.5) * 0.18;
      const o = (hash(seed * 17 + j) - 0.5) * 2 * L2 * bow * (0.6 + hash(seed * 23 + j));
      mids.push([a[0] + dx * t + nx * o, a[1] + dz * t + nz * o]);
    }
    ctrl = [a, ...mids, b];
  }
  const base = resample(catmull(ctrl, 12), 3);
  let acc = 0;
  const lens = [0];
  for (let i = 1; i < base.length; i++) {
    acc += Math.hypot(base[i][0] - base[i - 1][0], base[i][1] - base[i - 1][1]);
    lens.push(acc);
  }
  const L = acc;
  return base.map((p, i) => {
    const q = base[Math.min(i + 1, base.length - 1)], r = base[Math.max(i - 1, 0)];
    const tx = q[0] - r[0], tz = q[1] - r[1], tl = Math.hypot(tx, tz) || 1, s = lens[i];
    const env = Math.min(1, s / 20, (L - s) / 20);
    const localAmp = amp * (0.35 + 1.3 * Math.abs(noise(s / 60, seed + 3)));
    const o = localAmp * env * fbm(s / 32, seed);
    return [p[0] - tz / tl * o, p[1] + tx / tl * o];
  });
}
const RIVERS = [
  ["sht", "hui", "China", 0, 1.1, 1.8],
  ["hui", "dgg", "China", 1, 1.8, 2.4],
  ["dgg", "P1", "China", 2, 2.4, 2.8],
  ["fos", "gzh", "China", 0, 1.2, 2.2],
  ["gzh", "P1", "China", 1, 2.2, 3.2],
  ["P1", "P2", "China", 3, 3.4, 4.2],
  ["szn", "P2", "China", 2, 1.2, 2.2],
  ["hkg", "P2", "China", 2, 1.2, 2.4],
  ["jmn", "zsn", "China", 1, 1.2, 2],
  ["zsn", "zhh", "China", 2, 2, 2.6],
  ["zhh", "JC", "China", 3, 2.6, 3.2],
  ["P2", "JC", "China", 4, 4.2, 5],
  ["SEA", "rot", "Rhein", 0, 5, 4.2],
  ["SEA", "ant", "Rhein", 0, 3.6, 3],
  ["rot", "N1", "Rhein", 1, 4.2, 3.8],
  ["ant", "N1", "Rhein", 1, 3, 2.6],
  ["N1", "dui", "Rhein", 2, 4.2, 3.6],
  ["dui", "dus", "Rhein", 3, 3.6, 3],
  ["dus", "kol", "Rhein", 4, 3, 2]
];
const LEVELS = { China: 5, Rhein: 5 };
const MAIN_CTRL = [NODES.JC, [330, -440], [190, -350], [150, -250], [20, -170], [-20, -60], [-150, 10], [-210, 130], [-340, 170], [-420, 300], [-560, 350], [-640, 440], [-820, 410], [-960, 470], NODES.SEA];
function withCaps(e, seed, n) {
  const caps = [], count = n + Math.floor(hash(seed * 41) * (n + 2));
  for (let k = 0; k < count; k++) {
    const u = 0.1 + 0.8 * hash(seed * 13 + k), i = Math.floor(u * (e.pts.length - 1));
    const p = e.pts[i], q = e.pts[Math.min(i + 3, e.pts.length - 1)];
    const side = hash(seed * 7 + k) > 0.5 ? 1 : -1;
    const ang = Math.atan2(q[1] - p[1], q[0] - p[0]) + side * (0.45 + 0.9 * hash(seed + k * 3));
    const len = 16 + 95 * Math.pow(hash(seed * 5 + k), 1.3);
    const bpt = [p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len];
    const pts = vein([p, bpt], seed * 31 + k, 2 + len * 0.05, 0.3);
    const w0 = e.w0 * (0.35 + 0.3 * hash(seed * 19 + k));
    caps.push({ pts, u, w0, w1: 0.12 });
    if (len > 35 && hash(seed * 43 + k) > 0.25) {
      const j = Math.floor(pts.length * (0.4 + 0.3 * hash(seed + k * 9))), p2 = pts[j];
      const a2 = ang - side * (0.6 + 0.6 * hash(seed * 47 + k)), l2 = len * (0.3 + 0.3 * hash(seed * 53 + k));
      caps.push({ pts: vein([p2, [p2[0] + Math.cos(a2) * l2, p2[1] + Math.sin(a2) * l2]], seed * 59 + k, 1.5, 0.3), u: u + 0.08, w0: w0 * 0.55, w1: 0.1 });
    }
  }
  return { ...e, caps };
}
const EDGES = RIVERS.map(([a, b, ph, lv, w0, w1], i) => withCaps({ pts: vein([NODES[a], NODES[b]], i + 1, 7 + 7 * hash(i * 3), 0.1 + 0.16 * hash(i * 7)), ph, lv, w0, w1 }, i + 1, 4));
const MAIN = withCaps({ pts: vein(MAIN_CTRL, 77, 13), w0: 5.5, w1: 7 }, 99, 16);
function makeCam(T, drift) {
  const k = drift ? MOTION.draw(0, TOTAL)(T) : 1;
  return { f: 1480 + 90 * k, yaw: -0.06 * (1 - k), tilt: 0.78, D: 2200, cx: 960, cy: 620 + 20 * (1 - k) };
}
function project(X, Y, Z, cam) {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const x = X * cy - Z * sy, z = X * sy + Z * cy;
  const ct = Math.cos(cam.tilt), st = Math.sin(cam.tilt);
  const v = Y * ct + z * st, w = cam.D + z * ct - Y * st, s = cam.f / w;
  return { x: cam.cx + x * s, y: cam.cy - v * s, s, w };
}
function pathD(pts, cam) {
  return pts.map((p, i) => {
    const q = project(p[0], 0, p[1], cam);
    return (i ? "L" : "M") + q.x.toFixed(1) + " " + q.y.toFixed(1);
  }).join("");
}
function Ground({ T, cam }) {
  const op = MOTION.enter(0, 1, 0, 0.8)(T);
  const lines = [];
  for (let x = -1300; x <= 1300; x += 100) {
    const a = project(x, 0, -420, cam), b = project(x, 0, 420, cam);
    lines.push(<line key={"x" + x} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.blau} strokeWidth="0.6" opacity={Math.max(0, 1 - Math.abs(x) / 1300) * 0.55} />);
  }
  for (let z = -400; z <= 400; z += 100) {
    const a = project(-1300, 0, z, cam), b = project(1300, 0, z, cam);
    lines.push(<line key={"z" + z} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.blau} strokeWidth="0.6" opacity={Math.max(0, 1 - Math.abs(z) / 450) * 0.55} />);
  }
  return <g opacity={op}>{lines}</g>;
}
function ribbon(pts, w0, w1, prog, cam, K = 1.75) {
  if (prog <= 0) return null;
  const n = pts.length, cut = prog * (n - 1), m = Math.floor(cut), f = cut - m;
  const use = pts.slice(0, m + 1);
  if (m < n - 1 && f > 0) {
    const a = pts[m], b = pts[m + 1];
    use.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  if (use.length < 2) return null;
  const P = use.map((p) => project(p[0], 0, p[1], cam));
  const L = [], R = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(i - 1, 0)], b = P[Math.min(i + 1, P.length - 1)];
    const tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1;
    const u = i / (P.length - 1) * prog, wob = 1 + 0.22 * noise(i / 14, w0 * 17 + w1 * 5), hw = (w0 + (w1 - w0) * u) * wob * P[i].s * K * 0.5;
    L.push([P[i].x - ty / tl * hw, P[i].y + tx / tl * hw]);
    R.push([P[i].x + ty / tl * hw, P[i].y - tx / tl * hw]);
  }
  const all = L.concat(R.reverse());
  return "M" + all.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L") + "Z";
}
function Vein({ e, prog, cam, flow, flowOn, dash }) {
  const body = ribbon(e.pts, e.w0, e.w1, prog, cam);
  if (!body) return null;
  const halo = ribbon(e.pts, e.w0 * 1.6, e.w1 * 1.6, prog, cam);
  const gloss = ribbon(e.pts, e.w0 * 0.22, e.w1 * 0.22, prog, cam);
  return <g>
      <path d={halo} fill={C.deep} opacity="0.1" transform="translate(0 5)" />
      {e.caps && e.caps.map((c, k) => {
    const cp = Math.max(0, Math.min(1, (prog - c.u) / 0.18));
    const d = ribbon(c.pts, c.w0, c.w1, cp, cam);
    return d && <path key={k} d={d} fill={k % 3 ? C.mid : C.deep} />;
  })}
      <path d={body} fill={C.deep} />
      {gloss && <path d={gloss} fill="#a9c0db" opacity="0.7" transform="translate(0 -0.8)" />}
      {flowOn > 0 && prog >= 1 && <path
    d={pathD(e.pts, cam)}
    pathLength={1e3}
    fill="none"
    stroke="#ffffff"
    strokeWidth={Math.max(1, (e.w0 + e.w1) * 0.28)}
    strokeLinecap="round"
    strokeDasharray={dash}
    strokeDashoffset={-flow}
    opacity={0.75 * flowOn}
  />}
    </g>;
}
function Veins({ T, cam, flow }) {
  const flowOn = MOTION.enter(0, 1, CUES.Rhein + 0.8, CUES.Hold)(T);
  const edges = EDGES.map((e, i) => {
    const span = CUES[e.ph === "China" ? "Route" : "Hold"] - CUES[e.ph], step = span / (LEVELS[e.ph] + 0.6);
    const s = CUES[e.ph] + e.lv * step;
    return <Vein key={i} e={e} prog={MOTION.draw(s, s + step * 1.1)(T)} cam={cam} flow={flow * 30} flowOn={flowOn} dash="3 24" />;
  });
  const mainProg = MOTION.draw(CUES.Route, CUES.Rhein)(T);
  return <g>{edges}<Vein e={MAIN} prog={mainProg} cam={cam} flow={flow * 40} flowOn={flowOn} dash="5 40" /></g>;
}
function Goal({ T, cam, amb }) {
  const g = project(NODES.kol[0], 0, NODES.kol[1], cam);
  const on = MOTION.enter(0, 1, CUES.Hold - 0.15, CUES.Hold + 0.4)(T);
  if (on <= 0) return null;
  const rings = [0, 0.5].map((o) => ((T - CUES.Hold + amb) * 0.45 + o) % 1);
  return <g opacity={on}>{rings.map((r, k) => r >= 0 && <ellipse
    key={k}
    cx={g.x}
    cy={g.y}
    rx={(14 + r * 110) * g.s}
    ry={(14 + r * 110) * g.s * 0.7}
    fill="none"
    stroke={C.deep}
    strokeWidth={1.4}
    opacity={1 - r}
  />)}</g>;
}
function cityTiming(c) {
  return CUES.Cities + 0.1 + c.order % 5 * 0.12 + (c.order >= 5 ? Math.floor((c.order - 5) / 5) * 0.55 : 0.55 * hash(c.order));
}
function layoutLabels(cam, chinese) {
  const PAD = 10;
  const L = CITIES.map((c) => {
    const q = project(c.p[0], c.h, c.p[1], cam), k = q.s * 1.55, fs = c.goal ? 40 : 31;
    const w = Math.max(c.en.length * fs * 0.6, chinese ? c.zh.length * 17 * 1.4 : 0) * k + PAD;
    const h = (fs + (chinese ? 23 : 0) + 12) * k + PAD;
    return { id: c.id, x: q.x, y: q.y, w, h, lift: 0 };
  });
  for (let it = 0; it < 40; it++) {
    let moved = false;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if (Math.abs(a.x - b.x) * 2 >= a.w + b.w) continue;
      const ay = a.y - a.lift, by = b.y - b.lift;
      const [up, lo] = ay < by || ay === by && i < j ? [a, b] : [b, a];
      const ov = up.y - up.lift - (lo.y - lo.lift - lo.h);
      if (ov > 0) {
        up.lift += ov + 1;
        moved = true;
      }
    }
    if (!moved) break;
  }
  const M = 48;
  return Object.fromEntries(L.map((l) => {
    const half = (l.w - PAD) / 2, nx = Math.min(Math.max(l.x, M + half), W - M - half);
    return [l.id, { lift: l.lift, dx: nx - l.x }];
  }));
}
function Pins({ T, cam, bobT, lifts }) {
  return <g>{CITIES.map((c, i) => {
    const s0 = cityTiming(c);
    const g = project(c.p[0], 0, c.p[1], cam);
    const bob = Math.sin(bobT * 1.3 + i * 1.7) * 5;
    const top0 = project(c.p[0], c.h + bob, c.p[1], cam), top = { x: top0.x + lifts[c.id].dx, y: top0.y - lifts[c.id].lift };
    const needle = MOTION.draw(s0 + 0.2, s0 + 0.55)(T);
    const head = MOTION.pop(s0 + 0.5, s0 + 0.75)(T);
    const shadow = MOTION.enter(0, 1, s0, s0 + 0.5)(T);
    const y2 = top.y + (g.y - top.y) * needle;
    return <g key={c.id}>
        <ellipse cx={g.x + 6 * g.s} cy={g.y + 4 * g.s} rx={22 * g.s} ry={4 * g.s} fill={C.ink} opacity={0.14 * shadow} />
        <line x1={top.x} y1={top.y} x2={g.x} y2={y2} stroke={C.ink} strokeWidth={1.1} opacity={needle > 0 ? 0.9 : 0} />
        <ellipse cx={g.x} cy={g.y} rx={Math.max(0, 9 * g.s * head)} ry={Math.max(0, 4.6 * g.s * head)} fill="#ffffff" stroke={C.ink} strokeWidth={1.2} />
        <ellipse cx={g.x} cy={g.y} rx={Math.max(0, 3.4 * g.s * head)} ry={Math.max(0, 1.8 * g.s * head)} fill={C.ink} />
      </g>;
  })}</g>;
}
function Signs({ T, cam, bobT, chinese, lifts, font }) {
  const items = CITIES.map((c, i) => {
    const bob = Math.sin(bobT * 1.3 + i * 1.7) * 5;
    const q0 = project(c.p[0], c.h + bob, c.p[1], cam);
    return { c, q: { ...q0, x: q0.x + lifts[c.id].dx, y: q0.y - lifts[c.id].lift } };
  }).sort((a, b) => b.q.w - a.q.w);
  return <>{items.map(({ c, q }) => {
    const s0 = cityTiming(c);
    const sc = MOTION.pop(s0, s0 + 0.5)(T);
    if (sc <= 0) return null;
    const k = q.s * sc * 1.55;
    return <div key={c.id} style={{
      position: "absolute",
      left: q.x,
      top: q.y,
      transform: `translate(-50%,-100%) scale(${k})`,
      transformOrigin: "50% 100%",
      opacity: Math.min(1, sc * 2),
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      whiteSpace: "nowrap",
      pointerEvents: "none",
      filter: "drop-shadow(0 22px 10px rgba(15,30,51,0.16)) drop-shadow(0 2px 1px rgba(15,30,51,0.12))"
    }}>
        <div style={{
      fontFamily: font,
      fontWeight: 700,
      fontSize: c.goal ? 40 : 31,
      color: C.ink,
      lineHeight: 1,
      letterSpacing: "-0.005em",
      WebkitTextStroke: "5px #ffffff",
      paintOrder: "stroke fill"
    }}>{c.en}</div>
        {chinese && <div style={{
      fontFamily: '"PingFang SC","Noto Sans SC","Microsoft YaHei","Hiragino Sans GB",sans-serif',
      fontWeight: 600,
      fontSize: c.goal ? 21 : 17,
      color: C.deep,
      lineHeight: 1,
      letterSpacing: "0.35em",
      marginRight: "-0.35em",
      WebkitTextStroke: "4px #ffffff",
      paintOrder: "stroke fill"
    }}>{c.zh}</div>}
        <div style={{ width: c.goal ? 64 : 34, height: 2, background: C.ink, marginTop: 2 }} />
      </div>;
  })}</>;
}
const FOCUS = { china: [1370, 420], rhein: [420, 440], all: [960, 520] };
function fitView(w, h, fit, T) {
  if (!w || !h) return null;
  const kFull = Math.min(w / W, h / H);
  let k = fit === "cover" ? Math.max(w / W, h / H) : kFull, fx = W / 2, fy = H / 2;
  if (fit === "auto" && w / h < 1.1) {
    const kClose = Math.min(w / 1e3, h * 0.8 / 700);
    const pan = MOTION.draw(CUES.Route, CUES.Rhein)(T), out = MOTION.draw(CUES.Rhein + 0.8, TOTAL)(T);
    const cx = FOCUS.china[0] + (FOCUS.rhein[0] - FOCUS.china[0]) * pan, cy = FOCUS.china[1] + (FOCUS.rhein[1] - FOCUS.china[1]) * pan;
    k = kClose + (kFull - kClose) * out;
    fx = cx + (FOCUS.all[0] - cx) * out;
    fy = cy + (FOCUS.all[1] - cy) * out;
  }
  return { k, x: w / 2 - fx * k, y: h / 2 - fy * k };
}
const DEFAULTS = {
  mode: "scroll",
  scrollLength: 300,
  scrollParentDepth: 1,
  speed: 1,
  previewTime: 7,
  chinese: true,
  cameraDrift: true,
  flowSpeed: 1.4,
  fit: "auto",
  background: "#ffffff",
  fontFamily: '"RPM Aglet Sans", Arial, sans-serif'
};
const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
function RiverScene(input) {
  const P = { ...DEFAULTS };
  Object.keys(DEFAULTS).forEach((k) => {
    const v = input[k];
    if (v !== void 0 && v !== null && v !== "") P[k] = v;
  });
  if (!["scroll", "scrollParent", "autoplay"].includes(P.mode)) P.mode = "scroll";
  const isStatic = useStaticCanvas();
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const propsRef = useRef(P);
  propsRef.current = P;
  const [T, setT] = useState(isStatic ? Math.min(TOTAL, P.previewTime) : 0);
  const [amb, setAmb] = useState(0);
  const [box, setBox] = useState([0, 0]);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (isStatic || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const upd = () => setReduced(mq.matches);
    upd();
    mq.addEventListener?.("change", upd);
    return () => mq.removeEventListener?.("change", upd);
  }, [isStatic]);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const upd = () => setBox([el.clientWidth, el.clientHeight]);
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (isStatic) {
      setT(Math.min(TOTAL, Math.max(0, P.previewTime)));
      setAmb(0);
    }
  }, [isStatic, P.previewTime]);
  useEffect(() => {
    if (isStatic) return;
    const root = rootRef.current;
    if (!root) return;
    if (reduced) {
      setT(TOTAL);
      setAmb(0);
      return;
    }
    let raf = 0, visible = false, cur = 0, last = -1, start = -1, endAt = -1;
    const target = (now) => {
      const p = propsRef.current;
      if (p.mode === "autoplay") return start < 0 ? 0 : Math.min(TOTAL, (now - start) / 1e3 * p.speed);
      let el = root;
      if (p.mode === "scrollParent") for (let i = 0; i < Math.max(1, p.scrollParentDepth) && el.parentElement; i++) el = el.parentElement;
      const r = el.getBoundingClientRect(), vh = window.innerHeight || 1, span = r.height - vh;
      return TOTAL * (span > 1 ? clamp01(-r.top / span) : clamp01((vh - r.top) / (vh + r.height)));
    };
    const tick = (now) => {
      raf = 0;
      const dt = last < 0 ? 16.7 : Math.min(100, now - last);
      last = now;
      const tgt = target(now);
      cur = propsRef.current.mode === "autoplay" ? tgt : cur + (tgt - cur) * (1 - Math.pow(0.88, dt / 16.7));
      if (Math.abs(tgt - cur) < 1e-3) cur = tgt;
      const done = cur >= TOTAL - 1e-3;
      if (done && endAt < 0) endAt = now;
      if (!done) endAt = -1;
      setT(cur);
      setAmb(done ? (now - endAt) / 1e3 : 0);
      if (visible && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf && visible) {
        last = -1;
        raf = requestAnimationFrame(tick);
      }
    };
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        visible = e.isIntersecting;
        if (e.intersectionRatio >= 0.4 && start < 0 && propsRef.current.mode === "autoplay") start = performance.now();
      }
      if (visible) wake();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }, { threshold: [0, 0.4] });
    io.observe(root);
    const onVis = () => wake();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isStatic, reduced, P.mode]);
  const bobT = T + amb;
  const flow = (T + amb) * P.flowSpeed;
  const cam = makeCam(T, P.cameraDrift);
  const lifts = layoutLabels(cam, P.chinese);
  const scrollOwn = P.mode === "scroll" && !isStatic && !reduced;
  const view = fitView(box[0], box[1], P.fit, T);
  const base = input.style || {};
  return <div
    ref={rootRef}
    data-id={input["data-id"]}
    data-name={input["data-name"]}
    role="img"
    aria-label="Karte: Warenweg von den Städten im Perlfluss-Delta über das Meer und den Rhein hinauf bis Köln."
    style={{ ...base, position: "relative", background: P.background, height: scrollOwn ? `${P.scrollLength}vh` : base.height ?? "100vh" }}
  >
      <div ref={stageRef} style={scrollOwn ? { position: "sticky", top: 0, height: "100vh", width: "100%", overflow: "hidden" } : { position: "absolute", inset: 0, overflow: "hidden" }}>
        {view && <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `translate(${view.x}px,${view.y}px) scale(${view.k})`, transformOrigin: "0 0" }}>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden="true">
              <Ground T={T} cam={cam} />
              <Veins T={T} cam={cam} flow={flow} />
              <Goal T={T} cam={cam} amb={amb} />
              <Pins T={T} cam={cam} bobT={bobT} lifts={lifts} />
            </svg>
            <Signs T={T} cam={cam} bobT={bobT} chinese={P.chinese} lifts={lifts} font={P.fontFamily} />
          </div>}
      </div>
    </div>;
}
export default withResponsiveProps(RiverScene);

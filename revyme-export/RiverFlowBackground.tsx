'use client';

/** @label "River Flow Background" */
/** @comment "Animierter, unscharfer Fluss-Hintergrund: zwei Delta-Fächer, verbunden durch einen mäandrierenden Strom mit fließenden Lichtimpulsen." */
/** @defaultWidth 1440 */
/** @defaultHeight 810 */
/** @controls {
  "theme": { "type": "select", "label": "Thema", "default": "light", "options": [{"label":"Hell (Ivory)","value":"light"},{"label":"Dunkel (Deep Rhine)","value":"deep"}] },
  "background": { "type": "color", "label": "Hintergrund", "default": "transparent" },
  "lineColor": { "type": "color", "label": "Flussfarbe (leer = Thema)", "default": "" },
  "coreColor": { "type": "color", "label": "Lichtkern (leer = Thema)", "default": "" },
  "blur": { "type": "number", "label": "Unschärfe (px)", "min": 0, "max": 12, "step": 0.5, "default": 2.5 },
  "glow": { "type": "number", "label": "Leuchten", "min": 0, "max": 1, "step": 0.05, "default": 0.55 },
  "intensity": { "type": "number", "label": "Deckkraft", "min": 0.1, "max": 1, "step": 0.05, "default": 0.7 },
  "density": { "type": "number", "label": "Verzweigung", "min": 0.3, "max": 1.5, "step": 0.1, "default": 1 },
  "speed": { "type": "number", "label": "Strömung", "min": 0, "max": 3, "step": 0.1, "default": 1 },
  "sway": { "type": "number", "label": "Bewegung der Adern", "min": 0, "max": 2, "step": 0.1, "default": 1 },
  "fadeEdges": { "type": "toggle", "label": "Ränder ausblenden", "default": true },
  "centerClear": { "type": "number", "label": "Mitte freistellen", "min": 0, "max": 0.8, "step": 0.05, "default": 0.15 },
  "grain": { "type": "toggle", "label": "Filmkorn", "default": true },
  "parallax": { "type": "toggle", "label": "Maus-Parallaxe", "default": true },
  "seed": { "type": "number", "label": "Variante", "min": 1, "max": 99, "step": 1, "default": 7 }
} */

/*
 * River Flow Background – animierter Hintergrund nach Referenzvideo „Fluss-Strömung horizontal“.
 * Links und rechts je ein Delta-Fächer aus verzweigten Adern, in der Bildmitte ein mäandrierender
 * Hauptstrom mit hellem Kern. Lichtimpulse fließen aus den Adern zum Strom und entlang des Stroms.
 * Canvas 2D (keine Abhängigkeiten), einmal gezeichnet und als zweite, stark unscharfe Ebene gespiegelt
 * (Glow). Füllt seine Box: im Builder absolut hinter den Inhalt einer Sektion legen.
 * Editor (useStaticCanvas): ein statischer Frame. prefers-reduced-motion: statisch.
 */

import { useEffect, useRef } from 'react';
import { withResponsiveProps, useStaticCanvas } from '@revyme/runtime';

const VW = 1920, VH = 1080;
const THEMES = {
  light: { line: '#5f7a9d', core: '#dfe7f1', glow: '#8db4da', grainAlpha: 0.05 },
  deep: { line: '#8db4da', core: '#f7f4ee', glow: '#24557a', grainAlpha: 0.07 },
};

// ---------- deterministisches Rauschen ----------
function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 16807) % 2147483647; return (s % 100000) / 100000; };
}
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, seed) {
  const i = Math.floor(x), t = x - i, h = (k) => hash(i + k + seed * 101) * 2 - 1;
  const p0 = h(-1), p1 = h(0), p2 = h(1), p3 = h(2);
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}
function fbm(x, seed) { return noise(x, seed) * 0.65 + noise(x * 2.3, seed + 7) * 0.25 + noise(x * 6.1, seed + 13) * 0.1; }

// Aderlinie von a nach b: Bogen + rauschmodulierte Mäander, gleichmäßig abgetastet
function veinLine(a, b, seed, amp, step = 9) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const bow = (hash(seed * 3.1) - 0.5) * 0.25 * L;
  const n = Math.max(4, Math.ceil(L / step)), pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, env = Math.sin(Math.PI * t);
    const off = bow * env + amp * Math.min(1, t * 6) * fbm(t * L / 140, seed);
    pts.push([a[0] + dx * t + nx * off, a[1] + dy * t + ny * off]);
  }
  return pts;
}

// ---------- Geometrie ----------
function buildRiver(seed, density) {
  const r = rng(seed);
  const paths = [];
  const Lroot = [420 + (r() - 0.5) * 40, 560 + (r() - 0.5) * 30];
  const Rroot = [1480 + (r() - 0.5) * 40, 580 + (r() - 0.5) * 30];
  // Hauptstrom (links → rechts), feine Knicke wie im Referenzvideo
  const main = [];
  const mn = 180;
  for (let i = 0; i <= mn; i++) {
    const t = i / mn, env = Math.sin(Math.PI * t);
    const x = Lroot[0] + (Rroot[0] - Lroot[0]) * t;
    const y = Lroot[1] + (Rroot[1] - Lroot[1]) * t - env * 70 * (0.6 + fbm(t * 2.2, seed + 40)) + 16 * noise(t * 38, seed + 41) * env;
    main.push([x, y]);
  }
  paths.push({ pts: main, w0: 5.2, w1: 5.2, alpha: 1, main: true, dir: -1, phase: 0 });
  // Delta-Fächer: Wurzel → Rand; Kinder zweigen ab und laufen weiter nach außen
  const fan = (root, side) => {
    const nPrim = Math.round(8 * density);
    for (let k = 0; k < nPrim; k++) {
      const spread = (k / Math.max(1, nPrim - 1) - 0.5) * 2; // −1…1
      const ang = (side < 0 ? Math.PI : 0) + spread * 1.25 + (r() - 0.5) * 0.25;
      const len = 620 + r() * 520;
      const end = [root[0] + Math.cos(ang) * len, root[1] + Math.sin(ang) * len * 0.9];
      const prim = veinLine(root, end, seed * 13 + k + side * 50, 26 + r() * 22);
      const wRoot = 2.6 + r() * 2.4 * (1 - Math.abs(spread) * 0.5);
      paths.push({ pts: prim, w0: wRoot, w1: 1.1, alpha: 0.9, dir: 1, phase: r() });
      const nSec = Math.round((3 + r() * 4) * density);
      for (let j = 0; j < nSec; j++) {
        const u = 0.18 + 0.7 * r(), i = Math.floor(u * (prim.length - 1));
        const p = prim[i], q = prim[Math.min(i + 2, prim.length - 1)];
        const base = Math.atan2(q[1] - p[1], q[0] - p[0]);
        const a2 = base + (r() > 0.5 ? 1 : -1) * (0.25 + r() * 0.7);
        const l2 = 140 + r() * 360 * (1 - u * 0.4);
        const e2 = [p[0] + Math.cos(a2) * l2, p[1] + Math.sin(a2) * l2];
        const sec = veinLine(p, e2, seed * 97 + k * 11 + j + side * 7, 10 + r() * 14, 8);
        paths.push({ pts: sec, w0: wRoot * (0.35 + 0.2 * r()), w1: 0.5, alpha: 0.55, dir: 1, phase: r() });
        if (r() < 0.55) {
          const i3 = Math.floor(sec.length * (0.35 + 0.4 * r())), p3 = sec[i3], q3 = sec[Math.min(i3 + 2, sec.length - 1)];
          const a3 = Math.atan2(q3[1] - p3[1], q3[0] - p3[0]) + (r() > 0.5 ? 1 : -1) * (0.3 + r() * 0.6);
          const l3 = 60 + r() * 180;
          paths.push({ pts: veinLine(p3, [p3[0] + Math.cos(a3) * l3, p3[1] + Math.sin(a3) * l3], seed * 7 + k * 31 + j, 6, 7), w0: 0.7, w1: 0.3, alpha: 0.35, dir: 1, phase: r() });
        }
      }
    }
  };
  fan(Lroot, -1);
  fan(Rroot, 1);
  // Abstand je Punkt (für Strömungsimpulse) + Sway-Faktor (Wurzel ruhig, Enden beweglich)
  for (const p of paths) {
    const s = [0];
    for (let i = 1; i < p.pts.length; i++) s.push(s[i - 1] + Math.hypot(p.pts[i][0] - p.pts[i - 1][0], p.pts[i][1] - p.pts[i - 1][1]));
    p.s = s; p.len = s[s.length - 1];
    p.nrm = p.pts.map((_, i) => {
      const a = p.pts[Math.max(0, i - 1)], b = p.pts[Math.min(p.pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [-dy / l, dx / l];
    });
    p.seed = hash(p.pts.length * 1.7 + p.len);
  }
  return paths;
}

// ---------- Zeichnen ----------
function hexA(hex, a) {
  const h = hex.replace('#', ''), f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(f.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function tracePath(ctx, p, t, sway, from, to) {
  const k = sway * 7;
  for (let i = from; i <= to; i++) {
    const w = p.main ? 0.35 : Math.min(1, p.s[i] / 260);
    const o = k * w * Math.sin(t * 0.5 + p.s[i] / 180 + p.seed * 6.28);
    const x = p.pts[i][0] + p.nrm[i][0] * o, y = p.pts[i][1] + p.nrm[i][1] * o;
    if (i === from) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
}
function drawFrame(ctx, paths, t, o) {
  const { line, core } = o;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Adern (verjüngt: 4 Abschnitte)
  for (const p of paths) {
    const n = p.pts.length - 1, seg = 4;
    for (let c = 0; c < seg; c++) {
      const a = Math.floor((c * n) / seg), b = Math.floor(((c + 1) * n) / seg);
      ctx.beginPath(); tracePath(ctx, p, t, o.sway, a, b);
      ctx.strokeStyle = hexA(line, p.alpha);
      ctx.lineWidth = p.w0 + (p.w1 - p.w0) * ((c + 0.5) / seg);
      ctx.stroke();
    }
  }
  // Hauptstrom: heller Kern
  const main = paths[0];
  ctx.beginPath(); tracePath(ctx, main, t, o.sway, 0, main.pts.length - 1);
  ctx.strokeStyle = hexA(core, 0.75); ctx.lineWidth = 1.8; ctx.stroke();
  // Strömungsimpulse: Adern → Wurzel, Hauptstrom → rechts
  if (o.speed > 0) {
    ctx.save();
    for (const p of paths) {
      if (p.alpha < 0.5 && !p.main) continue;
      const gap = p.main ? 260 : 340, dash = p.main ? 70 : 46;
      ctx.setLineDash([dash, gap]);
      ctx.lineDashOffset = (p.main ? -1 : 1) * (t * o.speed * (p.main ? 90 : 60) + p.phase * gap);
      ctx.beginPath(); tracePath(ctx, p, t, o.sway, 0, p.pts.length - 1);
      ctx.strokeStyle = hexA(core, p.main ? 0.9 : 0.55);
      ctx.lineWidth = p.main ? 2.4 : Math.max(0.8, p.w0 * 0.45);
      ctx.stroke();
    }
    ctx.restore();
  }
}

const DEFAULTS = {
  theme: 'light', background: 'transparent', lineColor: '', coreColor: '', blur: 2.5, glow: 0.55, intensity: 0.7,
  density: 1, speed: 1, sway: 1, fadeEdges: true, centerClear: 0.15, grain: true, parallax: true, seed: 7,
};
const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

function RiverFlowBackground(input) {
  const P = { ...DEFAULTS };
  Object.keys(DEFAULTS).forEach((k) => { const v = input[k]; if (v !== undefined && v !== null && v !== '') P[k] = v; });
  const theme = THEMES[P.theme] || THEMES.light;
  const lineC = P.lineColor || theme.line, coreC = P.coreColor || theme.core;
  const isStatic = useStaticCanvas();
  const redrawRef = useRef(null);
  const rootRef = useRef(null), mainRef = useRef(null), glowRef = useRef(null), layerRef = useRef(null);
  const propsRef = useRef(P);
  propsRef.current = { ...P, line: lineC, core: coreC };

  useEffect(() => {
    const root = rootRef.current, cv = mainRef.current, gv = glowRef.current;
    if (!root || !cv || !gv) return;
    const ctx = cv.getContext('2d'), gtx = gv.getContext('2d');
    if (!ctx || !gtx) return;
    const reduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let paths = buildRiver(propsRef.current.seed, propsRef.current.density);
    let key = propsRef.current.seed + ':' + propsRef.current.density;
    let raf = 0, visible = true, t0 = performance.now(), W = 0, H = 0;
    const size = () => {
      const w = root.clientWidth || 1, h = root.clientHeight || 1;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      if (w === W && h === H) return;
      W = w; H = h;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      gv.width = Math.round(w * 0.35); gv.height = Math.round(h * 0.35); // Glow in niedriger Auflösung (wird ohnehin unscharf)
    };
    const render = (now) => {
      const o = propsRef.current;
      const k2 = o.seed + ':' + o.density;
      if (k2 !== key) { paths = buildRiver(o.seed, o.density); key = k2; }
      size();
      const t = isStatic || reduced ? 2 : (now - t0) / 1000;
      // Bühne 1920×1080 „cover“ in die Box; im Hochformat um 90° gedreht (Strom läuft vertikal)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (cv.height > cv.width * 1.1) {
        const s = Math.max(cv.height / VW, cv.width / VH);
        ctx.setTransform(0, s, -s, 0, cv.width / 2 + (VH * s) / 2, cv.height / 2 - (VW * s) / 2);
      } else {
        const s = Math.max(cv.width / VW, cv.height / VH);
        ctx.setTransform(s, 0, 0, s, (cv.width - VW * s) / 2, (cv.height - VH * s) / 2);
      }
      drawFrame(ctx, paths, t, { line: o.line, core: o.core, sway: isStatic || reduced ? 0 : o.sway, speed: isStatic || reduced ? 0 : o.speed });
      gtx.setTransform(1, 0, 0, 1, 0, 0);
      gtx.clearRect(0, 0, gv.width, gv.height);
      gtx.drawImage(cv, 0, 0, gv.width, gv.height);
    };
    const loop = (now) => { raf = 0; render(now); if (visible && !document.hidden) raf = requestAnimationFrame(loop); };
    const start = () => { if (!raf && !isStatic && !reduced) raf = requestAnimationFrame(loop); };
    render(performance.now());
    redrawRef.current = () => render(performance.now());
    const ro = new ResizeObserver(() => { W = 0; render(performance.now()); });
    ro.observe(root);
    if (isStatic || reduced) return () => ro.disconnect();
    const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); if (visible) start(); }, { rootMargin: '100px' });
    io.observe(root);
    const onVis = () => start();
    document.addEventListener('visibilitychange', onVis);
    // sanfte Maus-Parallaxe über CSS-Transform der Ebenen
    let px = 0, py = 0, tx = 0, ty = 0, praf = 0;
    const stepPar = () => {
      praf = 0; px += (tx - px) * 0.06; py += (ty - py) * 0.06;
      if (layerRef.current) layerRef.current.style.transform = `translate3d(${(px * 14).toFixed(2)}px,${(py * 10).toFixed(2)}px,0)`;
      if (Math.abs(tx - px) + Math.abs(ty - py) > 0.002) praf = requestAnimationFrame(stepPar);
    };
    const onMove = (e) => {
      if (!propsRef.current.parallax) return;
      tx = (e.clientX / (window.innerWidth || 1)) * 2 - 1; ty = (e.clientY / (window.innerHeight || 1)) * 2 - 1;
      if (!praf) praf = requestAnimationFrame(stepPar);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    start();
    return () => {
      ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf); if (praf) cancelAnimationFrame(praf);
    };
  }, [isStatic]);

  // Statischer Editor-Frame bei Prop-Änderung neu zeichnen
  const sig = JSON.stringify(propsRef.current);
  useEffect(() => { if (redrawRef.current) redrawRef.current(); }, [sig]);

  const clear = Math.max(0, Math.min(0.8, P.centerClear));
  const masks = [];
  if (P.fadeEdges) masks.push('linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)');
  if (clear > 0) masks.push(`radial-gradient(ellipse 42% 30% at 50% 50%, rgba(0,0,0,${(1 - clear).toFixed(2)}) 0%, #000 100%)`);
  const mask = masks.length ? masks.join(', ') : 'none';
  const base = input.style || {};
  return (
    <div
      ref={rootRef}
      data-id={input['data-id']}
      data-name={input['data-name']}
      aria-hidden="true"
      style={{ width: '100%', height: '100%', ...base, position: base.position || 'relative', overflow: 'hidden', background: P.background, pointerEvents: 'none' }}
    >
      <div ref={layerRef} style={{ position: 'absolute', inset: '-3%', opacity: P.intensity, WebkitMaskImage: mask, maskImage: mask, WebkitMaskComposite: 'source-in', maskComposite: 'intersect', willChange: 'transform' }}>
        <canvas ref={glowRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: `blur(${10 + P.blur * 5}px) saturate(1.15)`, opacity: P.glow, transform: 'scale(1.04)' }} />
        <canvas ref={mainRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: P.blur > 0 ? `blur(${P.blur}px)` : 'none' }} />
      </div>
      {P.grain && <div style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, opacity: theme.grainAlpha, mixBlendMode: P.theme === 'deep' ? 'screen' : 'multiply' }} />}
    </div>
  );
}

export default withResponsiveProps(RiverFlowBackground);

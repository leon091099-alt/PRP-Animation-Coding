// Funktionsprüfung: Scroll (vor/zurück), Autoplay, Reduced Motion, kein WebGL, Editor-Statik.
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5173/';
const out = 'scripts/out/modes'; fs.mkdirSync(out, { recursive: true });
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const log = (...a) => console.log(...a);

async function run(name, launchArgs, fn, ctxOpts = {}) {
  const b = await chromium.launch({ args: launchArgs });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, ...ctxOpts });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await fn(page);
  log(name, errs.length ? 'FEHLER: ' + [...new Set(errs)].join(' | ') : 'ok');
  await b.close();
}
const canvasCount = (page) => page.evaluate(() => document.querySelectorAll('canvas').length);

await run('scroll', GL, async (page) => {
  await page.goto(base); await page.waitForTimeout(1500);
  const H = await page.evaluate(() => document.body.scrollHeight - innerHeight);
  for (const f of [0.35, 0.6, 0.9, 0.6]) {
    await page.evaluate((y) => scrollTo(0, y), Math.round(H * f));
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${out}/scroll_${f}${f === 0.6 ? '_' + Date.now() % 1000 : ''}.png` });
  }
  log('  canvas:', await canvasCount(page));
});
await run('autoplay', GL, async (page) => {
  await page.goto(base + '?mode=autoplay'); await page.waitForTimeout(1000);
  await page.evaluate(() => scrollTo(0, innerHeight * 0.6)); await page.waitForTimeout(5000);
  await page.screenshot({ path: `${out}/autoplay_5s.png` });
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${out}/autoplay_12s.png` });
});
await run('reduced-motion', GL, async (page) => {
  await page.goto(base); await page.waitForTimeout(800);
  await page.evaluate(() => scrollTo(0, innerHeight * 0.6)); await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/reduced.png` });
}, { reducedMotion: 'reduce' });
await run('no-webgl', ['--disable-webgl', '--disable-3d-apis'], async (page) => {
  await page.goto(base + '?p=1&static=1&shot=1'); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/nowebgl.png` });
  log('  svg:', await page.evaluate(() => document.querySelectorAll('svg path').length), 'canvas:', await canvasCount(page));
});
await run('editor-static', GL, async (page) => {
  await page.goto(base + '?p=0.5&static=1&shot=1&locale=de'); await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/static_p05_de.png` });
});

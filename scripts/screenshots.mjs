// Screenshots bei festen p-Werten (Abschnitt 10.5). Nutzung:
//   node scripts/screenshots.mjs [baseUrl] [--p=0.05,0.25] [--w=1440,390] [--q=locale=de]
import { chromium } from 'playwright';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const base = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'http://127.0.0.1:5173/';
const ps = (args.p || '0.05,0.25,0.45,0.65,0.85,1').split(',').map(Number);
const widths = (args.w || '1440,390').split(',').map(Number);
const out = args.out || 'scripts/out/shots';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const w of widths) {
  const h = w < 640 ? 844 : 900;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const p of ps) {
    await page.goto(`${base}?p=${p}&shot=1&static=1${args.q ? '&' + args.q : ''}`);
    await page.waitForTimeout(+(args.wait || 2500));
    const f = `${out}/p${String(p).replace('.', '_')}_${w}${args.tag ? '_' + args.tag : ''}.png`;
    await page.screenshot({ path: f });
    console.log(f);
  }
  if (errors.length) console.log('Konsole:', [...new Set(errors)].slice(0, 10).join('\n'));
  await page.close();
}
await browser.close();

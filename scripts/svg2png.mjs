// Hilfsskript: rendert SVG-Vorschauen zu PNG (Playwright/Chromium).
import { chromium } from 'playwright';
import fs from 'node:fs';
const files = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
for (const f of files) {
  const svg = fs.readFileSync(f, 'utf8');
  const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/);
  await page.setViewportSize({ width: +w, height: +h });
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  await page.screenshot({ path: f.replace(/\.svg$/, '.png') });
}
await browser.close();

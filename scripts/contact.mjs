// Kontaktbogen aus mehreren Screenshots (für schnelle Sichtprüfung).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [out, ...files] = process.argv.slice(2);
const cols = files.length > 3 ? 3 : files.length;
const imgs = files.map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>${path.basename(f)}</figcaption></figure>`).join('');
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1800, height: 800 } });
await pg.setContent(`<style>body{margin:0;display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;background:#999}figure{margin:0}img{width:100%;display:block}figcaption{font:12px sans-serif;padding:2px;background:#fff}</style>${imgs}`);
await pg.screenshot({ path: out, fullPage: true }); await b.close();

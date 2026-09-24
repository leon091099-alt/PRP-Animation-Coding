// fetch-geo.mjs – lädt die Rohdaten für build-geo.mjs nach scripts/.cache (einmalig, wird nicht eingecheckt).
//   Natural Earth 10m (GeoJSON), OSM simplified land polygons, AWS Terrain Tiles (Terrarium z9),
//   OSM waterway=river|canal via Overpass (gekachelt, mit Wiederholung).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CACHE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.cache');
fs.mkdirSync(path.join(CACHE, 'tiles'), { recursive: true });
fs.mkdirSync(path.join(CACHE, 'osm'), { recursive: true });

const curl = (url, out, extra = []) => {
  try { execFileSync('curl', ['-sSfL', '-A', 'RiverBridgeBuild/1.0', '--max-time', '300', '-o', out, ...extra, url], { stdio: 'inherit' }); return true; } catch { return false; }
};
const REGIONS = { cn: [21.848, 23.552, 112.564, 114.836], rh: [50.598, 52.302, 3.027, 7.573] }; // Plattenausdehnung inkl. 6 % Rand

// Natural Earth
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
for (const f of ['ne_10m_urban_areas', 'ne_10m_lakes']) {
  const out = path.join(CACHE, f + '.geojson');
  if (!fs.existsSync(out)) { console.log('NE', f); curl(`${NE}/${f}.geojson`, out); }
}
// OSM Landpolygone (vereinfacht)
if (!fs.existsSync(path.join(CACHE, 'simplified-land-polygons-complete-3857'))) {
  const zip = path.join(CACHE, 'simplified-land.zip');
  console.log('OSM land polygons');
  curl('https://osmdata.openstreetmap.de/download/simplified-land-polygons-complete-3857.zip', zip);
  execFileSync('unzip', ['-o', '-q', zip, '-d', CACHE]);
}
// Terrain Tiles
const tileXY = (lat, lng, z) => {
  const n = 2 ** z, r = (lat * Math.PI) / 180;
  return [Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
};
for (const [la0, la1, lo0, lo1] of Object.values(REGIONS)) {
  const [x0, y0] = tileXY(la1, lo0, 9), [x1, y1] = tileXY(la0, lo1, 9);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const out = path.join(CACHE, `tiles/9_${x}_${y}.png`);
    if (!fs.existsSync(out)) curl(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/9/${x}/${y}.png`, out);
  }
}
// Overpass (Kacheln 0.6°, Mirror-Rotation)
const MIRRORS = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const valid = (f) => { try { return Array.isArray(JSON.parse(fs.readFileSync(f, 'utf8')).elements); } catch { return false; } };
for (const [key, [la0, la1, lo0, lo1]] of Object.entries(REGIONS)) {
  for (let la = la0; la < la1; la += 0.6) for (let lo = lo0; lo < lo1; lo += 0.6) {
    const out = path.join(CACHE, `osm/${key}_${la.toFixed(2)}_${lo.toFixed(2)}.json`);
    const bb = `${la.toFixed(3)},${lo.toFixed(3)},${Math.min(la + 0.6, la1).toFixed(3)},${Math.min(lo + 0.6, lo1).toFixed(3)}`;
    const q = `[out:json][timeout:120];(way["waterway"="river"](${bb});way["waterway"="canal"]["name"](${bb}););out geom;`;
    for (let i = 0; i < 6 && !valid(out); i++) {
      console.log('Overpass', key, bb, 'Versuch', i + 1);
      curl(MIRRORS[i % MIRRORS.length], out, ['--data-urlencode', 'data=' + q]);
    }
    if (!valid(out)) console.warn('  ! fehlgeschlagen:', out);
  }
}
console.log('fertig →', CACHE);

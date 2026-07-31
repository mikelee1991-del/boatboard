/** Split coast-geo.js lines at erroneous long jumps (>5 km). Fast repair — no full densify. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, 'coast-geo.js'), 'utf8');
const COAST_GEO = {};
eval(src.replace(/window\.COAST_GEO/g, 'COAST_GEO'));

const MAX_SEG = 5000;

function haversineM(a, b) {
  const R = 6371000, d2r = Math.PI / 180;
  const dlat = (b.lat - a.lat) * d2r, dlon = (b.lon - a.lon) * d2r;
  const la = a.lat * d2r, lb = b.lat * d2r;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dlon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function splitLine(line) {
  const pts = line.pts || line;
  if (!pts || pts.length < 2) return [line];
  const parts = [];
  let cur = { name: line.name, pts: [pts[0]] };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const d = haversineM(a, b);
    if (d > MAX_SEG) {
      if (cur.pts.length >= 2) parts.push(cur);
      cur = { name: line.name + '-split' + parts.length, pts: [b] };
    } else {
      cur.pts.push(b);
    }
  }
  if (cur.pts.length >= 2) parts.push(cur);
  return parts.length ? parts : [line];
}

const newLines = [];
let splits = 0;
for (const line of COAST_GEO.lines) {
  const parts = splitLine(line);
  if (parts.length > 1) splits += parts.length - 1;
  newLines.push(...parts);
}

const linesStart = src.indexOf('lines: [');
const islandsStart = src.indexOf('islands: [', linesStart);
if (linesStart < 0 || islandsStart < 0) throw new Error('lines/islands block not found');

function fmtPt(p) {
  return `{lat:${Math.round(p.lat * 1e6) / 1e6},lon:${Math.round(p.lon * 1e6) / 1e6}}`;
}
let block = '  lines: [\n';
newLines.forEach((line, i) => {
  block += `    { name: '${line.name.replace(/'/g, "\\'")}', pts: [`;
  block += line.pts.map(fmtPt).join(',');
  block += '] }' + (i < newLines.length - 1 ? ',\n' : '\n');
});
block += '  ]';

const bak = path.join(root, 'coast-geo.js.bak');
if (!fs.existsSync(bak)) fs.copyFileSync(path.join(root, 'coast-geo.js'), bak);
const out = src.slice(0, linesStart) + block + ',\n' + src.slice(islandsStart);
fs.writeFileSync(path.join(root, 'coast-geo.js'), out);
console.log(`split-coast-jumps: ${COAST_GEO.lines.length} lines → ${newLines.length} (+${splits} splits at jumps >${MAX_SEG}m)`);

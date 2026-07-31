'use strict';
/**
 * Ensure every verified-water-pins.json entry is live with verified:true.
 * Does NOT wipe KML / userTrusted / cdfg pins — additive merge only.
 * Honors pin-trust no/unsure exclusions.
 * Coords copied verbatim — never nudged.
 * Usage: node sync-verified-pins-live.cjs
 */
const fs = require('fs');
const path = require('path');
const root = __dirname;

function read(n) { return fs.readFileSync(path.join(root, n), 'utf8'); }
function write(n, c) { fs.writeFileSync(path.join(root, n), c); }

function hav(a, b, c, d) {
  const R = 3440.065;
  const dLat = (c - a) * Math.PI / 180;
  const dLon = (d - b) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function extractArray(src, name) {
  const marker = 'const ' + name + ' = [';
  let start = src.indexOf(marker);
  if (start < 0) return null;
  start += marker.length;
  let depth = 1, i = start, inStr = false, strCh = '', esc = false;
  while (i < src.length && depth > 0) {
    const c = src.charAt(i);
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === strCh) inStr = false;
    } else {
      if (c === '"' || c === "'") { inStr = true; strCh = c; }
      else if (c === '[') depth++;
      else if (c === ']') depth--;
    }
    i++;
  }
  if (depth !== 0) return null;
  // eslint-disable-next-line no-eval
  return eval('[' + src.substring(start, i - 1) + ']');
}

function escJs(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function loadExclusions() {
  const doc = JSON.parse(read('pin-trust-review-results.json'));
  return (doc.results || []).filter(r => r.verdict === 'no' || r.verdict === 'unsure');
}

function isExcluded(exclusions, name, lat, lon, kind) {
  return exclusions.some(r => {
    const k = String(r.kind || '').toLowerCase();
    if (kind === 'fish' && k === 'dive') return false;
    if (kind === 'dive' && k === 'fish') return false;
    return String(r.name) === String(name) && hav(r.lat, r.lon, lat, lon) < 0.05;
  });
}

function findNear(arr, name, lat, lon) {
  return arr.find(s => s && String(s.name) === String(name) && hav(s.lat, s.lon, lat, lon) <= 0.05) ||
    arr.find(s => s && hav(s.lat, s.lon, lat, lon) <= 0.02) || null;
}

function stampVerified(text, name, lat, lon) {
  const namePat = escRe(name);
  let changed = false;
  let re = new RegExp(
    "(name:\\s*'" + namePat + "'[^\\}]{0,500}?lat:\\s*)" +
    String(lat).replace('.', '\\.') + "(\\s*,\\s*lon:\\s*)" +
    String(lon).replace('.', '\\.') + "([^\\}]*)(\\})",
    'm'
  );
  if (!re.test(text)) {
    re = new RegExp("(name:\\s*'" + namePat + "'[^\\}]{0,600}?)(\\})", 'm');
    if (!re.test(text)) return { text, changed: false };
    text = text.replace(re, (m, body, close) => {
      if (/verified\s*:\s*true/.test(body)) return m;
      changed = true;
      return body.replace(/\s*$/, '') + ', verified: true' + close;
    });
    return { text, changed };
  }
  text = text.replace(re, (m, a, b, mid, close) => {
    if (/verified\s*:\s*true/.test(mid)) return m;
    changed = true;
    return a + lat + b + lon + mid.replace(/\s*$/, '') + ', verified: true' + close;
  });
  return { text, changed };
}

function stampDiveVerified(text, id, name) {
  let changed = false;
  if (id) {
    const re = new RegExp("(id:\\s*'" + escRe(id) + "'[^\\}]{0,400}?)(\\})", 'm');
    if (re.test(text)) {
      text = text.replace(re, (m, body, close) => {
        if (/verified\s*:\s*true/.test(body)) return m;
        changed = true;
        return body.replace(/\s*$/, '') + ', verified: true' + close;
      });
      if (changed) return { text, changed };
    }
  }
  return stampVerified(text, name, arguments[3], arguments[4]);
}

function formatFish(sp) {
  const species = JSON.stringify(sp.species || ['calico bass', 'sand bass', 'rockfish']);
  return [
    "  { name: '" + escJs(sp.name) + "', lat: " + sp.lat + ", lon: " + sp.lon +
      (sp.face != null ? ", face: " + sp.face : '') +
      (sp.regional ? ', regional: true' : '') +
      ', verified: true,',
    "    species: " + species + ",",
    "    depth: '" + escJs(sp.depth || '30-120 ft') + "', habitat: '" + escJs(sp.habitat || 'Multi-source verified grounds') + "',",
    "    tactics: '" + escJs(sp.tactics || 'Verified-water-pins multi-source GPS; drift or live bait.') + "',",
    "    bestTide: '" + escJs(sp.bestTide || 'incoming') + "', bestTime: '" + escJs(sp.bestTime || 'dawn') +
      "', minSstF: " + (sp.minSstF != null ? sp.minSstF : 58) + " }"
  ].join('\n');
}

function formatDive(sp) {
  const parts = [
    "id: '" + escJs(sp.id) + "'",
    "name: '" + escJs(sp.name) + "'",
    'lat: ' + sp.lat,
    'lon: ' + sp.lon,
    'face: ' + (sp.face != null ? sp.face : 270),
    'depth: ' + (sp.depth != null ? sp.depth : 40),
    'verified: true'
  ];
  if (sp.boat) parts.push('boat: true');
  if (sp.regional) parts.push('regional: true');
  return '    { ' + parts.join(', ') + ' }';
}

const log = JSON.parse(read('verified-water-pins.json'));
const exclusions = loadExclusions();
let html = read('index.html');
let diveJs = read('dive-engine.js');
let fish = extractArray(html, 'FISH_SPOTS') || [];
let dive = extractArray(diveJs, 'DIVE_SITES') || [];

let fishStamped = 0, fishAdded = 0, diveStamped = 0, diveAdded = 0, skippedEx = 0;
const fishAdd = [];
const diveAdd = [];

for (const sp of log.fishKept || []) {
  if (isExcluded(exclusions, sp.name, sp.lat, sp.lon, 'fish')) { skippedEx++; continue; }
  const hit = findNear(fish, sp.name, sp.lat, sp.lon);
  if (hit) {
    if (!hit.verified) {
      const r = stampVerified(html, hit.name, hit.lat, hit.lon);
      html = r.text;
      if (r.changed) { fishStamped++; hit.verified = true; }
    }
  } else {
    fishAdd.push(formatFish(sp));
    fish.push({ name: sp.name, lat: sp.lat, lon: sp.lon, verified: true });
    fishAdded++;
  }
}

for (const sp of log.diveKept || []) {
  if (isExcluded(exclusions, sp.name, sp.lat, sp.lon, 'dive')) { skippedEx++; continue; }
  const hit = dive.find(s => s && s.id === sp.id) || findNear(dive, sp.name, sp.lat, sp.lon);
  if (hit) {
    if (!hit.verified) {
      /* stamp by id preferred */
      let changed = false;
      if (hit.id) {
        const re = new RegExp("(id:\\s*'" + escRe(hit.id) + "'[^\\}]{0,400}?)(\\})", 'm');
        if (re.test(diveJs)) {
          diveJs = diveJs.replace(re, (m, body, close) => {
            if (/verified\s*:\s*true/.test(body)) return m;
            changed = true;
            return body.replace(/\s*$/, '') + ', verified: true' + close;
          });
        }
      }
      if (!changed) {
        const r = stampVerified(diveJs, hit.name, hit.lat, hit.lon);
        diveJs = r.text;
        changed = r.changed;
      }
      if (changed) { diveStamped++; hit.verified = true; }
    }
  } else {
    diveAdd.push(formatDive(sp));
    dive.push({ id: sp.id, name: sp.name, lat: sp.lat, lon: sp.lon, verified: true });
    diveAdded++;
  }
}

if (fishAdd.length) {
  const fsIdx = html.indexOf('const FISH_SPOTS = [');
  const fend = html.indexOf('\n];', fsIdx);
  html = html.substring(0, fend) + ',\n  /* —— Verified-water-pins default trust (coords verbatim) —— */\n' +
    fishAdd.join(',\n') + '\n];' + html.substring(fend + 3);
}

if (diveAdd.length) {
  const dend = diveJs.indexOf('];', diveJs.indexOf('const DIVE_SITES = ['));
  diveJs = diveJs.substring(0, dend).replace(/\s*$/, '') +
    ',\n    /* —— Verified-water-pins default trust (coords verbatim) —— */\n' +
    diveAdd.join(',\n') + '\n  ];' + diveJs.substring(dend + 2);
}

html = html.replace(
  /const FISH_SPOTS = \[\n  \/\*[^*]*\*\//,
  'const FISH_SPOTS = [\n  /* VERIFIED + CDFG + inherent KML + userTrusted. See verified-water-pins.json + San Diego Fishing Spots.kml */'
);

write('index.html', html);
write('dive-engine.js', diveJs);

const report = {
  policy: 'Default-trust verified-water-pins.json: verified:true, coords verbatim; no/unsure overrides; additive merge',
  fishKept: (log.fishKept || []).length,
  diveKept: (log.diveKept || []).length,
  fishStamped,
  fishAdded,
  diveStamped,
  diveAdded,
  skippedExclusions: skippedEx
};
write('sync-verified-pins-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

'use strict';
/**
 * Auto-seed pin-trust yes for default-trusted sources still pending:
 * - kml-single / kml-omitted / kmlImported (San Diego Fishing Spots.kml)
 * - verified / dive-verified / multi-source from verified-water-pins.json
 * Never overwrites existing no / unsure / yes.
 * Usage: node auto-seed-default-trust-yes.cjs
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

function isDefaultTrustClass(tc, source) {
  const t = String(tc || '').toLowerCase();
  const s = String(source || '');
  if (/^kml/.test(t) || t === 'kml-single' || t === 'kml-omitted') return 'kml';
  if (t === 'verified' || t === 'dive-verified' || t === 'cdfg' || t === 'cdfgappendix') return 'verified';
  if (/San Diego Fishing Spots\.kml/i.test(s)) return 'kml';
  if (/verified-water-pins\.json/i.test(s)) return 'verified';
  return null;
}

function liveDisplayed(fish, dive, kind, name, lat, lon) {
  const arr = kind === 'dive' ? dive : fish;
  return arr.some(s => s && isFinite(s.lat) && hav(s.lat, s.lon, lat, lon) <= 0.05);
}

const html = read('index.html');
const diveJs = read('dive-engine.js');
const fish = extractArray(html, 'FISH_SPOTS') || [];
const dive = extractArray(diveJs, 'DIVE_SITES') || [];

let review = null;
try {
  review = JSON.parse(read('pin-trust-review.json'));
} catch (e) {
  review = null;
}

const resultsDoc = JSON.parse(read('pin-trust-review-results.json'));
const byId = {};
const byKey = {};
for (const r of resultsDoc.results || []) {
  if (!r || !r.id) continue;
  byId[r.id] = r;
  byKey[(r.kind || '') + '|' + r.name + '|' + r.lat + '|' + r.lon] = r;
}

const now = new Date().toISOString();
let seeded = 0;
let refreshed = 0;
const candidates = (review && review.candidates) || [];

function upsertYes(c, why) {
  const key = (c.kind || '') + '|' + c.name + '|' + c.lat + '|' + c.lon;
  let row = byId[c.id] || byKey[key];
  if (row) {
    const v = String(row.verdict || '').toLowerCase();
    if (v === 'no' || v === 'unsure' || v === 'yes') {
      /* refresh display flag only */
      const disp = liveDisplayed(fish, dive, row.kind, row.name, row.lat, row.lon);
      if (row.currentlyDisplayed !== disp) { row.currentlyDisplayed = disp; refreshed++; }
      return;
    }
  }
  const disp = liveDisplayed(fish, dive, c.kind, c.name, c.lat, c.lon);
  const entry = {
    id: (row && row.id) || c.id,
    kind: c.kind,
    name: c.name,
    lat: c.lat,
    lon: c.lon,
    priority: c.priority || 'low',
    trustClass: c.trustClass || '',
    currentlyDisplayed: disp,
    source: c.source || '',
    sourceUrl: c.sourceUrl || '',
    reason: c.reason || '',
    verdict: 'yes',
    note: why,
    reviewedAt: now
  };
  if (row) {
    Object.assign(row, entry);
  } else {
    resultsDoc.results.push(entry);
    byId[entry.id] = entry;
    byKey[key] = entry;
  }
  seeded++;
}

/* 1) From review candidates */
for (const c of candidates) {
  const tier = isDefaultTrustClass(c.trustClass, c.source);
  if (!tier) continue;
  upsertYes(c, tier === 'kml'
    ? 'Auto-yes: San Diego Fishing Spots.kml inherent trust'
    : 'Auto-yes: verified-water-pins.json multi-source trust');
}

/* 2) From live kmlImported / verified fish not already in results */
let kmlIdx = 0;
for (const s of fish) {
  if (!s || !s.kmlImported) continue;
  if (s.verified || s.cdfgAppendix) continue;
  const id = 'fish_kml_live_' + (kmlIdx++);
  const key = 'fish|' + s.name + '|' + s.lat + '|' + s.lon;
  if (byKey[key] && ['yes', 'no', 'unsure'].includes(String(byKey[key].verdict || '').toLowerCase())) continue;
  upsertYes({
    id: (byKey[key] && byKey[key].id) || id,
    kind: 'fish',
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    priority: 'low',
    trustClass: 'kml-single',
    source: 'San Diego Fishing Spots.kml (user chart)',
    reason: 'Inherent KML trust — optional spot-check only.'
  }, 'Auto-yes: San Diego Fishing Spots.kml inherent trust');
}

for (const s of fish) {
  if (!s || !s.verified) continue;
  const key = 'fish|' + s.name + '|' + s.lat + '|' + s.lon;
  if (byKey[key] && ['yes', 'no', 'unsure'].includes(String(byKey[key].verdict || '').toLowerCase())) continue;
  upsertYes({
    id: (byKey[key] && byKey[key].id) || ('fish_ver_' + String(s.name).toLowerCase().replace(/[^a-z0-9]+/g, '').substring(0, 24)),
    kind: 'fish',
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    priority: 'low',
    trustClass: 'verified',
    source: 'verified-water-pins.json (multi-source)',
    reason: 'Multi-source verified — default trusted.'
  }, 'Auto-yes: verified-water-pins.json multi-source trust');
}

for (const s of dive) {
  if (!s || !(s.verified || s.cdfgAppendix)) continue;
  const key = 'dive|' + s.name + '|' + s.lat + '|' + s.lon;
  if (byKey[key] && ['yes', 'no', 'unsure'].includes(String(byKey[key].verdict || '').toLowerCase())) continue;
  upsertYes({
    id: (byKey[key] && byKey[key].id) || ('dive_ver_' + (s.id || String(s.name).toLowerCase().replace(/[^a-z0-9]+/g, '').substring(0, 24))),
    kind: 'dive',
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    priority: 'low',
    trustClass: s.cdfgAppendix ? 'cdfg' : 'dive-verified',
    source: s.cdfgAppendix ? 'CDFG Artificial Reef Appendix' : 'verified-water-pins.json (multi-source)',
    reason: 'Default trusted verified/CDFG dive — optional spot-check.'
  }, 'Auto-yes: verified-water-pins / CDFG inherent trust');
}

/* Refresh currentlyDisplayed for all rows */
for (const r of resultsDoc.results) {
  const disp = liveDisplayed(fish, dive, r.kind, r.name, r.lat, r.lon);
  if (r.currentlyDisplayed !== disp) { r.currentlyDisplayed = disp; refreshed++; }
}

let yes = 0, no = 0, unsure = 0, pending = 0;
for (const r of resultsDoc.results) {
  const v = String(r.verdict || '').toLowerCase();
  if (v === 'yes') yes++;
  else if (v === 'no') no++;
  else if (v === 'unsure') unsure++;
  else pending++;
}
resultsDoc.summary = { yes, no, unsure, pending, total: resultsDoc.results.length };
resultsDoc.exportedAt = now;
resultsDoc.mergeNote = (resultsDoc.mergeNote ? resultsDoc.mergeNote + ' | ' : '') +
  'Auto-seeded default-trust yes for pending KML + verified (' + seeded + ') at ' + now;

write('pin-trust-review-results.json', JSON.stringify(resultsDoc, null, 2) + '\n');
console.log(JSON.stringify({ seeded, refreshed, summary: resultsDoc.summary }, null, 2));

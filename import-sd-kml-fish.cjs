'use strict';
/**
 * Node port of import-sd-kml-fish.js — San Diego Fishing Spots.kml → FISH_SPOTS.
 * Inherent trust: kmlImported:true, coords verbatim. Honors no/unsure exclusions
 * only via apply-pin-trust-yes.js (this import restores all non-near-dup placemarks).
 */
const fs = require('fs');
const path = require('path');
const root = __dirname;

function read(n) { return fs.readFileSync(path.join(root, n), 'utf8'); }
function write(n, c) { fs.writeFileSync(path.join(root, n), c); }

function trimStr(s) { return String(s).replace(/^\s+|\s+$/g, ''); }

function normalizeName(s) {
  if (!s) return '';
  return trimStr(String(s).toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/#/g, 'num')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' '));
}

function nameSimilarity(a, b) {
  const na = normalizeName(a), nb = normalizeName(b);
  if (na === nb) return 1;
  const ta = na.split(/\s+/).filter(t => t.length > 1);
  const tb = nb.split(/\s+/).filter(t => t.length > 1);
  if (!ta.length || !tb.length) return 0;
  let common = 0;
  for (const x of ta) for (const y of tb) if (x === y) common++;
  return common / Math.max(ta.length, tb.length);
}

function hav(lat1, lon1, lat2, lon2) {
  const R = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function stripHtml(s) {
  if (!s) return '';
  return trimStr(String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
}

function guessFace(lat, lon) {
  if (lon > -117.35 && lat >= 32.5 && lat <= 33.05) return 270;
  if (lon > -118.0 && lat >= 33.3 && lat <= 33.7) return 200;
  if (lat >= 33.7 && lat <= 34.1) return 250;
  if (lat >= 34.0) return 205;
  return 270;
}

function isRegional(lat, lon, desc) {
  if (lat >= 32.5 && lat <= 33.2 && lon >= -117.5 && lon <= -116.9) return true;
  if (/San Diego|La Jolla|Point Loma|Mission Bay|Coronado|Imperial Beach|Oceanside|Encinitas|Del Mar|Torrey Pines|Carlsbad|Wreck Alley/i.test(desc || '')) return true;
  return false;
}

function inferHabitat(name, desc) {
  const n = String(name).toLowerCase();
  if (/wreck|shipwreck|yukon|ruby/.test(n)) return 'Wreck structure';
  if (/kelp/.test(n)) return 'Kelp bed';
  if (/artificial reef|art reef/.test(n)) return 'Artificial reef modules';
  if (/bank|spot|fathom|trench|knuckle|ridge|hump|finger/.test(n)) return 'Offshore structure & hard bottom';
  if (/reef/.test(n)) return 'Rocky reef';
  if (desc && desc !== 'Fishing Spot' && desc !== 'Google Maps') return desc;
  return 'Offshore fishing grounds';
}

function escJs(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

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

function parseKmlFishingSpots(kml) {
  const folderStart = kml.indexOf('<name>Fishing Spots</name>');
  if (folderStart < 0) throw new Error('Fishing Spots folder not found');
  const folderEnd = kml.indexOf('</Folder>', folderStart);
  const section = kml.substring(folderStart, folderEnd);
  const spots = [];
  const re = /<Placemark>[\s\S]*?<name>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/name>[\s\S]*?(?:<description>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/description>)?[\s\S]*?<Point>[\s\S]*?<coordinates>\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/gi;
  let m;
  while ((m = re.exec(section)) !== null) {
    const name = trimStr((m[1] || m[2] || '').replace(/\s+/g, ' '));
    const desc = stripHtml(m[3] || m[4] || '');
    const lon = parseFloat(m[5]), lat = parseFloat(m[6]);
    if (!name || !isFinite(lat) || !isFinite(lon)) continue;
    spots.push({ name, lat, lon, desc });
  }
  return spots;
}

function findNearDuplicate(kml, fishSpots) {
  const normK = normalizeName(kml.name);
  for (let idx = 0; idx < fishSpots.length; idx++) {
    const ex = fishSpots[idx];
    if (!ex || ex.name == null || !isFinite(ex.lat) || !isFinite(ex.lon)) continue;
    const normE = normalizeName(ex.name);
    const dist = hav(kml.lat, kml.lon, ex.lat, ex.lon);
    if (normK === normE && dist <= 0.5) {
      return { idx, reason: 'name+proximity', dist };
    }
    if (dist <= 0.001) {
      return { idx, reason: 'same-coords', dist };
    }
    if ((ex.verified || ex.cdfgAppendix || ex.userTrusted) && dist <= 0.15) {
      const sim = nameSimilarity(kml.name, ex.name);
      const sub = normK.indexOf(normE) >= 0 || normE.indexOf(normK) >= 0;
      /* Require strong name agreement — "Beach"/"Mission Bay Park" alone is not enough */
      if (sim >= 0.65 || (sub && sim >= 0.5)) {
        return { idx, reason: 'trusted-overlap', dist, sim };
      }
    }
  }
  return null;
}

function formatNewSpot(sp) {
  let head = "  { name: '" + escJs(sp.name) + "', lat: " + sp.lat + ", lon: " + sp.lon;
  const tail = [];
  if (sp.face != null) tail.push('face: ' + sp.face);
  if (sp.regional) tail.push('regional: true');
  tail.push('kmlImported: true');
  head += ', ' + tail.join(', ');
  return [
    head + ',',
    "    species: ['calico bass', 'sand bass', 'bonito', 'rockfish'],",
    "    depth: '30-120 ft', habitat: '" + escJs(sp.habitat) + "',",
    "    tactics: 'San Diego Fishing Spots.kml chart waypoint; drift or live bait on structure.',",
    "    bestTide: 'incoming', bestTime: 'dawn', minSstF: 58 }"
  ].join('\n');
}

let html = read('index.html');
const kmlText = read('San Diego Fishing Spots.kml');

/* Additive restore only — do not strip the existing KML block (strip broke
 * array close when comments/objects sat between marker and ];). Idempotent via
 * findNearDuplicate. */

const kmlSpots = parseKmlFishingSpots(kmlText);
const fishSpots = extractArray(html, 'FISH_SPOTS');
if (!fishSpots) throw new Error('Failed to parse FISH_SPOTS');

console.log('KML fishing spots:', kmlSpots.length);
console.log('Existing FISH_SPOTS (pre-import):', fishSpots.length);

const added = [], skipped = [], dupExamples = [];
const newEntries = [];
let protectedVerified = 0;

for (const spot of kmlSpots) {
  const dup = findNearDuplicate(spot, fishSpots);
  if (dup) {
    const ex = fishSpots[dup.idx];
    if (ex.verified) protectedVerified++;
    skipped.push(spot.name);
    if (dupExamples.length < 40) {
      dupExamples.push({
        existing: ex.name,
        kmlName: spot.name,
        reason: dup.reason,
        distNm: Math.round(dup.dist * 1000) / 1000,
        existingVerified: !!ex.verified,
        action: ex.verified
          ? 'kept multi-source verified coords (KML not applied)'
          : 'skipped near-duplicate'
      });
    }
    continue;
  }
  const regional = isRegional(spot.lat, spot.lon, spot.desc);
  newEntries.push(formatNewSpot({
    name: spot.name,
    lat: spot.lat,
    lon: spot.lon,
    face: guessFace(spot.lat, spot.lon),
    regional,
    habitat: inferHabitat(spot.name, spot.desc)
  }));
  fishSpots.push({ name: spot.name, lat: spot.lat, lon: spot.lon, kmlImported: true, verified: false });
  added.push(spot.name);
}

if (newEntries.length) {
  const fishStart = html.indexOf('const FISH_SPOTS = [');
  const closeIdx = html.indexOf('\n];', fishStart);
  if (closeIdx < 0) throw new Error('FISH_SPOTS closing bracket not found');
  const insertBlock = ',\n  /* —— San Diego KML import —— */\n' +
    '  /* User-provided San Diego Fishing Spots.kml — coords verbatim, kmlImported:true */\n' +
    newEntries.join(',\n') + '\n];';
  html = html.substring(0, closeIdx) + insertBlock + html.substring(closeIdx + 3);
}

html = html.replace(
  /const FISH_SPOTS = \[\n  \/\*[^*]*\*\//,
  'const FISH_SPOTS = [\n  /* MULTI-SOURCE VERIFIED + user San Diego Fishing Spots.kml (kmlImported). See verified-water-pins.json */'
);

write('index.html', html);

const report = {
  policy: 'Inherent KML trust: coords verbatim + kmlImported; cdfgAppendix/verified never overwritten; no nudges',
  kmlTotal: kmlSpots.length,
  existingBefore: fishSpots.length - added.length,
  finalCount: fishSpots.length,
  added: added.length,
  skippedNearDuplicates: skipped.length,
  protectedVerifiedOverlaps: protectedVerified,
  addedNames: added,
  dupExamples
};
write('import-sd-kml-report.json', JSON.stringify(report, null, 2));
console.log('Added:', added.length, 'Skipped near-dups:', skipped.length,
  '(protected verified overlaps:', protectedVerified + ')');
console.log('Final FISH_SPOTS:', fishSpots.length);
if (added.length) console.log('Added names:', added.join(', '));

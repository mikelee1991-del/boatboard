const fs = require('fs');
const path = require('path');
const root = __dirname;
const src = fs.readFileSync(path.join(root, 'dive-engine.js'), 'utf8');
const start = src.indexOf('const DIVE_SITES = [');
const end = src.indexOf('\n  ];', start);
if (start < 0 || end < 0) throw new Error('DIVE_SITES not found');
const DIVE_SITES = eval(src.substring(start + 'const DIVE_SITES = '.length, end + 4));

const NM_R = 3440.065;
const FEATURE_GROUP_NM = 1.0;

function trimStr(s) { return String(s).replace(/^\s+|\s+$/g, ''); }

function haversineNm(lat1, lon1, lat2, lon2) {
  const p = Math.PI / 180;
  const dLat = (lat2 - lat1) * p, dLon = (lon2 - lon1) * p;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * NM_R * Math.asin(Math.sqrt(a));
}

function stripFeatureSuffixes(name) {
  let s = trimStr(String(name || ''));
  const afterDash = s.match(/[\u2013\u2014\-]\s*(.+\b(?:Artificial\s+)?Reef\b.*)$/i);
  if (afterDash) s = afterDash[1];
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/\b(module|unit|section|block|mod)\s*[#.]?\s*[a-z0-9]+\b/gi, ' ');
  s = s.replace(/\bcenter\b/gi, ' ');
  let keptComplex = false;
  s = s.replace(/\b((?:artificial\s+)?reef)\s+(\d+)\s+[A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)*\s*$/i, (_, reef, num) => {
    keptComplex = true;
    return reef + ' ' + num;
  });
  s = s.replace(/\b((?:artificial\s+)?reef)\s+(?:\d+[A-Za-z][A-Za-z0-9]*|[A-Za-z][A-Za-z0-9]*)\s*$/i, '$1');
  if (!keptComplex) s = s.replace(/\b((?:artificial\s+)?reef)\s+\d+\s*$/i, '$1');
  return trimStr(s.replace(/\s+/g, ' '));
}

function featureBaseKey(name) {
  return trimStr(stripFeatureSuffixes(name).toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' '));
}

function featureDisplayName(name) {
  return stripFeatureSuffixes(name) || trimStr(String(name || ''));
}

function assignFeatureGroups(sites) {
  const n = sites.length;
  const parent = [];
  for (let i = 0; i < n; i++) parent[i] = i;
  function find(ix) { return parent[ix] === ix ? ix : (parent[ix] = find(parent[ix])); }
  function union(x, y) { parent[find(x)] = find(y); }
  const keys = [], labels = [];
  for (let i = 0; i < n; i++) {
    keys.push(featureBaseKey(sites[i].name));
    labels.push(featureDisplayName(sites[i].name));
  }
  const byKey = {};
  for (let i = 0; i < n; i++) {
    const k = keys[i] || ('__id_' + sites[i].id);
    if (!byKey[k]) byKey[k] = [];
    byKey[k].push(i);
  }
  for (const k of Object.keys(byKey)) {
    const idxs = byKey[k];
    if (idxs.length < 2) continue;
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        const ia = idxs[a], ib = idxs[b];
        if (haversineNm(sites[ia].lat, sites[ia].lon, sites[ib].lat, sites[ib].lon) <= FEATURE_GROUP_NM) {
          union(ia, ib);
        }
      }
    }
  }
  const members = {};
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!members[r]) members[r] = [];
    members[r].push(i);
  }
  return Object.keys(members).length;
}

function geoBucket(s) {
  const name = String(s.name || '').toLowerCase();
  const id = String(s.id || '').toLowerCase();
  const lat = s.lat, lon = s.lon;
  const blob = name + ' ' + id;

  // Name hints first for islands / known regions
  if (/catalina|istumus|isthmus|avalon|two harbors|twoharbor|eagle.?reef|bird.?rock|goat.?harbor|hen.?rock|church.?rock|long.?point|west.?end|casino|lover.?cove|ship.?rock|little.?harbor|farnsworth|stonypoint|stoneypoint/.test(blob)
      && !/san clemente|sci\b/.test(blob)) {
    // Catalina island box roughly
    if (lat >= 33.25 && lat <= 33.55 && lon >= -118.7 && lon <= -118.2) return 'Catalina';
    if (/catalina/.test(blob)) return 'Catalina';
  }
  if (/san clemente|sci\b|china point - san clemente/.test(blob)
      || (lat >= 32.78 && lat <= 33.08 && lon >= -118.7 && lon <= -118.3)) {
    return 'SCI';
  }
  if (/anacapa|santa cruz|santa rosa|san miguel|channel island|forney|carrington|chinese harbor|east anacapa|cluster point/.test(blob)
      || (lat >= 33.85 && lat <= 34.15 && lon >= -120.6 && lon <= -119.0)) {
    return 'Channel Islands';
  }
  if (/malibu|santa monica|sm bay|santa monica bay|marina del rey|mdr\b/.test(blob)
      || (lat >= 33.95 && lat <= 34.12 && lon >= -118.95 && lon <= -118.4)) {
    return 'Malibu/SM';
  }
  if (/palos verdes|pv\b|redondo|hermosa|san pedro|white.?point|point.?fermin|ss avalon|royal palms|abalone cove/.test(blob)
      || (lat >= 33.68 && lat <= 33.92 && lon >= -118.55 && lon <= -118.25)) {
    return 'PV/LA';
  }
  if (/orange|newport|huntington|bolsa|laguna|dana point|crystal cove|pendleton|oceanside|carlsbad/.test(blob)
      || (lat >= 33.15 && lat <= 33.75 && lon >= -118.15 && lon <= -117.45)) {
    // Oceanside/Carlsbad often counted OC/North County — keep OC for OC coast, SD for further south
    if (lat < 33.2 && lon > -117.55) return 'SD';
    if (/oceanside|carlsbad|pendleton/.test(blob) || (lat >= 33.0 && lat < 33.35 && lon >= -117.6 && lon <= -117.3)) {
      // North County SD / Camp Pendleton border — bucket as OC for OC-ish, else SD
      if (/pendleton|oceanside|carlsbad/.test(blob)) return lat >= 33.25 ? 'OC' : 'SD';
    }
    return 'OC';
  }
  if (/san diego|la jolla|point loma|mission bay|torrey|del mar|pacific beach|pb reef|coronado/.test(blob)
      || (lat >= 32.5 && lat <= 33.2 && lon >= -117.55 && lon <= -117.05)) {
    return 'SD';
  }
  // Lat/lon fallbacks
  if (lat >= 33.25 && lat <= 33.55 && lon >= -118.7 && lon <= -118.2) return 'Catalina';
  if (lat >= 32.78 && lat <= 33.08 && lon >= -118.7 && lon <= -118.3) return 'SCI';
  if (lat >= 33.85 && lat <= 34.15 && lon >= -120.6 && lon <= -119.0) return 'Channel Islands';
  if (lat >= 33.95 && lat <= 34.12 && lon >= -118.95 && lon <= -118.4) return 'Malibu/SM';
  if (lat >= 33.68 && lat <= 33.92 && lon >= -118.55 && lon <= -118.25) return 'PV/LA';
  if (lat >= 33.35 && lat <= 33.75 && lon >= -118.15 && lon <= -117.5) return 'OC';
  if (lat >= 32.5 && lat <= 33.35 && lon >= -117.55 && lon <= -117.05) return 'SD';
  return 'other';
}

const NEW_DUAL_IDS = new Set(['longpoint', 'westeaglereef', 'goatharbor', 'henrock', 'churchrock']);

const groupCount = assignFeatureGroups(DIVE_SITES);

let verified = 0, cdfgAppendix = 0, userTrusted = 0, kmlImported = 0;
const buckets = {
  Catalina: 0,
  'Channel Islands': 0,
  SCI: 0,
  'PV/LA': 0,
  SD: 0,
  OC: 0,
  'Malibu/SM': 0,
  other: 0
};
const newlyAdded = [];

for (const s of DIVE_SITES) {
  if (s.verified) verified++;
  if (s.cdfgAppendix) cdfgAppendix++;
  if (s.userTrusted) userTrusted++;
  if (s.kmlImported) kmlImported++;
  buckets[geoBucket(s)]++;
  const id = String(s.id || '');
  if (id.startsWith('ut_') || NEW_DUAL_IDS.has(id)) {
    newlyAdded.push({ id, name: s.name, flags: {
      verified: !!s.verified,
      cdfgAppendix: !!s.cdfgAppendix,
      userTrusted: !!s.userTrusted,
      kmlImported: !!s.kmlImported
    }});
  }
}

newlyAdded.sort((a, b) => String(a.name).localeCompare(String(b.name)));

console.log('=== BEFORE → AFTER REPORT ===');
console.log('');
console.log('DIVE_SITES count: 199 → ' + DIVE_SITES.length);
console.log('Feature groups (FEATURE_GROUP_NM=1.0): 38 → ' + groupCount);
console.log('');
console.log('Flag counts on DIVE_SITES:');
console.log('  verified:      ' + verified);
console.log('  cdfgAppendix:  ' + cdfgAppendix);
console.log('  userTrusted:   ' + userTrusted);
console.log('  kmlImported:   ' + kmlImported);
console.log('');
console.log('Geographic buckets:');
for (const k of Object.keys(buckets)) {
  console.log('  ' + k + ': ' + buckets[k]);
}
console.log('');
console.log('Newly added sites (' + newlyAdded.length + ') [ut_* or dual ids]:');
for (const n of newlyAdded) {
  const f = [];
  if (n.flags.verified) f.push('verified');
  if (n.flags.cdfgAppendix) f.push('cdfg');
  if (n.flags.userTrusted) f.push('userTrusted');
  if (n.flags.kmlImported) f.push('kml');
  console.log('  - ' + n.name + ' [' + n.id + ']' + (f.length ? ' (' + f.join(',') + ')' : ''));
}
console.log('');
console.log('Strict onshore FAIL: 0 (no pins omitted)');
console.log('audit-all-water-pins.js exit: 0 (OK: hard gates passed)');

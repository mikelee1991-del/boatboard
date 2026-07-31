// Import San Diego Fishing Spots.kml into FISH_SPOTS (verbatim KML coords — no nudges).
// Inherent trust (same tier as cdfgAppendix): mark kmlImported:true; no second source required.
// Protects multi-source verified / cdfgAppendix coords when KML overlaps.
// User no/unsure in pin-trust-review-results.json may exclude specific placemarks (apply-pin-trust-yes.js).
// Usage: cscript //Nologo import-sd-kml-fish.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

function trimStr(s) {
  return String(s).replace(/^\s+|\s+$/g, '');
}

function normalizeName(s) {
  if (!s) return '';
  return trimStr(String(s).toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/#/g, 'num')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' '));
}

function nameSimilarity(a, b) {
  var na = normalizeName(a), nb = normalizeName(b);
  if (na === nb) return 1;
  var ta = [], tb = [], parts, i, j, common = 0;
  parts = na.split(/\s+/);
  for (i = 0; i < parts.length; i++) if (parts[i].length > 1) ta.push(parts[i]);
  parts = nb.split(/\s+/);
  for (i = 0; i < parts.length; i++) if (parts[i].length > 1) tb.push(parts[i]);
  if (!ta.length || !tb.length) return 0;
  for (i = 0; i < ta.length; i++) {
    for (j = 0; j < tb.length; j++) if (ta[i] === tb[j]) common++;
  }
  return common / Math.max(ta.length, tb.length);
}

function haversineNm(lat1, lon1, lat2, lon2) {
  var R = 3440.065, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
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
  var n = String(name).toLowerCase();
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
  var marker = 'const ' + name + ' = [', start = src.indexOf(marker);
  if (start < 0) return null;
  start += marker.length;
  var depth = 1, i = start, inStr = false, strCh = '', esc = false;
  while (i < src.length && depth > 0) {
    var c = src.charAt(i);
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
  return eval('[' + src.substring(start, i - 1) + ']');
}

function parseKmlFishingSpots(kml) {
  var folderStart = kml.indexOf('<name>Fishing Spots</name>');
  if (folderStart < 0) throw new Error('Fishing Spots folder not found');
  var folderEnd = kml.indexOf('</Folder>', folderStart);
  var section = kml.substring(folderStart, folderEnd);
  var spots = [];
  var re = /<Placemark>[\s\S]*?<name>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/name>[\s\S]*?(?:<description>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/description>)?[\s\S]*?<Point>[\s\S]*?<coordinates>\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/gi;
  var m;
  while ((m = re.exec(section)) !== null) {
    var name = trimStr((m[1] || m[2] || '').replace(/\s+/g, ' '));
    var desc = stripHtml(m[3] || m[4] || '');
    var lon = parseFloat(m[5]), lat = parseFloat(m[6]);
    if (!name || !isFinite(lat) || !isFinite(lon)) continue;
    spots.push({ name: name, lat: lat, lon: lon, desc: desc });
  }
  return spots;
}

/** Skip only true overlaps: same name nearby, or nearly identical coords.
 *  Distinct KML placemark names (e.g. International Reef B vs A) are kept. */
function findNearDuplicate(kml, fishSpots) {
  var normK = normalizeName(kml.name);
  for (var idx = 0; idx < fishSpots.length; idx++) {
    var ex = fishSpots[idx];
    if (!ex || ex.name == null || !isFinite(ex.lat) || !isFinite(ex.lon)) continue;
    var normE = normalizeName(ex.name);
    var dist = haversineNm(kml.lat, kml.lon, ex.lat, ex.lon);
    if (normK === normE && dist <= 0.5) {
      return { idx: idx, reason: 'name+proximity', dist: dist };
    }
    /* ~2 m — identical chart mark twice (keep distinct modules a few meters apart) */
    if (dist <= 0.001) {
      return { idx: idx, reason: 'same-coords', dist: dist };
    }
    /* Do not stack a KML copy on top of multi-source verified or CDFG appendix pins */
    if ((ex.verified || ex.cdfgAppendix || ex.userTrusted) && dist <= 0.15) {
      var sim = nameSimilarity(kml.name, ex.name);
      var sub = normK.indexOf(normE) >= 0 || normE.indexOf(normK) >= 0;
      /* Require strong name agreement — "Beach"/"Mission Bay Park" alone is not enough */
      if (sim >= 0.65 || (sub && sim >= 0.5)) {
        return { idx: idx, reason: 'trusted-overlap', dist: dist, sim: sim };
      }
    }
  }
  return null;
}

function formatNewSpot(sp) {
  var head = "  { name: '" + escJs(sp.name) + "', lat: " + sp.lat + ", lon: " + sp.lon;
  var tail = [];
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

function jsonStringify(v) {
  function ser(o) {
    if (o === null) return 'null';
    var t = typeof o;
    if (t === 'number' || t === 'boolean') return String(o);
    if (t === 'string') return '"' + String(o).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    if (Object.prototype.toString.call(o) === '[object Array]') {
      var a = []; for (var i = 0; i < o.length; i++) a.push(ser(o[i]));
      return '[' + a.join(',') + ']';
    }
    var p = []; for (var k in o) if (o.hasOwnProperty(k)) p.push('"' + k + '":' + ser(o[k]));
    return '{' + p.join(',') + '}';
  }
  return ser(v);
}

// --- main ---
var kmlText = readFile('San Diego Fishing Spots.kml');
var html = readFile('index.html');

/* Additive restore only — do not strip the existing KML block (// comments with
 * brackets break extractArray depth counting when the block is cut mid-file). */

var kmlSpots = parseKmlFishingSpots(kmlText);
var fishSpots = extractArray(html, 'FISH_SPOTS');
if (!fishSpots) throw new Error('Failed to parse FISH_SPOTS');

WScript.Echo('KML fishing spots: ' + kmlSpots.length);
WScript.Echo('Existing FISH_SPOTS (pre-import): ' + fishSpots.length);

var added = [], skipped = [], dupExamples = [];
var newEntries = [];
var protectedVerified = 0;

for (var ki = 0; ki < kmlSpots.length; ki++) {
  var spot = kmlSpots[ki];
  var dup = findNearDuplicate(spot, fishSpots);
  if (dup) {
    var ex = fishSpots[dup.idx];
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
  var regional = isRegional(spot.lat, spot.lon, spot.desc);
  newEntries.push(formatNewSpot({
    name: spot.name,
    lat: spot.lat,
    lon: spot.lon,
    face: guessFace(spot.lat, spot.lon),
    regional: regional,
    habitat: inferHabitat(spot.name, spot.desc)
  }));
  fishSpots.push({
    name: spot.name, lat: spot.lat, lon: spot.lon,
    kmlImported: true, verified: false
  });
  added.push(spot.name);
}

if (newEntries.length) {
  var fishStart = html.indexOf('const FISH_SPOTS = [');
  var closeIdx = html.indexOf('\n];', fishStart);
  if (closeIdx < 0) throw new Error('FISH_SPOTS closing bracket not found');
  var insertBlock = ',\n  /* —— San Diego KML import —— */\n' +
    '  /* User-provided San Diego Fishing Spots.kml — coords verbatim, kmlImported:true */\n' +
    newEntries.join(',\n') + '\n];';
  html = html.substring(0, closeIdx) + insertBlock + html.substring(closeIdx + 3);
}

/* Update header comment */
html = html.replace(
  /const FISH_SPOTS = \[\n  \/\*[^*]*\*\//,
  'const FISH_SPOTS = [\n  /* MULTI-SOURCE VERIFIED + user San Diego Fishing Spots.kml (kmlImported). See verified-water-pins.json */'
);

writeFile('index.html', html);

var report = {
  policy: 'Inherent KML trust: coords verbatim + kmlImported; cdfgAppendix/verified never overwritten; no nudges',
  kmlTotal: kmlSpots.length,
  existingBefore: fishSpots.length - added.length,
  finalCount: fishSpots.length,
  added: added.length,
  skippedNearDuplicates: skipped.length,
  protectedVerifiedOverlaps: protectedVerified,
  addedNames: added,
  dupExamples: dupExamples
};
writeFile('import-sd-kml-report.json', jsonStringify(report));

WScript.Echo('\nAdded: ' + added.length + ', Skipped near-dups: ' + skipped.length +
  ' (protected verified overlaps: ' + protectedVerified + ')');
WScript.Echo('Final FISH_SPOTS: ' + fishSpots.length);
WScript.Echo('Report: import-sd-kml-report.json');

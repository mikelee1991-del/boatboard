// Import CDFG/CDFW Artificial Reef Appendix into FISH_SPOTS + DIVE_SITES.
// Coords from cdfg-artificial-reefs.json (DMS→decimal, verbatim). Inherently trusted.
// Usage: cscript //Nologo build-cdfg-reefs-json.js & cscript //Nologo import-cdfg-reefs.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

function trimStr(s) { return String(s).replace(/^\s+|\s+$/g, ''); }
function normalizeName(s) {
  return trimStr(String(s).toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/ss palawan/g, 'palawan')
    .replace(/artificial reef/g, 'ar')
    .replace(/#/g, 'num')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' '));
}
function haversineNm(lat1, lon1, lat2, lon2) {
  var R = 3440.065, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function escJs(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

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

function parseJsonFile(n) {
  var t = readFile(n);
  /* strip BOM */
  if (t.charCodeAt(0) === 0xFEFF) t = t.substring(1);
  return eval('(' + t + ')');
}

function isRegional(lat, lon) {
  if (lat >= 32.4 && lat <= 33.25) return true; /* SD */
  if (lat >= 33.25 && lat <= 33.65 && lon > -118.15) return true; /* OC */
  if (lat >= 34.0 && lon < -118.5) return true; /* Malibu/SM */
  if (lat > 34.1) return true; /* north of LA */
  return false;
}

function guessFace(lat, lon) {
  if (lon > -117.4) return 270;
  if (lon > -118.0) return 200;
  if (lat >= 33.7 && lat <= 34.1) return 250;
  return 250;
}

function slugId(name) {
  return 'cdfg_' + normalizeName(name).replace(/\s+/g, '_').substring(0, 40);
}

function findMatch(reef, list) {
  var normR = normalizeName(reef.name);
  var best = null;
  for (var i = 0; i < list.length; i++) {
    var ex = list[i];
    if (!ex || !ex.name) continue;
    var dist = haversineNm(reef.lat, reef.lon, ex.lat, ex.lon);
    var normE = normalizeName(ex.name);
    if (normR === normE && dist <= 1.0) return { idx: i, reason: 'name', dist: dist };
    if (dist <= 0.08) {
      var tokens = normR.split(' ');
      var hit = 0;
      for (var t = 0; t < tokens.length; t++) if (tokens[t].length > 2 && normE.indexOf(tokens[t]) >= 0) hit++;
      if (hit >= 2 || (ex.cdfgAppendix && dist <= 0.05)) {
        if (!best || dist < best.dist) best = { idx: i, reason: 'prox', dist: dist };
      }
    }
  }
  return best;
}

function formatFish(reef) {
  var depth = reef.depthFt ? (Math.max(20, reef.depthFt - 20) + '-' + (reef.depthFt + 20) + ' ft') : '40-100 ft';
  var head = "  { name: '" + escJs(reef.name) + "', lat: " + reef.lat + ", lon: " + reef.lon;
  var flags = ['face: ' + guessFace(reef.lat, reef.lon)];
  if (isRegional(reef.lat, reef.lon)) flags.push('regional: true');
  flags.push('cdfgAppendix: true');
  return [
    head + ', ' + flags.join(', ') + ',',
    "    species: ['calico bass', 'sand bass', 'sheephead', 'rockfish'],",
    "    depth: '" + depth + "', habitat: 'CDFG artificial reef modules',",
    "    tactics: 'Official CDFG appendix waypoint; drift modules up-current.',",
    "    bestTide: 'either', bestTime: 'morning', minSstF: 58 }"
  ].join('\n');
}

function formatDive(reef) {
  var id = slugId(reef.name);
  var depth = reef.depthFt || 60;
  var parts = [
    "id: '" + id + "'",
    "name: '" + escJs(reef.name) + "'",
    'lat: ' + reef.lat,
    'lon: ' + reef.lon,
    'face: ' + guessFace(reef.lat, reef.lon),
    'depth: ' + depth,
    'cdfgAppendix: true',
    'boat: true'
  ];
  if (isRegional(reef.lat, reef.lon)) parts.push('regional: true');
  return '    { ' + parts.join(', ') + ' }';
}

function replaceCoordsInObject(text, name, lat, lon, kind) {
  /* Update lat/lon for a named object; ensure cdfgAppendix flag present */
  var esc = escRe(name);
  var re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+");
  if (!re.test(text)) return { text: text, changed: false };
  re.lastIndex = 0;
  text = text.replace(re, '$1' + lat + '$2' + lon);
  /* add cdfgAppendix if missing near this name */
  var nameIdx = text.indexOf("name: '" + name + "'");
  if (nameIdx < 0) nameIdx = text.indexOf('name: "' + name + '"');
  if (nameIdx >= 0) {
    var sliceEnd = text.indexOf('}', nameIdx);
    var slice = text.substring(nameIdx, sliceEnd);
    if (slice.indexOf('cdfgAppendix') < 0) {
      text = text.substring(0, sliceEnd) + ', cdfgAppendix: true' + text.substring(sliceEnd);
    }
  }
  return { text: text, changed: true };
}

function stripPriorCdfgBlock(html, marker) {
  var idx = html.indexOf(marker);
  if (idx < 0) return html;
  var close = html.indexOf('\n];', idx);
  if (close < 0) return html;
  var cut = idx;
  while (cut > 0 && (html.charAt(cut - 1) === ' ' || html.charAt(cut - 1) === '\n' || html.charAt(cut - 1) === '\r' || html.charAt(cut - 1) === ',')) cut--;
  return html.substring(0, cut) + '\n];' + html.substring(close + 3);
}

var data = parseJsonFile('cdfg-artificial-reefs.json');
var reefs = data.reefs;
WScript.Echo('CDFG reefs: ' + reefs.length);

/* —— FISH_SPOTS —— */
var html = readFile('index.html');
html = stripPriorCdfgBlock(html, '  /* —— CDFG Artificial Reef Appendix —— */');
var fish = extractArray(html, 'FISH_SPOTS');
var fishAdded = [], fishUpdated = [], fishKept = [];
var fishNew = [];

for (var i = 0; i < reefs.length; i++) {
  var reef = reefs[i];
  var m = findMatch(reef, fish);
  if (m) {
    var ex = fish[m.idx];
    var distM = Math.round(m.dist * 1852);
    if (ex.lat !== reef.lat || ex.lon !== reef.lon) {
      var rr = replaceCoordsInObject(html, ex.name, reef.lat, reef.lon, 'fish');
      html = rr.text;
      fish[m.idx].lat = reef.lat;
      fish[m.idx].lon = reef.lon;
      fishUpdated.push({ name: ex.name, cdfgName: reef.name, distM: distM, action: 'coords→CDFG DMS' });
    } else {
      var rr2 = replaceCoordsInObject(html, ex.name, reef.lat, reef.lon, 'fish');
      html = rr2.text;
      fishKept.push(ex.name);
    }
    fish[m.idx].cdfgAppendix = true;
  } else {
    fishNew.push(formatFish(reef));
    fish.push({ name: reef.name, lat: reef.lat, lon: reef.lon, cdfgAppendix: true });
    fishAdded.push(reef.name);
  }
}

if (fishNew.length) {
  var fs = html.indexOf('const FISH_SPOTS = [');
  var fc = html.indexOf('\n];', fs);
  html = html.substring(0, fc) + ',\n  /* —— CDFG Artificial Reef Appendix —— */\n' +
    '  /* Official DocumentID=30217 — cdfgAppendix:true, DMS→decimal, no nudges */\n' +
    fishNew.join(',\n') + '\n];' + html.substring(fc + 3);
}

html = html.replace(
  /const FISH_SPOTS = \[\n  \/\*[^*]*\*\//,
  'const FISH_SPOTS = [\n  /* VERIFIED + CDFG appendix (cdfgAppendix) + San Diego KML (kmlImported). See verified-water-pins.json / cdfg-artificial-reefs.json */'
);
writeFile('index.html', html);

/* —— DIVE_SITES —— */
var diveJs = readFile('dive-engine.js');
diveJs = stripPriorCdfgBlock(diveJs, '    /* —— CDFG Artificial Reef Appendix —— */');
/* dive array closes with ]; differently — stripPrior uses \n]; which works */
var dive = extractArray(diveJs, 'DIVE_SITES');
if (!dive) {
  /* try var/const inside IIFE — already const DIVE_SITES */
  throw new Error('DIVE_SITES not parseable');
}
var diveAdded = [], diveUpdated = [];
var diveNew = [];

for (var d = 0; d < reefs.length; d++) {
  var reefD = reefs[d];
  /* Skip far north of typical dive range for King Harbor boat? User said trust appendix — include all. */
  var md = findMatch(reefD, dive);
  if (md) {
    var exD = dive[md.idx];
    if (exD.lat !== reefD.lat || exD.lon !== reefD.lon) {
      var rd = replaceCoordsInObject(diveJs, exD.name, reefD.lat, reefD.lon, 'dive');
      diveJs = rd.text;
      diveUpdated.push({ name: exD.name, cdfgName: reefD.name, action: 'coords→CDFG DMS' });
    } else {
      var rd2 = replaceCoordsInObject(diveJs, exD.name, reefD.lat, reefD.lon, 'dive');
      diveJs = rd2.text;
    }
    dive[md.idx].cdfgAppendix = true;
  } else {
    diveNew.push(formatDive(reefD));
    dive.push({ name: reefD.name, lat: reefD.lat, lon: reefD.lon, cdfgAppendix: true });
    diveAdded.push(reefD.name);
  }
}

if (diveNew.length) {
  var ds = diveJs.indexOf('const DIVE_SITES = [');
  var dc = diveJs.indexOf('\n  ];', ds);
  if (dc < 0) dc = diveJs.indexOf('\n];', ds);
  var closeLen = diveJs.substring(dc, dc + 5).indexOf('];') >= 0 ?
    (diveJs.charAt(dc + 1) === ']' ? 3 : 5) : 3;
  /* find exact ]; after ds */
  var end = diveJs.indexOf('];', ds);
  var before = diveJs.substring(0, end);
  /* trim trailing whitespace/comma issues */
  diveJs = before.replace(/\s*$/, '') + ',\n    /* —— CDFG Artificial Reef Appendix —— */\n' +
    '    /* Official DocumentID=30217 — cdfgAppendix:true */\n' +
    diveNew.join(',\n') + '\n  ];' + diveJs.substring(end + 2);
}

writeFile('dive-engine.js', diveJs);

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

writeFile('import-cdfg-reefs-report.json', jsonStringify({
  policy: 'CDFG appendix inherently trusted; DMS→decimal verbatim; no nudges',
  sourceUrl: data.sourceUrl,
  reefCount: reefs.length,
  fishAdded: fishAdded.length,
  fishUpdated: fishUpdated.length,
  fishAlreadyMatched: fishKept.length,
  diveAdded: diveAdded.length,
  diveUpdated: diveUpdated.length,
  fishAddedNames: fishAdded,
  fishUpdated: fishUpdated,
  diveAddedNames: diveAdded,
  diveUpdated: diveUpdated
}));

WScript.Echo('Fish added: ' + fishAdded.length + ', updated→CDFG: ' + fishUpdated.length);
WScript.Echo('Dive added: ' + diveAdded.length + ', updated→CDFG: ' + diveUpdated.length);
WScript.Echo('Report: import-cdfg-reefs-report.json');

/**
 * Apply pin-trust-review-results.json verdicts (does not invent bulk-yes).
 * - yes: stamp userTrusted; add missing dive/fish with published coords verbatim
 * - no / unsure: remove from live FISH_SPOTS / DIVE_SITES (user override beats inherent KML trust)
 * - Restores prior KML onshore-omits that are not no/unsure (inherent KML trust)
 * Usage: cscript //Nologo apply-pin-trust-yes.js
 */
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

function parseJson(n) {
  var t = readFile(n);
  if (t.charCodeAt(0) === 0xFEFF) t = t.substring(1);
  return eval('(' + t + ')');
}

function escJs(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

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

function haversineNm(lat1, lon1, lat2, lon2) {
  var R = 3440.065, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

function stampUserTrusted(text, name, lat, lon) {
  var esc = escRe(name);
  /* Source may escape apostrophes as \' inside single-quoted names */
  var escSrc = escRe(String(name).replace(/'/g, "\\'"));
  var nameAlts = [esc];
  if (escSrc !== esc) nameAlts.push(escSrc);
  var changed = false;
  for (var ai = 0; ai < nameAlts.length; ai++) {
    var namePat = nameAlts[ai];
    var re = new RegExp("(name:\\s*'" + namePat + "'[^\\}]{0,400}?lat:\\s*)" +
      String(lat).replace('.', '\\.') + "(\\s*,\\s*lon:\\s*)" +
      String(lon).replace('.', '\\.') + "([^\\}]*)(\\})", 'm');
    if (!re.test(text)) {
      re = new RegExp("(name:\\s*'" + namePat + "'[^\\}]{0,500}?)(\\})", 'm');
      if (!re.test(text)) continue;
      re.lastIndex = 0;
      text = text.replace(re, function (m, body, close) {
        if (/userTrusted\s*:\s*true/.test(body)) return m;
        changed = true;
        return body.replace(/\s*$/, '') + ', userTrusted: true' + close;
      });
      if (changed) return { text: text, changed: true };
      continue;
    }
    re.lastIndex = 0;
    text = text.replace(re, function (m, a, b, mid, close) {
      if (/userTrusted\s*:\s*true/.test(mid)) return m;
      changed = true;
      return a + lat + b + lon + mid.replace(/\s*$/, '') + ', userTrusted: true' + close;
    });
    if (changed) return { text: text, changed: true };
  }
  return { text: text, changed: false };
}

/** Remove a fish object matching name + lat (tolerant of formatting / userTrusted). */
function removeFishByNameLat(html, name, lat) {
  var re = new RegExp(
    ",?\\r?\\n  \\{ name: '" + escRe(name) + "', lat: " + String(lat).replace('.', '\\.') +
    "[\\s\\S]*?minSstF: 58(?:,\\s*userTrusted:\\s*true)?\\s*\\}"
  );
  if (!re.test(html)) return { text: html, removed: false };
  return { text: html.replace(re, ''), removed: true };
}

/** Remove a dive object matching name (and preferably lat). */
function removeDiveByNameLat(js, name, lat) {
  var latPart = (lat != null && isFinite(lat))
    ? "[\\s\\S]{0,120}?lat:\\s*" + String(lat).replace('.', '\\.')
    : '';
  var re = new RegExp(
    ",?\\r?\\n\\s*\\{[^\\n]*name:\\s*'" + escRe(name) + "'" + latPart + "[^\\}]*\\}"
  );
  if (!re.test(js)) {
    /* looser: name only */
    re = new RegExp(",?\\r?\\n\\s*\\{[^\\n]*name:\\s*'" + escRe(name) + "'[^\\}]*\\}");
    if (!re.test(js)) return { text: js, removed: false };
  }
  return { text: js.replace(re, ''), removed: true };
}

function hasNameNear(arr, name, lat, lon, nm) {
  for (var i = 0; i < arr.length; i++) {
    var s = arr[i];
    if (!s || s.name == null) continue;
    if (String(s.name) !== String(name)) continue;
    if (haversineNm(s.lat, s.lon, lat, lon) <= (nm || 0.05)) return true;
  }
  return false;
}

function formatFishRestored(sp) {
  return [
    "  { name: '" + escJs(sp.name) + "', lat: " + sp.lat + ", lon: " + sp.lon +
      ", kmlImported: true, userTrusted: true,",
    "    species: ['calico bass', 'sand bass', 'bonito', 'rockfish'],",
    "    depth: '30-120 ft', habitat: 'Offshore fishing grounds',",
    "    tactics: 'San Diego Fishing Spots.kml — user-trusted / inherent KML chart.',",
    "    bestTide: 'incoming', bestTime: 'dawn', minSstF: 58 }"
  ].join('\n');
}

function diveMeta(row) {
  /* Published depths / faces from pin-trust-extra / archive notes */
  var id = row.id || '';
  var depth = 50, face = 250, boat = true;
  if (id === 'pv_portuguesepoint') { depth = 35; face = 220; boat = false; }
  else if (id === 'pv_neptunearch') { depth = 28; face = 210; boat = false; }
  else if (id === 'pv_halfwayreef') { depth = 72; face = 220; }
  else if (id === 'pv_jennylynne') { depth = 145; face = 210; }
  else if (id === 'pv_kevinsreef') { depth = 75; face = 215; }
  else if (id === 'pv_resortpointwall') { depth = 70; face = 225; }
  else if (id === 'pv_thecrane') { depth = 45; face = 250; }
  return { depth: depth, face: face, boat: boat };
}

function formatDiveAdd(row) {
  var m = diveMeta(row);
  var id = String(row.id || ('ut_' + String(row.name).toLowerCase().replace(/[^a-z0-9]+/g, '').substring(0, 24)));
  var parts = [
    "id: '" + escJs(id) + "'",
    "name: '" + escJs(row.name) + "'",
    'lat: ' + row.lat,
    'lon: ' + row.lon,
    'face: ' + m.face,
    'depth: ' + m.depth
  ];
  if (m.boat) parts.push('boat: true');
  parts.push('userTrusted: true');
  return '    { ' + parts.join(', ') + ' }';
}

function formatFishAdd(row) {
  var flags = "userTrusted: true";
  if (/kml/i.test(row.trustClass || '') || /San Diego Fishing Spots\.kml/i.test(row.source || '')) {
    flags = "kmlImported: true, userTrusted: true";
  }
  return [
    "  { name: '" + escJs(row.name) + "', lat: " + row.lat + ", lon: " + row.lon + ", " + flags + ",",
    "    species: ['calico bass', 'sand bass', 'bonito', 'rockfish'],",
    "    depth: '30-120 ft', habitat: 'User-trusted water target',",
    "    tactics: 'Pin-trust review yes — published coords unchanged.',",
    "    bestTide: 'incoming', bestTime: 'dawn', minSstF: 58 }"
  ].join('\n');
}

// --- main ---
var resultsDoc = parseJson('pin-trust-review-results.json');
var results = resultsDoc.results || [];
var yes = [], no = [], unsure = [];
for (var i = 0; i < results.length; i++) {
  var v = String(results[i].verdict || '').toLowerCase();
  if (v === 'yes') yes.push(results[i]);
  else if (v === 'no') no.push(results[i]);
  else if (v === 'unsure') unsure.push(results[i]);
}

var exclude = no.concat(unsure);
writeFile('pin-trust-live-exclusions.json', jsonStringify({
  note: 'Pins excluded from live maps by pin-trust no/unsure (overrides inherent KML trust).',
  no: no,
  unsure: unsure,
  excludeNames: (function () {
    var a = []; for (var e = 0; e < exclude.length; e++) a.push(exclude[e].name);
    return a;
  })()
}));

var html = readFile('index.html');
var diveJs = readFile('dive-engine.js');
var fishArr = extractArray(html, 'FISH_SPOTS') || [];
var diveArr = extractArray(diveJs, 'DIVE_SITES') || [];

var fishStamped = 0, diveStamped = 0, fishAdded = 0, diveAdded = 0;
var fishRemoved = 0, diveRemoved = 0, restored = 0;
var missing = [], yesNames = [];

/* Remove no / unsure from live lists first — kind-scoped so dive Windansea
   unsure does not delete fish Windansea yes (same name/lat). */
for (var x = 0; x < exclude.length; x++) {
  var ex = exclude[x];
  var kind = String(ex.kind || '').toLowerCase();
  if (kind !== 'dive') {
    var rf = removeFishByNameLat(html, ex.name, ex.lat);
    html = rf.text;
    if (rf.removed) fishRemoved++;
    /* Fish no/unsure: also drop non-verified dive syncs of same name/coords.
       Keep dual-source verified dives (e.g. Goat Harbor — Catalina). */
    diveArr = extractArray(diveJs, 'DIVE_SITES') || [];
    for (var di = 0; di < diveArr.length; di++) {
      var ds = diveArr[di];
      if (!ds || !ds.name) continue;
      if (ds.verified) continue;
      if (String(ds.name) !== String(ex.name)) continue;
      if (haversineNm(ds.lat, ds.lon, ex.lat, ex.lon) > 0.15) continue;
      var rdSync = removeDiveByNameLat(diveJs, ds.name, ds.lat);
      diveJs = rdSync.text;
      if (rdSync.removed) diveRemoved++;
    }
  }
  if (kind !== 'fish') {
    var rd = removeDiveByNameLat(diveJs, ex.name, ex.lat);
    diveJs = rd.text;
    if (rd.removed) diveRemoved++;
    /* Dive no/unsure: drop fish copy of same name/coords unless fish has yes.
       Protects Windansea fish-yes when dive is unsure; clears Barn Kelp fish
       when dive Barn Kelp is no (overrides inherent KML for that placemark). */
    var fishHasYes = false;
    for (var fy = 0; fy < yes.length; fy++) {
      if (String(yes[fy].kind || '').toLowerCase() === 'dive') continue;
      if (String(yes[fy].name) === String(ex.name)) { fishHasYes = true; break; }
    }
    if (!fishHasYes) {
      var rfDive = removeFishByNameLat(html, ex.name, ex.lat);
      html = rfDive.text;
      if (rfDive.removed) fishRemoved++;
    }
  }
  /* Also strip any dive synced under near-identical coords/name variants */
  if (/Vicente Outside Rock/i.test(ex.name)) {
    var rd2 = removeDiveByNameLat(diveJs, 'Vicente Outside Rock 80ft', 33.7388);
    diveJs = rd2.text;
    if (rd2.removed) diveRemoved++;
    var rf2 = removeFishByNameLat(html, 'Vicente Outside Rock 80ft', 33.7388);
    html = rf2.text;
    if (rf2.removed) fishRemoved++;
  }
}

/* Refresh arrays after removals */
fishArr = extractArray(html, 'FISH_SPOTS') || [];
diveArr = extractArray(diveJs, 'DIVE_SITES') || [];

var diveAddLines = [];
var fishAddLines = [];

for (var y = 0; y < yes.length; y++) {
  var row = yes[y];
  yesNames.push(row.name);
  if (row.kind === 'dive') {
    var sd = stampUserTrusted(diveJs, row.name, row.lat, row.lon);
    diveJs = sd.text;
    if (sd.changed) diveStamped++;
    if (!hasNameNear(diveArr, row.name, row.lat, row.lon, 0.05)) {
      diveAddLines.push(formatDiveAdd(row));
      diveArr.push({ name: row.name, lat: row.lat, lon: row.lon, userTrusted: true });
      diveAdded++;
    }
  } else {
    var sf = stampUserTrusted(html, row.name, row.lat, row.lon);
    html = sf.text;
    if (sf.changed) fishStamped++;
    if (!hasNameNear(fishArr, row.name, row.lat, row.lon, 0.05)) {
      /* Missing from live (e.g. collateral remove or never promoted) — add with yes coords */
      fishAddLines.push(formatFishAdd(row));
      fishArr.push({ name: row.name, lat: row.lat, lon: row.lon });
      fishAdded++;
    } else if (!sf.changed) {
      /* Try stamp by name only if coords already present under slightly different formatting */
      var loose = stampUserTrusted(html, row.name, row.lat, row.lon);
      html = loose.text;
      if (loose.changed) fishStamped++;
      else missing.push('fish:' + row.name);
    }
  }
}

if (diveAddLines.length) {
  var dend = diveJs.indexOf('];', diveJs.indexOf('const DIVE_SITES = ['));
  diveJs = diveJs.substring(0, dend).replace(/\s*$/, '') +
    ',\n    /* —— Pin-trust yes dive promotes (coords verbatim) —— */\n' +
    diveAddLines.join(',\n') + '\n  ];' + diveJs.substring(dend + 2);
}

if (fishAddLines.length) {
  var fs = html.indexOf('const FISH_SPOTS = [');
  var fend = html.indexOf('\n];', fs);
  html = html.substring(0, fend) + ',\n  /* —— Pin-trust yes fish promotes —— */\n' +
    fishAddLines.join(',\n') + '\n];' + html.substring(fend + 3);
}

/* Restore previously omitted KML spots that are not no/unsure */
var omitDoc = null;
try { omitDoc = parseJson('kml-onshore-omitted.json'); } catch (e1) { omitDoc = { omitted: [], restored: [] }; }
var toRestore = [];
var omitList = (omitDoc.omitted && omitDoc.omitted.length) ? omitDoc.omitted :
  (omitDoc.restored || []);
function isExcludedNameLat(name, lat, lon) {
  for (var e = 0; e < exclude.length; e++) {
    if (String(exclude[e].name) === String(name) &&
        haversineNm(exclude[e].lat, exclude[e].lon, lat, lon) < 0.05) return true;
  }
  return false;
}
fishArr = extractArray(html, 'FISH_SPOTS') || [];
for (var o = 0; o < omitList.length; o++) {
  var om = omitList[o];
  if (!om || !om.name) continue;
  if (isExcludedNameLat(om.name, om.lat, om.lon)) continue;
  if (hasNameNear(fishArr, om.name, om.lat, om.lon, 0.05)) {
    var rr = stampUserTrusted(html, om.name, om.lat, om.lon);
    html = rr.text;
    continue;
  }
  toRestore.push(om);
}
if (toRestore.length) {
  var block = [];
  for (var t = 0; t < toRestore.length; t++) {
    block.push(formatFishRestored(toRestore[t]));
    restored++;
  }
  var fs2 = html.indexOf('const FISH_SPOTS = [');
  var end2 = html.indexOf('\n];', fs2);
  html = html.substring(0, end2) + ',\n  /* —— Inherent-KML restored (was onshore-omit) —— */\n' +
    block.join(',\n') + '\n];' + html.substring(end2 + 3);
}

html = html.replace(
  /const FISH_SPOTS = \[\n  \/\*[^*]*\*\//,
  'const FISH_SPOTS = [\n  /* VERIFIED + CDFG + inherent KML + userTrusted. See pin-trust-review-results.json */'
);

writeFile('index.html', html);
writeFile('dive-engine.js', diveJs);
writeFile('kml-onshore-omitted.json', jsonStringify({
  note: 'Inherent KML trust: onshore-model fails do not omit San Diego Fishing Spots.kml placemarks. User no/unsure overrides live display (see pin-trust-live-exclusions.json).',
  count: 0,
  omitted: [],
  restoredThisRun: toRestore
}));

WScript.Echo('Yes applied: ' + yes.length);
WScript.Echo('No excluded: ' + no.length);
WScript.Echo('Unsure excluded: ' + unsure.length);
WScript.Echo('Fish stamped userTrusted: ' + fishStamped);
WScript.Echo('Dive stamped userTrusted: ' + diveStamped);
WScript.Echo('Fish added: ' + fishAdded);
WScript.Echo('Dive added: ' + diveAdded);
WScript.Echo('Fish removed (no/unsure): ' + fishRemoved);
WScript.Echo('Dive removed (no/unsure): ' + diveRemoved);
WScript.Echo('Restored omitted KML: ' + restored);
if (missing.length) {
  WScript.Echo('Stamp misses: ' + missing.length);
  for (var m = 0; m < missing.length && m < 20; m++) WScript.Echo('  ' + missing[m]);
}
WScript.Echo('Wrote pin-trust-live-exclusions.json');

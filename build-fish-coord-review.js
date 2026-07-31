// Build fish-coord-review-data.js + fish-coord-review.json from FISH_SPOTS audit.
// Run: cscript //Nologo build-fish-coord-review.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;

function extractArray(src, name) {
  var marker = 'const ' + name + ' = [';
  var start = src.indexOf(marker);
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
  var body = src.substring(start, i - 1);
  try { return eval('[' + body + ']'); } catch (e) { WScript.Echo('ERROR parsing ' + name + ': ' + e.message); return null; }
}

function haversineM(a, b) {
  var R = 6371000, d2r = Math.PI / 180;
  var dlat = (b.lat - a.lat) * d2r, dlon = (b.lon - a.lon) * d2r;
  var la = a.lat * d2r, lb = b.lat * d2r;
  var h = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function analyzeCoastAccuracy() {
  var SLIP = { lat: 33.8481667, lon: -118.3963333 };
  var RADIUS_100NM_M = 100 * 1852;
  var FT50 = 15.24;
  var lines = COAST_GEO.lines || [];
  var islands = COAST_GEO.islands || [];
  var linePts = 0, islandPts = 0, landPts = 0;
  var maxSegM = 0, maxSegInfo = '';
  var pvMaxM = 0, pvMaxInfo = '';
  var pvSegs = 0, pvOver10ft = 0;
  var nm100Segs = 0, nm100Over50ft = 0, nm100MaxM = 0, nm100MaxInfo = '';
  var FT10 = 3.048;

  function within100Nm(p) {
    return haversineM(SLIP, p) <= RADIUS_100NM_M;
  }
  function segmentWithin100Nm(a, b) {
    if (within100Nm(a) || within100Nm(b)) return true;
    return within100Nm({ lat: a.lat + (b.lat - a.lat) * 0.5, lon: a.lon + (b.lon - a.lon) * 0.5 });
  }
  function segBothWithin100Nm(a, b) {
    return within100Nm(a) && within100Nm(b);
  }

  function scanSegs(pts, label) {
    for (var i = 0; i < pts.length - 1; i++) {
      var d = haversineM(pts[i], pts[i + 1]);
      if (d > maxSegM) { maxSegM = d; maxSegInfo = label + ' seg ' + i + ' ' + d.toFixed(2) + 'm'; }
      var a = pts[i], b = pts[i + 1];
      if (segmentWithin100Nm(a, b)) {
        nm100Segs++;
        if (d > nm100MaxM) { nm100MaxM = d; nm100MaxInfo = label + ' ' + d.toFixed(2) + 'm'; }
        if (d > FT50) nm100Over50ft++;
      }
      if (a.lat >= 33.68 && a.lat <= 33.84 && a.lon >= -118.48 && a.lon <= -118.28) {
        pvSegs++;
        if (d > pvMaxM) { pvMaxM = d; pvMaxInfo = label + ' ' + d.toFixed(2) + 'm'; }
        if (d > FT10) pvOver10ft++;
      }
    }
  }

  for (var li = 0; li < lines.length; li++) {
    var line = lines[li];
    if (!line) continue;
    var pts = line.pts || line;
    if (!pts || !pts.length) continue;
    linePts += pts.length;
    scanSegs(pts, line.name || ('line' + li));
  }
  for (var ii = 0; ii < islands.length; ii++) {
    var isle = islands[ii];
    if (!isle) continue;
    var ipts = isle.pts || [];
    if (!ipts.length) continue;
    islandPts += ipts.length;
  }
  var land = COAST_GEO.land || [];
  for (var lj = 0; lj < land.length; lj++) {
    if (land[lj].pts) landPts += land[lj].pts.length;
  }

  var nm100Meets50ft = nm100Over50ft === 0;
  var hasBadJump = maxSegM > 10000;
  return {
    lineCount: lines.length,
    linePts: linePts,
    islandCount: islands.length,
    islandPts: islandPts,
    landCount: land.length,
    landPts: landPts,
    maxSegM: Math.round(maxSegM * 100) / 100,
    maxSegInfo: maxSegInfo,
    pvMaxSegM: Math.round(pvMaxM * 100) / 100,
    pvMaxSegInfo: pvMaxInfo,
    pvSegCount: pvSegs,
    pvSegsOver10ft: pvOver10ft,
    pvMeets10ft: pvOver10ft === 0,
    nm100SegCount: nm100Segs,
    nm100MaxSegM: Math.round(nm100MaxM * 100) / 100,
    nm100MaxSegInfo: nm100MaxInfo,
    nm100SegsOver50ft: nm100Over50ft,
    nm100Meets50ft: nm100Meets50ft,
    hasBadJump: hasBadJump,
    source: 'OpenStreetMap coastline via fetch-coast.mjs; densified within 100 NM of Port Royal slip (25 ft step, 50 ft max)',
    note: nm100Meets50ft
      ? 'Coast segments within 100 NM of slip are all <= 50 ft (max ' + Math.round(nm100MaxM * 3.281) + ' ft). Suitable for nearshore fish-spot audit.'
      : 'Within 100 NM of slip: ' + nm100Over50ft + ' of ' + nm100Segs + ' segments exceed 50 ft (worst ' +
        Math.round(nm100MaxM * 3.281) + ' ft in ' + nm100MaxInfo + ').' +
        (hasBadJump ? ' Also: spurious ~' + Math.round(maxSegM / 1852) + ' NM jump — run fix-coast-pv-fast.js.' : '')
  };
}

function spotRegion(lat, lon) {
  if (LA.isPVPeninsula(lat, lon) || (lat >= 33.68 && lat <= 33.84 && lon >= -118.48 && lon <= -118.28)) return 'PV';
  if (lat >= 32.4 && lat <= 33.15 && lon >= -117.55 && lon <= -117.0) return 'SD';
  if (lat >= 33.15 && lat <= 33.95 && lon >= -118.55 && lon <= -117.55) return 'LA_OC';
  if (lat >= 32.85 && lat <= 33.15 && lon >= -118.65 && lon <= -118.30) return 'CATALINA';
  return 'OTHER';
}

function isKmlImported(spot) {
  var t = spot.tactics || '';
  return t.indexOf('SWYC/San Diego chart spot') >= 0;
}

function isoNow() {
  var d = new Date();
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()) + 'T' +
    p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ':' + p2(d.getUTCSeconds()) + 'Z';
}
function jsonStringify(v, indent) {
  if (typeof JSON !== 'undefined' && JSON.stringify) return JSON.stringify(v, null, indent || 0);
  function ser(o, d) {
    if (o === null) return 'null';
    var tp = typeof o;
    if (tp === 'number' || tp === 'boolean') return String(o);
    if (tp === 'string') return '"' + String(o).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"';
    if (Object.prototype.toString.call(o) === '[object Array]') {
      var a = [], nl = indent ? '\n' + Array(d + 1).join('  ') : '';
      for (var i = 0; i < o.length; i++) a.push((indent ? nl : '') + ser(o[i], d + 1));
      return '[' + a.join(indent ? ',' : ',') + (indent && o.length ? '\n' + Array(d).join('  ') : '') + ']';
    }
    var p = [], nl2 = indent ? '\n' + Array(d + 1).join('  ') : '';
    for (var k in o) if (o.hasOwnProperty(k)) p.push((indent ? nl2 : '') + '"' + k + '":' + (indent ? ' ' : '') + ser(o[k], d + 1));
    return '{' + p.join(indent ? ',' : ',') + (indent && p.length ? '\n' + Array(d).join('  ') : '') + '}';
  }
  return ser(v, 0);
}

var dashSrc = readFile('index.html');
var FISH_SPOTS = extractArray(dashSrc, 'FISH_SPOTS');
if (!FISH_SPOTS) { WScript.Echo('ERROR: could not parse FISH_SPOTS'); WScript.Quit(1); }

function isWatchSpot(sp, audit, loc) {
  if (audit.verdict === 'FIX') return false;
  if (!LA.isPVPeninsula(sp.lat, sp.lon)) return false;
  if (loc.distM > 1200) return false;
  if (loc.eastM < -450) return false;
  if (loc.eastM > 50) return true;
  return loc.eastM > -400 && loc.distM < 1000;
}

var coastAcc = analyzeCoastAccuracy();
var rows = [], suspects = [], watch = [];
for (var fi = 0; fi < FISH_SPOTS.length; fi++) {
  var sp = FISH_SPOTS[fi];
  var audit = LA.auditItem(sp, 'FISH_SPOTS');
  var locDetail = LA.localEastM(sp.lat, sp.lon);
  var row = {
    idx: fi,
    id: sp.id || sp.name,
    name: sp.name,
    lat: sp.lat,
    lon: sp.lon,
    face: sp.face || 270,
    region: spotRegion(sp.lat, sp.lon),
    kmlImported: isKmlImported(sp),
    onLand: audit.onLand,
    mEast: audit.mEast,
    localEastM: audit.localEast,
    localDistM: locDetail.distM,
    bluff: audit.bluff,
    onIsle: audit.onIsle || '',
    verdict: audit.verdict,
    why: audit.why,
    watch: isWatchSpot(sp, audit, locDetail),
    watchWhy: isWatchSpot(sp, audit, locDetail)
      ? 'PV bluff zone — audit OK but coast-geo may be wrong; verify on Esri satellite'
      : '',
    sugLat: audit.sugLat,
    sugLon: audit.sugLon,
    sugPush: audit.sugPush,
    sugNote: 'Algorithmic suggestion only — not authoritative. Verify on satellite before editing FISH_SPOTS.'
  };
  rows.push(row);
  if (audit.verdict === 'FIX') suspects.push(row);
  else if (row.watch) watch.push(row);
}

suspects.sort(function (a, b) {
  return (b.localEastM || 0) - (a.localEastM || 0);
});
watch.sort(function (a, b) {
  return (b.localEastM || 0) - (a.localEastM || 0);
});

var report = {
  generated: isoNow(),
  total: rows.length,
  suspectCount: suspects.length,
  watchCount: watch.length,
  coastAccuracy: coastAcc,
  home: { lat: 33 + 50 / 60 + 53.4 / 3600, lon: -(118 + 23 / 60 + 46.8 / 3600), name: 'Port Royal, King Harbor' },
  rows: rows,
  suspects: suspects,
  watch: watch
};

var jsonPath = root + '\\fish-coord-review.json';
var jsPath = root + '\\fish-coord-review-data.js';
var jsonOut = fso.CreateTextFile(jsonPath, true);
jsonOut.Write(jsonStringify(report, 2));
jsonOut.Close();

var jsOut = fso.CreateTextFile(jsPath, true);
jsOut.Write('/* Generated by build-fish-coord-review.js — do not edit by hand */\n');
jsOut.Write('var FISH_COORD_REVIEW = ');
jsOut.Write(jsonStringify(report, 2));
jsOut.Write(';\n');
jsOut.Close();

WScript.Echo('FISH_SPOTS: ' + rows.length + ' total, ' + suspects.length + ' suspect');
WScript.Echo('Coast line pts: ' + coastAcc.linePts + ' | within100Nm max seg: ' + coastAcc.nm100MaxSegM + 'm (' + coastAcc.nm100MaxSegInfo + ')');
WScript.Echo('Within 100NM meets 50ft: ' + (coastAcc.nm100Meets50ft ? 'YES' : 'NO — ' + coastAcc.nm100SegsOver50ft + ' segments over'));
WScript.Echo('Wrote fish-coord-review.json');
WScript.Echo('Wrote fish-coord-review-data.js');

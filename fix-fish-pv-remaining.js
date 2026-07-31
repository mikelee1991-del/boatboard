// DISABLED 2026-07-27 — DO NOT RUN for production coords (no nudge/suggestOffshore applies).
WScript.Echo('REFUSED: fix-fish-pv-remaining.js is disabled (no coordinate nudges).');
WScript.Quit(1);
/* legacy
// Suggest + apply offshore fixes for scan-fish-onshore failures.
// Skips CDFG Artificial Reef names (authoritative). cscript //Nologo fix-fish-pv-remaining.js
*/
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;

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

function strictOnshore(lat, lon) {
  var oi = LA.onIsland(lat, lon);
  if (oi) return { fail: true, why: 'islandLand ' + oi };
  if (LA.isOnLand(lat, lon)) return { fail: true, why: 'isOnLand' };
  var loc = LA.localEastM(lat, lon);
  if (loc.distM < 2500 && loc.eastM > 50) return { fail: true, why: 'localEast+' + loc.eastM, loc: loc };
  if (LA.isEastOfShoreline(lat, lon) && !LA.isOCGap(lat, lon) && !LA.isSPBay(lat, lon)) {
    return { fail: true, why: 'eastOfShoreline', loc: loc };
  }
  var isPV = lat >= 33.68 && lat <= 33.84 && lon >= -118.44 && lon <= -118.32 && !(lat >= 33.70 && lat <= 33.78 && lon >= -118.26 && lon <= -118.05);
  var isBluffCoast = isPV || (lat >= 33.80 && lat <= 34.05 && lon >= -118.55 && lon <= -118.35);
  if (isBluffCoast && loc.distM < 800 && loc.eastM > -180) {
    return { fail: true, why: 'bluffPV dist=' + loc.distM + ' east=' + loc.eastM, loc: loc };
  }
  if (loc.distM < 350 && loc.eastM > -150) {
    return { fail: true, why: 'nearCoast dist=' + loc.distM + ' east=' + loc.eastM, loc: loc };
  }
  var me = Math.round(LA.metersEastOfShoreline(lat, lon));
  if (me > 50 && !LA.isOCGap(lat, lon) && !LA.isSPBay(lat, lon)) {
    return { fail: true, why: 'mEast+' + me, loc: loc };
  }
  return { fail: false, loc: loc };
}

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function replaceFish(src, name, oldLat, oldLon, newLat, newLon) {
  var re = new RegExp(
    '(name:\\s*[\'"]' + escapeRe(name) + '[\'"][\\s\\S]{0,240}?lat:\\s*)' +
      escapeRe(String(oldLat)) + '(\\s*,\\s*lon:\\s*)' + escapeRe(String(oldLon)),
    'm'
  );
  if (!re.test(src)) return { src: src, ok: false };
  return {
    src: src.replace(re, '$1' + LA.fmt7(newLat) + '$2' + LA.fmt7(newLon)),
    ok: true
  };
}

var html = readFile('index.html');
var FISH = extractArray(html, 'FISH_SPOTS') || [];
var fixed = 0, skippedReef = 0, nofix = 0;

for (var i = 0; i < FISH.length; i++) {
  var s = FISH[i];
  if (LA.isFarOffshoreFish(s.lat, s.lon)) continue;
  if (/Artificial Reef/i.test(s.name || '')) { skippedReef++; continue; }
  var r = strictOnshore(s.lat, s.lon);
  if (!r.fail) continue;

  var face = s.face || 270;
  var sug = LA.nudgeOffshore(s.lat, s.lon, face) || LA.suggestOffshore(s.lat, s.lon, face);
  if (!sug) {
    // Force west push for stubborn PV/SP coast-geo false land
    var best = null;
    for (var d = 200; d <= 5000; d += 100) {
      var p = LA.destPt(s.lat, s.lon, 270, d);
      if (LA.onIsland(p.lat, p.lon)) continue;
      if (strictOnshore(p.lat, p.lon).fail) continue;
      best = { lat: LA.fmt7(p.lat), lon: LA.fmt7(p.lon), pushM: d, dir: 270 };
      break;
    }
    sug = best;
  }
  if (!sug) {
    nofix++;
    WScript.Echo('NOFIX ' + s.name + ' | ' + s.lat + ',' + s.lon + ' | ' + r.why);
    continue;
  }
  var check = strictOnshore(sug.lat, sug.lon);
  if (check.fail) {
    nofix++;
    WScript.Echo('STILLBAD ' + s.name + ' -> ' + sug.lat + ',' + sug.lon + ' | ' + check.why);
    continue;
  }
  var rep = replaceFish(html, s.name, s.lat, s.lon, sug.lat, sug.lon);
  if (!rep.ok) {
    nofix++;
    WScript.Echo('REPLACEFAIL ' + s.name);
    continue;
  }
  html = rep.src;
  fixed++;
  WScript.Echo('FIX ' + s.name + ' | ' + s.lat + ',' + s.lon + ' -> ' + sug.lat + ',' + sug.lon +
    ' (+' + sug.pushM + 'm @' + sug.dir + ') | was ' + r.why);
}

writeFile('index.html', html);
WScript.Echo('');
WScript.Echo('Fixed: ' + fixed + '  skippedReef: ' + skippedReef + '  nofix: ' + nofix);
if (nofix) WScript.Quit(1);

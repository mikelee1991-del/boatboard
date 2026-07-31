// Strict onshore scan for FISH_SPOTS — cscript //Nologo scan-fish-onshore.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }

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

function namedFishGeoFail(site) {
  var lat = site.lat, lon = site.lon, n = site.name || '';
  if (/Valiant/i.test(n) && !(lat >= 33.348 && lat <= 33.355 && lon >= -118.330 && lon <= -118.320)) {
    return 'valiantMustBeDescansoBayAvalon';
  }
  if (/Descanso Beach.*Avalon/i.test(n) && !(lat >= 33.349 && lat <= 33.355 && lon >= -118.330 && lon <= -118.320)) {
    return 'descansoMustBeAvalonBayN';
  }
  if (/Malaga Cove/i.test(n) && !(lat >= 33.798 && lat <= 33.815 && lon <= -118.397 && lon >= -118.420)) {
    return 'northPvMalagaBand';
  }
  if (/Haggerty/i.test(n) && !/Crane|Golf Ball/i.test(n) &&
      !(lat >= 33.798 && lat <= 33.810 && lon <= -118.400 && lon >= -118.420)) {
    return 'haggertyMustBeNorthPv';
  }
  if (/^Bluff Cove kelp/i.test(n) && !(lat >= 33.788 && lat <= 33.798 && lon <= -118.405 && lon >= -118.420)) {
    return 'bluffCoveMustBeNorthPv';
  }
  if (/Corona del Mar/i.test(n) && !(lat >= 33.588 && lat <= 33.594 && lon <= -117.870 && lon >= -117.885)) {
    return 'coronaMustBeOffshoreCdM';
  }
  if (/The Crane — Haggerty/i.test(n) && !(lat >= 33.800 && lat <= 33.810 && lon <= -118.405 && lon >= -118.415)) {
    return 'craneMustBeHaggertyOffshore';
  }
  return '';
}

function strictOnshore(site) {
  var lat = site.lat, lon = site.lon;
  /* CDFG artificial reefs — authoritative chart coords (Malibu phantom used to false-flag these). */
  if (/Artificial Reef/i.test(site.name || '')) return { fail: false, loc: LA.localEastM(lat, lon) };
  /* Inherent trust: KML / verified / CDFG / userTrusted — display as-is, never nudge */
  if (site.kmlImported || site.verified || site.userTrusted || site.cdfgAppendix) {
    return { fail: false, loc: LA.localEastM(lat, lon) };
  }
  var namedWhy = namedFishGeoFail(site);
  if (namedWhy) return { fail: true, why: namedWhy };
  var oi = LA.onIsland(lat, lon);
  if (oi) return { fail: true, why: 'islandLand ' + oi };
  if (LA.isSPBay(lat, lon)) return { fail: false, loc: LA.localEastM(lat, lon) };
  if (LA.isOnLand(lat, lon)) return { fail: true, why: 'isOnLand' };
  var loc = LA.localEastM(lat, lon);
  /* PV: use west-shore seaward meters — pv-* localEastM normals are flipped. */
  var pvSea = LA.pvSeawardM(lat, lon);
  if (pvSea != null && lon <= -118.32) {
    if (pvSea < 120) {
      return { fail: true, why: 'bluffPV sea=' + Math.round(pvSea), loc: loc, pvSea: pvSea };
    }
    return { fail: false, loc: loc, pvSea: pvSea };
  }
  if (loc.distM < 2500 && loc.eastM > 50) return { fail: true, why: 'localEast+' + loc.eastM, loc: loc };
  if (LA.isEastOfShoreline(lat, lon) && !LA.isOCGap(lat, lon) && !LA.isSPBay(lat, lon)) {
    return { fail: true, why: 'eastOfShoreline', loc: loc };
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

var FISH_SPOTS = extractArray(readFile('index.html'), 'FISH_SPOTS');
var fails = [], pvFails = [];

for (var i = 0; i < FISH_SPOTS.length; i++) {
  var s = FISH_SPOTS[i];
  if (LA.isFarOffshoreFish(s.lat, s.lon)) continue;
  var r = strictOnshore(s);
  if (!r.fail) continue;
  var row = { name: s.name, lat: s.lat, lon: s.lon, why: r.why, loc: r.loc || LA.localEastM(s.lat, s.lon) };
  fails.push(row);
  if (s.lat >= 33.68 && s.lat <= 33.84 && s.lon >= -118.44 && s.lon <= -118.26) pvFails.push(row);
}

WScript.Echo('FISH_SPOTS total: ' + FISH_SPOTS.length);
WScript.Echo('Strict onshore FAIL: ' + fails.length);
WScript.Echo('PV peninsula FAIL: ' + pvFails.length);
WScript.Echo('');
WScript.Echo('--- PV peninsula failures ---');
for (var p = 0; p < pvFails.length; p++) {
  var f = pvFails[p];
  WScript.Echo(f.name + ' | ' + f.lat + ',' + f.lon + ' | ' + f.why + ' | dist=' + f.loc.distM + ' east=' + f.loc.eastM);
}
WScript.Echo('');
WScript.Echo('--- Other failures ---');
for (var o = 0; o < fails.length; o++) {
  var x = fails[o];
  if (x.lat >= 33.68 && x.lat <= 33.84 && x.lon >= -118.44 && x.lon <= -118.26) continue;
  WScript.Echo(x.name + ' | ' + x.lat + ',' + x.lon + ' | ' + x.why);
}

if (fails.length > 0) WScript.Quit(1);

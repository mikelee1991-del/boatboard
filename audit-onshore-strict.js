// Strict onshore audit — ignores OC/SD gap exemptions for FISH_SPOTS
// Run: cscript //Nologo audit-onshore-strict.js
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
  return eval('[' + src.substring(start, i - 1) + ']');
}

function strictFishNeedsFix(lat, lon, face) {
  var oi = LA.onIsland(lat, lon);
  if (oi) return { why: 'islandLand ' + oi };
  var loc = LA.localEastM(lat, lon);
  var onLand = LA.isOnLand(lat, lon);
  var likelyWater = LA.isLikelyOnWater(lat, lon);
  var east = LA.isEastOfShoreline(lat, lon);
  var me = Math.round(LA.metersEastOfShoreline(lat, lon));

  if (loc.distM < 2500 && loc.eastM > 50) {
    return { why: 'inland localEast+' + loc.eastM + ' dist=' + loc.distM };
  }
  if (onLand) {
    if (loc.eastM < -400) return null;
    if (me < -2500 && loc.eastM < 0) return null;
    return { why: 'onLand' };
  }
  if (east) return { why: 'eastOfShoreline' };
  if (me > 50) return { why: 'mEast+' + me };
  if (loc.distM < 200 && loc.eastM > 50) {
    return { why: 'bluff localEast+' + loc.eastM + ' dist=' + loc.distM };
  }
  if (loc.distM < 120 && loc.eastM > -80) {
    return { why: 'nearshore localEast=' + loc.eastM + ' dist=' + loc.distM };
  }
  if (!likelyWater && loc.eastM > -400) return { why: 'notOnWater' };
  return null;
}

var dashSrc = readFile('index.html');
var FISH_SPOTS = extractArray(dashSrc, 'FISH_SPOTS');
var strictBad = [], gapExempt = [], pvBad = [];

for (var i = 0; i < FISH_SPOTS.length; i++) {
  var spot = FISH_SPOTS[i];
  var lat = spot.lat, lon = spot.lon, name = spot.name;
  var face = spot.face || 270;
  var inGap = LA.isOCGap(lat, lon) || LA.isSPBay(lat, lon);
  var strict = strictFishNeedsFix(lat, lon, face);
  var normal = LA.needsOffshoreFix(lat, lon, face, !!spot.boat, !!spot.regional, 'FISH_SPOTS');
  var loc = LA.localEastM(lat, lon);

  if (strict) {
    strictBad.push({
      name: name, lat: lat, lon: lon, face: face,
      inGap: inGap,
      auditSkipped: inGap && !normal,
      strictWhy: strict.why,
      localEast: loc.eastM,
      distM: loc.distM,
      onLand: LA.isOnLand(lat, lon)
    });
    if (inGap && !normal) gapExempt.push(name);
    if (lat >= 33.72 && lat <= 33.79 && lon >= -118.45 && lon <= -118.35) pvBad.push(name);
  }
}

WScript.Echo('\n## Strict onshore audit (FISH_SPOTS)\n');
WScript.Echo('Total spots: ' + FISH_SPOTS.length);
WScript.Echo('Onshore/inland (strict): ' + strictBad.length);
WScript.Echo('  in OC/SD gap (audit skipped): ' + gapExempt.length);
WScript.Echo('  PV peninsula area: ' + pvBad.length + '\n');

if (strictBad.length) {
  WScript.Echo('| name | lat | lon | localEast | distM | onLand | gap | strict why |');
  WScript.Echo('|---|---|---|---|---|---|---|---|');
  for (var j = 0; j < strictBad.length && j < 100; j++) {
    var r = strictBad[j];
    WScript.Echo('| ' + r.name + ' | ' + r.lat + ' | ' + r.lon + ' | ' + r.localEast + ' | ' + r.distM + ' | ' + r.onLand + ' | ' + r.inGap + ' | ' + r.strictWhy + ' |');
  }
  if (strictBad.length > 100) WScript.Echo('... and ' + (strictBad.length - 100) + ' more');
}

if (typeof JSON === 'undefined') {
  JSON = { stringify: function (v) {
    function ser(o) {
      if (o === null) return 'null';
      var t = typeof o;
      if (t === 'number' || t === 'boolean') return String(o);
      if (t === 'string') return '"' + String(o).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
      if (Object.prototype.toString.call(o) === '[object Array]') {
        var a = []; for (var k = 0; k < o.length; k++) a.push(ser(o[k]));
        return '[' + a.join(',') + ']';
      }
      var p = []; for (var key in o) if (o.hasOwnProperty(key)) p.push('"' + key + '":' + ser(o[key]));
      return '{' + p.join(',') + '}';
    }
    return ser(v);
  }};
}
writeFile('audit-onshore-strict.json', JSON.stringify({
  total: FISH_SPOTS.length,
  onshore: strictBad.length,
  gapExempt: gapExempt.length,
  pvArea: pvBad.length,
  spots: strictBad
}, null, 2));
WScript.Echo('\nWrote audit-onshore-strict.json');

// PV peninsula fish spot analysis — cscript //Nologo audit-pv-spots.js
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
  return eval('[' + src.substring(start, i - 1) + ']');
}

var FISH_SPOTS = extractArray(readFile('index.html'), 'FISH_SPOTS');
// PV peninsula + nearby bluffs
var latMin = 33.70, latMax = 33.80, lonMin = -118.45, lonMax = -118.30;

WScript.Echo('\n## PV area FISH_SPOTS (lat ' + latMin + '-' + latMax + ', lon ' + lonMin + '-' + lonMax + ')\n');
WScript.Echo('| name | lat | lon | localEast | distM | onLand | audit |');
WScript.Echo('|---|---|---|---|---|---|---|');

var count = 0, onshore = 0;
for (var i = 0; i < FISH_SPOTS.length; i++) {
  var s = FISH_SPOTS[i];
  if (s.lat < latMin || s.lat > latMax || s.lon < lonMin || s.lon > lonMax) continue;
  count++;
  var loc = LA.localEastM(s.lat, s.lon);
  var onLand = LA.isOnLand(s.lat, s.lon);
  var issue = LA.needsOffshoreFix(s.lat, s.lon, s.face || 270, !!s.boat, !!s.regional, 'FISH_SPOTS');
  var bad = onLand || loc.eastM > -150 || (loc.distM < 500 && loc.eastM > -300);
  if (bad) onshore++;
  WScript.Echo('| ' + s.name + ' | ' + s.lat + ' | ' + s.lon + ' | ' + loc.eastM + ' | ' + loc.distM + ' | ' + onLand + ' | ' + (issue ? issue.why : 'OK') + ' |');
}
WScript.Echo('\nTotal in bbox: ' + count + ', likely onshore/nearshore: ' + onshore);

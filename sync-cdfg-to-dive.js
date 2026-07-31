// Sync ALL CDFG appendix reefs into DIVE_SITES by proximity (not fragile name match).
// Usage: cscript //Nologo sync-cdfg-to-dive.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

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

function haversineNm(lat1, lon1, lat2, lon2) {
  var R = 3440.065, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function escJs(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

function isRegional(lat, lon) {
  if (lat >= 32.4 && lat <= 33.25) return true;
  if (lat >= 33.25 && lat <= 33.65 && lon > -118.15) return true;
  if (lat >= 34.0 && lon < -118.5) return true;
  if (lat > 34.1) return true;
  return false;
}

function guessFace(lat, lon) {
  if (lon > -117.4) return 270;
  if (lon > -118.0) return 200;
  if (lat >= 33.7 && lat <= 34.1) return 250;
  return 250;
}

function slugId(name, i) {
  var s = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '').substring(0, 28);
  return 'cdfg_' + s + '_' + i;
}

var data = eval('(' + readFile('cdfg-artificial-reefs.json').replace(/^\uFEFF/, '') + ')');
var reefs = data.reefs;
var diveJs = readFile('dive-engine.js');
var dive = extractArray(diveJs, 'DIVE_SITES');
if (!dive) throw new Error('DIVE_SITES parse failed');

var added = [];
var newLines = [];

for (var r = 0; r < reefs.length; r++) {
  var reef = reefs[r];
  var found = false;
  for (var d = 0; d < dive.length; d++) {
    var s = dive[d];
    if (!s || !isFinite(s.lat)) continue;
    if (haversineNm(reef.lat, reef.lon, s.lat, s.lon) <= 0.008) { found = true; break; }
  }
  if (found) continue;
  var id = slugId(reef.name, r);
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
  newLines.push('    { ' + parts.join(', ') + ' }');
  dive.push({ name: reef.name, lat: reef.lat, lon: reef.lon, cdfgAppendix: true });
  added.push(reef.name);
}

if (newLines.length) {
  var end = diveJs.indexOf('];', diveJs.indexOf('const DIVE_SITES = ['));
  diveJs = diveJs.substring(0, end).replace(/\s*$/, '') +
    ',\n    /* —— CDFG appendix sync (missing modules) —— */\n' +
    newLines.join(',\n') + '\n  ];' + diveJs.substring(end + 2);
  writeFile('dive-engine.js', diveJs);
}

WScript.Echo('Added missing CDFG dive modules: ' + added.length);
WScript.Echo('Dive total now ~' + dive.length);
for (var i = 0; i < Math.min(15, added.length); i++) WScript.Echo('  + ' + added[i]);
if (added.length > 15) WScript.Echo('  ... +' + (added.length - 15) + ' more');

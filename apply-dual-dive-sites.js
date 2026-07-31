// Apply dual-source dive sites from dual-dive-sites-candidates.js (skip:true excluded).
// Also appends entries to verified-water-pins.json diveKept.
// Usage: cscript //Nologo apply-dual-dive-sites.js
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

/* Load candidates — strip browser-only bits */
var candSrc = readFile('dual-dive-sites-candidates.js')
  .replace(/window\s*=\s*this\s*;/, '')
  .replace(/if\s*\(typeof module[\s\S]*$/, '');
eval(candSrc);

var diveJs = readFile('dive-engine.js');
var dive = extractArray(diveJs, 'DIVE_SITES');
var added = [], skipped = [];

for (var i = 0; i < DUAL_DIVE_SITES.length; i++) {
  var s = DUAL_DIVE_SITES[i];
  if (s.skip) { skipped.push(s.id + ' (skip)'); continue; }
  var exists = false;
  for (var d = 0; d < dive.length; d++) {
    if (!dive[d]) continue;
    if (dive[d].id === s.id) { exists = true; break; }
    if (haversineNm(s.lat, s.lon, dive[d].lat, dive[d].lon) < 0.05) { exists = true; break; }
  }
  if (exists) { skipped.push(s.id + ' (already present)'); continue; }

  var parts = [
    "id: '" + s.id + "'",
    "name: '" + escJs(s.name) + "'",
    'lat: ' + s.lat,
    'lon: ' + s.lon,
    'face: ' + (s.face || 250),
    'depth: ' + (s.depth || 60),
    'verified: true',
    'boat: true'
  ];
  if (s.regional) parts.push('regional: true');
  var line = '    { ' + parts.join(', ') + ' }';
  var end = diveJs.indexOf('];', diveJs.indexOf('const DIVE_SITES = ['));
  diveJs = diveJs.substring(0, end).replace(/\s*$/, '') + ',\n' + line + '\n  ];' + diveJs.substring(end + 2);
  dive.push(s);
  added.push(s.name);
}

writeFile('dive-engine.js', diveJs);

/* Append to verified-water-pins.json diveKept if possible */
try {
  var log = eval('(' + readFile('verified-water-pins.json').replace(/^\uFEFF/, '') + ')');
  if (!log.diveKept) log.diveKept = [];
  for (var a = 0; a < DUAL_DIVE_SITES.length; a++) {
    var site = DUAL_DIVE_SITES[a];
    if (site.skip) continue;
    var found = false;
    for (var k = 0; k < log.diveKept.length; k++) {
      if (log.diveKept[k].id === site.id) { found = true; break; }
    }
    if (found) continue;
    log.diveKept.push({
      id: site.id,
      name: site.name,
      lat: site.lat,
      lon: site.lon,
      face: site.face,
      depth: site.depth,
      boat: true,
      regional: !!site.regional,
      sources: site.sources,
      agreement: site.agreement
    });
  }
  function ser(o, ind) {
    if (o === null) return 'null';
    var t = typeof o;
    if (t === 'number' || t === 'boolean') return String(o);
    if (t === 'string') return '"' + String(o).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    var sp = '\n' + ind, sp2 = '\n' + ind + '  ';
    if (Object.prototype.toString.call(o) === '[object Array]') {
      if (!o.length) return '[]';
      var a = []; for (var i = 0; i < o.length; i++) a.push(sp2 + ser(o[i], ind + '  '));
      return '[' + a.join(',') + sp + ']';
    }
    var keys = []; for (var k in o) if (o.hasOwnProperty(k)) keys.push(k);
    var p = []; for (var j = 0; j < keys.length; j++) p.push(sp2 + '"' + keys[j] + '": ' + ser(o[keys[j]], ind + '  '));
    return '{' + p.join(',') + sp + '}';
  }
  writeFile('verified-water-pins.json', ser(log, ''));
} catch (e) {
  WScript.Echo('WARN verified-water-pins update: ' + e.message);
}

WScript.Echo('Added dual-source dive sites: ' + added.length);
for (var x = 0; x < added.length; x++) WScript.Echo('  + ' + added[x]);
WScript.Echo('Skipped: ' + skipped.length);
for (var y = 0; y < skipped.length; y++) WScript.Echo('  - ' + skipped[y]);

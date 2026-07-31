// Patch coast-geo.js: split erroneous long jumps, densify PV/nearshore segments to ~2m spacing.
// Run: cscript //Nologo densify-coast-pv.js
// Backs up to coast-geo.js.bak before writing.
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var src = fso.OpenTextFile(root + '\\coast-geo.js', 1).ReadAll();
var COAST_GEO = {};
eval(src.replace(/window\.COAST_GEO/g, 'COAST_GEO'));

var FT10 = 3.048;
var DENSIFY_STEP = 2.0;
var MAX_SEG = 800; /* split lines when segment exceeds this (bad OSM chain) */

function haversineM(a, b) {
  var R = 6371000, d2r = Math.PI / 180;
  var dlat = (b.lat - a.lat) * d2r, dlon = (b.lon - a.lon) * d2r;
  var la = a.lat * d2r, lb = b.lat * d2r;
  var h = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function inPvBox(p) {
  return p.lat >= 33.68 && p.lat <= 33.84 && p.lon >= -118.48 && p.lon <= -118.28;
}

function inNearshoreBox(p) {
  return p.lat >= 33.65 && p.lat <= 33.95 && p.lon >= -118.55 && p.lon <= -118.05;
}

function lerpPt(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
}

function round6(n) { return Math.round(n * 1e6) / 1e6; }

function densifyPts(pts, testFn) {
  if (pts.length < 2) return pts;
  var out = [{ lat: pts[0].lat, lon: pts[0].lon }];
  for (var i = 0; i < pts.length - 1; i++) {
    var a = pts[i], b = pts[i + 1];
    var d = haversineM(a, b);
    if (d > MAX_SEG) {
      /* bad jump — stop current chain; caller splits */
      return { split: true, pts: out, rest: pts.slice(i) };
    }
    if (d > FT10 && (testFn(a) || testFn(b))) {
      var n = Math.floor(d / DENSIFY_STEP);
      if (n < 1) n = 1;
      for (var k = 1; k <= n; k++) {
        var t = k / (n + 1);
        var p = lerpPt(a, b, t);
        out.push({ lat: round6(p.lat), lon: round6(p.lon) });
      }
    }
    out.push({ lat: b.lat, lon: b.lon });
  }
  return { split: false, pts: out };
}

function processLine(line) {
  var pts = line.pts || line;
  var testFn = (line.name && (line.name.indexOf('pv-') === 0 || line.name === 'south-bay'))
    ? inPvBox : inNearshoreBox;
  var result = densifyPts(pts, testFn);
  if (result.split) {
    var parts = [{ name: line.name, pts: result.pts }];
    var rest = result.rest;
    while (rest.length >= 2) {
      var sub = { name: line.name + '-part', pts: rest };
      var r2 = densifyPts(rest, testFn);
      if (r2.split) {
        parts.push({ name: line.name + '-part' + parts.length, pts: r2.pts });
        rest = r2.rest;
      } else {
        parts.push({ name: line.name + '-part' + parts.length, pts: r2.pts });
        rest = [];
      }
    }
    return parts;
  }
  return [{ name: line.name, pts: result.pts }];
}

var newLines = [];
for (var li = 0; li < COAST_GEO.lines.length; li++) {
  var parts = processLine(COAST_GEO.lines[li]);
  for (var pi = 0; pi < parts.length; pi++) newLines.push(parts[pi]);
}
COAST_GEO.lines = newLines;

function fmtPt(p) { return '{lat:' + round6(p.lat) + ',lon:' + round6(p.lon) + '}'; }

function emitLines(lines) {
  var s = '  lines: [\n';
  for (var i = 0; i < lines.length; i++) {
    var pts = lines[i].pts;
    s += '    { name: \'' + lines[i].name.replace(/'/g, "\\'") + '\', pts: [';
    for (var j = 0; j < pts.length; j++) {
      if (j) s += ',';
      s += fmtPt(pts[j]);
    }
    s += '] }';
    if (i < lines.length - 1) s += ',';
    s += '\n';
  }
  s += '  ]';
  return s;
}

/* Preserve islands + land from original file via regex replace on lines block only */
var linesStart = src.indexOf('lines: [');
var islandsStart = src.indexOf('islands: [', linesStart);
if (linesStart < 0 || islandsStart < 0) {
  WScript.Echo('ERROR: could not locate lines/islands in coast-geo.js');
  WScript.Quit(1);
}

var newLinesBlock = emitLines(COAST_GEO.lines);
var out = src.substring(0, linesStart) + newLinesBlock + ',\n' + src.substring(islandsStart);

var bak = root + '\\coast-geo.js.bak';
if (!fso.FileExists(bak)) {
  fso.CopyFile(root + '\\coast-geo.js', bak, true);
}
var fo = fso.CreateTextFile(root + '\\coast-geo.js', true);
fo.Write(out);
fo.Close();

/* verify */
COAST_GEO = {};
eval(out.replace(/window\.COAST_GEO/g, 'COAST_GEO'));
var pvMax = 0, pvOver = 0, linePts = 0;
for (var vi = 0; vi < COAST_GEO.lines.length; vi++) {
  var vpts = COAST_GEO.lines[vi].pts;
  linePts += vpts.length;
  for (var si = 0; si < vpts.length - 1; si++) {
    var vd = haversineM(vpts[si], vpts[si + 1]);
    if (vpts[si].lat >= 33.68 && vpts[si].lat <= 33.84 && vpts[si].lon >= -118.48 && vpts[si].lon <= -118.28) {
      if (vd > pvMax) pvMax = vd;
      if (vd > FT10) pvOver++;
    }
  }
}
WScript.Echo('Patched coast-geo.js — ' + COAST_GEO.lines.length + ' lines, ' + linePts + ' pts');
WScript.Echo('PV max segment: ' + pvMax.toFixed(2) + 'm, segments over 10ft: ' + pvOver);
WScript.Echo('Backup: coast-geo.js.bak');

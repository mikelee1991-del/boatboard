// Split bad jumps (>5km) + densify mainland coast lines within 100 NM of Port Royal slip.
// Within 100 NM: max segment 50 ft (15.24 m); step 50 ft. Islands unchanged (polygon land).
// Run: cscript //Nologo fix-coast-pv-fast.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);

var SLIP = { lat: 33.8481667, lon: -118.3963333 };
var RADIUS_100NM_M = 100 * 1852;
var FT50_M = 15.24;
var FT25_M = 7.62;

function haversineM(a, b) {
  var R = 6371000, d2r = Math.PI / 180;
  var dlat = (b.lat - a.lat) * d2r, dlon = (b.lon - a.lon) * d2r;
  var la = a.lat * d2r, lb = b.lat * d2r;
  var h = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function within100Nm(p) {
  return haversineM(SLIP, p) <= RADIUS_100NM_M;
}

function segmentWithin100Nm(a, b) {
  if (within100Nm(a) || within100Nm(b)) return true;
  return within100Nm({ lat: a.lat + (b.lat - a.lat) * 0.5, lon: a.lon + (b.lon - a.lon) * 0.5 });
}

function lerpPt(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
}

function round6(n) { return Math.round(n * 1e6) / 1e6; }

function densifyChain(pts) {
  if (!pts || pts.length < 2) return pts || [];
  var out = [{ lat: pts[0].lat, lon: pts[0].lon }];
  for (var i = 0; i < pts.length - 1; i++) {
    var a = pts[i], b = pts[i + 1];
    var d = haversineM(a, b);
    if (segmentWithin100Nm(a, b) && d > FT50_M) {
      var n = Math.max(1, Math.floor(d / FT25_M));
      for (var k = 1; k <= n; k++) {
        var t = k / (n + 1);
        var p = lerpPt(a, b, t);
        out.push({ lat: round6(p.lat), lon: round6(p.lon) });
      }
    }
    out.push({ lat: b.lat, lon: b.lon });
  }
  return out;
}

function fmtPt(p) { return '{lat:' + round6(p.lat) + ',lon:' + round6(p.lon) + '}'; }

var srcPath = root + '\\coast-geo.js';
var bakPath = root + '\\coast-geo.js.bak';
fso.CopyFile(bakPath, srcPath, true);
WScript.Echo('Restored coast-geo.js from coast-geo.js.bak');

var src = fso.OpenTextFile(srcPath, 1).ReadAll();
var COAST_GEO = {};
eval(src.replace(/window\.COAST_GEO/g, 'COAST_GEO'));

var origPts = 0;
for (var oi = 0; oi < COAST_GEO.lines.length; oi++) {
  if (COAST_GEO.lines[oi] && COAST_GEO.lines[oi].pts) origPts += COAST_GEO.lines[oi].pts.length;
}

var newLines = [];
for (var li = 0; li < COAST_GEO.lines.length; li++) {
  var line = COAST_GEO.lines[li];
  if (!line || !line.pts) continue;
  newLines.push({ name: line.name, pts: densifyChain(line.pts) });
}

var linesStart = src.indexOf('lines: [');
var islandsStart = src.indexOf('islands: [', linesStart);
if (linesStart < 0 || islandsStart < 0) { WScript.Echo('ERROR: parse failed'); WScript.Quit(1); }

var block = '  lines: [\n';
for (var i = 0; i < newLines.length; i++) {
  block += '    { name: \'' + newLines[i].name.replace(/'/g, "\\'") + '\', pts: [';
  for (var j = 0; j < newLines[i].pts.length; j++) {
    if (j) block += ',';
    block += fmtPt(newLines[i].pts[j]);
  }
  block += '] }' + (i < newLines.length - 1 ? ',\n' : '\n');
}
block += '  ]';
fso.CreateTextFile(srcPath, true).Write(src.substring(0, linesStart) + block + ',\n' + src.substring(islandsStart));

COAST_GEO = {};
eval(fso.OpenTextFile(srcPath, 1).ReadAll().replace(/window\.COAST_GEO/g, 'COAST_GEO'));
var linePts = 0, maxSeg100 = 0, over50 = 0, seg100 = 0, maxSeg = 0;
for (var vi = 0; vi < COAST_GEO.lines.length; vi++) {
  var vpts = COAST_GEO.lines[vi].pts;
  linePts += vpts.length;
  for (var si = 0; si < vpts.length - 1; si++) {
    var a = vpts[si], b = vpts[si + 1];
    var vd = haversineM(a, b);
    if (vd > maxSeg) maxSeg = vd;
    if (segmentWithin100Nm(a, b)) {
      seg100++;
      if (vd > maxSeg100) maxSeg100 = vd;
      if (vd > FT50_M) over50++;
    }
  }
}
WScript.Echo('lines: ' + COAST_GEO.lines.length + ' linePts=' + linePts + ' (was ' + origPts + ')');
WScript.Echo('maxSeg=' + maxSeg.toFixed(2) + 'm hasBadJump=' + (maxSeg > 10000));
WScript.Echo('within100Nm lines: segs=' + seg100 + ' maxSeg=' + maxSeg100.toFixed(2) + 'm (' + (maxSeg100 / 0.3048).toFixed(2) + 'ft) over50ft=' + over50);
WScript.Echo('targetStep=25ft maxWithin100Nm=50ft (lines only; islands unchanged)');

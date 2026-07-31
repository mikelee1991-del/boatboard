// Find where coast-other-2 backtracks (dist from slip drops) — causes cross-land chords.
// Run: cscript //Nologo analyze-backtrack.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var COAST_GEO = {};
eval(fso.OpenTextFile(root + '\\coast-geo.js', 1).ReadAll().replace(/window\.COAST_GEO/g, 'COAST_GEO'));

var SLIP_LAT = 33 + 50 / 60 + 53.4 / 3600;
var SLIP_LON = -(118 + 23 / 60 + 46.8 / 3600);
var NM = 1852;

function haversineM(a, b) {
  var R = 6371000, d2r = Math.PI / 180;
  var dlat = (b.lat - a.lat) * d2r, dlon = (b.lon - a.lon) * d2r;
  var la = a.lat * d2r, lb = b.lat * d2r;
  var h = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
function distNm(lat, lon) {
  return haversineM({ lat: SLIP_LAT, lon: SLIP_LON }, { lat: lat, lon: lon }) / NM;
}
function segBrg(a, b) {
  var d2r = Math.PI / 180;
  var la1 = a.lat * d2r, la2 = b.lat * d2r, dlo = (b.lon - a.lon) * d2r;
  var y = Math.sin(dlo) * Math.cos(la2);
  var x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dlo);
  return ((Math.atan2(y, x) / d2r) + 360) % 360;
}
function angDiff(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

function analyzeLine(name) {
  var line = null;
  for (var li = 0; li < COAST_GEO.lines.length; li++) {
    if (COAST_GEO.lines[li].name === name) line = COAST_GEO.lines[li];
  }
  if (!line) return;
  var pts = line.pts;
  WScript.Echo('=== ' + name + ' (' + pts.length + ' pts) ===');

  WScript.Echo('-- Backtrack: distNm drops >0.3 NM between consecutive pts --');
  var prevD = distNm(pts[0].lat, pts[0].lon);
  for (var i = 1; i < pts.length; i++) {
    var d = distNm(pts[i].lat, pts[i].lon);
    if (prevD - d > 0.3) {
      var segM = haversineM(pts[i - 1], pts[i]);
      WScript.Echo('i' + i + ': ' + prevD.toFixed(1) + '->' + d.toFixed(1) + ' NM (drop ' + (prevD - d).toFixed(1) + ') seg=' + segM.toFixed(0) + 'm ' +
        pts[i - 1].lat + ',' + pts[i - 1].lon + ' -> ' + pts[i].lat + ',' + pts[i].lon);
    }
    prevD = d;
  }

  WScript.Echo('-- Long segments (>200m) with chord midpoint dist 12-16 NM --');
  for (i = 1; i < pts.length; i++) {
    segM = haversineM(pts[i - 1], pts[i]);
    if (segM < 200) continue;
    var mid = { lat: (pts[i - 1].lat + pts[i].lat) / 2, lon: (pts[i - 1].lon + pts[i].lon) / 2 };
    var dm = distNm(mid.lat, mid.lon);
    if (dm >= 12 && dm <= 16) {
      WScript.Echo('i' + i + ': ' + segM.toFixed(0) + 'm mid@' + dm.toFixed(1) + 'NM ' + pts[i - 1].lat + ',' + pts[i - 1].lon + ' -> ' + pts[i].lat + ',' + pts[i].lon);
    }
  }

  WScript.Echo('-- Sharp turns >100deg with segment >100m --');
  for (i = 2; i < pts.length; i++) {
    var b1 = segBrg(pts[i - 2], pts[i - 1]);
    var b2 = segBrg(pts[i - 1], pts[i]);
    var turn = angDiff(b1, b2);
    segM = haversineM(pts[i - 1], pts[i]);
    if (turn > 100 && segM > 100) {
      mid = { lat: (pts[i - 1].lat + pts[i].lat) / 2, lon: (pts[i - 1].lon + pts[i].lon) / 2 };
      dm = distNm(mid.lat, mid.lon);
      WScript.Echo('i' + i + ': turn=' + turn.toFixed(0) + ' seg=' + segM.toFixed(0) + 'm @' + dm.toFixed(1) + 'NM');
    }
  }
}

analyzeLine('coast-other-2');
WScript.Echo('');
analyzeLine('malibu');

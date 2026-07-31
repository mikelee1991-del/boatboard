// Find where coast-other-2 transitions from harbor zigzag to SE run toward SD.
// Run: cscript //Nologo analyze-coast-transition.js
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

var pts = null;
for (var li = 0; li < COAST_GEO.lines.length; li++) {
  if (COAST_GEO.lines[li].name === 'coast-other-2') pts = COAST_GEO.lines[li].pts;
}

WScript.Echo('=== Bearing along coast-other-2 (every 200 pts) ===');
for (var i = 200; i < pts.length; i += 200) {
  var b = segBrg(pts[i - 1], pts[i]);
  WScript.Echo('i' + i + ' brg=' + b.toFixed(0) + ' @' + distNm(pts[i].lat, pts[i].lon).toFixed(1) + 'NM ' + pts[i].lat.toFixed(5) + ',' + pts[i].lon.toFixed(5));
}

WScript.Echo('');
WScript.Echo('=== First index where bearing is 120-160 for 20 consecutive segments ===');
var run = 0, startI = -1;
for (i = 1; i < pts.length; i++) {
  b = segBrg(pts[i - 1], pts[i]);
  if (b >= 120 && b <= 160) {
    if (run === 0) startI = i;
    run++;
    if (run >= 20) {
      WScript.Echo('Stable SE run starts ~i' + startI + ' @' + distNm(pts[startI].lat, pts[startI].lon).toFixed(1) + 'NM ' + pts[startI].lat + ',' + pts[startI].lon);
      break;
    }
  } else {
    run = 0; startI = -1;
  }
}

WScript.Echo('');
WScript.Echo('=== Segment from pv tip to i8500 — does it cross PV land? ===');
// Sample midpoints vs expected ocean side (should be west of -118.25 for PV south face)
var tip = pts[0];
var target = pts[8500];
WScript.Echo('Tip: ' + tip.lat + ',' + tip.lon);
WScript.Echo('i8500: ' + target.lat + ',' + target.lon + ' @' + distNm(target.lat, target.lon).toFixed(1) + 'NM');
var steps = 20;
for (var s = 0; s <= steps; s++) {
  var t = s / steps;
  var lat = tip.lat + (target.lat - tip.lat) * t;
  var lon = tip.lon + (target.lon - tip.lon) * t;
  WScript.Echo('  chord t=' + t.toFixed(2) + ': ' + lat.toFixed(5) + ',' + lon.toFixed(5) + ' @' + distNm(lat, lon).toFixed(1) + 'NM');
}

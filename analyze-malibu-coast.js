// Analyze malibu line vs landmarks north of slip
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var SLIP_LAT = 33 + 50 / 60 + 53.4 / 3600;
var SLIP_LON = -(118 + 23 / 60 + 46.8 / 3600);
var NM = 1852;

var COAST_GEO = {};
eval(fso.OpenTextFile(root + '\\coast-geo.js', 1).ReadAll().replace(/window\.COAST_GEO/g, 'COAST_GEO'));
var LITE = {};
eval(fso.OpenTextFile(root + '\\coast-overlay-lite.js', 1).ReadAll().replace(/window\.COAST_OVERLAY_LITE/g, 'LITE'));

function hav(a, b) {
  var R = 6371000, d2r = Math.PI / 180;
  var dlat = (b.lat - a.lat) * d2r, dlon = (b.lon - a.lon) * d2r;
  var la = a.lat * d2r, lb = b.lat * d2r;
  var h = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
function distNm(lat, lon) {
  return hav({ lat: SLIP_LAT, lon: SLIP_LON }, { lat: lat, lon: lon }) / NM;
}

var REFS = [
  { name: 'Santa Monica Pier', lat: 34.010, lon: -118.497 },
  { name: 'Malibu Pier', lat: 34.035, lon: -118.678 },
  { name: 'Point Dume', lat: 34.001, lon: -118.806 }
];

function getLine(arr, name) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].name === name) return arr[i].pts;
  }
  return null;
}

function analyzePts(label, pts) {
  WScript.Echo('=== ' + label + ' (' + pts.length + ' pts) ===');
  WScript.Echo('first: ' + pts[0].lat + ',' + pts[0].lon + ' @' + distNm(pts[0].lat, pts[0].lon).toFixed(1) + ' NM');
  WScript.Echo('last:  ' + pts[pts.length - 1].lat + ',' + pts[pts.length - 1].lon + ' @' + distNm(pts[pts.length - 1].lat, pts[pts.length - 1].lon).toFixed(1) + ' NM');
  var ri, best, bp, i;
  for (ri = 0; ri < REFS.length; ri++) {
    best = 1e12; bp = null;
    for (i = 0; i < pts.length; i++) {
      var d = hav(pts[i], REFS[ri]);
      if (d < best) { best = d; bp = pts[i]; }
    }
    WScript.Echo(REFS[ri].name + ': ' + (best / NM).toFixed(2) + ' NM at ' + bp.lat + ',' + bp.lon);
  }
  WScript.Echo('-- Points in 12-20 NM ring from slip --');
  var ring = 0;
  for (i = 0; i < pts.length; i++) {
    var dn = distNm(pts[i].lat, pts[i].lon);
    if (dn >= 12 && dn <= 20) ring++;
  }
  WScript.Echo('ring pts: ' + ring);
  WScript.Echo('-- Max segment >500m in 12-25 NM ring --');
  var maxD = 0, maxI = -1;
  for (i = 1; i < pts.length; i++) {
    var mid = { lat: (pts[i - 1].lat + pts[i].lat) / 2, lon: (pts[i - 1].lon + pts[i].lon) / 2 };
    var dm = distNm(mid.lat, mid.lon);
    if (dm < 12 || dm > 25) continue;
    var d = hav(pts[i - 1], pts[i]);
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxI >= 0) {
    WScript.Echo('max ' + maxD.toFixed(0) + 'm at i' + maxI + ' ' + pts[maxI - 1].lat + ',' + pts[maxI - 1].lon + ' -> ' + pts[maxI].lat + ',' + pts[maxI].lon);
  }
}

analyzePts('FULL malibu', getLine(COAST_GEO.lines, 'malibu'));
WScript.Echo('');
analyzePts('LITE malibu', getLine(LITE.lines, 'malibu'));
WScript.Echo('');
analyzePts('LITE coast-other', getLine(LITE.lines, 'coast-other'));

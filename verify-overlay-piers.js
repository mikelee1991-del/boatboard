// Comprehensive pier / phantom verification for coast-overlay-lite.js
// Run: cscript //Nologo verify-overlay-piers.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
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

var REFS = [
  { n: 'Santa Monica Pier', lat: 34.010, lon: -118.497 },
  { n: 'Malibu Pier', lat: 34.035, lon: -118.678 },
  { n: 'Point Dume', lat: 34.001, lon: -118.806 },
  { n: 'King Harbor', lat: 33.8482, lon: -118.3963 },
  { n: 'Point Vicente', lat: 33.741, lon: -118.411 },
  { n: 'Seal Beach Pier', lat: 33.741, lon: -118.104 },
  { n: 'Huntington Pier', lat: 33.655, lon: -118.004 },
  { n: 'Newport Pier', lat: 33.609, lon: -117.929 },
  { n: 'Dana Point Harbor', lat: 33.460, lon: -117.706 },
  { n: 'Avalon', lat: 33.343, lon: -118.327 }
];

function allPts() {
  var pts = [], li, i, arr;
  for (li = 0; li < (LITE.lines || []).length; li++) {
    arr = LITE.lines[li].pts;
    for (i = 0; i < arr.length; i++) pts.push(arr[i]);
  }
  for (li = 0; li < (LITE.islands || []).length; li++) {
    arr = LITE.islands[li].pts;
    for (i = 0; i < arr.length; i++) pts.push(arr[i]);
  }
  return pts;
}

var pts = allPts(), ri, i, best, bp, d;
WScript.Echo('=== Pier proximity (target <0.2 NM, ideal <0.1) ===');
for (ri = 0; ri < REFS.length; ri++) {
  best = 1e12; bp = null;
  for (i = 0; i < pts.length; i++) {
    d = hav(pts[i], REFS[ri]);
    if (d < best) { best = d; bp = pts[i]; }
  }
  WScript.Echo(REFS[ri].n + ': ' + (best / 1852).toFixed(3) + ' NM' +
    (bp ? (' at ' + bp.lat + ',' + bp.lon) : ' MISSING'));
}

WScript.Echo('');
WScript.Echo('=== Segment spacing ===');
(function () {
  var li, j, d, maxSeg = 0, longSegs = 0, arr;
  function scan(arr, label) {
    for (j = 1; j < arr.length; j++) {
      d = hav(arr[j - 1], arr[j]);
      if (d > maxSeg) maxSeg = d;
      if (d > 200) {
        longSegs++;
        if (longSegs <= 8) {
          WScript.Echo('LONG ' + label + ' ' + d.toFixed(0) + 'm: ' +
            arr[j - 1].lat + ',' + arr[j - 1].lon + ' -> ' + arr[j].lat + ',' + arr[j].lon);
        }
      }
    }
  }
  for (li = 0; li < (LITE.lines || []).length; li++) scan(LITE.lines[li].pts, LITE.lines[li].name);
  for (li = 0; li < (LITE.islands || []).length; li++) scan(LITE.islands[li].pts, 'isle:' + LITE.islands[li].name);
  WScript.Echo('maxSeg=' + maxSeg.toFixed(1) + 'm (' + (maxSeg / 0.3048).toFixed(0) + ' ft) longSegs>200m=' + longSegs);
})();

(function () {
  var phantomOC = 0, k, all = allPts();
  for (k = 0; k < all.length; k++) {
    if (all[k].lat >= 33.64 && all[k].lat <= 33.74 && all[k].lon >= -118.20 && all[k].lon <= -118.12)
      phantomOC++;
  }
  WScript.Echo('San Pedro Channel phantom corridor pts: ' + phantomOC + ' (want ~0)');
})();

WScript.Echo('');
WScript.Echo('lines=' + LITE.lines.length + ' islands=' + LITE.islands.length + ' pts=' + pts.length);
(function () {
  var n;
  for (n = 0; n < LITE.islands.length; n++)
    WScript.Echo('  island ' + LITE.islands[n].name + ': ' + LITE.islands[n].pts.length + ' pts');
})();
var f = fso.GetFile(root + '\\coast-overlay-lite.js');
WScript.Echo('fileKB=' + Math.round(f.Size / 1024));

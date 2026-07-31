// Check max segment spacing in coast-overlay-lite.js. Run: cscript //Nologo check-overlay-spacing.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var COAST_OVERLAY_LITE = {};
eval(fso.OpenTextFile(root + '\\coast-overlay-lite.js', 1).ReadAll().replace(/window\.COAST_OVERLAY_LITE/g, 'COAST_OVERLAY_LITE'));

function haversineM(a, b) {
  var R = 6371000, d2r = Math.PI / 180;
  var dlat = (b.lat - a.lat) * d2r, dlon = (b.lon - a.lon) * d2r;
  var la = a.lat * d2r, lb = b.lat * d2r;
  var h = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

var maxM = 0, pts = 0, segs = 0;
function scan(arr) {
  for (var i = 1; i < arr.length; i++) {
    var d = haversineM(arr[i - 1], arr[i]);
    if (d > maxM) maxM = d;
    segs++;
  }
  pts += arr.length;
}
for (var li = 0; li < (COAST_OVERLAY_LITE.lines || []).length; li++) scan(COAST_OVERLAY_LITE.lines[li].pts);
for (var ii = 0; ii < (COAST_OVERLAY_LITE.islands || []).length; ii++) scan(COAST_OVERLAY_LITE.islands[ii].pts);

var SLIP_LAT = 33 + 50 / 60 + 53.4 / 3600;
var SLIP_LON = -(118 + 23 / 60 + 46.8 / 3600);
WScript.Echo('=== OC pier proximity (want <0.5 NM) ===');
var REFS = [
  { name: 'Seal Beach pier', lat: 33.741, lon: -118.104 },
  { name: 'Huntington Pier', lat: 33.655, lon: -118.004 },
  { name: 'Newport Pier', lat: 33.609, lon: -117.929 }
];
for (var ri = 0; ri < REFS.length; ri++) {
  var bestOff = 1e12, bestP = null;
  for (li = 0; li < (COAST_OVERLAY_LITE.lines || []).length; li++) {
    var pts2 = COAST_OVERLAY_LITE.lines[li].pts;
    for (var pi = 0; pi < pts2.length; pi++) {
      var off = haversineM(pts2[pi], REFS[ri]);
      if (off < bestOff) { bestOff = off; bestP = pts2[pi]; }
    }
  }
  WScript.Echo(REFS[ri].name + ' closest=' + (bestOff / 1852).toFixed(2) + ' NM' +
    (bestP ? ' at ' + bestP.lat + ',' + bestP.lon : ''));
}

var f = fso.GetFile(root + '\\coast-overlay-lite.js');
WScript.Echo('pts=' + pts + ' segs=' + segs + ' maxSegM=' + maxM.toFixed(1) + ' (' + (maxM * 3.28084).toFixed(0) + ' ft) KB=' + Math.round(f.Size / 1024));

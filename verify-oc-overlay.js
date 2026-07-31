// Verify no San Pedro Channel phantom remains in overlay. cscript //Nologo verify-oc-overlay.js
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

var phantom = 0, nearSeal = 0, bestSeal = 1e12, bestSealP = null;
var SEAL = { lat: 33.741, lon: -118.104 };
for (var li = 0; li < (COAST_OVERLAY_LITE.lines || []).length; li++) {
  var pts = COAST_OVERLAY_LITE.lines[li].pts;
  WScript.Echo('line ' + COAST_OVERLAY_LITE.lines[li].name + ' pts=' + pts.length +
    ' start=' + pts[0].lat + ',' + pts[0].lon + ' end=' + pts[pts.length - 1].lat + ',' + pts[pts.length - 1].lon);
  for (var i = 0; i < pts.length; i++) {
    var p = pts[i];
    // Mid-channel phantom corridor (west of OC mainland, east of Catalina channel)
    if (p.lat >= 33.64 && p.lat <= 33.74 && p.lon >= -118.20 && p.lon <= -118.12) phantom++;
    // Points near Seal Beach pier should hug coastline (~0.3 NM)
    if (p.lat >= 33.72 && p.lat <= 33.75 && p.lon >= -118.14 && p.lon <= -118.08) {
      nearSeal++;
      var d = haversineM(p, SEAL);
      if (d < bestSeal) { bestSeal = d; bestSealP = p; }
    }
  }
}
WScript.Echo('phantomCorridorPts=' + phantom + ' (want 0 or few harbor-only)');
WScript.Echo('nearSealPts=' + nearSeal + ' closestToPierNm=' + (bestSeal / 1852).toFixed(3) +
  (bestSealP ? ' at ' + bestSealP.lat + ',' + bestSealP.lon : ''));

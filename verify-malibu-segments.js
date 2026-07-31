// Max segment length per malibu overlay line
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

var li, i, l, maxSeg, d, globalMax = 0;
for (li = 0; li < LITE.lines.length; li++) {
  l = LITE.lines[li];
  if (l.name.indexOf('malibu') !== 0) continue;
  maxSeg = 0;
  for (i = 1; i < l.pts.length; i++) {
    d = hav(l.pts[i - 1], l.pts[i]);
    if (d > maxSeg) maxSeg = d;
  }
  WScript.Echo(l.name + ' maxSeg=' + maxSeg.toFixed(1) + 'm (' + (maxSeg / 0.3048).toFixed(0) + ' ft)');
  if (maxSeg > globalMax) globalMax = maxSeg;
}
WScript.Echo('malibu globalMax=' + globalMax.toFixed(1) + 'm');

// Verify north overlay pier proximity after malibu fix
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

function getMalibuPts() {
  var all = [], li, lj, l, p;
  for (li = 0; li < LITE.lines.length; li++) {
    l = LITE.lines[li];
    if (l.name.indexOf('malibu') === 0) {
      for (lj = 0; lj < l.pts.length; lj++) all.push(l.pts[lj]);
    }
  }
  return all;
}

var REFS = [
  { n: 'Santa Monica Pier', lat: 34.010, lon: -118.497 },
  { n: 'Malibu Pier', lat: 34.035, lon: -118.678 },
  { n: 'Point Dume', lat: 34.001, lon: -118.806 }
];

var pts = getMalibuPts(), ri, i, best, bp, d, maxSeg = 0;
WScript.Echo('malibu overlay pts (all segments): ' + pts.length);
for (ri = 0; ri < REFS.length; ri++) {
  best = 1e12; bp = null;
  for (i = 0; i < pts.length; i++) {
    d = hav(pts[i], REFS[ri]);
    if (d < best) { best = d; bp = pts[i]; }
  }
  WScript.Echo(REFS[ri].n + ': ' + (best / 1852).toFixed(3) + ' NM at ' + bp.lat + ',' + bp.lon);
}
for (i = 1; i < pts.length; i++) {
  d = hav(pts[i - 1], pts[i]);
  if (d > maxSeg) maxSeg = d;
}
WScript.Echo('maxSegMalibu=' + maxSeg.toFixed(1) + 'm (' + (maxSeg / 0.3048).toFixed(0) + ' ft)');

// Phantom check: points west of -118.52 at SM lat
var ph = 0;
for (i = 0; i < pts.length; i++) {
  if (pts[i].lat >= 33.96 && pts[i].lat <= 34.08 && pts[i].lon < -118.52) ph++;
}
WScript.Echo('west-stray SM Bay pts: ' + ph + ' (want 0)');

WScript.Echo('');
WScript.Echo('LITE lines:');
for (li = 0; li < LITE.lines.length; li++) {
  WScript.Echo('  ' + LITE.lines[li].name + ': ' + LITE.lines[li].pts.length + ' pts');
}

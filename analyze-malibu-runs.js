// Map phantom vs good along malibu line
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var COAST_GEO = {};
eval(fso.OpenTextFile(root + '\\coast-geo.js', 1).ReadAll().replace(/window\.COAST_GEO/g, 'COAST_GEO'));
var pts = COAST_GEO.lines[0].pts;

function isMalibuPhantom(p) {
  if (p.lat >= 33.93 && p.lat <= 34.10 && p.lon > -119.0 && p.lon <= -118.52) {
    var beachLon = -118.44 - (p.lat - 33.94) * (0.41 / 0.16);
    if (p.lon < beachLon - 0.02) return true;
  }
  return false;
}

var runs = [], run = null, i;
for (i = 0; i < pts.length; i++) {
  var ph = isMalibuPhantom(pts[i]);
  if (!run || run.ph !== ph) {
    if (run) runs.push(run);
    run = { ph: ph, start: i, end: i, lat0: pts[i].lat, lon0: pts[i].lon, lat1: pts[i].lat, lon1: pts[i].lon };
  } else {
    run.end = i; run.lat1 = pts[i].lat; run.lon1 = pts[i].lon;
  }
}
if (run) runs.push(run);

WScript.Echo('malibu runs (' + runs.length + '):');
for (i = 0; i < runs.length; i++) {
  var r = runs[i];
  WScript.Echo((r.ph ? 'PHANTOM' : 'GOOD   ') + ' i' + r.start + '..' + r.end + ' (' + (r.end - r.start + 1) + ' pts) ' +
    r.lat0.toFixed(3) + ',' + r.lon0.toFixed(3) + ' -> ' + r.lat1.toFixed(3) + ',' + r.lon1.toFixed(3));
}

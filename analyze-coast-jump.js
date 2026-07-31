// Quick analyze coast-geo.js segments. Run: cscript //Nologo analyze-coast-jump.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var src = fso.OpenTextFile(root + '\\coast-geo.js', 1).ReadAll();
var COAST_GEO = {};
eval(src.replace(/window\.COAST_GEO/g, 'COAST_GEO'));

function haversineM(a, b) {
  var R = 6371000, d2r = Math.PI / 180;
  var dlat = (b.lat - a.lat) * d2r, dlon = (b.lon - a.lon) * d2r;
  var la = a.lat * d2r, lb = b.lat * d2r;
  var h = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

WScript.Echo('Line count: ' + COAST_GEO.lines.length);
for (var li = 0; li < COAST_GEO.lines.length; li++) {
  var line = COAST_GEO.lines[li];
  var pts = line.pts;
  var maxD = 0, maxI = -1;
  for (var i = 0; i < pts.length - 1; i++) {
    var d = haversineM(pts[i], pts[i + 1]);
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > 1000) {
    WScript.Echo(line.name + ': ' + pts.length + ' pts, max seg ' + maxI + ' = ' + maxD.toFixed(2) + 'm (' + (maxD / 1852).toFixed(1) + ' NM)');
    if (maxD > 5000) {
      var a = pts[maxI], b = pts[maxI + 1];
      WScript.Echo('  from ' + a.lat + ',' + a.lon + ' to ' + b.lat + ',' + b.lon);
    }
  }
}

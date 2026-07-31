var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var COAST_OVERLAY_LITE = {};
eval(fso.OpenTextFile(root + '\\coast-overlay-lite.js', 1).ReadAll().replace(/window\.COAST_OVERLAY_LITE/g, 'COAST_OVERLAY_LITE'));
for (var i = 0; i < COAST_OVERLAY_LITE.lines.length; i++) {
  var l = COAST_OVERLAY_LITE.lines[i];
  WScript.Echo(l.name + ': ' + l.pts.length + ' pts, first ' + l.pts[0].lat + ',' + l.pts[0].lon + ' last ' + l.pts[l.pts.length-1].lat + ',' + l.pts[l.pts.length-1].lon);
}

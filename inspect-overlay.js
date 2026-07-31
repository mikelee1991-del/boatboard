var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var G = {};
eval(fso.OpenTextFile(root + '\\coast-overlay-lite.js', 1).ReadAll().replace(/window\.COAST_OVERLAY_LITE/g, 'G'));
WScript.Echo('lines=' + G.lines.length);
WScript.Echo('islands=' + (G.islands ? G.islands.length : 0));
WScript.Echo('land=' + (G.land ? G.land.length : 0));
for (var i = 0; i < G.lines.length; i++) {
  var p = G.lines[i].pts;
  var minLon = 1e9, maxLon = -1e9, minLat = 1e9, maxLat = -1e9;
  for (var j = 0; j < p.length; j++) {
    if (p[j].lon < minLon) minLon = p[j].lon;
    if (p[j].lon > maxLon) maxLon = p[j].lon;
    if (p[j].lat < minLat) minLat = p[j].lat;
    if (p[j].lat > maxLat) maxLat = p[j].lat;
  }
  WScript.Echo(G.lines[i].name + ' pts=' + p.length +
    ' lat=' + minLat + '..' + maxLat +
    ' lon=' + minLon + '..' + maxLon);
}

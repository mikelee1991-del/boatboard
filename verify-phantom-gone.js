var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var G = {};
eval(fso.OpenTextFile(root + '\\coast-overlay-lite.js', 1).ReadAll().replace(/window\.COAST_OVERLAY_LITE/g, 'G'));
var phantom = 0, i, j, p;
for (i = 0; i < G.lines.length; i++) {
  if (G.lines[i].name.indexOf('coast-other-2') !== 0) continue;
  for (j = 0; j < G.lines[i].pts.length; j++) {
    p = G.lines[i].pts[j];
    if (p.lat >= 33.645 && p.lat <= 33.728 && p.lon >= -118.185 && p.lon <= -118.115) phantom++;
  }
}
WScript.Echo('phantom-box pts remaining: ' + phantom);

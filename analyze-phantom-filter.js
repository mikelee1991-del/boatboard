// Detect phantom channel indices in coast-other-2.
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var COAST_GEO = {};
eval(fso.OpenTextFile(root + '\\coast-geo.js', 1).ReadAll().replace(/window\.COAST_GEO/g, 'COAST_GEO'));

function isPhantomChannelPoint(p) {
  return p.lat >= 33.64 && p.lat <= 33.735 && p.lon >= -118.20 && p.lon <= -118.11;
}

var pts = COAST_GEO.lines[5].pts; // coast-other-2 is index 5
var phantomStart = -1, phantomEnd = -1, inP = false;
for (var i = 0; i < pts.length; i++) {
  var ph = isPhantomChannelPoint(pts[i]);
  if (ph && !inP) { phantomStart = i; inP = true; }
  if (!ph && inP) { phantomEnd = i - 1; break; }
}
WScript.Echo('phantomStart=' + phantomStart + ' phantomEnd=' + phantomEnd);
if (phantomStart >= 0) {
  WScript.Echo('before: i' + (phantomStart-1) + ' ' + pts[phantomStart-1].lat + ',' + pts[phantomStart-1].lon);
  WScript.Echo('after: i' + (phantomEnd+1) + ' ' + pts[phantomEnd+1].lat + ',' + pts[phantomEnd+1].lon);
}

// Test filter runs
var runs = [], run = [];
for (i = 0; i < pts.length; i++) {
  if (isPhantomChannelPoint(pts[i])) {
    if (run.length >= 2) runs.push(run);
    run = [];
  } else {
    run.push(pts[i]);
  }
}
if (run.length >= 2) runs.push(run);
WScript.Echo('Runs after filter: ' + runs.length);
for (var ri = 0; ri < runs.length; ri++) {
  var r = runs[ri];
  WScript.Echo(' run' + ri + ': ' + r.length + ' pts, start ' + r[0].lat + ',' + r[0].lon + ' end ' + r[r.length-1].lat + ',' + r[r.length-1].lon);
}

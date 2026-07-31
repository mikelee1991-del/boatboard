// Verify MALIBU_GAP_FILL pier proximity. cscript //Nologo verify-malibu-gap-fill.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var MALIBU_GAP_FILL = [];
eval(fso.OpenTextFile(root + '\\malibu-gap-fill.js.txt', 1).ReadAll().replace(/var MALIBU_GAP_FILL/g, 'MALIBU_GAP_FILL'));

function hav(a, b) {
  var R = 6371000, d2r = Math.PI / 180;
  var dlat = (b.lat - a.lat) * d2r, dlon = (b.lon - a.lon) * d2r;
  var la = a.lat * d2r, lb = b.lat * d2r;
  var h = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

var REFS = [
  { n: 'El Segundo', lat: 33.915, lon: -118.435 },
  { n: 'Santa Monica Pier', lat: 34.010, lon: -118.497 },
  { n: 'Malibu Pier', lat: 34.035, lon: -118.678 },
  { n: 'Point Dume', lat: 34.001, lon: -118.806 }
];

WScript.Echo('MALIBU_GAP_FILL count=' + MALIBU_GAP_FILL.length);
var ri, i, best, bp;
for (ri = 0; ri < REFS.length; ri++) {
  best = 1e12; bp = null;
  for (i = 0; i < MALIBU_GAP_FILL.length; i++) {
    var d = hav(MALIBU_GAP_FILL[i], REFS[ri]);
    if (d < best) { best = d; bp = MALIBU_GAP_FILL[i]; }
  }
  WScript.Echo(REFS[ri].n + ': ' + (best / 1852).toFixed(3) + ' NM at ' + bp.lat + ',' + bp.lon);
}

var maxSeg = 0;
for (i = 1; i < MALIBU_GAP_FILL.length; i++) {
  var dm = hav(MALIBU_GAP_FILL[i - 1], MALIBU_GAP_FILL[i]);
  if (dm > maxSeg) maxSeg = dm;
}
WScript.Echo('maxSeg=' + maxSeg.toFixed(1) + 'm (' + (maxSeg / 0.3048).toFixed(0) + ' ft)');

// Check if malibu line is west/offshore of real beaches
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var COAST_GEO = {};
eval(fso.OpenTextFile(root + '\\coast-geo.js', 1).ReadAll().replace(/window\.COAST_GEO/g, 'COAST_GEO'));
var pts = COAST_GEO.lines[0].pts; // malibu is first line

var REFS = [
  { name: 'Santa Monica Pier', lat: 34.010, lon: -118.497 },
  { name: 'Malibu Pier', lat: 34.035, lon: -118.678 },
  { name: 'Point Dume', lat: 34.001, lon: -118.806 },
  { name: 'El Segundo', lat: 33.915, lon: -118.435 },
  { name: 'PV Palos Verdes', lat: 33.737, lon: -118.410 }
];

function hav(a,b){var R=6371000,d2r=Math.PI/180,dlat=(b.lat-a.lat)*d2r,dlon=(b.lon-a.lon)*d2r,la=a.lat*d2r,lb=b.lat*d2r,h=Math.sin(dlat/2)*Math.sin(dlat/2)+Math.cos(la)*Math.cos(lb)*Math.sin(dlon/2)*Math.sin(dlon/2);return 2*R*Math.asin(Math.sqrt(h));}

WScript.Echo('=== malibu: nearest point bearing from each ref ===');
var ri, i, best, bp, d;
for (ri = 0; ri < REFS.length; ri++) {
  best = 1e12; bp = null;
  for (i = 0; i < pts.length; i++) {
    d = hav(pts[i], REFS[ri]);
    if (d < best) { best = d; bp = pts[i]; }
  }
  var dlat = bp.lat - REFS[ri].lat;
  var dlon = bp.lon - REFS[ri].lon;
  WScript.Echo(REFS[ri].name + ': off ' + (best/1852).toFixed(2) + ' NM, overlay ' + bp.lat.toFixed(5) + ',' + bp.lon.toFixed(5) +
    ' deltaLat=' + (dlat*1852/60).toFixed(2) + 'nm dLon=' + (dlon*1852/60*Math.cos(REFS[ri].lat*Math.PI/180)).toFixed(2) + 'nm');
}

WScript.Echo('');
WScript.Echo('=== Sample malibu at lat bands (avg lon) ===');
var bands = [[33.92,33.94],[33.94,33.96],[33.96,33.98],[33.98,34.00],[34.00,34.02],[34.02,34.04],[34.04,34.06],[34.06,34.08]];
for (var bi = 0; bi < bands.length; bi++) {
  var lo = bands[bi][0], hi = bands[bi][1], sum = 0, n = 0;
  for (i = 0; i < pts.length; i++) {
    if (pts[i].lat >= lo && pts[i].lat < hi) { sum += pts[i].lon; n++; }
  }
  if (n > 0) WScript.Echo('lat ' + lo + '-' + hi + ': avgLon=' + (sum/n).toFixed(5) + ' n=' + n);
}

WScript.Echo('');
WScript.Echo('=== Check for phantom: points west of -118.55 at lat 33.96-34.08 ===');
var phantom = 0;
for (i = 0; i < pts.length; i++) {
  if (pts[i].lat >= 33.96 && pts[i].lat <= 34.08 && pts[i].lon < -118.55) phantom++;
}
WScript.Echo('west-stray pts: ' + phantom);

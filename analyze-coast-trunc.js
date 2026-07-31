// Last good coast-other-2 index + test SD section accuracy.
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var COAST_GEO = {};
eval(fso.OpenTextFile(root + '\\coast-geo.js', 1).ReadAll().replace(/window\.COAST_GEO/g, 'COAST_GEO'));

var NM = 1852;
function haversineM(a, b) {
  var R = 6371000, d2r = Math.PI / 180;
  var dlat = (b.lat - a.lat) * d2r, dlon = (b.lon - a.lon) * d2r;
  var la = a.lat * d2r, lb = b.lat * d2r;
  var h = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
var REFS = [
  { name: 'Seal Beach pier', lat: 33.741, lon: -118.104 },
  { name: 'Huntington Pier', lat: 33.655, lon: -118.004 },
  { name: 'Newport Pier', lat: 33.606, lon: -117.933 },
  { name: 'Long Beach Alamitos', lat: 33.756, lon: -118.117 },
  { name: 'San Pedro breakwater', lat: 33.705, lon: -118.275 },
  { name: 'Oceanside pier', lat: 33.195, lon: -117.385 },
  { name: 'San Diego Harbor', lat: 32.715, lon: -117.175 }
];

var pts = COAST_GEO.lines.filter(function(l){ return l.name==='coast-other-2'; })[0].pts;

for (var thresh = 1.0; thresh <= 3.0; thresh += 0.5) {
  var last = -1;
  for (var i = 0; i < pts.length; i++) {
    var best = 1e12;
    for (var r = 0; r < REFS.length; r++) {
      var d = haversineM(pts[i], REFS[r]);
      if (d < best) best = d;
    }
    if (best <= thresh * NM) last = i;
  }
  WScript.Echo('Within ' + thresh + ' NM: last i=' + last + ' (of ' + (pts.length-1) + ')');
}

WScript.Echo('');
WScript.Echo('=== i0-i6500 min landmark distance ===');
var worst = 0, worstI = -1;
for (i = 0; i <= 6500; i++) {
  best = 1e12;
  for (r = 0; r < REFS.length; r++) {
    d = haversineM(pts[i], REFS[r]);
    if (d < best) best = d;
  }
  if (best > worst) { worst = best; worstI = i; }
}
WScript.Echo('worst i0-6500: i=' + worstI + ' off=' + (worst/NM).toFixed(2) + 'NM');

WScript.Echo('');
WScript.Echo('=== SD section i17000+ ===');
for (i = 17000; i < pts.length; i += 500) {
  best = 1e12; var bn = '';
  for (r = 0; r < REFS.length; r++) {
    d = haversineM(pts[i], REFS[r]);
    if (d < best) { best = d; bn = REFS[r].name; }
  }
  WScript.Echo('i' + i + ': ' + pts[i].lat.toFixed(5) + ',' + pts[i].lon.toFixed(5) + ' off ' + bn + ' ' + (best/NM).toFixed(2) + 'NM');
}

// Diagnose PV coast phantom — why water at -118.42 fails isOnLand
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;

var samples = [
  { name: 'lunada', lat: 33.7683972, lon: -118.4273943 },
  { name: 'forrestal-tgt', lat: 33.7448, lon: -118.4168 },
  { name: 'pvshores-tgt', lat: 33.77415, lon: -118.4265 },
  { name: 'rockypoint', lat: 33.7705, lon: -118.4353333 },
  { name: 'abalone', lat: 33.750789, lon: -118.4126593 },
  { name: 'pvr5c', lat: 33.7204718, lon: -118.352473 },
  { name: 'whitepoint', lat: 33.7139958, lon: -118.3625655 },
  { name: 'mega-forrestal', lat: 33.7469508, lon: -118.438474 }
];

function shoreCands(lat) {
  var out = [], lines = COAST_GEO.lines || [], li, pts, i, a, b, t;
  for (li = 0; li < lines.length; li++) {
    pts = lines[li].pts || [];
    for (i = 0; i < pts.length - 1; i++) {
      a = pts[i]; b = pts[i + 1];
      if (lat < Math.min(a.lat, b.lat) || lat > Math.max(a.lat, b.lat)) continue;
      t = Math.abs(b.lat - a.lat) < 1e-9 ? 0.5 : (lat - a.lat) / (b.lat - a.lat);
      out.push({ lon: a.lon + t * (b.lon - a.lon), line: lines[li].name });
    }
  }
  out.sort(function (x, y) { return x.lon - y.lon; });
  return out;
}

var s, i, loc, cands, westmost, eastmost;
for (i = 0; i < samples.length; i++) {
  s = samples[i];
  loc = LA.localEastM(s.lat, s.lon);
  WScript.Echo(s.name + ' ' + s.lat + ',' + s.lon +
    ' onLand=' + LA.isOnLand(s.lat, s.lon) +
    ' eastShore=' + LA.isEastOfShoreline(s.lat, s.lon) +
    ' SPBay=' + LA.isSPBay(s.lat, s.lon) +
    ' locEast=' + loc.eastM + ' dist=' + loc.distM);
  cands = shoreCands(s.lat);
  if (cands.length) {
    westmost = cands[0];
    eastmost = cands[cands.length - 1];
    WScript.Echo('  shoreLons n=' + cands.length +
      ' west=' + westmost.lon.toFixed(5) + '(' + westmost.line + ')' +
      ' east=' + eastmost.lon.toFixed(5) + '(' + eastmost.line + ')');
    // show up to 6 westernmost
    var k, line = '  west6:';
    for (k = 0; k < Math.min(6, cands.length); k++) {
      line += ' ' + cands[k].lon.toFixed(4) + '/' + cands[k].line;
    }
    WScript.Echo(line);
  }
}

// Count coast pts west of -118.43 in PV lat band (phantom suspect)
var ph = 0, li, pts, p, j;
for (li = 0; li < COAST_GEO.lines.length; li++) {
  pts = COAST_GEO.lines[li].pts || [];
  for (j = 0; j < pts.length; j++) {
    p = pts[j];
    if (p.lat >= 33.70 && p.lat <= 33.80 && p.lon <= -118.43 && p.lon >= -118.55) {
      ph++;
      if (ph <= 5) WScript.Echo('PV-west pt ' + COAST_GEO.lines[li].name + ' ' + p.lat + ',' + p.lon);
    }
  }
}
WScript.Echo('PV lat band pts with lon<=-118.43: ' + ph);

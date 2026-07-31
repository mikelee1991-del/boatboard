// Patch coast-geo.js: remove coast-other-2 channel phantom, add OC gap fill.
// Run: cscript //Nologo repair-coast-phantom.js
// Then: cscript //Nologo build-coast-overlay-lite.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));

function haversineM(a, b) {
  var R = 6371000, d2r = Math.PI / 180;
  var dlat = (b.lat - a.lat) * d2r, dlon = (b.lon - a.lon) * d2r;
  var la = a.lat * d2r, lb = b.lat * d2r;
  var h = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function isChannelPhantom(p) {
  if (p.lat >= 33.46 && p.lat <= 33.76 && p.lon >= -118.22 && p.lon <= -117.72) {
    if (p.lon <= -118.20 && p.lat >= 33.72) return false;
    if (p.lat <= 33.48 && p.lon >= -117.75) return false;
    if (p.lon >= -118.20 && p.lon <= -117.78) return true;
  }
  return false;
}

function stripPhantomRuns(pts) {
  var segs = [], run = [], i;
  for (i = 0; i < pts.length; i++) {
    if (isChannelPhantom(pts[i])) {
      if (run.length >= 2) segs.push(run);
      run = [];
    } else {
      run.push(pts[i]);
    }
  }
  if (run.length >= 2) segs.push(run);
  return segs;
}

var OC_GAP_FILL = [
  { lat: 33.748, lon: -118.122 }, { lat: 33.741, lon: -118.104 }, { lat: 33.730, lon: -118.088 },
  { lat: 33.717, lon: -118.073 }, { lat: 33.700, lon: -118.048 }, { lat: 33.680, lon: -118.025 },
  { lat: 33.655, lon: -118.004 }, { lat: 33.640, lon: -117.975 }, { lat: 33.622, lon: -117.950 },
  { lat: 33.609, lon: -117.929 }, { lat: 33.590, lon: -117.900 }, { lat: 33.570, lon: -117.860 },
  { lat: 33.542, lon: -117.789 }, { lat: 33.510, lon: -117.755 }, { lat: 33.480, lon: -117.730 },
  { lat: 33.462, lon: -117.716 }
];

var newLines = [], li, line, stripped, phantomRemoved = 0;
for (li = 0; li < (COAST_GEO.lines || []).length; li++) {
  line = COAST_GEO.lines[li];
  if (!line) continue;
  if (line.name === 'coast-other-2') {
    stripped = stripPhantomRuns(line.pts);
    phantomRemoved = line.pts.length;
    for (var si = 0; si < stripped.length; si++) {
      var seg = stripped[si];
      var name = si === 0 ? 'coast-other-2' : 'coast-other-2-' + si;
      if (si === 1 && stripped.length >= 2) {
        var a = stripped[0][stripped[0].length - 1], b = seg[0];
        if (haversineM(a, b) > 3000 && a.lat >= 33.68 && b.lat <= 33.68) {
          newLines.push({ name: 'oc-mainland-gap', pts: OC_GAP_FILL });
        }
      }
      newLines.push({ name: name, pts: seg });
    }
    phantomRemoved -= stripped.reduce(function (s, x) { return s + x.length; }, 0);
    phantomRemoved -= OC_GAP_FILL.length;
  } else {
    newLines.push(line);
  }
}
COAST_GEO.lines = newLines;

function escStr(s) { return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
function ptOut(p) { return '{lat:' + (+p.lat.toFixed(6)) + ',lon:' + (+p.lon.toFixed(6)) + '}'; }
function lineOut(l) {
  var ptx = [], pi;
  for (pi = 0; pi < l.pts.length; pi++) ptx.push(ptOut(l.pts[pi]));
  return '    { name: \'' + escStr(l.name) + '\', pts: [' + ptx.join(',') + '] }';
}

var body = '/** OpenStreetMap coastline — Southern California (ODbL). Patched: repair-coast-phantom.js */\nwindow.COAST_GEO = {\n  lines: [\n';
for (li = 0; li < COAST_GEO.lines.length; li++) {
  if (li) body += ',\n';
  body += lineOut(COAST_GEO.lines[li]);
}
body += '\n  ],\n  islands: [\n';
for (li = 0; li < (COAST_GEO.islands || []).length; li++) {
  if (li) body += ',\n';
  body += lineOut(COAST_GEO.islands[li]);
}
body += '\n  ],\n  land: [\n';
for (li = 0; li < (COAST_GEO.land || []).length; li++) {
  if (li) body += ',\n';
  body += lineOut(COAST_GEO.land[li]);
}
body += '\n  ]\n};\n';

var bak = root + '\\coast-geo.js.bak-phantom';
if (!fso.FileExists(bak)) fso.CopyFile(root + '\\coast-geo.js', bak, true);
fso.OpenTextFile(root + '\\coast-geo.js', 2, true).Write(body);
WScript.Echo('Patched coast-geo.js: ' + COAST_GEO.lines.length + ' lines, removed ~' + phantomRemoved + ' phantom pts');
WScript.Echo('Backup: coast-geo.js.bak-phantom');

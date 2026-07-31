// Split coast-geo.js at erroneous long jumps (>5 km). Run: cscript //Nologo split-coast-jumps.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var src = fso.OpenTextFile(root + '\\coast-geo.js', 1).ReadAll();
var COAST_GEO = {};
eval(src.replace(/window\.COAST_GEO/g, 'COAST_GEO'));

var MAX_SEG = 5000;

function haversineM(a, b) {
  var R = 6371000, d2r = Math.PI / 180;
  var dlat = (b.lat - a.lat) * d2r, dlon = (b.lon - a.lon) * d2r;
  var la = a.lat * d2r, lb = b.lat * d2r;
  var h = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function splitLine(line) {
  if (!line) return [];
  var pts = line.pts;
  if (!pts || !pts.length) return [line];
  if (pts.length < 2) return [line];
  var parts = [], cur = { name: line.name, pts: [pts[0]] }, splits = 0;
  for (var i = 0; i < pts.length - 1; i++) {
    var a = pts[i], b = pts[i + 1], d = haversineM(a, b);
    if (d > MAX_SEG) {
      if (cur.pts.length >= 2) parts.push(cur);
      cur = { name: line.name + '-split' + parts.length, pts: [b] };
      splits++;
    } else cur.pts.push(b);
  }
  if (cur.pts.length >= 2) parts.push(cur);
  return parts.length ? parts : [line];
}

var newLines = [], totalSplits = 0;
for (var li = 0; li < COAST_GEO.lines.length; li++) {
  if (!COAST_GEO.lines[li]) continue;
  var parts = splitLine(COAST_GEO.lines[li]);
  if (parts.length > 1) totalSplits += parts.length - 1;
  for (var pi = 0; pi < parts.length; pi++) newLines.push(parts[pi]);
}

function fmtPt(p) { return '{lat:' + Math.round(p.lat * 1e6) / 1e6 + ',lon:' + Math.round(p.lon * 1e6) / 1e6 + '}'; }
var linesStart = src.indexOf('lines: [');
var islandsStart = src.indexOf('islands: [', linesStart);
var block = '  lines: [\n';
for (var i = 0; i < newLines.length; i++) {
  var pts = newLines[i].pts;
  block += '    { name: \'' + newLines[i].name.replace(/'/g, "\\'") + '\', pts: [';
  for (var j = 0; j < pts.length; j++) {
    if (j) block += ',';
    block += fmtPt(pts[j]);
  }
  block += '] }' + (i < newLines.length - 1 ? ',\n' : '\n');
}
block += '  ]';

var bak = root + '\\coast-geo.js.bak';
if (!fso.FileExists(bak)) fso.CopyFile(root + '\\coast-geo.js', bak, true);
var out = src.substring(0, linesStart) + block + ',\n' + src.substring(islandsStart);
fso.CreateTextFile(root + '\\coast-geo.js', true).Write(out);
WScript.Echo('split-coast-jumps: ' + COAST_GEO.lines.length + ' lines -> ' + newLines.length + ' (+' + totalSplits + ' splits)');

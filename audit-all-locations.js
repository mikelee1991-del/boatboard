// Audit ALL curated location arrays — run: cscript //Nologo audit-all-locations.js
// Exits 1 if any site needs FIX (for CI / pre-commit). Writes audit-all-locations.json.
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;

function extractArray(src, name) {
  var marker = 'const ' + name + ' = [';
  var start = src.indexOf(marker);
  if (start < 0) return null;
  start += marker.length;
  var depth = 1, i = start, inStr = false, strCh = '', esc = false;
  while (i < src.length && depth > 0) {
    var c = src.charAt(i);
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === strCh) inStr = false;
    } else {
      if (c === '"' || c === "'") { inStr = true; strCh = c; }
      else if (c === '[') depth++;
      else if (c === ']') depth--;
    }
    i++;
  }
  if (depth !== 0) return null;
  var body = src.substring(start, i - 1);
  try { return eval('[' + body + ']'); } catch (e) { WScript.Echo('ERROR parsing ' + name + ': ' + e.message); return null; }
}

var diveSrc = readFile('dive-engine.js');
var dashSrc = readFile('index.html');
var DIVE_SITES = extractArray(diveSrc, 'DIVE_SITES');
var FISH_SPOTS = extractArray(dashSrc, 'FISH_SPOTS');
var SURF_SPOTS = extractArray(dashSrc, 'SURF_SPOTS');
var CDIP_BUOYS = extractArray(dashSrc, 'CDIP_BUOYS');

var categories = [
  ['DIVE_SITES', DIVE_SITES],
  ['FISH_SPOTS', FISH_SPOTS],
  ['SURF_SPOTS', SURF_SPOTS],
  ['CDIP_BUOYS', CDIP_BUOYS]
];

var allRows = [], totalFix = 0;
WScript.Echo('\n## Location Audit (strict offshore rules)\n');
WScript.Echo('Flags: islandLand | inland localEast>50 | onLand | eastOfShoreline | mEast>50 | bluff/nearshore');
WScript.Echo('Exemptions: inner bight bay water, OC/SD coast gaps, SP Bay, King Harbor, CDFG Artificial Reef, boat+regional dive sites\n');

for (var ci = 0; ci < categories.length; ci++) {
  var cat = categories[ci][0], arr = categories[ci][1];
  if (!arr) { WScript.Echo('ERROR: failed to parse ' + cat); continue; }
  var ok = 0, fix = 0;
  for (var i = 0; i < arr.length; i++) {
    var row = LA.auditItem(arr[i], cat);
    allRows.push(row);
    if (row.verdict === 'OK') ok++; else fix++;
  }
  WScript.Echo(cat + ': ' + ok + ' OK, ' + fix + ' need fix (' + arr.length + ' total)');
  totalFix += fix;
}

var fixes = [];
for (var ri = 0; ri < allRows.length; ri++) {
  if (allRows[ri].verdict === 'FIX') fixes.push(allRows[ri]);
}

if (fixes.length) {
  WScript.Echo('\n## Sites needing fix (' + fixes.length + ')\n');
  WScript.Echo('| category | id | lat | lon | onLand | localEast | why | suggested |');
  WScript.Echo('|---|---|---|---|---|---|---|---|');
  for (var fi = 0; fi < fixes.length; fi++) {
    var r = fixes[fi];
    var sug = r.sugLat ? (r.sugLat + ', ' + r.sugLon + ' (' + r.sugPush + ')') : '';
    WScript.Echo('| ' + r.category + ' | ' + r.id + ' | ' + r.lat + ' | ' + r.lon + ' | ' + r.onLand + ' | ' + r.localEast + ' | ' + r.why + ' | ' + sug + ' |');
  }
}

function countRows(rows, cat, verdict) {
  var n = 0;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].category === cat && rows[i].verdict === verdict) n++;
  }
  return n;
}
function rowsForCat(rows, cat) {
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].category === cat) out.push(rows[i]);
  }
  return out;
}

var summary = {};
for (var ci2 = 0; ci2 < categories.length; ci2++) {
  var cname = categories[ci2][0];
  var catRows = rowsForCat(allRows, cname);
  summary[cname] = {
    total: catRows.length,
    ok: countRows(allRows, cname, 'OK'),
    fix: countRows(allRows, cname, 'FIX')
  };
}

if (typeof JSON === 'undefined') {
  JSON = { stringify: function (v) {
    function ser(o) {
      if (o === null) return 'null';
      var t = typeof o;
      if (t === 'number' || t === 'boolean') return String(o);
      if (t === 'string') return '"' + String(o).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
      if (Object.prototype.toString.call(o) === '[object Array]') {
        var a = []; for (var i = 0; i < o.length; i++) a.push(ser(o[i]));
        return '[' + a.join(',') + ']';
      }
      var p = []; for (var k in o) if (o.hasOwnProperty(k)) p.push('"' + k + '":' + ser(o[k]));
      return '{' + p.join(',') + '}';
    }
    return ser(v);
  }};
}

var out = fso.CreateTextFile(root + '\\audit-all-locations.json', true);
out.Write(JSON.stringify({ summary: summary, rows: allRows }, null, 2));
out.Close();
WScript.Echo('\nWrote audit-all-locations.json');

if (totalFix > 0) {
  WScript.Echo('\nFAIL: ' + totalFix + ' locations need offshore fix. Run: cscript //Nologo apply-coord-fixes-offshore.js');
  WScript.Quit(1);
}
WScript.Echo('\nPASS: all locations OK');
WScript.Quit(0);

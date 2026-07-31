/**
 * Merge latest pin-trust export (from parent transcript) into pin-trust-review-results.json
 * Dedupe by id (latest reviewedAt wins). Prefer this export for listed ids;
 * keep older yes only when id not in this export and not contradicted.
 * Usage: cscript //Nologo _merge-pin-trust-export.js
 *        OR: node _merge-pin-trust-export.js
 */
var isNode = typeof require !== 'undefined';
var fs, fso, root, readFile, writeFile;

if (isNode) {
  fs = require('fs');
  root = __dirname;
  readFile = function (n) { return fs.readFileSync(root + '/' + n, 'utf8'); };
  writeFile = function (n, c) { fs.writeFileSync(root + '/' + n, c); };
} else {
  fso = new ActiveXObject('Scripting.FileSystemObject');
  root = fso.GetParentFolderName(WScript.ScriptFullName);
  readFile = function (n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); };
  writeFile = function (n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); };
}

function parseJson(t) {
  if (t.charCodeAt(0) === 0xFEFF) t = t.substring(1);
  if (isNode) return JSON.parse(t);
  return eval('(' + t + ')');
}

function jsonStringify(v, pretty) {
  if (isNode) return JSON.stringify(v, null, pretty ? 2 : 0);
  function ser(o, ind) {
    if (o === null) return 'null';
    var t = typeof o;
    if (t === 'number' || t === 'boolean') return String(o);
    if (t === 'string') return '"' + String(o).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    var sp = pretty ? '\n' + ind : '';
    var sp2 = pretty ? '\n' + ind + '  ' : '';
    if (Object.prototype.toString.call(o) === '[object Array]') {
      if (!o.length) return '[]';
      var a = []; for (var i = 0; i < o.length; i++) a.push(ser(o[i], ind + (pretty ? '  ' : '')));
      return '[' + sp2 + a.join(',' + sp2) + sp + ']';
    }
    var p = []; for (var k in o) if (o.hasOwnProperty(k)) p.push('"' + k + '":' + (pretty ? ' ' : '') + ser(o[k], ind + (pretty ? '  ' : '')));
    return '{' + sp2 + p.join(',' + sp2) + sp + '}';
  }
  return ser(v, '');
}

function newer(a, b) {
  var ta = String(a.reviewedAt || '');
  var tb = String(b.reviewedAt || '');
  return ta >= tb ? a : b;
}

function dedupeById(arr) {
  var map = {};
  for (var i = 0; i < arr.length; i++) {
    var r = arr[i];
    if (!r || !r.id) continue;
    if (!map[r.id]) map[r.id] = r;
    else map[r.id] = newer(r, map[r.id]);
  }
  var out = [];
  for (var k in map) if (map.hasOwnProperty(k)) out.push(map[k]);
  return out;
}

function countVerdicts(arr) {
  var s = { yes: 0, no: 0, unsure: 0, pending: 0, total: arr.length };
  for (var i = 0; i < arr.length; i++) {
    var v = String(arr[i].verdict || '').toLowerCase();
    if (v === 'yes') s.yes++;
    else if (v === 'no') s.no++;
    else if (v === 'unsure') s.unsure++;
    else s.pending++;
  }
  return s;
}

/* Load raw export written by extract step, or from _tmp-export-raw.json */
var rawPath = '_tmp-export-raw.json';
var exportDoc;
try {
  exportDoc = parseJson(readFile(rawPath));
} catch (e) {
  throw new Error('Missing ' + rawPath + ' — extract export first');
}

var oldDoc = parseJson(readFile('pin-trust-review-results.json'));
var exportDeduped = dedupeById(exportDoc.results || []);
var exportIds = {};
for (var i = 0; i < exportDeduped.length; i++) exportIds[exportDeduped[i].id] = true;

var merged = exportDeduped.slice();
var keptOldYes = 0;
var oldResults = oldDoc.results || [];
for (var o = 0; o < oldResults.length; o++) {
  var row = oldResults[o];
  if (!row || !row.id) continue;
  if (exportIds[row.id]) continue; /* this export authoritative for listed ids */
  if (String(row.verdict || '').toLowerCase() === 'yes') {
    merged.push(row);
    keptOldYes++;
  } else if (String(row.verdict || '').toLowerCase() === 'no' ||
             String(row.verdict || '').toLowerCase() === 'unsure') {
    /* Keep old no/unsure only if not re-listed (shouldn't happen often) */
    merged.push(row);
  }
}

merged = dedupeById(merged);
/* Sort: no, unsure, yes — then by reviewedAt */
merged.sort(function (a, b) {
  var order = { no: 0, unsure: 1, yes: 2 };
  var va = order[String(a.verdict || '').toLowerCase()];
  var vb = order[String(b.verdict || '').toLowerCase()];
  if (va == null) va = 9;
  if (vb == null) vb = 9;
  if (va !== vb) return va - vb;
  return String(a.reviewedAt || '') < String(b.reviewedAt || '') ? -1 : 1;
});

var summary = countVerdicts(merged);
var out = {
  type: 'pin-trust-review-results',
  exportedAt: exportDoc.exportedAt,
  dataGenerated: exportDoc.dataGenerated,
  summary: summary,
  mergeNote: 'Deduped export ' + exportDoc.exportedAt + ' by id (latest reviewedAt). Kept ' +
    keptOldYes + ' prior yes ids not re-listed in this export.',
  results: merged
};

writeFile('pin-trust-review-results.json', jsonStringify(out, true) + '\n');

function echo(s) {
  if (isNode) console.log(s);
  else WScript.Echo(s);
}
echo('Export raw results: ' + (exportDoc.results || []).length);
echo('Export deduped: ' + exportDeduped.length);
echo('Kept old yes: ' + keptOldYes);
echo('Merged total: ' + merged.length);
echo('Summary: yes=' + summary.yes + ' no=' + summary.no + ' unsure=' + summary.unsure);
var nos = [], uns = [], newDive = [];
for (var j = 0; j < merged.length; j++) {
  var r = merged[j];
  var v = String(r.verdict || '').toLowerCase();
  if (v === 'no') nos.push(r.id + ' ' + r.name);
  if (v === 'unsure') uns.push(r.id + ' ' + r.name);
  if (v === 'yes' && (r.id === 'cat_littlegeiger' || r.id === 'cat_littlefarnsworth' || r.id === 'cat_garibaldireef'))
    newDive.push(r.id + ' ' + r.name);
}
echo('NO:');
for (var n = 0; n < nos.length; n++) echo('  ' + nos[n]);
echo('UNSURE:');
for (var u = 0; u < uns.length; u++) echo('  ' + uns[u]);
echo('NEW DIVE YES:');
for (var d = 0; d < newDive.length; d++) echo('  ' + newDive[d]);

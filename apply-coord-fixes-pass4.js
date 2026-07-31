// Auto-apply offshore coord fixes from strict audit — cscript //Nologo apply-coord-fixes-pass4.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;

// Authoritative manual overrides (6–7 decimals)
var MANUAL = {
  seafangrotto: { lat: 33.4440000, lon: -118.4742833, note: 'CA Diving News N33°26.64 W118°28.457' },
  pebblybeach: { lat: 33.3268500, lon: -118.3302500, note: 'Pushed W off Pebbly Beach' },
  moonstone: { lat: 33.3238500, lon: -118.3307500, note: 'Pushed W off Moonstone Beach' },
  buttonshell: { lat: 33.3168500, lon: -118.3272500, note: 'Pushed W off Buttonshell' },
  hamiltoncove: { lat: 33.3427413, lon: -118.3190150, note: 'Hamilton Cove kelp offshore W' },
  chineserocks: { lat: 33.3233333, lon: -118.4785833, note: 'Chinese Rocks W side offshore' },
  rockquarry: { lat: 33.3133333, lon: -118.3017167, note: 'Rock Quarry NE Catalina offshore' },
  quarrywall: { lat: 33.3120000, lon: -118.3030000, note: 'Quarry wall offshore' },
  quarrycove: { lat: 33.3150000, lon: -118.3050000, note: 'Quarry Cove offshore' },
  smugglerscove: { lat: 34.0283333, lon: -119.5948333, note: 'Smugglers Cove SC island W' },
  frys: { lat: 34.0400000, lon: -119.5993333, note: 'Frys Harbor SC island W' },
  bechers: { lat: 33.9883333, lon: -120.0948333, note: 'Bechers Bay SR island W' }
};

var FISH_TO_DIVE = {
  'Sea Fan Grotto fish — Catalina': 'seafangrotto',
  'Pebbly Beach kelp — Catalina': 'pebblybeach',
  'Moonstone Beach kelp — Catalina': 'moonstone',
  'Buttonshell Beach kelp — Catalina': 'buttonshell',
  'Rock Quarry Catalina fish grounds': 'rockquarry',
  'Rock Quarry wall fish — Catalina NE': 'quarrywall',
  'Quarry Cove kelp — Catalina NE': 'quarrycove',
  'Chinese Rocks kelp — Catalina': 'chineserocks',
  'Smugglers Cove kelp — Santa Cruz Is.': 'smugglerscove',
  "Fry's Harbor kelp — Santa Cruz Is.": 'frys',
  "Bechers Bay kelp — Santa Rosa Is.": 'bechers'
};

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
  return eval('[' + src.substring(start, i - 1) + ']');
}

function replaceDiveById(text, id, lat, lon) {
  var re = new RegExp("(\\{\\s*id:\\s*'" + id + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+");
  if (!re.test(text)) return { text: text, changed: false };
  re.lastIndex = 0;
  return { text: text.replace(re, '$1' + lat + '$2' + lon), changed: true };
}

function replaceFishByName(text, name, lat, lon) {
  var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+");
  if (!re.test(text)) return { text: text, changed: false };
  re.lastIndex = 0;
  return { text: text.replace(re, '$1' + lat + '$2' + lon), changed: true };
}

var diveSrc = readFile('dive-engine.js');
var htmlSrc = readFile('index.html');
var DIVE_SITES = extractArray(diveSrc, 'DIVE_SITES');
var FISH_SPOTS = extractArray(htmlSrc, 'FISH_SPOTS');

var de = diveSrc, html = htmlSrc, dc = 0, fc = 0, log = [], manualIds = {};

// Apply manual dive fixes
for (var mid in MANUAL) {
  if (!MANUAL.hasOwnProperty(mid)) continue;
  var m = MANUAL[mid];
  manualIds[mid] = 1;
  var dr = replaceDiveById(de, mid, m.lat, m.lon);
  if (dr.changed) { de = dr.text; dc++; log.push('MANUAL DIVE ' + mid + ' -> ' + m.lat + ',' + m.lon); }
}

// Apply manual fish fixes via map
for (var fn in FISH_TO_DIVE) {
  if (!FISH_TO_DIVE.hasOwnProperty(fn)) continue;
  var fid = FISH_TO_DIVE[fn], mm = MANUAL[fid];
  if (!mm) continue;
  var hr = replaceFishByName(html, fn, mm.lat, mm.lon);
  if (hr.changed) { html = hr.text; fc++; log.push('MANUAL FISH ' + fn + ' -> ' + mm.lat + ',' + mm.lon); }
}

function applyAuditFixes(arr, cat, isDive) {
  for (var i = 0; i < arr.length; i++) {
    var item = arr[i];
    var id = item.id || item.name;
    if (isDive && manualIds[id]) continue;
    if (!isDive && FISH_TO_DIVE[item.name]) continue;
    var row = LA.auditItem(item, cat);
    if (row.verdict !== 'FIX' || !row.sugLat) continue;
    if (isDive) {
      var dr2 = replaceDiveById(de, id, row.sugLat, row.sugLon);
      if (dr2.changed) {
        de = dr2.text; dc++;
        log.push('AUTO DIVE ' + id + ' -> ' + row.sugLat + ',' + row.sugLon + ' (' + row.sugPush + ')');
        item.lat = row.sugLat; item.lon = row.sugLon;
      }
    } else {
      var hr2 = replaceFishByName(html, item.name, row.sugLat, row.sugLon);
      if (hr2.changed) {
        html = hr2.text; fc++;
        log.push('AUTO FISH ' + item.name + ' -> ' + row.sugLat + ',' + row.sugLon + ' (' + row.sugPush + ')');
        item.lat = row.sugLat; item.lon = row.sugLon;
      }
    }
  }
}

applyAuditFixes(DIVE_SITES, 'DIVE_SITES', true);
applyAuditFixes(FISH_SPOTS, 'FISH_SPOTS', false);

writeFile('dive-engine.js', de);
writeFile('index.html', html);
WScript.Echo('Pass4 offshore fixes: ' + dc + ' dive, ' + fc + ' fish');
if (log.length) WScript.Echo(log.join('\n'));

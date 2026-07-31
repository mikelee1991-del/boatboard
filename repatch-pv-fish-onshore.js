// Authoritative PV + remaining fish offshore repatch
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }
var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;
function rep(text, name, lat, lon) {
  var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+");
  if (!re.test(text)) return text;
  re.lastIndex = 0;
  return text.replace(re, '$1' + lat + '$2' + lon);
}
var FIX = {
  "Honeymoon Cove offshore kelp (PV)": [33.7640958, -118.3944132],
  "Christmas Tree Cove kelp \u2014 PV": [33.7616791, -118.3931641],
  "Neptune Cove arch kelp \u2014 Golden Cove": [33.7540754, -118.3969454],
  "Neptune Cove arch kelp fish \u2014 Golden Cove": [33.7540754, -118.3969454],
  "SS Dominator wreck rubble \u2014 Rocky Point": [33.7710958, -118.4018439],
  "Point Vicente kelp line (PV)": [33.7464292, -118.406211],
  "Palos Verdes Point reefs": [33.7464292, -118.406211],
  "The Crane \u2014 Haggerty's offshore": [33.7771469, -118.3983986],
  "Resort Point kelp wall \u2014 PV": [33.7645497, -118.4193457],
  "Marguerite Cove kelp \u2014 PV": [33.7566879, -118.4138892],
  "Lunada Bay outer reef fish \u2014 PV": [33.7674141, -118.4201485],
  "Marineland Reef 80ft": [33.749489, -118.4028257],
  "Vicente Outside Rock 80ft": [33.7464292, -118.406211],
  "Valiant wreck fish grounds": [33.7746738, -118.425],
  "Horseshoe Kelp": [33.7058333, -118.3688333],
  "Golf Ball Reef \u2014 Fermin Point kelp": [33.7771469, -118.3983986],
  "Manhattan Beach / El Porto halibut flats": [33.8844444, -118.3988989],
  "El Porto reef fish \u2014 Manhattan": [33.885, -118.3988989],
  "Manhattan Hard Bottom": [33.8844444, -118.3988989],
  "Sand Bass Junction": [33.6843, -118.18]
};
var html = readFile('index.html'), n = 0, bad = 0;
for (var nm in FIX) {
  if (!FIX.hasOwnProperty(nm)) continue;
  var lat = FIX[nm][0], lon = FIX[nm][1];
  var next = rep(html, nm, lat, lon);
  if (next !== html) { html = next; n++; }
  var r = LA.auditItem({ name: nm, lat: lat, lon: lon }, 'FISH_SPOTS');
  if (r.verdict !== 'OK') bad++;
}
writeFile('index.html', html);
WScript.Echo('Patched ' + n + ' spots, ' + bad + ' still fail audit at target coords');

// Pass 3: Authoritative coords for user-reported wrong sites + systematic scrub
// Run: cscript //Nologo apply-coord-fixes-pass3.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));

var D2R = Math.PI / 180, R2D = 180 / Math.PI;
function destPt(lat, lon, brgDeg, distM) {
  var R = 6371000, br = brgDeg * D2R, la = lat * D2R, lo = lon * D2R, d = distM / R;
  var nla = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(br));
  var nlo = lo + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(nla));
  return { lat: nla * R2D, lon: ((nlo * R2D + 540) % 360) - 180 };
}
function fmt7(n) { return Math.round(n * 1e7) / 1e7; }

function pointInPoly(lat, lon, poly) {
  var inside = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var yi = poly[i].lat, xi = poly[i].lon, yj = poly[j].lat, xj = poly[j].lon;
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi)) inside = !inside;
  }
  return inside;
}
function coastIslands() { return COAST_GEO.islands || []; }
function coastLines() { return COAST_GEO.lines || []; }
function onIsland(lat, lon) {
  for (var i = 0; i < coastIslands().length; i++) {
    var isle = coastIslands()[i];
    if (isle && isle.pts && pointInPoly(lat, lon, isle.pts)) return isle.name;
  }
  return '';
}
function isNearKingHarbor(lat, lon) {
  return lat >= 33.832 && lat <= 33.856 && lon >= -118.407 && lon <= -118.386;
}
function shoreLonCandidatesAtLat(lat) {
  var out = [];
  for (var li = 0; li < coastLines().length; li++) {
    var line = coastLines()[li];
    if (!line) continue;
    var pts = line.pts || line;
    if (!pts || !pts.length) continue;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      if (!a || !b) continue;
      var lo = Math.min(a.lat, b.lat), hi = Math.max(a.lat, b.lat);
      if (lat < lo || lat > hi) continue;
      var t = Math.abs(b.lat - a.lat) < 1e-9 ? 0.5 : (lat - a.lat) / (b.lat - a.lat);
      out.push(a.lon + t * (b.lon - a.lon));
    }
  }
  return out;
}
function bestShoreLonAtLat(lat) {
  var c = shoreLonCandidatesAtLat(lat);
  return c.length ? Math.max.apply(null, c) : null;
}
function isEastOfShoreline(lat, lon) {
  if (lat < 32.4 || lat > 35.2) return false;
  if (isNearKingHarbor(lat, lon)) return false;
  if ((lon > -118.05 && lat >= 33.45 && lat <= 33.72) || (lon > -117.35 && lat >= 32.5 && lat <= 33.05)) return false;
  for (var i = 0; i < coastIslands().length; i++) {
    if (coastIslands()[i] && coastIslands()[i].pts && pointInPoly(lat, lon, coastIslands()[i].pts)) return true;
  }
  var shoreLon = bestShoreLonAtLat(lat);
  if (shoreLon == null) return false;
  return lon > shoreLon + 0.00008;
}
var KING_HARBOR_LAND = [
  { lat: 33.833889, lon: -118.389444 }, { lat: 33.833889, lon: -118.378611 },
  { lat: 33.855000, lon: -118.378611 }, { lat: 33.855000, lon: -118.389444 },
  { lat: 33.851111, lon: -118.391667 }, { lat: 33.848611, lon: -118.392500 },
  { lat: 33.845000, lon: -118.392778 }, { lat: 33.841111, lon: -118.393056 },
  { lat: 33.837500, lon: -118.393333 }
];
function buildObstacles() {
  var out = [];
  for (var i = 0; i < (COAST_GEO.land || []).length; i++) {
    var l = COAST_GEO.land[i];
    if (l && l.pts) out.push({ poly: l.pts });
  }
  for (var j = 0; j < coastIslands().length; j++) {
    if (coastIslands()[j] && coastIslands()[j].pts) out.push({ poly: coastIslands()[j].pts });
  }
  return out;
}
var OBSTACLES = buildObstacles();
function isOnLand(lat, lon) {
  if (pointInPoly(lat, lon, KING_HARBOR_LAND)) return true;
  if (isNearKingHarbor(lat, lon)) return false;
  if (lat >= 32.4 && lat <= 35.2 && lon >= -121.5 && lon <= -117.0) {
    if (isEastOfShoreline(lat, lon)) return true;
    for (var i = 0; i < OBSTACLES.length; i++) {
      if (pointInPoly(lat, lon, OBSTACLES[i].poly)) return true;
    }
    return false;
  }
  return true;
}
function pushOffshore(lat, lon, face, note) {
  var dirs = [face || 270, 270, 90, 180, 0, 225, 315, 200, 160, 45, 135];
  var seen = {}, uniq = [];
  for (var di = 0; di < dirs.length; di++) {
    if (dirs[di] == null || seen[dirs[di]]) continue;
    seen[dirs[di]] = 1; uniq.push(dirs[di]);
  }
  var dists = [80, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1000];
  var onIsle = onIsland(lat, lon);
  for (var ui = 0; ui < uniq.length; ui++) {
    for (var pi = 0; pi < dists.length; pi++) {
      var p = destPt(lat, lon, uniq[ui], dists[pi]);
      if (isOnLand(p.lat, p.lon)) continue;
      if (onIsle) {
        if (!onIsland(p.lat, p.lon)) {
          return { lat: fmt7(p.lat), lon: fmt7(p.lon), note: note + ' push ' + dists[pi] + 'm @' + uniq[ui] };
        }
        continue;
      }
      return { lat: fmt7(p.lat), lon: fmt7(p.lon), note: note + ' push ' + dists[pi] + 'm @' + uniq[ui] };
    }
  }
  return { lat: fmt7(lat), lon: fmt7(lon), note: note + ' (no push found)' };
}

// Shore entries for offshore push
var terraneaOff = destPt(33.73880, -118.39350, 205, 280); // PADI Old Marineland entry
var lunadaOff = destPt(33.7700158, -118.4250738, 230, 280); // USGS Lunada Bay center
var lunadaOuter = destPt(33.7700158, -118.4250738, 230, 450);

var PASS3 = {
  // User-named sites — authoritative offshore targets
  ssacademy: { lat: 33.6957167, lon: -118.2652000, face: 270, note: 'FS Loop wreck ScubaBoard N33 41.743 W118 15.912' },
  ssresper: { lat: 33.6914833, lon: -118.2087000, face: 270, note: 'Georgia Straits socaloceanfishing / ScubaBoard' },
  sshilda: { lat: 33.7319167, lon: -118.1868333, face: 270, note: 'Johanna Smith Wikipedia 33d43m55sN 118d11m13sW' },
  terranea: { lat: terraneaOff.lat, lon: terraneaOff.lon, face: 205, note: 'Long Point kelp ~280m from PADI entry 33.73880,-118.39350' },
  lunada: { lat: lunadaOff.lat, lon: lunadaOff.lon, face: 230, note: 'Kelp west of Lunada cove USGS bay center' },
  lunadaoff: { lat: lunadaOuter.lat, lon: lunadaOuter.lon, face: 230, note: 'Outer Lunada kelp west of cove' },
  airportreef: { lat: 33.4613000, lon: -118.5114500, face: 270, note: 'West Eagle Reef CA Diving News N33 27.678 W118 30.687' },
  chineserocks: { lat: 33.3233333, lon: -118.4745833, face: 270, note: 'China Point backside Catalina 33 19.400N 118 28.475W' },
  // Systematic scrub — wrong city / round coords / platforms on land
  pc815: { lat: 32.6316667, lon: -117.2366667, face: 270, note: 'USS PC-815 Wikipedia San Diego 32d37m54sN 117d14m12sW' },
  eureka: { lat: 33.5638333, lon: -118.1166667, face: 270, note: 'Platform Eureka BSEE/USCG 33 33.833N 118 07.0W' },
  elly: { lat: 33.5837500, lon: -118.1293333, face: 270, note: 'Platform Elly BSEE 33 35.025N 118 07.76W' },
  edith: { lat: 33.5958100, lon: -118.1415860, face: 270, note: 'Platform Edith Helis 33.59581,-118.141586' },
  esther: { lat: 33.5823900, lon: -118.1291200, face: 270, note: 'Platform Ellen Helis 33.58239,-118.12912' },
  gina: { lat: 33.5823900, lon: -118.1291200, face: 270, note: 'Mapped to Ellen (no Gina platform in Beta Unit)' },
  barge272: { lat: 33.6958167, lon: -118.1435333, face: 270, note: 'Gambler wreck ScubaBoard N33 41.749 W118 08.612' },
  westendkelp: { lat: 33.4683333, lon: -118.5833333, face: 270, note: 'Catalina west end offshore kelp' },
  italians: { lat: 33.3768333, lon: -118.3418333, face: 90, note: 'Italian Gardens lee shore kelp offshore E' },
  bluffcove: { lat: 33.8025000, lon: -118.4125000, face: 250, note: 'Bluff Cove kelp west of Haggerty entry' },
  wayside: { lat: 33.8042000, lon: -118.4115000, face: 250, note: 'Wayside Park kelp offshore W' },
  longpointpv: { lat: 33.7398333, lon: -118.3968333, face: 225, note: 'Long Point PV kelp offshore' }
};

var FISH_TO_DIVE = {
  'SS Academy wreck fish — San Pedro Bay': 'ssacademy',
  'SS Resper wreck fish — San Pedro Bay': 'ssresper',
  'SS Hilda wreck fish — San Pedro': 'sshilda',
  'Terranea Cove kelp — PV': 'terranea',
  'Lunada Bay kelp — PV north': 'lunada',
  'Lunada Bay outer reef fish — PV': 'lunadaoff',
  'Airport Reef fish — Catalina': 'airportreef',
  'Chinese Rocks kelp — Catalina': 'chineserocks',
  'PC-815 wreck fish — San Pedro': 'pc815',
  'Eureka / Elly oil rig grounds': 'eureka',
  'Elly oil platform fish — SM Bay': 'elly',
  'Edith oil platform fish — SM Bay': 'edith',
  'Esther oil platform fish — SM Bay': 'esther',
  'Gina oil platform fish — SM Bay': 'gina',
  'Barge 272 reef fish — San Pedro Bay': 'barge272',
  'Bluff Cove kelp — PV': 'bluffcove',
  'Wayside Park kelp — PV': 'wayside'
};

var NAME_UPDATES = {
  ssacademy: 'FS Loop wreck — San Pedro Bay',
  ssresper: 'Georgia Straits wreck — San Pedro Bay',
  sshilda: 'Johanna Smith wreck — San Pedro Bay',
  airportreef: 'West Eagle Reef — Catalina isthmus',
  chineserocks: 'China Point — Catalina backside',
  pc815: 'PC-815 wreck — San Diego Bay',
  eureka: 'Eureka oil platform — San Pedro Bay',
  elly: 'Elly oil platform — San Pedro Bay',
  edith: 'Edith oil platform — San Pedro Bay',
  esther: 'Ellen oil platform — San Pedro Bay',
  gina: 'Ellen oil platform — San Pedro Bay'
};

function replaceDiveById(text, id, lat, lon) {
  var re = new RegExp("(\\{\\s*id:\\s*'" + id + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+");
  if (!re.test(text)) return { text: text, changed: false };
  re.lastIndex = 0;
  return { text: text.replace(re, '$1' + lat + '$2' + lon), changed: true };
}
function replaceDiveName(text, id, newName) {
  var re = new RegExp("(\\{\\s*id:\\s*'" + id + "'[^\\}]*?name:\\s*')([^']+)(')");
  if (!re.test(text)) return { text: text, changed: false };
  re.lastIndex = 0;
  return { text: text.replace(re, '$1' + newName + '$3'), changed: true };
}
function replaceFishByName(text, name, lat, lon) {
  var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+");
  if (!re.test(text)) return { text: text, changed: false };
  re.lastIndex = 0;
  return { text: text.replace(re, '$1' + lat + '$2' + lon), changed: true };
}
function replaceFishIdCoord(text, id, lat, lon) {
  var re = new RegExp("(id:\\s*'" + id + "'[^\\}]*?lat:)[\\d.eE+-]+(,\\s*lon:)[\\d.eE+-]+");
  if (!re.test(text)) return { text: text, changed: false };
  re.lastIndex = 0;
  return { text: text.replace(re, '$1' + lat + '$2' + lon), changed: true };
}

var resolved = {}, log = [];
for (var id in PASS3) {
  if (!PASS3.hasOwnProperty(id)) continue;
  var s = PASS3[id];
  var p = { lat: fmt7(s.lat), lon: fmt7(s.lon), note: s.note };
  if (isOnLand(p.lat, p.lon)) {
    var pushed = pushOffshore(s.lat, s.lon, s.face, s.note);
    p = pushed;
  }
  resolved[id] = p;
  log.push(id + ': -> ' + p.lat + ',' + p.lon + ' (' + p.note + ', onLand=' + isOnLand(p.lat, p.lon) + ')');
}

var de = readFile('dive-engine.js'), html = readFile('index.html');
var dc = 0, fc = 0, nc = 0;
for (var did in resolved) {
  if (!resolved.hasOwnProperty(did)) continue;
  var r = resolved[did];
  var dr = replaceDiveById(de, did, r.lat, r.lon);
  if (dr.changed) { de = dr.text; dc++; }
}
for (var nid in NAME_UPDATES) {
  if (!NAME_UPDATES.hasOwnProperty(nid)) continue;
  var nr = replaceDiveName(de, nid, NAME_UPDATES[nid]);
  if (nr.changed) { de = nr.text; nc++; }
}
writeFile('dive-engine.js', de);

for (var fname in FISH_TO_DIVE) {
  if (!FISH_TO_DIVE.hasOwnProperty(fname)) continue;
  var fid = FISH_TO_DIVE[fname], fr = resolved[fid];
  if (!fr) continue;
  var hr = replaceFishByName(html, fname, fr.lat, fr.lon);
  if (hr.changed) { html = hr.text; fc++; }
}
if (resolved.lunada) {
  var lr = replaceFishIdCoord(html, 'lunada', resolved.lunada.lat, resolved.lunada.lon);
  if (lr.changed) { html = lr.text; fc++; }
}
writeFile('index.html', html);

WScript.Echo('Pass3: ' + dc + ' dive coords, ' + nc + ' dive renames, ' + fc + ' fish updates\n' + log.join('\n'));

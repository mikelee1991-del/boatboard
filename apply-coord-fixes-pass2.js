// Pass 2: ID-based coord fixes + iterative offshore push — cscript //Nologo apply-coord-fixes-pass2.js
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
function isOnCatalina(lat, lon) {
  return onIsland(lat, lon) === 'Santa Catalina Island' ||
    (lat >= 33.30 && lat <= 33.50 && lon <= -118.30 && lon >= -118.65);
}
var KING_HARBOR_LAND = [
  { lat: 33.833889, lon: -118.389444 }, { lat: 33.833889, lon: -118.378611 },
  { lat: 33.855000, lon: -118.378611 }, { lat: 33.855000, lon: -118.389444 },
  { lat: 33.851111, lon: -118.391667 }, { lat: 33.848611, lon: -118.392500 },
  { lat: 33.845000, lon: -118.392778 }, { lat: 33.841111, lon: -118.393056 },
  { lat: 33.837500, lon: -118.393333 }
];
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
function isOCGap(lat, lon) {
  return (lon > -118.05 && lat >= 33.45 && lat <= 33.72) || (lon > -117.35 && lat >= 32.5 && lat <= 33.05);
}
function isLikelyOnWater(lat, lon) {
  if (isNearKingHarbor(lat, lon)) return true;
  if (lat < 32.4 || lat > 35.2 || lon > -117.0 || lon < -121.5) return false;
  if (isOCGap(lat, lon)) return !isEastOfShoreline(lat, lon);
  var shoreLon = bestShoreLonAtLat(lat);
  if (shoreLon == null) return false;
  return lon < shoreLon - 0.00025;
}
function pushOffshore(lat, lon, face, note) {
  var dirs = [face || 270, 270, 90, 180, 0, 225, 315, 200, 160, 45, 135];
  var seen = {}, uniq = [];
  for (var di = 0; di < dirs.length; di++) {
    if (dirs[di] == null || seen[dirs[di]]) continue;
    seen[dirs[di]] = 1; uniq.push(dirs[di]);
  }
  var dists = [80, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1200, 1500];
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

// Seed coords from research; script validates/pushes further if still on land
var PASS2 = {
  inspiration: { lat: 33.7353240, lon: -118.3682960, face: 200, note: 'USC Sea Grant bluff clearance' },
  pebblybeach: { lat: 33.3276500, lon: -118.3285000, face: 90, note: 'Catalina E channel kelp' },
  hamiltoncove: { lat: 33.3376500, lon: -118.3236500, face: 90, note: 'Hamilton Cove mooring kelp' },
  moonstone: { lat: 33.3242500, lon: -118.3275000, face: 90, note: 'Moonstone E kelp' },
  buttonshell: { lat: 33.3172500, lon: -118.3235000, face: 90, note: 'Buttonshell E kelp' },
  churchcove: { lat: 33.4416500, lon: -118.4942500, face: 270, note: 'Cat Harbor W kelp' },
  airportreef: { lat: 33.4036500, lon: -118.4198500, face: 270, note: 'Airport Reef W kelp' },
  littleharborback: { lat: 33.3766500, lon: -118.3668500, face: 180, note: 'Little Harbor backside' },
  chineserocks: { lat: 33.4300000, lon: -118.4802500, face: 270, note: 'Chinese Rocks W kelp' },
  seafangrotto: { lat: 33.4350000, lon: -118.4836500, face: 270, note: 'Sea Fan Grotto W kelp' },
  smpier: { lat: 33.9980000, lon: -118.5055000, face: 270, note: 'SM Pier reef W' },
  venice: { lat: 33.9850000, lon: -118.4775000, face: 270, note: 'Venice nearshore reef W' },
  playadelrey: { lat: 33.9600000, lon: -118.4575000, face: 270, note: 'Playa del Rey reef W' },
  sanclemente: { lat: 33.4261110, lon: -117.6265000, face: 270, note: 'San Clemente Pier kelp W' },
  tstreet: { lat: 33.4200000, lon: -117.6225000, face: 270, note: 'T-Street kelp W' },
  calafia: { lat: 33.4150000, lon: -117.6175000, face: 270, note: 'Calafia kelp W' },
  riviera: { lat: 33.4280000, lon: -117.6325000, face: 270, note: 'Riviera kelp W' },
  smugglers: { lat: 34.0285000, lon: -119.5865000, face: 270, note: 'Smugglers Cove mooring kelp' },
  frysharbor: { lat: 34.0385000, lon: -119.5965000, face: 270, note: "Fry's Harbor kelp" },
  santarosa: { lat: 33.9885000, lon: -120.0865000, face: 270, note: 'Bechers Bay kelp W' }
};

var FISH_TO_DIVE = {
  'Inspiration Point kelp — PV': 'inspiration',
  'Pebbly Beach kelp — Catalina': 'pebblybeach',
  'Hamilton Cove kelp — Catalina': 'hamiltoncove',
  'Moonstone Beach kelp — Catalina': 'moonstone',
  'Buttonshell Beach kelp — Catalina': 'buttonshell',
  'Church Cove kelp — Catalina': 'churchcove',
  'Sea Fan Grotto fish — Catalina': 'seafangrotto',
  'Airport Reef fish — Catalina': 'airportreef',
  'Little Harbor backside kelp — Catalina': 'littleharborback',
  'Chinese Rocks kelp — Catalina': 'chineserocks',
  'Santa Monica Pier reef fish': 'smpier',
  'Venice Beach nearshore fish': 'venice',
  'Playa del Rey reef fish': 'playadelrey',
  'San Clemente Pier kelp': 'sanclemente',
  'T-Street kelp — San Clemente': 'tstreet',
  'Calafia Beach kelp — San Clemente': 'calafia',
  'Riviera kelp — San Clemente': 'riviera',
  'Smugglers Cove kelp — Santa Cruz Is.': 'smugglers',
  "Fry's Harbor kelp — Santa Cruz Is.": 'frysharbor',
  'Bechers Bay kelp — Santa Rosa Is.': 'santarosa'
};

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

var resolved = {}, log = [];
for (var id in PASS2) {
  if (!PASS2.hasOwnProperty(id)) continue;
  var s = PASS2[id];
  var p = s;
  if (isOnLand(s.lat, s.lon)) p = pushOffshore(s.lat, s.lon, s.face, s.note);
  else p = { lat: fmt7(s.lat), lon: fmt7(s.lon), note: s.note };
  if (isOnLand(p.lat, p.lon)) {
    var p2 = pushOffshore(p.lat, p.lon, s.face, s.note + ' retry');
    if (!isOnLand(p2.lat, p2.lon)) p = p2;
  }
  resolved[id] = p;
  log.push(id + ': -> ' + p.lat + ',' + p.lon + ' (' + p.note + ', onLand=' + isOnLand(p.lat, p.lon) + ')');
}

var de = readFile('dive-engine.js'), html = readFile('index.html');
var dc = 0, fc = 0;
for (var did in resolved) {
  if (!resolved.hasOwnProperty(did)) continue;
  var r = resolved[did];
  var dr = replaceDiveById(de, did, r.lat, r.lon);
  if (dr.changed) { de = dr.text; dc++; }
}
writeFile('dive-engine.js', de);

for (var fname in FISH_TO_DIVE) {
  if (!FISH_TO_DIVE.hasOwnProperty(fname)) continue;
  var fid = FISH_TO_DIVE[fname], fr = resolved[fid];
  if (!fr) continue;
  var hr = replaceFishByName(html, fname, fr.lat, fr.lon);
  if (hr.changed) { html = hr.text; fc++; }
}
// Fix corrupted surf spot venice in html if present
html = html.replace(/lon:\s*-118\.472833328333283+/g, 'lon: ' + resolved.venice.lon);
html = html.replace(/lon:\s*-118\.452833328333283+/g, 'lon: ' + resolved.playadelrey.lon);
html = html.replace(/lon:\s*-117\.612833328333283+/g, 'lon: ' + resolved.calafia.lon);
writeFile('index.html', html);

WScript.Echo('Pass2: ' + dc + ' dive, ' + fc + ' fish updates\n' + log.join('\n'));

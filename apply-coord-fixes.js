// Apply GPS fixes from audit — run: cscript //Nologo apply-coord-fixes.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);

function readFile(name) { return fso.OpenTextFile(root + '\\' + name, 1).ReadAll(); }
function writeFile(name, content) { var f = fso.CreateTextFile(root + '\\' + name, true); f.Write(content); f.Close(); }

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
    var pts = line.pts || line;
    if (!pts) continue;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
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
  if (pointInPoly(lat, lon, KING_HARBOR_LAND)) return false;
  if (isNearKingHarbor(lat, lon)) return true;
  if (lat < 32.4 || lat > 35.2 || lon > -117.0 || lon < -121.5) return false;
  if (isOCGap(lat, lon)) return !isEastOfShoreline(lat, lon);
  var shoreLon = bestShoreLonAtLat(lat);
  if (shoreLon == null) return false;
  return lon < shoreLon - 0.00025;
}
function suggestOffshore(lat, lon, face) {
  var dirs = [face || 270, 270, 90, 180, 0, 225, 315, 200, 160];
  var seen = {}, uniq = [];
  for (var di = 0; di < dirs.length; di++) {
    if (dirs[di] == null || seen[dirs[di]]) continue;
    seen[dirs[di]] = 1; uniq.push(dirs[di]);
  }
  var dists = [40, 60, 80, 100, 120, 150, 200, 250, 300, 350];
  for (var ui = 0; ui < uniq.length; ui++) {
    for (var pi = 0; pi < dists.length; pi++) {
      var p = destPt(lat, lon, uniq[ui], dists[pi]);
      if (!isOnLand(p.lat, p.lon)) {
        if (isOnCatalina(lat, lon) || onIsland(lat, lon)) return { lat: fmt7(p.lat), lon: fmt7(p.lon), pushM: dists[pi], dir: uniq[ui] };
        if (isLikelyOnWater(p.lat, p.lon) || isOCGap(p.lat, p.lon)) return { lat: fmt7(p.lat), lon: fmt7(p.lon), pushM: dists[pi], dir: uniq[ui] };
      }
    }
  }
  return null;
}

// Authoritative CDFG offshore reef coords (keep — audit false positive on coarse coast)
var KEEP_OFFSHORE = {
  smbayreef: { lat: 34.0130556, lon: -118.5425000 },
  topanga: { lat: 34.0272222, lon: -118.5325000 },
  malibureef: { lat: 34.0300000, lon: -118.6497222 },
  mdreyreef: { lat: 33.9683333, lon: -118.4863889 },
  redondoreefa: { lat: 33.8383333, lon: -118.4138889 },
  hermosareefb: { lat: 33.8544444, lon: -118.4130556 }
};

// Explicit fixes from audit suggestions + research
var EXPLICIT = {
  marguerite: { lat: 33.7566880, lon: -118.4182160 },
  inspiration: { lat: 33.7356620, lon: -118.3681480 },
  twoharbors: { lat: 33.4416670, lon: -118.4929550 },
  isthmuscove: { lat: 33.4440000, lon: -118.4902330 },
  metropole: { lat: 33.3400000, lon: -118.3141390 },
  nautilus: { lat: 33.3410000, lon: -118.3148850 },
  avalonouter: { lat: 33.3520000, lon: -118.3278470 },
  // Catalina east-side coves — kelp ~150–200 m offshore (OpenWaterAtlas / chart)
  pebblybeach: { lat: 33.3278333, lon: -118.3324167 },
  hamiltoncove: { lat: 33.3375833, lon: -118.3258333 },
  moonstone: { lat: 33.3244167, lon: -118.3291667 },
  buttonshell: { lat: 33.3174167, lon: -118.3251667 },
  // Isthmus / north shore — push into Cat Harbor / channel
  catharbor: { lat: 33.4416670, lon: -118.4929550 },
  churchcove: { lat: 33.4418333, lon: -118.4911667 },
  seafangrotto: { lat: 33.4350000, lon: -118.4816667 },
  airportreef: { lat: 33.4038333, lon: -118.4176667 },
  littleharborback: { lat: 33.3768333, lon: -118.3648333 },
  chineserocks: { lat: 33.4300000, lon: -118.4783333 },
  // Channel Islands harbor mooring kelp (offshore of anchorage)
  smugglers: { lat: 34.0300000, lon: -119.5833333 },
  frysharbor: { lat: 34.0400000, lon: -119.5933333 },
  santarosa: { lat: 33.9900000, lon: -120.0833333 },
  // Mainland beach sites — ~180 m seaward on face
  smpier: { lat: 33.9980000, lon: -118.5008333 },
  venice: { lat: 33.9850000, lon: -118.4728333 },
  playadelrey: { lat: 33.9600000, lon: -118.4528333 },
  sanclemente: { lat: 33.4261110, lon: -117.6216667 },
  tstreet: { lat: 33.4200000, lon: -117.6178333 },
  calafia: { lat: 33.4150000, lon: -117.6128333 },
  riviera: { lat: 33.4280000, lon: -117.6278333 }
};

// Fish spot name → dive id mapping for sync
var FISH_TO_DIVE = {
  'Marguerite Cove kelp — PV': 'marguerite',
  'Inspiration Point kelp — PV': 'inspiration',
  'Two Harbors kelp fish — Catalina': 'twoharbors',
  'Isthmus Cove kelp fish — Two Harbors': 'isthmuscove',
  'Metropole Shipwreck fish — Avalon': 'metropole',
  'Nautilus wreck fish — Avalon': 'nautilus',
  'Avalon Outer Reef fish — Catalina': 'avalonouter',
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
  'Bechers Bay kelp — Santa Rosa Is.': 'santarosa',
  'Bluff Cove kelp — PV': 'bluffcove',
  'Pt Vicente outer pinnacles fish — PV': 'ptvicenteoff',
  'Santa Monica Bay Artificial Reef center': 'smbayreef',
  'Marina del Rey Artificial Reef': 'mdreyreef',
  'Topanga Artificial Reef — Malibu': 'topanga',
  'Malibu Artificial Reef A': 'malibureef'
};

function lowPrecision(lat, lon) {
  var ls = String(lat), ns = String(lon);
  if (ls.indexOf('.') < 0 || ns.indexOf('.') < 0) return true;
  var ld = ls.split('.')[1].replace(/0+$/, ''), nd = ns.split('.')[1].replace(/0+$/, '');
  return ld.length < 5 || nd.length < 5;
}

function replaceCoord(text, oldLat, oldLon, newLat, newLon) {
  var ol = oldLat, on = oldLon;
  var patterns = [
    [ol, on],
    [Math.round(ol * 1e6) / 1e6, Math.round(on * 1e6) / 1e6],
    [Math.round(ol * 1e4) / 1e4, Math.round(on * 1e4) / 1e4]
  ];
  var nl = fmt7(newLat), nn = fmt7(newLon);
  var out = text, changed = false;
  for (var i = 0; i < patterns.length; i++) {
    var a = patterns[i][0], b = patterns[i][1];
    var re = new RegExp('lat:\\s*' + a + '0*,\\s*lon:\\s*' + b + '0*', 'g');
    if (re.test(out)) {
      out = out.replace(re, 'lat: ' + nl + ', lon: ' + nn);
      changed = true;
    }
    re = new RegExp('lat:\\s*' + a + '0*,\\s*\\n\\s*lon:\\s*' + b + '0*', 'g');
    if (re.test(out)) {
      out = out.replace(re, 'lat: ' + nl + ',\n    lon: ' + nn);
      changed = true;
    }
  }
  return { text: out, changed: changed };
}

// Build fix map from audit dive rows
var audit = eval('(' + readFile('audit-dive-sites.json') + ')');
var fixes = {};
var fixLog = [];

for (var ri = 0; ri < audit.rows.length; ri++) {
  var r = audit.rows[ri];
  if (r.verdict === 'OK') continue;
  var id = r.id;
  var newLat = r.lat, newLon = r.lon, reason = r.verdict;
  if (KEEP_OFFSHORE[id]) {
    newLat = KEEP_OFFSHORE[id].lat; newLon = KEEP_OFFSHORE[id].lon;
    reason = 'KEEP_CDFG';
  } else if (EXPLICIT[id]) {
    newLat = EXPLICIT[id].lat; newLon = EXPLICIT[id].lon;
    reason = 'EXPLICIT';
  } else if (r.sugLat != null) {
    newLat = r.sugLat; newLon = r.sugLon;
    reason = 'AUDIT_SUG';
  } else {
    var sug = suggestOffshore(r.lat, r.lon, null);
    if (sug) { newLat = sug.lat; newLon = sug.lon; reason = 'PUSH_' + sug.pushM + 'm_' + sug.dir; }
    else continue;
  }
  if (Math.abs(newLat - r.lat) < 1e-8 && Math.abs(newLon - r.lon) < 1e-8 && !lowPrecision(r.lat, r.lon)) continue;
  fixes[id] = { lat: fmt7(newLat), lon: fmt7(newLon), oldLat: r.lat, oldLon: r.lon, reason: reason };
  fixLog.push(id + ': ' + r.lat + ',' + r.lon + ' -> ' + fmt7(newLat) + ',' + fmt7(newLon) + ' (' + reason + ')');
}

// Precision-only pass on all dive sites
for (var si = 0; si < audit.rows.length; si++) {
  var s = audit.rows[si];
  if (fixes[s.id]) continue;
  if (lowPrecision(s.lat, s.lon)) {
    fixes[s.id] = { lat: fmt7(s.lat), lon: fmt7(s.lon), oldLat: s.lat, oldLon: s.lon, reason: 'PRECISION' };
    fixLog.push(s.id + ': precision ' + s.lat + ',' + s.lon + ' -> ' + fmt7(s.lat) + ',' + fmt7(s.lon));
  }
}

// Apply to dive-engine.js
var de = readFile('dive-engine.js');
var deChanges = 0;
for (var fid in fixes) {
  if (!fixes.hasOwnProperty(fid)) continue;
  var fx = fixes[fid];
  var res = replaceCoord(de, fx.oldLat, fx.oldLon, fx.lat, fx.lon);
  if (res.changed) { de = res.text; deChanges++; }
}
writeFile('dive-engine.js', de);

// Apply to fish spots
var html = readFile('index.html');
var fishChanges = 0;
var fishAudit = eval('(' + readFile('audit-all-locations.json') + ')');
for (var fi = 0; fi < fishAudit.rows.length; fi++) {
  var fr = fishAudit.rows[fi];
  if (fr.category !== 'FISH_SPOTS') continue;
  var fname = fr.name;
  var diveId = FISH_TO_DIVE[fname];
  var fx2 = diveId && fixes[diveId] ? fixes[diveId] : null;
  if (!fx2 && fr.verdict === 'FIX' && fr.sugLat != null) {
    fx2 = { lat: fmt7(fr.sugLat), lon: fmt7(fr.sugLon), oldLat: fr.lat, oldLon: fr.lon, reason: 'FISH_AUDIT' };
  }
  if (!fx2 && fr.verdict === 'FIX') {
    if (diveId && EXPLICIT[diveId]) {
      fx2 = { lat: EXPLICIT[diveId].lat, lon: EXPLICIT[diveId].lon, oldLat: fr.lat, oldLon: fr.lon, reason: 'FISH_EXPLICIT' };
    } else {
      var fsug = suggestOffshore(fr.lat, fr.lon, fr.face || 270);
      if (fsug) fx2 = { lat: fsug.lat, lon: fsug.lon, oldLat: fr.lat, oldLon: fr.lon, reason: 'FISH_PUSH' };
    }
  }
  if (!fx2 && lowPrecision(fr.lat, fr.lon)) {
    fx2 = { lat: fmt7(fr.lat), lon: fmt7(fr.lon), oldLat: fr.lat, oldLon: fr.lon, reason: 'FISH_PRECISION' };
  }
  if (!fx2) continue;
  var res2 = replaceCoord(html, fx2.oldLat, fx2.oldLon, fx2.lat, fx2.lon);
  if (res2.changed) {
    html = res2.text; fishChanges++;
    fixLog.push('FISH ' + fname + ': ' + fx2.oldLat + ',' + fx2.oldLon + ' -> ' + fx2.lat + ',' + fx2.lon + ' (' + fx2.reason + ')');
  }
}
writeFile('index.html', html);

WScript.Echo('Applied ' + deChanges + ' dive coord updates, ' + fishChanges + ' fish coord updates');
WScript.Echo('\n--- Fix log ---\n' + fixLog.join('\n'));

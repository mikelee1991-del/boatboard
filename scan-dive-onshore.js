// Strict onshore scan for DIVE_SITES in dive-engine.js — cscript //Nologo scan-dive-onshore.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;

function extractDiveSites(src) {
  var marker = 'const DIVE_SITES = [', start = src.indexOf(marker);
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

function classifyFail(lat, lon, why) {
  if (why.indexOf('islandLand') === 0) return 'islandLand';
  if (why === 'isOnLand' || why === 'eastOfShoreline') return 'mainlandOnshore';
  if (why.indexOf('bluffPV') >= 0 || why.indexOf('bluff') >= 0) return 'bluffTooClose';
  if (why.indexOf('localEast+') === 0 || why.indexOf('nearCoast') >= 0 || why.indexOf('nearshore') >= 0) return 'nearshoreOnLand';
  if (why.indexOf('mEast+') === 0) return 'eastOfShoreline';
  return 'other';
}

/** Named-site geographic sanity — catches wrong-island / bluff-cluster misplacements that lon gates alone miss. */
function namedSiteGeoFail(site) {
  var lat = site.lat, lon = site.lon, n = site.name || '', id = site.id || '';
  /* Valiant is the Avalon/Descanso Bay yacht wreck — never PV or San Pedro Bay. */
  if (id === 'valiant' || /Valiant/i.test(n)) {
    if (!(lat >= 33.348 && lat <= 33.355 && lon >= -118.330 && lon <= -118.320)) {
      return 'valiantMustBeDescansoBayAvalon';
    }
  }
  /* Descanso Beach Avalon is N of Casino Point — not Lover's Cove / south-harbor lat. */
  if (id === 'descanso' || /Descanso Beach — Avalon/i.test(n)) {
    if (!(lat >= 33.349 && lat <= 33.355 && lon >= -118.330 && lon <= -118.320)) {
      return 'descansoMustBeAvalonBayN';
    }
  }
  /* Malaga Cove / Wayside / RAT are N PV (~33.80), not Flat Rock bluff cluster (~33.77). */
  if (id === 'malaga' || id === 'malagaoff' || id === 'wayside' || id === 'torrance' ||
      /Malaga Cove/i.test(n) || /Wayside Park/i.test(n) || /Rat Beach|Torrance Beach \/ Rat/i.test(n)) {
    if (!(lat >= 33.798 && lat <= 33.815 && lon <= -118.397 && lon >= -118.420)) {
      return 'northPvMalagaBand';
    }
  }
  /* Haggerty's shore kelp sits SW of Malaga (~33.80), not mid-peninsula 33.77 bluff tops. */
  if (id === 'haggerty' || (/Haggerty/i.test(n) && !/Crane|Golf Ball/i.test(n))) {
    if (!(lat >= 33.798 && lat <= 33.810 && lon <= -118.400 && lon >= -118.420)) {
      return 'haggertyMustBeNorthPv';
    }
  }
  /* Bluff Cove proper is ~0.9 mi S of Malaga (~33.79), not Flat Rock (~33.77). */
  if (id === 'bluffcove' || /^Bluff Cove —/i.test(n)) {
    if (!(lat >= 33.788 && lat <= 33.798 && lon <= -118.405 && lon >= -118.420)) {
      return 'bluffCoveMustBeNorthPv';
    }
  }
  /* Corona del Mar dive is S of the beach parking — not 33.595/-117.870 onshore. */
  if (id === 'corona' || /Corona del Mar — Newport/i.test(n)) {
    if (!(lat >= 33.588 && lat <= 33.594 && lon <= -117.870 && lon >= -117.885)) {
      return 'coronaMustBeOffshoreCdM';
    }
  }
  return '';
}

function strictDiveOnshore(site) {
  var lat = site.lat, lon = site.lon;
  if (LA.isFarOffshoreFish(lat, lon) && site.regional) return { fail: false };
  /* CDFG / verified / inherent KML / userTrusted — authoritative; do not move for coast-geo phantoms. */
  if (/Artificial Reef/i.test(site.name || '') || site.cdfgAppendix ||
      site.verified || site.kmlImported || site.userTrusted) {
    return { fail: false, loc: LA.localEastM(lat, lon) };
  }

  var loc = LA.localEastM(lat, lon);
  var namedWhy = namedSiteGeoFail(site);
  if (namedWhy) {
    return { fail: true, why: namedWhy, loc: loc, kind: 'other' };
  }

  /* PV bluff band hard lon floor — anything east of ~118.405W in 33.73–33.80 is bluff/residential. */
  var pvBluffBand = lat >= 33.73 && lat <= 33.80 && lon >= -118.44 && lon <= -118.32;
  if (pvBluffBand && lon > -118.405) {
    return { fail: true, why: 'pvBluffLonGate lon=' + lon, loc: loc, kind: 'bluffTooClose' };
  }

  /* San Pedro / Pt Fermin shore dives — channel water west of ~118.36W. */
  if (lat >= 33.68 && lat <= 33.73 && lon >= -118.44 && lon <= -118.28 && lon > -118.36 && !site.boat) {
    return { fail: true, why: 'sanPedroLonGate lon=' + lon, loc: loc, kind: 'nearshoreOnLand' };
  }
  if (lat >= 33.68 && lat <= 33.73 && lon >= -118.44 && lon <= -118.36 && !site.boat) {
    if (LA.isOnLand(lat, lon)) {
      return { fail: true, why: 'isOnLand', loc: loc, kind: 'mainlandOnshore' };
    }
    return { fail: false, loc: loc };
  }
  /* San Pedro Bay channel — boat wrecks/reefs east of PV point are still in water. */
  if (site.boat && lat >= 33.68 && lat <= 33.73 && lon >= -118.40 && lon <= -118.25) {
    return { fail: false, loc: loc };
  }

  /*
   * PV west-coast water: use pvSeawardM + isOnLand (same as fish scan).
   * Do NOT early-OK on lon alone — that previously greenlit Valiant/Haggerty/Malaga
   * bluff-top pins at lon ≤ −118.405. Do NOT trust localEastM here (normals flip on PV).
   */
  var pvSea = LA.pvSeawardM(lat, lon);
  if (pvSea != null && lon <= -118.32 && lat >= 33.72 && lat <= 33.87) {
    if (LA.isOnLand(lat, lon)) {
      return { fail: true, why: 'isOnLand', loc: loc, kind: 'mainlandOnshore' };
    }
    if (pvSea < 80) {
      return { fail: true, why: 'bluffPV sea=' + Math.round(pvSea), loc: loc, kind: 'bluffTooClose' };
    }
    return { fail: false, loc: loc };
  }

  var issue = LA.needsOffshoreFix(lat, lon, site.face || 270, !!site.boat, !!site.regional, 'DIVE_SITES');
  if (issue) {
    return { fail: true, why: issue.why, loc: loc, kind: classifyFail(lat, lon, issue.why) };
  }

  var oi = LA.onIsland(lat, lon);
  if (oi) return { fail: true, why: 'islandLand ' + oi, loc: loc, kind: 'islandLand' };
  if (LA.isOnLand(lat, lon)) {
    return { fail: true, why: 'isOnLand', loc: loc, kind: 'mainlandOnshore' };
  }
  if (loc.distM < 2500 && loc.eastM > 50) {
    return { fail: true, why: 'localEast+' + loc.eastM, loc: loc, kind: 'nearshoreOnLand' };
  }
  if (loc.distM < 450 && loc.eastM > -280) {
    return { fail: true, why: 'nearCoast dist=' + loc.distM + ' east=' + loc.eastM, loc: loc, kind: 'nearshoreOnLand' };
  }
  return { fail: false, loc: loc };
}

var DIVE_SITES = extractDiveSites(readFile('dive-engine.js'));
if (!DIVE_SITES) { WScript.Echo('ERROR: could not parse DIVE_SITES'); WScript.Quit(1); }

var fails = [], pvFails = [], byKind = {};
for (var i = 0; i < DIVE_SITES.length; i++) {
  var s = DIVE_SITES[i];
  var r = strictDiveOnshore(s);
  if (!r.fail) continue;
  var row = {
    id: s.id, name: s.name, lat: s.lat, lon: s.lon,
    why: r.why, kind: r.kind, boat: !!s.boat, regional: !!s.regional,
    loc: r.loc || LA.localEastM(s.lat, s.lon)
  };
  fails.push(row);
  if (!byKind[r.kind]) byKind[r.kind] = 0;
  byKind[r.kind]++;
  if (s.lat >= 33.68 && s.lat <= 33.84 && s.lon >= -118.44 && s.lon <= -118.26) pvFails.push(row);
}

WScript.Echo('DIVE_SITES total: ' + DIVE_SITES.length);
WScript.Echo('Strict onshore FAIL: ' + fails.length);
WScript.Echo('PV peninsula FAIL: ' + pvFails.length);
WScript.Echo('By kind: islandLand=' + (byKind.islandLand || 0) +
  ' mainlandOnshore=' + (byKind.mainlandOnshore || 0) +
  ' bluffTooClose=' + (byKind.bluffTooClose || 0) +
  ' nearshoreOnLand=' + (byKind.nearshoreOnLand || 0) +
  ' eastOfShoreline=' + (byKind.eastOfShoreline || 0) +
  ' other=' + (byKind.other || 0));
WScript.Echo('');
WScript.Echo('--- All failures ---');
for (var f = 0; f < fails.length; f++) {
  var x = fails[f];
  WScript.Echo(x.id + ' | ' + x.name + ' | ' + x.lat + ',' + x.lon + ' | ' + x.kind + ' | ' + x.why +
    ' | dist=' + x.loc.distM + ' east=' + x.loc.eastM);
}

if (fails.length > 0) WScript.Quit(1);

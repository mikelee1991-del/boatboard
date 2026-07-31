/* Shared location audit geo — load after COAST_GEO is defined.
 * CScript: eval(readFile('location-audit-core.js'));
 * Browser: COAST_GEO must exist; call LocationAudit.init(COAST_GEO);
 */
(function (root) {
  var G = null;
  var D2R = Math.PI / 180;

  function init(coastGeo) { G = coastGeo || root.COAST_GEO; }

  function coastLines() { return (G && G.lines) || []; }
  function coastIslands() { return (G && G.islands) || []; }

  var KING_HARBOR_LAND = [
    { lat: 33.833889, lon: -118.389444 }, { lat: 33.833889, lon: -118.378611 },
    { lat: 33.855000, lon: -118.378611 }, { lat: 33.855000, lon: -118.389444 },
    { lat: 33.851111, lon: -118.391667 }, { lat: 33.848611, lon: -118.392500 },
    { lat: 33.845000, lon: -118.392778 }, { lat: 33.841111, lon: -118.393056 },
    { lat: 33.837500, lon: -118.393333 }
  ];

  function pointInPoly(lat, lon, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var yi = poly[i].lat, xi = poly[i].lon, yj = poly[j].lat, xj = poly[j].lon;
      if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi)) inside = !inside;
    }
    return inside;
  }

  function isNearKingHarbor(lat, lon) {
    return lat >= 33.832 && lat <= 33.856 && lon >= -118.420 && lon <= -118.386;
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

  /**
   * Westernmost mainland shore lon near PV (ignore harbor spaghetti east of -118.30).
   * pv-north/pv-south localEastM normals are flipped vs true seaward — prefer this.
   */
  function pvWestShoreLonAtLat(lat) {
    if (lat < 33.68 || lat > 33.82) return null;
    var c = shoreLonCandidatesAtLat(lat), west = null, i, lon;
    for (i = 0; i < c.length; i++) {
      lon = c[i];
      if (lon > -118.30 || lon < -118.55) continue;
      if (west == null || lon < west) west = lon;
    }
    return west;
  }

  /** Meters west of PV western shoreline (positive = seaward / in water). */
  function pvSeawardM(lat, lon) {
    var shore = pvWestShoreLonAtLat(lat);
    if (shore == null) return null;
    return (shore - lon) * 111320 * Math.cos(lat * D2R);
  }

  function isOCGap(lat, lon) {
    return (lon > -118.05 && lat >= 33.45 && lat <= 33.72) ||
      (lon > -117.50 && lat >= 32.5 && lat <= 33.36) ||
      (lon > -117.95 && lat >= 33.38 && lat <= 33.48); /* San Clemente */
  }

  function isSPBay(lat, lon) {
    if (lat >= 33.70 && lat <= 33.78 && lon >= -118.26 && lon <= -118.05) return true;
    /* San Pedro shelf / White Point / Pt Fermin / PVR — channel water west of PV tip. */
    if (lat >= 33.68 && lat <= 33.735 && lon >= -118.40 && lon <= -118.28) return true;
    /* Terminal Island / inner LA harbor channel (not PV bluff land). */
    if (lat >= 33.735 && lat <= 33.76 && lon >= -118.35 && lon <= -118.20) return true;
    return false;
  }

  function isChannelIsland(lat, lon) {
    return (lat >= 33.95 && lat <= 34.12 && lon >= -120.25 && lon <= -119.30) ||
      (lat >= 34.0 && lat <= 34.08 && lon >= -120.55 && lon <= -119.85);
  }

  function isOnCatalina(lat, lon) {
    for (var i = 0; i < coastIslands().length; i++) {
      var isle = coastIslands()[i];
      if (isle && isle.name === 'Santa Catalina Island' && isle.pts && pointInPoly(lat, lon, isle.pts)) return true;
    }
    return false;
  }

  function buildObstacles() {
    var out = [];
    for (var i = 0; i < (G.land || []).length; i++) {
      var l = G.land[i];
      if (l && l.pts) out.push({ poly: l.pts });
    }
    for (var j = 0; j < coastIslands().length; j++) {
      if (coastIslands()[j] && coastIslands()[j].pts) out.push({ poly: coastIslands()[j].pts });
    }
    return out;
  }

  var OBSTACLES = null;
  function obstacles() {
    if (!OBSTACLES && G) OBSTACLES = buildObstacles();
    return OBSTACLES || [];
  }

  function isEastOfShoreline(lat, lon) {
    if (lat < 32.4 || lat > 35.2) return false;
    if (isNearKingHarbor(lat, lon)) return false;
    if (isOCGap(lat, lon)) return false;
    for (var i = 0; i < coastIslands().length; i++) {
      if (coastIslands()[i] && coastIslands()[i].pts && pointInPoly(lat, lon, coastIslands()[i].pts)) return true;
    }
    /* PV west coast: use westernmost shore lon — max-lon picks harbor spaghetti east in the channel. */
    if (lat >= 33.68 && lat <= 33.82 && lon <= -118.28) {
      var pvWest = pvWestShoreLonAtLat(lat);
      if (pvWest != null) return lon > pvWest + 0.00008;
    }
    var shoreLon = bestShoreLonAtLat(lat);
    if (shoreLon == null) return false;
    return lon > shoreLon + 0.00008;
  }

  /** PV peninsula bluffs — west-facing coast only (exclude San Pedro / Alamitos bay). */
  function isPVPeninsula(lat, lon) {
    if (isSPBay(lat, lon)) return false;
    return lat >= 33.68 && lat <= 33.80 && lon >= -118.44 && lon <= -118.32;
  }

  function isInnerBightWater(lat, lon) {
    if (onIsland(lat, lon)) return false;
    if (isPVPeninsula(lat, lon)) return false;
    if (lat < 33.65 || lat > 33.92 || lon < -118.48 || lon > -118.22) return false;
    if (pointInPoly(lat, lon, KING_HARBOR_LAND)) return false;
    var loc = localEastM(lat, lon);
    if (loc.distM < 2500 && loc.eastM > 50) return false;
    return !isEastOfShoreline(lat, lon);
  }

  function isOnLand(lat, lon) {
    if (pointInPoly(lat, lon, KING_HARBOR_LAND)) return true;
    if (isNearKingHarbor(lat, lon)) return false;
    if (isInnerBightWater(lat, lon)) return false;
    /* PV west-facing bluffs — pv-* segment normals are flipped; use west-shore seaward test. */
    if (lat >= 33.68 && lat <= 33.82 && lon <= -118.32) {
      var pvSea = pvSeawardM(lat, lon);
      if (pvSea != null && pvSea > 40) return false;
      if (pvSea != null && pvSea < -40) return true;
    }
    if (isSPBay(lat, lon)) {
      var spLoc = localEastM(lat, lon);
      if (spLoc.eastM < 100) return false;
    }
    if (lat >= 32.4 && lat <= 35.2 && lon >= -121.5 && lon <= -117.0) {
      if (onIsland(lat, lon)) return true;
      if (isEastOfShoreline(lat, lon)) return true;
      for (var i = 0; i < obstacles().length; i++) {
        if (pointInPoly(lat, lon, obstacles()[i].poly)) return true;
      }
      var loc = localEastM(lat, lon);
      if (loc.distM < 2500 && loc.eastM > 50) return true;
      return false;
    }
    return true;
  }

  function isLikelyOnWater(lat, lon) {
    if (pointInPoly(lat, lon, KING_HARBOR_LAND)) return false;
    if (isNearKingHarbor(lat, lon)) return true;
    if (onIsland(lat, lon)) return false;
    if (lat < 32.4 || lat > 35.2 || lon > -117.0 || lon < -121.5) return false;
    var loc = localEastM(lat, lon);
    if (loc.distM < 2500 && loc.eastM > 50) return false;
    if (isOCGap(lat, lon)) return !isEastOfShoreline(lat, lon);
    var shoreLon = bestShoreLonAtLat(lat);
    if (shoreLon == null) return false;
    return lon < shoreLon - 0.00025;
  }

  function onIsland(lat, lon) {
    for (var i = 0; i < coastIslands().length; i++) {
      var isle = coastIslands()[i];
      if (isle && isle.pts && pointInPoly(lat, lon, isle.pts)) return isle.name;
    }
    return '';
  }

  function distToSegmentM(lat, lon, a, b) {
    var cos = Math.cos(lat * D2R);
    var ax = a.lon * cos, ay = a.lat, bx = b.lon * cos, by = b.lat, px = lon * cos, py = lat;
    var abx = bx - ax, aby = by - ay, apx = px - ax, apy = py - ay;
    var ab2 = abx * abx + aby * aby;
    var t = ab2 < 1e-18 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
    var qx = ax + t * abx, qy = ay + t * aby;
    var dlat = lat - qy, dlon = (lon - qx / cos);
    return { distM: Math.sqrt(dlat * dlat + dlon * dlon) * 111320, qx: qx, qy: qy, cos: cos };
  }

  var COAST_SEGS = null;
  function coastSegs() {
    if (COAST_SEGS) return COAST_SEGS;
    COAST_SEGS = [];
    for (var li = 0; li < coastLines().length; li++) {
      var line = coastLines()[li];
      if (!line) continue;
      var pts = line.pts || line;
      if (!pts) continue;
      for (var i = 0; i < pts.length - 1; i++) COAST_SEGS.push({ a: pts[i], b: pts[i + 1], name: line.name });
    }
    return COAST_SEGS;
  }

  function localEastM(lat, lon) {
    var best = 1e12, bestSeg = null, bestProj = null;
    for (var si = 0; si < coastSegs().length; si++) {
      var seg = coastSegs()[si];
      var r = distToSegmentM(lat, lon, seg.a, seg.b);
      if (r.distM < best) { best = r.distM; bestSeg = seg; bestProj = r; }
    }
    if (!bestSeg || best > 3000) return { eastM: 0, distM: Math.round(best) };
    var seg = bestSeg, p = bestProj;
    var tx = (seg.b.lon - seg.a.lon) * p.cos, ty = seg.b.lat - seg.a.lat;
    var tlen = Math.sqrt(tx * tx + ty * ty) || 1;
    var nx = -ty / tlen, ny = tx / tlen;
    var px = lon * p.cos - p.qx, py = lat - p.qy;
    return { eastM: Math.round(-(px * nx + py * ny) * 111320), distM: Math.round(best) };
  }

  function metersEastOfShoreline(lat, lon) {
    var shoreLon = bestShoreLonAtLat(lat);
    if (shoreLon == null) return 0;
    return (lon - shoreLon) * 111320 * Math.cos(lat * D2R);
  }

  function destPt(lat, lon, brgDeg, distM) {
    var R = 6371000, R2D = 180 / Math.PI;
    var br = brgDeg * D2R, la = lat * D2R, lo = lon * D2R, d = distM / R;
    var nla = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(br));
    var nlo = lo + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(nla));
    return { lat: nla * R2D, lon: ((nlo * R2D + 540) % 360) - 180 };
  }

  function fmt7(n) { return Math.round(n * 1e7) / 1e7; }

  function isNearIslandWater(lat, lon) {
    if (onIsland(lat, lon)) return false;
    if (lat >= 33.0 && lat <= 33.55 && lon >= -118.75 && lon <= -118.15) return true;
    if (lat >= 33.95 && lat <= 34.12 && lon >= -120.25 && lon <= -119.30) return true;
    if (lat >= 33.98 && lat <= 34.08 && lon >= -120.55 && lon <= -119.85) return true;
    if (lat >= 33.0 && lat <= 33.5 && lon >= -119.5 && lon <= -118.8) return true;
    return false;
  }

  /** Far offshore / beyond coast model — boat+regional audit exemption only here. */
  function isFarOffshoreFish(lat, lon) {
    if (lat < 32.4 || lat > 35.2 || lon > -117.0 || lon < -121.5) return true;
    var loc = localEastM(lat, lon);
    if (loc.distM > 8000) return true;
    if (lat <= 33.35 && lon >= -117.65 && lon <= -117.45) return true;
    if (loc.eastM < -800) return true;
    return false;
  }

  /** Stricter audit — uses island polygons + localEastM for peninsula/bluff false negatives. */
  function needsOffshoreFix(lat, lon, face, boat, regional, category) {
    if (category === 'SURF_SPOTS') return null;
    if (category === 'CDIP_BUOYS') return null;
    if (isNearKingHarbor(lat, lon)) return null;
    if (category === 'FISH_SPOTS' && isFarOffshoreFish(lat, lon)) return null;

    var oi = onIsland(lat, lon);
    if (oi) return { why: 'islandLand ' + oi };

    var gap = isOCGap(lat, lon) || isSPBay(lat, lon);
    var fishStrict = category === 'FISH_SPOTS';
    var skipGap = gap && !fishStrict;
    var loc = skipGap ? { eastM: -999, distM: 9999 } : localEastM(lat, lon);

    if (!skipGap && loc.distM < 2500 && loc.eastM > 50 && !isInnerBightWater(lat, lon)) {
      return { why: 'inland localEast+' + loc.eastM + ' dist=' + loc.distM };
    }
    if (isOnLand(lat, lon) && !skipGap) {
      if (loc.eastM < -400) return null;
      var meL = Math.round(metersEastOfShoreline(lat, lon));
      if (meL < -2500 && loc.eastM < 0) return null;
      return { why: 'onLand' };
    }
    if (isEastOfShoreline(lat, lon) && !skipGap) {
      if (fishStrict && isSPBay(lat, lon) && loc.eastM < 100 && !isOnLand(lat, lon)) { /* SP bay channel water */ }
      else return { why: 'eastOfShoreline' };
    }
    var me = Math.round(metersEastOfShoreline(lat, lon));
    if (me > 50 && !skipGap) {
      if (fishStrict && isSPBay(lat, lon) && loc.eastM < 100 && !isOnLand(lat, lon)) { /* SP bay channel water */ }
      else return { why: 'mEast+' + me };
    }
    /* Open ocean beyond coast-segment matching — OK for fish (San Pedro shelf, banks, rigs). */
    if (fishStrict && loc.distM > 3000 && !isOnLand(lat, lon)) return null;
    if (category === 'FISH_SPOTS' || !boat) {
      var pvSea = pvSeawardM(lat, lon);
      if (pvSea != null && lon <= -118.32) {
        if (pvSea < 120) return { why: 'bluffPV sea=' + Math.round(pvSea) };
        return null;
      }
      if (!skipGap && isPVPeninsula(lat, lon) && loc.distM < 900 && loc.eastM > -300) {
        return { why: 'bluffPV localEast=' + loc.eastM + ' dist=' + loc.distM };
      }
      if (!skipGap && fishStrict && loc.distM < 450 && loc.eastM > -280) {
        return { why: 'nearCoast localEast=' + loc.eastM + ' dist=' + loc.distM };
      }
      if (!skipGap && loc.distM < 200 && loc.eastM > 50) return { why: 'bluff localEast+' + loc.eastM + ' dist=' + loc.distM };
      if (!skipGap && loc.distM < 120 && loc.eastM > -80) return { why: 'nearshore localEast=' + loc.eastM + ' dist=' + loc.distM };
    }
    if (!skipGap && loc.distM < 5000 && !isLikelyOnWater(lat, lon) && loc.eastM > -400 && !isNearIslandWater(lat, lon) && !isInnerBightWater(lat, lon)) {
      if (fishStrict && isSPBay(lat, lon) && loc.eastM < 100 && !isOnLand(lat, lon)) { /* SP bay channel water */ }
      else return { why: 'notOnWater' };
    }
    return null;
  }

  /**
   * LEGACY suggestion only — DO NOT apply to production FISH_SPOTS / DIVE_SITES.
   * Policy (2026-07): replace coords from multi-source published GPS or hide the pin.
   * Never nudge/push to silence audits. See verified-water-pins.json / water-pin-coords.mdc.
   */
  function nudgeOffshore(lat, lon, face) {
    var loc0 = localEastM(lat, lon);
    var target = isPVPeninsula(lat, lon) ? -320 : -280;
    if (loc0.eastM <= target) return null;
    var needM = loc0.eastM > 0 ? loc0.eastM + 350 : (loc0.eastM - target);
    if (needM < 80) needM = 80;
    var dirs = [face || 270, 270, 250, 240, 225, 315, 200, 210];
    var seen = {}, uniq = [];
    for (var di = 0; di < dirs.length; di++) {
      if (dirs[di] == null || seen[dirs[di]]) continue;
      seen[dirs[di]] = 1; uniq.push(dirs[di]);
    }
    for (var ui = 0; ui < uniq.length; ui++) {
      for (var mult = 1; mult <= 3; mult++) {
        var pushM = Math.round(needM * mult);
        var p = destPt(lat, lon, uniq[ui], pushM);
        if (onIsland(p.lat, p.lon)) continue;
        if (isOnLand(p.lat, p.lon)) continue;
        var loc = localEastM(p.lat, p.lon);
        if (loc.eastM <= target) {
          return { lat: fmt7(p.lat), lon: fmt7(p.lon), pushM: pushM, dir: uniq[ui] };
        }
      }
    }
    return null;
  }

  function suggestOffshore(lat, lon, face) {
    var oi = onIsland(lat, lon);
    var loc0 = localEastM(lat, lon);
    var minPush = 120;
    var minEast = -120;
    if (isPVPeninsula(lat, lon)) minEast = -300;
    if (oi) minPush = 150;
    else if (loc0.eastM > 0) minPush = Math.min(loc0.eastM + 180, 2800);
    else if (loc0.eastM > -180) minPush = Math.max(minPush, 180 + loc0.eastM);

    var dirs = oi
      ? [270, 250, 225, 200, 180, 160, face || 270, 315, 240, 210]
      : (loc0.eastM > 100 ? [270, 250, 240, 225, 315, face || 270] : [270, 250, 225, 240, 315, 200, 210, face || 270]);
    var seen = {}, uniq = [];
    for (var di = 0; di < dirs.length; di++) {
      if (dirs[di] == null || seen[dirs[di]]) continue;
      seen[dirs[di]] = 1; uniq.push(dirs[di]);
    }
    var dists = [120, 150, 200, 250, 300, 400, 500, 700, 900, 1200, 1500, 1800, 2200, 2600, 3000, 3500, 4000, 5000];
    var best = null, bestEast = loc0.eastM;
    for (var ui = 0; ui < uniq.length; ui++) {
      for (var pi = 0; pi < dists.length; pi++) {
        if (dists[pi] < minPush) continue;
        var p = destPt(lat, lon, uniq[ui], dists[pi]);
        if (!oi && p.lon > lon + 0.00002) continue;
        if (onIsland(p.lat, p.lon)) continue;
        if (isOnLand(p.lat, p.lon)) continue;
        if (isEastOfShoreline(p.lat, p.lon) && !isOCGap(p.lat, p.lon)) continue;
        var loc = localEastM(p.lat, p.lon);
        if (oi) {
          if (!onIsland(p.lat, p.lon) && !isOnLand(p.lat, p.lon)) {
            return { lat: fmt7(p.lat), lon: fmt7(p.lon), pushM: dists[pi], dir: uniq[ui] };
          }
          continue;
        }
        if (loc.eastM > minEast) continue;
        if (loc0.eastM > 0 && loc.eastM >= loc0.eastM) continue;
        if (!best || loc.eastM < bestEast || (loc.eastM === bestEast && dists[pi] < best.pushM)) {
          best = { lat: fmt7(p.lat), lon: fmt7(p.lon), pushM: dists[pi], dir: uniq[ui] };
          bestEast = loc.eastM;
        }
      }
    }
    if (!best && loc0.eastM > 50) {
      for (var fd = minPush; fd <= 6000; fd += 150) {
        var fp = destPt(lat, lon, 270, fd);
        if (onIsland(fp.lat, fp.lon)) continue;
        var fl = localEastM(fp.lat, fp.lon);
        if (fl.eastM < minEast && !isOnLand(fp.lat, fp.lon)) {
          return { lat: fmt7(fp.lat), lon: fmt7(fp.lon), pushM: fd, dir: 270 };
        }
      }
    }
    return best;
  }

  function auditItem(item, category) {
    var lat = item.lat, lon = item.lon, face = item.face || 270, boat = !!item.boat;
    var regional = !!item.regional;
    var id = item.id || item.name || '';
    if (boat && regional && (category !== 'FISH_SPOTS' || isFarOffshoreFish(lat, lon))) {
      return {
        category: category, id: id, name: item.name, lat: lat, lon: lon,
        onLand: isOnLand(lat, lon), mEast: Math.round(metersEastOfShoreline(lat, lon)),
        localEast: isOnCatalina(lat, lon) ? -999 : localEastM(lat, lon).eastM,
        bluff: false, onIsle: onIsland(lat, lon), verdict: 'OK', why: '', sugLat: null, sugLon: null, sugPush: ''
      };
    }
    if (/Artificial Reef/i.test(item.name || '')) {
      return {
        category: category, id: id, name: item.name, lat: lat, lon: lon,
        onLand: isOnLand(lat, lon), mEast: Math.round(metersEastOfShoreline(lat, lon)),
        localEast: isOnCatalina(lat, lon) ? -999 : localEastM(lat, lon).eastM,
        bluff: false, onIsle: onIsland(lat, lon), verdict: 'OK', why: 'CDFG reef (authoritative)', sugLat: null, sugLon: null, sugPush: ''
      };
    }
    var issue = needsOffshoreFix(lat, lon, face, boat, regional, category);
    var loc = isOnCatalina(lat, lon) ? { eastM: -999, distM: 0 } : localEastM(lat, lon);
    var sug = issue ? (nudgeOffshore(lat, lon, face) || suggestOffshore(lat, lon, face)) : null;
    return {
      category: category,
      id: item.id || item.name,
      name: item.name,
      lat: lat,
      lon: lon,
      onLand: isOnLand(lat, lon),
      mEast: Math.round(metersEastOfShoreline(lat, lon)),
      localEast: loc.eastM,
      bluff: loc.distM < 200 && loc.eastM > 50,
      onIsle: onIsland(lat, lon),
      verdict: issue ? 'FIX' : 'OK',
      why: issue ? issue.why : '',
      sugLat: sug ? sug.lat : null,
      sugLon: sug ? sug.lon : null,
      sugPush: sug ? (sug.pushM + 'm @' + sug.dir) : ''
    };
  }

  root.LocationAudit = {
    init: init,
    isOnLand: isOnLand,
    isEastOfShoreline: isEastOfShoreline,
    isLikelyOnWater: isLikelyOnWater,
    isOCGap: isOCGap,
    isSPBay: isSPBay,
    isChannelIsland: isChannelIsland,
    isOnCatalina: isOnCatalina,
    onIsland: onIsland,
    localEastM: localEastM,
    metersEastOfShoreline: metersEastOfShoreline,
    pvWestShoreLonAtLat: pvWestShoreLonAtLat,
    pvSeawardM: pvSeawardM,
    isPVPeninsula: isPVPeninsula,
    isFarOffshoreFish: isFarOffshoreFish,
    needsOffshoreFix: needsOffshoreFix,
    nudgeOffshore: nudgeOffshore,
    suggestOffshore: suggestOffshore,
    auditItem: auditItem,
    destPt: destPt,
    fmt7: fmt7
  };
})(typeof WScript !== 'undefined' ? this : (typeof window !== 'undefined' ? window : global));

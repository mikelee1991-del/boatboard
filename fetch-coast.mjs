/**
 * Regenerate coast-geo.js from OpenStreetMap coastline ways.
 *
 * Usage:
 *   node fetch-coast.mjs          (preferred)
 *   .\regenerate-coast.ps1        (Windows fallback: curl + process-coast.ps1)
 */
import { writeFile, readFile } from 'fs/promises';
import { spawnSync } from 'child_process';

const BBOX = { south: 32.95, west: -120.20, north: 34.15, east: -117.55 };
const PRIORITY = { south: 33.68, west: -118.95, north: 34.08, east: -118.20 };
const DP_TOL = 0.001;

const SEED_WAYS = [41645254, 260968665, 785720737];

const ISLAND_BOXES = [
  { name: 'Santa Catalina Island', south: 33.28, west: -118.55, north: 33.48, east: -118.28 },
  { name: 'San Clemente Island', south: 32.87, west: -118.62, north: 33.15, east: -118.34 },
  { name: 'San Nicolas Island', south: 33.22, west: -119.75, north: 33.37, east: -119.44 },
  { name: 'Anacapa Island', south: 33.96, west: -119.40, north: 34.03, east: -119.30 },
  { name: 'Santa Cruz Island', south: 33.95, west: -119.80, north: 34.08, east: -119.34 },
  { name: 'Santa Rosa Island', south: 33.92, west: -120.18, north: 34.07, east: -119.80 },
];

const LAND_BOXES = [
  { name: 'Palos Verdes Peninsula', south: 33.68, west: -118.48, north: 33.84, east: -118.30 },
];

// ---------------------------------------------------------------------------
function sqDistToSeg(p, a, b) {
  const dx = b.lon - a.lon, dy = b.lat - a.lat;
  if (!dx && !dy) {
    const ex = p.lon - a.lon, ey = p.lat - a.lat;
    return ex * ex + ey * ey;
  }
  let t = ((p.lon - a.lon) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  const ex = p.lon - (a.lon + t * dx), ey = p.lat - (a.lat + t * dy);
  return ex * ex + ey * ey;
}

function inPriority(p) {
  return p.lat >= PRIORITY.south && p.lat <= PRIORITY.north &&
    p.lon >= PRIORITY.west && p.lon <= PRIORITY.east;
}

function douglasPeucker(pts, tol, keep) {
  if (pts.length <= 2) return keep.slice();
  const tol2 = tol * tol;
  const marked = keep.slice();
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    if (end - start < 2) continue;
    let maxD = 0, idx = -1;
    for (let i = start + 1; i < end; i++) {
      if (marked[i]) continue;
      const d = sqDistToSeg(pts[i], pts[start], pts[end]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol2 && idx >= 0) {
      marked[idx] = true;
      stack.push([start, idx], [idx, end]);
    }
  }
  return marked;
}

function simplifyPolyline(pts) {
  if (pts.length <= 2) return pts;
  const keep = pts.map(inPriority);
  keep[0] = keep[pts.length - 1] = true;
  return pts.filter((_, i) => douglasPeucker(pts, DP_TOL, keep)[i]);
}

function round6(n) { return Math.round(n * 1e6) / 1e6; }
function fmtPt(p) { return `{lat:${round6(p.lat)},lon:${round6(p.lon)}}`; }
function keyPt(p) { return `${round6(p.lat)},${round6(p.lon)}`; }

function chainBbox(chain) {
  let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
  for (const p of chain) {
    south = Math.min(south, p.lat); north = Math.max(north, p.lat);
    west = Math.min(west, p.lon); east = Math.max(east, p.lon);
  }
  return { south, north, west, east };
}

function bboxOverlapArea(a, b) {
  const s = Math.max(a.south, b.south), n = Math.min(a.north, b.north);
  const w = Math.max(a.west, b.west), e = Math.min(a.east, b.east);
  if (s >= n || w >= e) return 0;
  return (n - s) * (e - w);
}

function bboxArea(b) {
  return Math.max(0, b.north - b.south) * Math.max(0, b.east - b.west);
}

function centroid(pts) {
  let lat = 0, lon = 0;
  for (const p of pts) { lat += p.lat; lon += p.lon; }
  return { lat: lat / pts.length, lon: lon / pts.length };
}

function isClosed(chain, eps = 0.0002) {
  if (chain.length < 4) return false;
  const a = chain[0], b = chain[chain.length - 1];
  return Math.abs(a.lat - b.lat) < eps && Math.abs(a.lon - b.lon) < eps;
}

function closeRing(pts) {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  if (Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lon - b.lon) < 1e-6) return pts;
  return [...pts, { lat: a.lat, lon: a.lon }];
}

function matchNamedBox(chain, boxes, minRatio = 0.35) {
  const bb = chainBbox(chain);
  const area = bboxArea(bb);
  if (!area) return null;
  let best = null, bestScore = 0;
  for (const box of boxes) {
    const overlap = bboxOverlapArea(bb, box);
    const score = overlap / area;
    if (score > bestScore && score >= minRatio) { bestScore = score; best = box.name; }
  }
  return best;
}

function matchIsland(chain) {
  const bb = chainBbox(chain);
  const c = centroid(chain);
  for (const box of ISLAND_BOXES) {
    if (c.lat >= box.south && c.lat <= box.north && c.lon >= box.west && c.lon <= box.east)
      return box.name;
    if (bboxOverlapArea(bb, box) / bboxArea(bb) >= 0.35) return box.name;
  }
  return null;
}

function pointRegionName(p) {
  if (p.lat >= 33.68 && p.lat <= 33.84 && p.lon >= -118.48 && p.lon <= -118.30)
    return p.lat < 33.76 ? 'pv-south' : 'pv-north';
  if (p.lat >= 33.84 && p.lat <= 33.92 && p.lon >= -118.45 && p.lon <= -118.32)
    return 'south-bay';
  if (p.lat >= 33.92 && p.lat <= 34.05 && p.lon >= -118.85 && p.lon <= -118.45)
    return 'santa-monica';
  if (p.lat >= 33.55 && p.lat <= 33.72 && p.lon >= -118.05 && p.lon <= -117.55)
    return 'oc-south';
  if (p.lat >= 33.72 && p.lat <= 33.95 && p.lon >= -118.05 && p.lon <= -117.75)
    return 'oc-north';
  if (p.lon <= -118.85 && p.lat >= 33.95)
    return 'malibu';
  if (p.lon <= -119.0)
    return 'channel-coast';
  return 'coast-other';
}

function splitOpenChain(chain) {
  if (chain.length < 2) return [];
  const segments = [];
  let curName = pointRegionName(chain[0]);
  let cur = [chain[0]];
  for (let i = 1; i < chain.length; i++) {
    const name = pointRegionName(chain[i]);
    if (name !== curName && cur.length >= 2) {
      segments.push({ name: curName, pts: cur.slice() });
      cur = [cur[cur.length - 1], chain[i]];
      curName = name;
    } else {
      cur.push(chain[i]);
    }
  }
  if (cur.length >= 2) segments.push({ name: curName, pts: cur });
  // de-dupe names
  const counts = {};
  return segments.map(s => {
    counts[s.name] = (counts[s.name] || 0) + 1;
    const suffix = counts[s.name] > 1 ? `-${counts[s.name]}` : '';
    return { name: s.name + suffix, pts: s.pts };
  });
}

// ---------------------------------------------------------------------------
async function fetchOverpass() {
  const q = `[out:json][timeout:120];
(
  way["natural"="coastline"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out geom;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(q),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) throw new Error('Overpass HTTP ' + res.status);
  return res.json();
}

function overpassToWays(data) {
  const ways = [];
  for (const el of data.elements) {
    if (el.type === 'way' && el.geometry?.length >= 2) {
      ways.push({
        id: String(el.id),
        pts: el.geometry.map(g => ({ lat: g.lat, lon: g.lon })),
      });
    }
  }
  return ways;
}

function buildChains(ways) {
  const used = new Set();
  const chains = [];
  for (const way of ways) {
    if (used.has(way.id)) continue;
    used.add(way.id);
    let chain = way.pts.slice();
    let changed = true;
    while (changed) {
      changed = false;
      const hk = keyPt(chain[0]), tk = keyPt(chain[chain.length - 1]);
      for (const w of ways) {
        if (used.has(w.id) || w.pts.length < 2) continue;
        const wh = keyPt(w.pts[0]), wt = keyPt(w.pts[w.pts.length - 1]);
        if (tk === wh) { chain.push(...w.pts.slice(1)); used.add(w.id); changed = true; break; }
        if (tk === wt) { chain.push(...w.pts.slice(0, -1).reverse()); used.add(w.id); changed = true; break; }
        if (hk === wt) { chain.unshift(...w.pts.slice(0, -1)); used.add(w.id); changed = true; break; }
        if (hk === wh) { chain.unshift(...w.pts.slice(1).reverse()); used.add(w.id); changed = true; break; }
      }
    }
    chains.push(chain);
  }
  return chains;
}

function classifyChains(chains) {
  const lines = [], islands = [], land = [];
  const usedLand = new Set();
  const islandCandidates = new Map();

  function considerIsland(name, chain) {
    if (!name || chain.length < 80) return;
    const prev = islandCandidates.get(name);
    if (!prev || chain.length > prev.length) islandCandidates.set(name, chain);
  }

  for (const chain of chains) {
    const closed = isClosed(chain);
    const islandName = matchIsland(chain);

    if (islandName && chain.length >= 80) {
      considerIsland(islandName, chain);
      continue;
    }

    if (closed) {
      const simp = simplifyPolyline(chain);
      for (const lb of LAND_BOXES) {
        if (usedLand.has(lb.name)) continue;
        if (matchNamedBox(chain, [lb], 0.2) && chain.length >= 20) {
          land.push({ name: lb.name, pts: closeRing(simp) });
          usedLand.add(lb.name);
          break;
        }
      }
      continue;
    }

    const simp = simplifyPolyline(chain);
    for (const seg of splitOpenChain(simp)) {
      if (seg.pts.length >= 2) lines.push({ name: seg.name, pts: seg.pts });
    }
  }

  for (const [name, chain] of islandCandidates) {
    islands.push({ name, pts: closeRing(chain) });
  }

  return { lines, islands, land };
}

function serializeJs(data, stats) {
  const mk = arr => arr.map(l =>
    `    { name: '${l.name}', pts: [${l.pts.map(fmtPt).join(',')}] },`
  ).join('\n');
  return [
    '/** OpenStreetMap coastline — Southern California (ODbL). Generated by fetch-coast.mjs */',
    'window.COAST_GEO = {',
    '  lines: [\n' + mk(data.lines),
    '  ],',
    '  islands: [\n' + mk(data.islands),
    '  ],',
    '  land: [\n' + mk(data.land),
    '  ]',
    '};',
    '',
    '/* Point counts: ' + JSON.stringify(stats) + ' */',
  ].join('\n');
}

// ---------------------------------------------------------------------------
async function main() {
  let overpass;
  try {
    console.log('Fetching Overpass…');
    overpass = await fetchOverpass();
    await writeFile('coast-osm.json', JSON.stringify(overpass));
  } catch (e) {
    console.warn('Overpass fetch failed:', e.message);
    console.log('Trying curl fallback…');
    const r = spawnSync('curl.exe', [
      '-s', '-X', 'POST', 'https://overpass-api.de/api/interpreter',
      '--data-binary', '@overpass-query.txt',
    ], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('curl failed');
    overpass = JSON.parse(r.stdout);
    await writeFile('coast-osm.json', r.stdout);
  }

  const ways = overpassToWays(overpass);
  console.log('Coastline ways:', ways.length);

  for (const id of SEED_WAYS) {
    try {
      const res = await fetch(`https://www.openstreetmap.org/api/0.6/way/${id}/full`);
      if (res.ok) console.log(`Seed way ${id}: OK (${res.status})`);
    } catch { /* optional */ }
  }

  const chains = buildChains(ways);
  console.log('Connected chains:', chains.length);

  const classified = classifyChains(chains);
  const stats = {
    lines: classified.lines.map(l => ({ name: l.name, pts: l.pts.length })),
    islands: classified.islands.map(l => ({ name: l.name, pts: l.pts.length })),
    land: classified.land.map(l => ({ name: l.name, pts: l.pts.length })),
    totals: {
      linePts: classified.lines.reduce((s, l) => s + l.pts.length, 0),
      islandPts: classified.islands.reduce((s, l) => s + l.pts.length, 0),
      landPts: classified.land.reduce((s, l) => s + l.pts.length, 0),
      rawWays: ways.length,
      rawNodes: ways.reduce((s, w) => s + w.pts.length, 0),
    },
  };

  await writeFile('coast-geo.js', serializeJs(classified, stats));
  console.log('Wrote coast-geo.js');
  console.log(JSON.stringify(stats, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });

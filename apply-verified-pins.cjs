'use strict';
/**
 * Apply multi-source verified water pins only.
 * - Rewrites DIVE_SITES in dive-engine.js to verified subset
 * - Archives prior DIVE_SITES body to dive-sites-unverified-archive.js
 * - Rewrites FISH_SPOTS in index.html to verified subset
 * - Archives prior FISH_SPOTS to fish-spots-unverified-archive.json
 * NEVER invents or nudges coordinates — only copies values from verified-water-pins.json
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const log = JSON.parse(fs.readFileSync(path.join(root, 'verified-water-pins.json'), 'utf8'));

function fmtNum(n) {
  const s = String(n);
  if (s.includes('.')) return s;
  return n.toFixed(7).replace(/0+$/, '').replace(/\.$/, '.0');
}

function diveEntry(s) {
  const parts = [
    `id: '${s.id}'`,
    `name: '${s.name.replace(/'/g, "\\'")}'`,
    `lat: ${s.lat}`,
    `lon: ${s.lon}`,
    `face: ${s.face != null ? s.face : 270}`,
    `depth: ${s.depth != null ? s.depth : 40}`,
    `verified: true`
  ];
  if (s.boat) parts.push('boat: true');
  if (s.regional) parts.push('regional: true');
  return `    { ${parts.join(', ')} }`; // no trailing comma — JScript eval rejects sparse array holes
}

function fishEntry(s) {
  const species = JSON.stringify(s.species);
  const lines = [
    `  { name: '${s.name.replace(/'/g, "\\'")}', lat: ${s.lat}, lon: ${s.lon}${s.face != null ? `, face: ${s.face}` : ''}${s.regional ? ', regional: true' : ''}, verified: true,`,
    `    species: ${species},`,
    `    depth: '${s.depth.replace(/'/g, "\\'")}', habitat: '${s.habitat.replace(/'/g, "\\'")}',`,
    `    tactics: '${s.tactics.replace(/'/g, "\\'")}',`,
    `    bestTide: '${s.bestTide}', bestTime: '${s.bestTime}', minSstF: ${s.minSstF} } // ${s.sources}`
  ];
  return lines.join('\n');
}

/* —— dive-engine.js —— */
const divePath = path.join(root, 'dive-engine.js');
let diveSrc = fs.readFileSync(divePath, 'utf8');
const diveMatch = diveSrc.match(/const DIVE_SITES = \[([\s\S]*?)\n  \];/);
if (!diveMatch) throw new Error('DIVE_SITES not found');
fs.writeFileSync(
  path.join(root, 'dive-sites-unverified-archive.js'),
  '/* Archived DIVE_SITES body prior to multi-source verification pass 2026-07-27.\n' +
    ' * DO NOT re-enable for map display without multi-source GPS confirmation.\n' +
    ' * See verified-water-pins.json\n */\n' +
    'module.exports = `\n' + diveMatch[1] + '\n`;\n'
);

const diveHeader = `  /*
   * Dive site coordinates — MULTI-SOURCE VERIFIED water GPS ONLY.
   * Policy: never manually nudge/push coords; never display unverified pins.
   * Source of truth + source URLs: verified-water-pins.json
   * Archive of prior unverified list: dive-sites-unverified-archive.js
   * Validate: cscript //Nologo audit-all-water-pins.js
   */
  const DIVE_SITES = [
`;
const diveBody = log.diveKept.map(diveEntry).join(',\n');
diveSrc = diveSrc.replace(
  /  \/\*\n   \* Dive site coordinates[\s\S]*?const DIVE_SITES = \[[\s\S]*?\n  \];/,
  diveHeader + diveBody + '\n  ];'
);

/* Remove mapOffshoreM seaward display push — pins are published GPS only */
diveSrc = diveSrc.replace(
  /  \/\*\* Map pin at dive-target GPS; optional mapOffshoreM for bluff entries stored on shore\. \*\/\n  function siteMapPos\(site\) \{\n    const pushM = site\.mapOffshoreM \|\| 0;\n    if \(pushM > 0\) \{\n      const seaward = \(site\.face \|\| 270\) % 360;\n      return destPt\(site\.lat, site\.lon, seaward, pushM\);\n    \}\n    return \{ lat: site\.lat, lon: site\.lon \};\n  \}/,
  `  /** Map pin at stored published GPS only — never apply mapOffshoreM / seaward display nudges. */
  function siteMapPos(site) {
    return { lat: site.lat, lon: site.lon };
  }`
);

/* nearestSites / getSite fallbacks: only verified list remains as DIVE_SITES */
diveSrc = diveSrc.replace(
  '  /** Nearest-site pool for On site picker and Plan tab list (map shows all DIVE_SITES). */',
  '  /** Nearest-site pool for On site picker and Plan tab list (map shows verified DIVE_SITES only). */'
);

fs.writeFileSync(divePath, diveSrc);

/* —— FISH_SPOTS —— */
const dashPath = path.join(root, 'index.html');
let html = fs.readFileSync(dashPath, 'utf8');
const fishMatch = html.match(/const FISH_SPOTS = \[([\s\S]*?)\n\];/);
if (!fishMatch) throw new Error('FISH_SPOTS not found');
fs.writeFileSync(
  path.join(root, 'fish-spots-unverified-archive.json'),
  JSON.stringify({
    note: 'Archived FISH_SPOTS prior to multi-source verification pass 2026-07-27. Do not re-enable for map display without multi-source GPS confirmation.',
    raw: fishMatch[1]
  }, null, 2)
);

const fishHeader = `const FISH_SPOTS = [
  /* MULTI-SOURCE VERIFIED only — see verified-water-pins.json. Unverified archive: fish-spots-unverified-archive.json */
`;
const fishBody = log.fishKept.map(fishEntry).join(',\n');
// Ensure last fish object has no trailing comma after closing brace (JScript)
html = html.replace(
  /const FISH_SPOTS = \[[\s\S]*?\n\];/,
  fishHeader + fishBody + '\n];'
);

/* Update overview comment about spot count if present */
html = html.replace(
  '/** Overview brief — score nearby pool only (avoid sorting all 667 spots). */',
  '/** Overview brief — score nearby verified pool only (verified-water-pins.json). */'
);

fs.writeFileSync(dashPath, html);

console.log('Applied verified pins:');
console.log('  dive kept:', log.diveKept.length);
console.log('  fish kept:', log.fishKept.length);
console.log('  archives: dive-sites-unverified-archive.js, fish-spots-unverified-archive.json');

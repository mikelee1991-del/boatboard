/**
 * Build cdfg-artificial-reefs.json from embedded CDFG Appendix DMS rows
 * (DocumentID=30217, updated 6/01). Coords converted deg/min/sec → decimal.
 * Usage: cscript //Nologo build-cdfg-reefs-json.js
 */
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

function dms(deg, min, sec) {
  return deg + min / 60 + sec / 3600;
}
function latLon(latD, latM, latS, lonD, lonM, lonS) {
  return {
    lat: Math.round(dms(latD, latM, latS) * 1e7) / 1e7,
    lon: -Math.round(dms(lonD, lonM, lonS) * 1e7) / 1e7,
    dms: latD + '\u00B0' + latM + "'" + latS + '"N ' + lonD + '\u00B0' + lonM + "'" + lonS + '"W'
  };
}

/* Each row: [name, latD, latM, latS, lonD, lonM, lonS, depthFt optional] */
var ROWS = [
  ['Atascadero Artificial Reef', 35, 23, 36, 120, 52, 32, 55],
  ['San Luis Obispo Artificial Reef', 35, 11, 25, 120, 49, 55, 47],
  ['Pitas Point Artificial Reef', 34, 18, 8, 119, 22, 6, 28],
  ['Malibu Artificial Reef A', 34, 1, 48.65, 118, 39, 1.91, 60],
  ['Malibu Artificial Reef B', 34, 1, 49, 118, 39, 5, 60],
  ['Malibu Artificial Reef Center', 34, 1, 49, 118, 39, 2, 60],
  ['Topanga Artificial Reef', 34, 1, 38, 118, 31, 57, 28],
  ['Santa Monica Bay Artificial Reef 2', 34, 0, 51, 118, 32, 3, 57],
  ['Santa Monica Bay Artificial Reef 3', 34, 1, 2.06, 118, 32, 9.78, 57],
  ['Santa Monica Bay Artificial Reef 4', 34, 1, 5.75, 118, 32, 17.68, 57],
  ['Santa Monica Bay Artificial Reef 5', 34, 1, 10.56, 118, 32, 25.56, 57],
  ['Santa Monica Bay Artificial Reef 6', 34, 1, 19.4, 118, 32, 41, 57],
  ['Santa Monica Bay Artificial Reef 7', 34, 1, 22.61, 118, 32, 48.92, 57],
  ['Santa Monica Bay Artificial Reef 8', 34, 1, 16, 118, 32, 52, 57],
  ['Santa Monica Bay Artificial Reef 9', 34, 0, 29, 118, 32, 4, 57],
  ['Santa Monica Bay Artificial Reef 10', 34, 0, 36.05, 118, 32, 2.18, 57],
  ['Santa Monica Bay Artificial Reef 11', 34, 0, 41.47, 118, 32, 10.1, 57],
  ['Santa Monica Bay Artificial Reef 12', 34, 0, 42.77, 118, 32, 17.98, 57],
  ['Santa Monica Bay Artificial Reef 13', 34, 0, 47.08, 118, 32, 26.34, 57],
  ['Santa Monica Bay Artificial Reef 14', 34, 0, 50.47, 118, 32, 37.8, 57],
  ['Santa Monica Bay Artificial Reef 15', 34, 0, 50, 118, 32, 54, 57],
  ['Santa Monica Bay Artificial Reef 16', 34, 0, 57, 118, 33, 3, 57],
  ['Santa Monica Bay Artificial Reef 17', 34, 0, 9, 118, 32, 14, 57],
  ['Santa Monica Bay Artificial Reef 18', 34, 0, 17.84, 118, 32, 13.3, 57],
  ['Santa Monica Bay Artificial Reef 19', 34, 0, 17, 118, 32, 26, 57],
  ['Santa Monica Bay Artificial Reef 20', 34, 0, 21, 118, 32, 37, 57],
  ['Santa Monica Bay Artificial Reef 21', 34, 0, 27, 118, 32, 48, 57],
  ['Santa Monica Bay Artificial Reef 22', 34, 0, 32, 118, 32, 59, 57],
  ['Santa Monica Bay Artificial Reef 23', 34, 0, 38, 118, 33, 5, 57],
  ['Santa Monica Bay Artificial Reef 24', 34, 0, 39, 118, 33, 15, 57],
  ['Santa Monica Bay Artificial Reef Center', 34, 0, 47, 118, 32, 33, 57],
  ['Santa Monica Artificial Reef A', 34, 0, 34.2, 118, 31, 49.2, 60],
  ['Santa Monica Artificial Reef B', 34, 0, 33, 118, 31, 48, 60],
  ['Santa Monica Artificial Reef C', 34, 0, 33, 118, 31, 50.44, 60],
  ['Santa Monica Artificial Reef Center', 34, 0, 34, 118, 31, 47, 60],
  ['Marina Del Rey Artificial Reef 2A', 33, 58, 0, 118, 29, 10, 65],
  ['Marina Del Rey Artificial Reef 2B', 33, 58, 0.16, 118, 29, 11, 65],
  ['Marina Del Rey Artificial Reef 2C', 33, 58, 0.5, 118, 29, 12, 65],
  ['Marina Del Rey Artificial Reef 2D', 33, 58, 1, 118, 29, 13, 65],
  ['Marina Del Rey Artificial Reef 2E', 33, 58, 0.5, 118, 29, 9, 65],
  ['Marina Del Rey Artificial Reef 2F', 33, 58, 1, 118, 29, 10, 65],
  ['Marina Del Rey Artificial Reef 2G', 33, 58, 1.5, 118, 29, 12, 65],
  ['Marina Del Rey Artificial Reef 2H', 33, 58, 2, 118, 29, 13, 65],
  ['Marina Del Rey Artificial Reef 2I', 33, 58, 5, 118, 29, 7, 65],
  ['Marina Del Rey Artificial Reef 2J', 33, 58, 6, 118, 29, 11, 65],
  ['Marina Del Rey Artificial Reef 2K', 33, 58, 7, 118, 29, 14, 65],
  ['Marina Del Rey Artificial Reef 2L', 33, 58, 7, 118, 29, 16, 65],
  ['Marina Del Rey Artificial Reef 2M', 33, 58, 8, 118, 29, 7, 65],
  ['Marina Del Rey Artificial Reef 2N', 33, 58, 8, 118, 29, 10, 65],
  ['Marina Del Rey Artificial Reef 2O', 33, 58, 9, 118, 29, 12, 65],
  ['Marina Del Rey Artificial Reef 2P', 33, 58, 9, 118, 29, 15, 65],
  ['Marina Del Rey Artificial Reef 2 Center', 33, 58, 6, 118, 29, 11, 65],
  ['Marina Del Rey Artificial Reef 1Q', 33, 57, 56, 118, 29, 13, 65],
  ['Marina Del Rey Artificial Reef 1R', 33, 57, 57, 118, 29, 10, 65],
  ['Marina Del Rey Artificial Reef 1S', 33, 57, 54, 118, 29, 10, 65],
  ['Marina Del Rey Artificial Reef 1T', 33, 57, 52, 118, 29, 10, 65],
  ['Marina Del Rey Artificial Reef 1 Center', 33, 57, 54, 118, 29, 10, 65],
  ['Hermosa Beach Artificial Reef A', 33, 51, 15, 118, 24, 50, 60],
  ['Hermosa Beach Artificial Reef B', 33, 51, 16, 118, 24, 47, 60],
  ['Hermosa Beach Artificial Reef C', 33, 51, 13, 118, 24, 49, 60],
  ['Hermosa Beach Artificial Reef D', 33, 51, 11, 118, 24, 46, 60],
  ['Hermosa Beach Artificial Reef Center', 33, 51, 13, 118, 24, 48, 60],
  ['Redondo Beach Artificial Reef A', 33, 50, 18, 118, 24, 34, 72],
  ['Redondo Beach Artificial Reef B (Barge)', 33, 50, 18, 118, 24, 33, 72],
  ['Redondo Beach Artificial Reef C', 33, 50, 17, 118, 24, 31, 72],
  ['Redondo Beach Artificial Reef D', 33, 50, 16, 118, 24, 33, 72],
  ['Redondo Beach Artificial Reef E', 33, 50, 15, 118, 24, 31, 72],
  ['Redondo Beach Artificial Reef F', 33, 50, 14, 118, 24, 34, 72],
  ['Redondo Beach Artificial Reef G', 33, 50, 14, 118, 24, 32, 72],
  ['Redondo Beach Artificial Reef H', 33, 50, 14, 118, 24, 30, 72],
  ['Redondo Beach Artificial Reef I', 33, 50, 13, 118, 24, 33, 72],
  ['Redondo Beach Artificial Reef J', 33, 50, 12, 118, 24, 34, 72],
  ['Redondo Beach Artificial Reef K', 33, 50, 11, 118, 24, 31, 72],
  ['Redondo Beach Artificial Reef Center', 33, 50, 14, 118, 24, 32, 72],
  ['SS Palawan Artificial Reef', 33, 49, 25, 118, 24, 53, 120],
  ['Bolsa Chica Artificial Reef A', 33, 39, 32.86, 118, 6, 2.87, 92],
  ['Bolsa Chica Artificial Reef C', 33, 39, 17.2, 118, 6, 7.7, 90],
  ['Bolsa Chica Artificial Reef D', 33, 39, 15.65, 118, 5, 58.13, 90],
  ['Bolsa Chica Artificial Reef E', 33, 39, 1.2, 118, 6, 10.1, 90],
  ['Bolsa Chica Artificial Reef F', 33, 38, 58.7, 118, 6, 6.3, 90],
  ['Bolsa Chica Artificial Reef G', 33, 38, 48.7, 118, 6, 20.6, 90],
  ['Bolsa Chica Artificial Reef H', 33, 38, 42.8, 118, 6, 6.4, 90],
  ['Bolsa Chica Artificial Reef 9', 33, 39, 18.95, 118, 5, 56.36, 90],
  ['Bolsa Chica Artificial Reef 10', 33, 39, 19.64, 118, 6, 3.68, 90],
  ['Bolsa Chica Artificial Reef 11', 33, 39, 13, 118, 6, 4.4, 90],
  ['Bolsa Chica Artificial Reef 12', 33, 38, 58, 118, 6, 17.5, 90],
  ['Bolsa Chica Artificial Reef 13', 33, 39, 14.5, 118, 5, 54.4, 90],
  ['Bolsa Chica Artificial Reef 14', 33, 39, 21, 118, 6, 8, 90],
  ['Bolsa Chica Artificial Reef 15', 33, 39, 18, 118, 6, 11, 90],
  ['Bolsa Chica Artificial Reef 16', 33, 39, 15, 118, 6, 12, 90],
  ['Bolsa Chica Artificial Reef 17', 33, 39, 13, 118, 6, 10, 90],
  ['Bolsa Chica Artificial Reef 18', 33, 39, 10.3, 118, 5, 59.5, 90],
  ['Bolsa Chica Artificial Reef 19', 33, 39, 32.4, 118, 5, 55.5, 85],
  ['Bolsa Chica Artificial Reef 20', 33, 39, 29.7, 118, 5, 48.2, 85],
  ['Bolsa Chica Artificial Reef 21', 33, 39, 29.2, 118, 5, 57.1, 85],
  ['Bolsa Chica Artificial Reef 22', 33, 39, 26.8, 118, 5, 49.2, 85],
  ['Bolsa Chica Artificial Reef 23', 33, 39, 26.2, 118, 5, 58, 85],
  ['Bolsa Chica Artificial Reef 24', 33, 39, 24.2, 118, 5, 50.6, 85],
  ['Bolsa Chica Artificial Reef 25', 33, 39, 6.7, 118, 5, 54.8, 90],
  ['Bolsa Chica Artificial Reef 26', 33, 39, 4.1, 118, 5, 55.9, 90],
  ['Bolsa Chica Artificial Reef 27', 33, 39, 2, 118, 5, 56.9, 90],
  ['Bolsa Chica Artificial Reef 28', 33, 38, 59.2, 118, 5, 57.5, 90],
  ['Bolsa Chica Artificial Reef 29', 33, 38, 56.7, 118, 5, 58.7, 90],
  ['Bolsa Chica Artificial Reef 30', 33, 38, 54.4, 118, 5, 59.6, 95],
  ['Bolsa Chica Artificial Reef 31', 33, 38, 52, 118, 6, 1.1, 95],
  ['Bolsa Chica Artificial Reef 32', 33, 38, 48.9, 118, 6, 1.5, 100],
  ['Bolsa Chica Artificial Reef 33', 33, 38, 46.4, 118, 6, 2.9, 100],
  ['Huntington Beach Artificial Reef A1', 33, 36, 55, 117, 58, 51, 60],
  ['Huntington Beach Artificial Reef A2', 33, 36, 52, 117, 58, 49, 60],
  ['Huntington Beach Artificial Reef A3', 33, 36, 50, 117, 58, 48, 60],
  ['Huntington Beach Artificial Reef A4', 33, 36, 49, 117, 58, 47, 60],
  ['Huntington Beach Artificial Reef B1', 33, 37, 10, 117, 59, 18, 60],
  ['Huntington Beach Artificial Reef B2', 33, 37, 9, 117, 59, 17, 60],
  ['Huntington Beach Artificial Reef B3', 33, 37, 7, 117, 59, 16, 60],
  ['Huntington Beach Artificial Reef C1', 33, 37, 18, 117, 59, 52, 60],
  ['Huntington Beach Artificial Reef C2', 33, 37, 17, 117, 59, 51, 60],
  ['Huntington Beach Artificial Reef C3', 33, 37, 15, 117, 59, 50, 60],
  ['Huntington Beach Artificial Reef D1', 33, 37, 29, 118, 0, 5, 60],
  ['Huntington Beach Artificial Reef D2', 33, 37, 28, 118, 0, 4, 60],
  ['Huntington Beach Artificial Reef D3', 33, 37, 26, 118, 0, 3, 60],
  ['Huntington Beach Artificial Reef D4', 33, 37, 24, 118, 0, 2, 60],
  ['Huntington Beach Artificial Reef A Center', 33, 36, 52, 117, 58, 59, 60],
  ['Huntington Beach Artificial Reef B Center', 33, 37, 17, 117, 59, 51, 60],
  ['Huntington Beach Artificial Reef C Center', 33, 37, 9, 117, 59, 17, 60],
  ['Huntington Beach Artificial Reef D Center', 33, 37, 28, 118, 0, 4, 60],
  ['Newport Beach Artificial Reef A', 33, 36, 8, 117, 57, 52, 72],
  ['Newport Beach Artificial Reef B', 33, 36, 13, 117, 57, 50, 72],
  ['Newport Beach Artificial Reef C', 33, 36, 16, 117, 57, 44, 72],
  ['Newport Beach Artificial Reef E', 33, 36, 7, 117, 57, 53, 72],
  ['Newport Beach Artificial Reef Center', 33, 36, 13, 117, 57, 49, 72],
  ['Pendleton Artificial Reef 1', 33, 19, 29.28, 117, 31, 40.04, 43],
  ['Pendleton Artificial Reef 3', 33, 19, 25.61, 117, 31, 36.59, 43],
  ['Pendleton Artificial Reef 4', 33, 19, 29.64, 117, 31, 38.76, 43],
  ['Pendleton Artificial Reef 6', 33, 19, 30.67, 117, 31, 38.66, 43],
  ['Pendleton Artificial Reef 7', 33, 19, 29.87, 117, 31, 36.88, 43],
  ['Pendleton Artificial Reef Center', 33, 19, 30, 117, 31, 42, 43],
  ['Oceanside Artificial Reef 2 1A', 33, 12, 15.18, 117, 26, 5.32, 57],
  ['Oceanside Artificial Reef 2 2A', 33, 12, 20.75, 117, 26, 4.12, 57],
  ['Oceanside Artificial Reef 2 3A', 33, 12, 24.49, 117, 26, 10.56, 57],
  ['Oceanside Artificial Reef 2 4A', 33, 12, 31.59, 117, 26, 14.46, 57],
  ['Oceanside Artificial Reef 2 1B', 33, 12, 24.45, 117, 25, 39.48, 57],
  ['Oceanside Artificial Reef 2 2B', 33, 12, 31.41, 117, 25, 46.33, 57],
  ['Oceanside Artificial Reef 2 3B', 33, 12, 37.26, 117, 25, 52.79, 57],
  ['Oceanside Artificial Reef 2 4B', 33, 12, 44.29, 117, 25, 56.58, 57],
  ['Oceanside Artificial Reef 2 1C', 33, 12, 43.2, 117, 25, 9.77, 57],
  ['Oceanside Artificial Reef 2 2C', 33, 12, 47.75, 117, 25, 13.57, 57],
  ['Oceanside Artificial Reef 2 3C', 33, 12, 54.63, 117, 25, 18.37, 57],
  ['Oceanside Artificial Reef 2 4C', 33, 13, 2.96, 117, 25, 24.07, 57],
  ['Oceanside Artificial Reef 2 Center', 33, 12, 40.17, 117, 25, 43.82, 57],
  ['Oceanside Artificial Reef 1A', 33, 10, 59, 117, 25, 1, 91],
  ['Oceanside Artificial Reef 1B', 33, 11, 0, 117, 24, 59, 67],
  ['Oceanside Artificial Reef 1C', 33, 10, 58, 117, 25, 1, 91],
  ['Oceanside Artificial Reef 1D', 33, 10, 59, 117, 24, 59, 91],
  ['Oceanside Artificial Reef 1E', 33, 10, 57, 117, 25, 2, 91],
  ['Oceanside Artificial Reef 1F', 33, 10, 57, 117, 24, 59, 91],
  ['Oceanside Artificial Reef 1G', 33, 10, 54.8, 117, 25, 5, 91],
  ['Oceanside Artificial Reef 1H', 33, 10, 54, 117, 24, 59, 91],
  ['Oceanside Artificial Reef 1 Center', 33, 10, 57, 117, 25, 0, 91],
  ['Carlsbad Artificial Reef 1', 33, 5, 19.49, 117, 19, 13.12, 48],
  ['Carlsbad Artificial Reef 2', 33, 5, 14.05, 117, 19, 11.04, 48],
  ['Carlsbad Artificial Reef 3', 33, 5, 9.76, 117, 19, 9.24, 48],
  ['Carlsbad Artificial Reef 4', 33, 5, 3.52, 117, 19, 7.25, 48],
  ['Carlsbad Artificial Reef 5', 33, 5, 16.8, 117, 19, 14.4, 48],
  ['Carlsbad Artificial Reef 6', 33, 5, 11.4, 117, 19, 13.2, 48],
  ['Carlsbad Artificial Reef 7', 33, 5, 5.4, 117, 19, 11.4, 48],
  ['Carlsbad Artificial Reef 8', 33, 5, 0, 117, 19, 9, 48],
  ['Carlsbad Artificial Reef 9', 33, 5, 15.6, 117, 19, 25.2, 48],
  ['Carlsbad Artificial Reef 10', 33, 5, 10.8, 117, 19, 22.8, 48],
  ['Carlsbad Artificial Reef 11', 33, 5, 4.8, 117, 19, 20.4, 48],
  ['Carlsbad Artificial Reef 12', 33, 4, 58.2, 117, 19, 19.2, 48],
  ['Torrey Pines Artificial Reef 2', 32, 53, 35, 117, 15, 35, 44],
  ['Torrey Pines Artificial Reef 1', 32, 53, 12, 117, 15, 50, 67],
  ['Pacific Beach Artificial Reef 1A', 32, 47, 20, 117, 16, 42, 57],
  ['Pacific Beach Artificial Reef 2A', 32, 47, 25, 117, 16, 45, 57],
  ['Pacific Beach Artificial Reef 3A', 32, 47, 35, 117, 16, 50, 57],
  ['Pacific Beach Artificial Reef 4A', 32, 47, 40, 117, 16, 55, 57],
  ['Pacific Beach Artificial Reef 1B', 32, 47, 24, 117, 16, 30, 57],
  ['Pacific Beach Artificial Reef 2B', 32, 47, 30, 117, 16, 30, 57],
  ['Pacific Beach Artificial Reef 3B', 32, 47, 38, 117, 16, 34, 57],
  ['Pacific Beach Artificial Reef 4B', 32, 47, 46, 117, 16, 35, 57],
  ['Pacific Beach Artificial Reef 1C', 32, 47, 30, 117, 16, 12, 57],
  ['Pacific Beach Artificial Reef 2C', 32, 47, 36, 117, 16, 12, 57],
  ['Pacific Beach Artificial Reef 3C', 32, 47, 44, 117, 16, 14, 57],
  ['Pacific Beach Artificial Reef 4C', 32, 47, 50, 117, 16, 18, 57],
  ['Pacific Beach Artificial Reef Center', 32, 47, 35, 117, 16, 35, 57],
  ['Mission Bay Park El Rey Wreck', 32, 45, 51, 117, 16, 38, 80],
  ['Mission Bay Park Ruby E Wreck', 32, 46, 2, 117, 16, 36, 90],
  ['Mission Bay Park Kelp Reef', 32, 46, 12, 117, 16, 4, 60],
  ['Mission Bay Park NEL Tower', 32, 46, 22, 117, 16, 3, 60],
  ['Mission Bay Park Concrete Rubble', 32, 45, 51, 117, 16, 31, 85],
  ['International Reef 1', 32, 32, 40.3, 117, 14, 53.1, 165],
  ['International Reef 2', 32, 32, 39.7, 117, 14, 54, 165],
  ['International Reef 3', 32, 32, 37.5, 117, 14, 50, 165],
  ['International Reef 4', 32, 32, 38.8, 117, 14, 48.2, 165],
  ['International Reef 5', 32, 32, 41, 117, 14, 50.5, 165],
  ['International Reef Missile Tower', 32, 32, 29.7, 117, 14, 47.4, 165]
];

var reefs = [];
for (var i = 0; i < ROWS.length; i++) {
  var r = ROWS[i];
  var ll = latLon(r[1], r[2], r[3], r[4], r[5], r[6]);
  reefs.push({
    name: r[0],
    lat: ll.lat,
    lon: ll.lon,
    dms: ll.dms,
    depthFt: r[7] || null,
    source: 'CDFW/CDFG Artificial Reef Coordinates Appendix (DocumentID=30217, updated 6/01)',
    sourceUrl: 'https://nrm.dfg.ca.gov/FileHandler.ashx?DocumentID=30217&inline'
  });
}

function jsonStringify(v, pretty) {
  function ser(o, ind) {
    if (o === null) return 'null';
    var t = typeof o;
    if (t === 'number' || t === 'boolean') return String(o);
    if (t === 'string') return '"' + String(o).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    var sp = pretty ? ('\n' + ind) : '';
    var sp2 = pretty ? ('\n' + ind + '  ') : '';
    if (Object.prototype.toString.call(o) === '[object Array]') {
      if (!o.length) return '[]';
      var a = []; for (var i = 0; i < o.length; i++) a.push(sp2 + ser(o[i], ind + '  '));
      return '[' + a.join(',') + sp + ']';
    }
    var keys = []; for (var k in o) if (o.hasOwnProperty(k)) keys.push(k);
    if (!keys.length) return '{}';
    var p = []; for (var j = 0; j < keys.length; j++) p.push(sp2 + '"' + keys[j] + '":' + (pretty ? ' ' : '') + ser(o[keys[j]], ind + '  '));
    return '{' + p.join(',') + sp + '}';
  }
  return ser(v, '');
}

var out = {
  note: 'Official CDFG/CDFW Artificial Reef Appendix — inherently trusted. DMS converted to decimal; no nudges.',
  sourceUrl: 'https://nrm.dfg.ca.gov/FileHandler.ashx?DocumentID=30217&inline',
  updated: '2001-06',
  count: reefs.length,
  reefs: reefs
};
writeFile('cdfg-artificial-reefs.json', jsonStringify(out, true));
WScript.Echo('Wrote cdfg-artificial-reefs.json with ' + reefs.length + ' reefs');

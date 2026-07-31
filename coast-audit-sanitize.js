// Sanitize coast-geo for CScript audits: strip Malibu / OC phantom chords and
// splice OSM gap fills (same logic as build-coast-overlay-lite.js).
// Load after COAST_GEO: eval(readFile('coast-audit-sanitize.js'));
// Then: COAST_GEO = CoastAuditSanitize.apply(COAST_GEO, rootPath);
(function (root) {
  function loadGapFill(fso, rootPath, name) {
    var path = rootPath + '\\' + name;
    if (!fso.FileExists(path)) return [];
    var txt = fso.OpenTextFile(path, 1).ReadAll();
    var i = txt.indexOf('[');
    if (i < 0) return [];
    return eval(txt.substring(i));
  }

  function isOcPhantomChord(p) {
    if (p.lat >= 33.46 && p.lat <= 33.76 && p.lon >= -118.22 && p.lon <= -117.72) {
      if (p.lon <= -118.20 && p.lat >= 33.72) return false;
      if (p.lat <= 33.48 && p.lon >= -117.75) return false;
      if (p.lon >= -118.20 && p.lon <= -117.78) return true;
    }
    return false;
  }

  /** Bad SM Bay / Malibu polyline ~1–3 NM west of beaches (matches overlay builder). */
  function isMalibuPhantomChord(p) {
    if (p.lat >= 33.950 && p.lat <= 34.098 && p.lon > -119.0 && p.lon <= -118.46) return true;
    return false;
  }

  function stripPhantomRuns(pts, isPhantom) {
    var segs = [], run = [], i;
    for (i = 0; i < pts.length; i++) {
      if (isPhantom(pts[i])) {
        if (run.length >= 2) segs.push(run);
        run = [];
      } else {
        run.push(pts[i]);
      }
    }
    if (run.length >= 2) segs.push(run);
    return segs;
  }

  function reversePts(pts) {
    var out = [], i;
    for (i = pts.length - 1; i >= 0; i--) out.push(pts[i]);
    return out;
  }

  function apply(coastGeo, rootPath) {
    if (!coastGeo || !coastGeo.lines) return coastGeo;
    var fso = new ActiveXObject('Scripting.FileSystemObject');
    var ocFill = loadGapFill(fso, rootPath, 'oc-gap-fill.js.txt');
    var malibuFill = reversePts(loadGapFill(fso, rootPath, 'malibu-gap-fill.js.txt'));
    var lines = [], li, line, pts, segs, si, name;

    for (li = 0; li < coastGeo.lines.length; li++) {
      line = coastGeo.lines[li];
      if (!line || !line.pts) continue;
      name = line.name || '';
      pts = line.pts;
      if (name === 'malibu') {
        segs = stripPhantomRuns(pts, isMalibuPhantomChord);
        if (segs.length >= 1 && malibuFill.length >= 2) {
          lines.push({ name: name, pts: segs[0] });
          lines.push({ name: name + '-gap', pts: malibuFill });
          for (si = 1; si < segs.length; si++) {
            lines.push({ name: name + '-' + si, pts: segs[si] });
          }
        } else if (malibuFill.length >= 2) {
          lines.push({ name: name + '-gap', pts: malibuFill });
        } else if (segs.length) {
          for (si = 0; si < segs.length; si++) {
            lines.push({ name: name + (si ? '-' + si : ''), pts: segs[si] });
          }
        } else {
          lines.push(line);
        }
      } else if (name === 'coast-other-2' && ocFill.length >= 2) {
        segs = stripPhantomRuns(pts, isOcPhantomChord);
        if (segs.length >= 1) {
          lines.push({ name: name, pts: segs[0] });
          lines.push({ name: name + '-gap', pts: ocFill });
          for (si = 1; si < segs.length; si++) {
            lines.push({ name: name + '-' + si, pts: segs[si] });
          }
        } else {
          lines.push({ name: name + '-gap', pts: ocFill });
        }
      } else {
        lines.push(line);
      }
    }
    return { lines: lines, islands: coastGeo.islands || [], land: coastGeo.land || [] };
  }

  root.CoastAuditSanitize = {
    apply: apply,
    isMalibuPhantomChord: isMalibuPhantomChord,
    isOcPhantomChord: isOcPhantomChord
  };
})(this);

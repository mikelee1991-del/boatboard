/**
 * BoatLobster — CA spiny lobster hunt planner (hoop net / scuba / freedive).
 * Spots are structure-biased pins drawn from trusted FISH_SPOTS + DIVE_SITES.
 * No new GPS invented. SMR / no-take names and polygons are excluded when known.
 * Season rule (CDFW): opens 18:00 Friday preceding first Wednesday in October;
 * closes 23:59:59 first Wednesday after March 15. Always verify wildlife.ca.gov.
 */
(function (global) {
  'use strict';

  const NM = 1852;
  const HR = 3600000;
  const LOBSTER_MAP_FIT_NM = 10;
  const LOBSTER_PICKER_POOL = 25;
  const LOBSTER_GOOD_AT = 82;
  const LOBSTER_FAIR_AT = 50;

  const HABITAT_RE = /reef|rock|kelp|wreck|jetty|breakwater|pinnacle|ledge|cobble|artificial|canyon|wall|cavern|ship|module|platform|rubble|boulder|hard\s*bottom|breakwall|rip\s*rap/i;
  const NO_TAKE_NAME_RE = /underwater\s*park|no[- ]?take|\bsmr\b|ecological\s+preserve|marine\s+refuge|marine\s+reserve|state\s+marine\s+reserve|avalon\s+underwater|casino\s+point.*park|ocean\s+trails\s+reserve/i;
  const SMCA_WARN_RE = /smca|conservation\s+area|farnsworth/i;

  let opts = null;
  let map = null, mapInited = false, spotLayer = null, boatMarker = null;
  let mapInitPromise = null;
  let lastRanked = null;
  let planDateOnly = null;
  let lastPaintKey = '';

  function $(id){ return document.getElementById(id); }
  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
  function f0(n){ return Math.round(n); }
  function f1(n){ return (Math.round(n * 10) / 10).toFixed(1); }
  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function haversineM(lat1, lon1, lat2, lon2){
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  function scoreColor(score){
    if(global.BoatScoreColor && global.BoatScoreColor.color) return global.BoatScoreColor.color(score);
    if(score >= 82) return '#1ed4a8';
    if(score >= 60) return '#7adf28';
    if(score >= 40) return '#f5d000';
    return '#ff7a1a';
  }
  function rampLegendHtml(){
    if(global.BoatScoreColor && global.BoatScoreColor.legendHtml){
      return global.BoatScoreColor.legendHtml('lobster');
    }
    return '<div class="score-ramp-legend"><div class="score-ramp-title">Lobster hunt score — continuous (0–100) · good ≥' +
      LOBSTER_GOOD_AT + '</div></div>';
  }

  /* ---- Season (CDFW recreational spiny lobster) ---- */
  function firstWeekdayOfMonth(y, monthIndex, weekday){
    const d = new Date(y, monthIndex, 1);
    const diff = (weekday - d.getDay() + 7) % 7;
    d.setDate(1 + diff);
    return d;
  }
  function fridayPreceding(d){
    const out = new Date(d.getTime());
    const back = (d.getDay() - 5 + 7) % 7 || 7;
    out.setDate(d.getDate() - back);
    return out;
  }
  function firstWednesdayAfterMarch15(y){
    /* CDFW: closes first Wednesday *after* March 15 (if the 15th is Wed → the 22nd). */
    const d = new Date(y, 2, 16);
    const add = (3 - d.getDay() + 7) % 7;
    d.setDate(16 + add);
    return d;
  }
  function seasonOpenClose(seasonStartYear){
    const firstWedOct = firstWeekdayOfMonth(seasonStartYear, 9, 3);
    const fri = fridayPreceding(firstWedOct);
    const open = new Date(fri.getFullYear(), fri.getMonth(), fri.getDate(), 18, 0, 0, 0);
    const closeDay = firstWednesdayAfterMarch15(seasonStartYear + 1);
    const close = new Date(closeDay.getFullYear(), closeDay.getMonth(), closeDay.getDate(), 23, 59, 59, 999);
    return { open, close, label: seasonStartYear + '–' + String(seasonStartYear + 1).slice(2) };
  }
  function seasonStatus(when){
    const t = when instanceof Date ? when.getTime() : +when;
    const y = new Date(t).getFullYear();
    /* Check season that opened in y-1 and y */
    const candidates = [seasonOpenClose(y - 1), seasonOpenClose(y)];
    for(let i = 0; i < candidates.length; i++){
      const s = candidates[i];
      if(t >= s.open.getTime() && t <= s.close.getTime()){
        return { inSeason: true, open: s.open, close: s.close, label: s.label, nextOpen: null };
      }
    }
    const next = t < seasonOpenClose(y).open.getTime() ? seasonOpenClose(y) : seasonOpenClose(y + 1);
    return { inSeason: false, open: next.open, close: next.close, label: next.label, nextOpen: next.open };
  }

  function parseDepthFt(spot){
    if(typeof spot.depth === 'number' && isFinite(spot.depth)){
      return { mid: spot.depth, min: spot.depth, max: spot.depth };
    }
    const s = String(spot.depth || '');
    const nums = (s.match(/[\d.]+/g) || []).map(Number).filter(n => isFinite(n));
    if(!nums.length) return { mid: null, min: null, max: null };
    const min = Math.min.apply(null, nums);
    const max = Math.max.apply(null, nums);
    return { mid: (min + max) / 2, min, max };
  }

  function blobText(spot){
    const parts = [spot.name, spot.habitat, spot.tactics, spot.about, spot.description];
    if(Array.isArray(spot.species)) parts.push(spot.species.join(' '));
    return parts.filter(Boolean).join(' ');
  }

  function isNoTakeType(type){
    const t = String(type || '').toLowerCase();
    if(t.includes('special closure')) return true;
    if(t.includes('no-take')) return true;
    if(/\bsmr\b/.test(t) && !t.includes('smca') && !t.includes('smrma')) return true;
    return false;
  }

  function ringContains(lat, lon, ring){
    /* ring: [[lon,lat], ...] GeoJSON order */
    let inside = false;
    for(let i = 0, j = ring.length - 1; i < ring.length; j = i++){
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      const intersect = ((yi > lat) !== (yj > lat)) &&
        (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
      if(intersect) inside = !inside;
    }
    return inside;
  }

  function pointInGeometry(lat, lon, geom){
    if(!geom || !geom.type) return false;
    if(geom.type === 'Polygon'){
      const rings = geom.coordinates || [];
      if(!rings[0] || !ringContains(lat, lon, rings[0])) return false;
      for(let h = 1; h < rings.length; h++){
        if(ringContains(lat, lon, rings[h])) return false;
      }
      return true;
    }
    if(geom.type === 'MultiPolygon'){
      const polys = geom.coordinates || [];
      for(let p = 0; p < polys.length; p++){
        const rings = polys[p];
        if(!rings[0] || !ringContains(lat, lon, rings[0])) continue;
        let inHole = false;
        for(let h = 1; h < rings.length; h++){
          if(ringContains(lat, lon, rings[h])){ inHole = true; break; }
        }
        if(!inHole) return true;
      }
    }
    return false;
  }

  function inNoTakeMpa(lat, lon){
    const gj = opts && opts.getMpaGeoJson ? opts.getMpaGeoJson() : null;
    if(!gj || !gj.features) return false;
    for(let i = 0; i < gj.features.length; i++){
      const f = gj.features[i];
      const props = f.properties || {};
      if(!isNoTakeType(props.Type || props.type)) continue;
      if(pointInGeometry(lat, lon, f.geometry)) return true;
    }
    return false;
  }

  function classifyFishStyle(spot){
    if(opts && opts.classifyFishStyle) return opts.classifyFishStyle(spot);
    return 'structure';
  }

  function isLobsterCandidate(spot, kind){
    if(!spot || spot.lat == null || spot.lon == null) return false;
    if(opts && opts.isOnLand && opts.isOnLand(spot.lat, spot.lon)) return false;
    const text = blobText(spot);
    if(NO_TAKE_NAME_RE.test(text) || NO_TAKE_NAME_RE.test(String(spot.name || ''))) return false;
    if(kind === 'fish' && classifyFishStyle(spot) === 'surface') return false;
    if(HABITAT_RE.test(text) || spot.cdfgAppendix || /lobster/i.test(text)) return true;
    if(kind === 'dive') return true; /* trusted dive pins are overwhelmingly structure */
    return false;
  }

  function pfgLookup(lat, lon){
    const groups = (global.PIN_FEATURE_GROUPS && global.PIN_FEATURE_GROUPS.groups) || [];
    if(!groups.length || lat == null || lon == null) return null;
    const key = (+lat).toFixed(5) + ',' + (+lon).toFixed(5);
    for(let i = 0; i < groups.length; i++){
      const g = groups[i];
      const members = g.members || [];
      for(let j = 0; j < members.length; j++){
        const m = members[j];
        if(m == null || m.lat == null || m.lon == null) continue;
        if((+m.lat).toFixed(5) + ',' + (+m.lon).toFixed(5) === key){
          return { id: g.groupId || ('pfg_' + i), name: g.displayName || g.groupId, size: members.length };
        }
      }
    }
    return null;
  }

  function groupKey(spot){
    if(spot.pfgId) return 'pfg:' + spot.pfgId;
    if(spot.featureGroup) return String(spot.sourceKind || spot.kind || 'x') + ':' + spot.featureGroup;
    return 'pin:' + spot.lat.toFixed(5) + ',' + spot.lon.toFixed(5);
  }

  function groupListName(spot){
    const base = spot.featureGroupName || spot.name;
    const n = spot.featureGroupSize || 1;
    return n > 1 ? base + ' (' + n + ')' : base;
  }

  function buildSpotPool(){
    const out = [];
    const seen = Object.create(null);
    function add(spot, kind){
      if(!isLobsterCandidate(spot, kind)) return;
      if(inNoTakeMpa(spot.lat, spot.lon)) return;
      const key = spot.lat.toFixed(5) + ',' + spot.lon.toFixed(5);
      const pfg = pfgLookup(spot.lat, spot.lon);
      if(seen[key]){
        const prev = seen[key];
        if(kind === 'dive' && prev.kind === 'fish'){
          prev.kind = 'both';
          prev.methods = 'hoop · scuba · freedive';
        }
        if(pfg && (!prev.pfgId || (pfg.size || 0) > (prev.featureGroupSize || 0))){
          prev.pfgId = pfg.id;
          prev.featureGroupName = pfg.name;
          prev.featureGroupSize = Math.max(prev.featureGroupSize || 1, pfg.size || 1);
        }
        if((spot.featureGroupSize || 1) > (prev.featureGroupSize || 1)){
          prev.featureGroup = spot.featureGroup || prev.featureGroup;
          prev.featureGroupName = spot.featureGroupName || prev.featureGroupName;
          prev.featureGroupSize = spot.featureGroupSize;
        }
        return;
      }
      const depth = parseDepthFt(spot);
      const text = blobText(spot);
      const smcaWarn = SMCA_WARN_RE.test(text);
      const fgName = (pfg && pfg.name) || spot.featureGroupName || spot.name;
      const fgSize = Math.max(spot.featureGroupSize || 1, (pfg && pfg.size) || 1);
      const row = {
        id: 'lob_' + kind + '_' + (spot.id || key.replace(/[^\d.-]/g, '_')),
        name: spot.name,
        lat: spot.lat,
        lon: spot.lon,
        depth: spot.depth,
        depthFt: depth,
        face: spot.face,
        habitat: spot.habitat,
        tactics: spot.tactics,
        species: spot.species,
        kind: kind,
        sourceKind: kind,
        methods: kind === 'dive' ? 'scuba · freedive' : 'hoop · scuba · freedive',
        smcaWarn: smcaWarn,
        pfgId: pfg ? pfg.id : null,
        featureGroup: spot.featureGroup || null,
        featureGroupName: fgName,
        featureGroupSize: fgSize,
        srcSpot: spot
      };
      seen[key] = row;
      out.push(row);
    }
    const fish = (opts && opts.getFishSpots && opts.getFishSpots()) || [];
    const dive = (opts && opts.getDiveSites && opts.getDiveSites()) || [];
    fish.forEach(s => add(s, 'fish'));
    dive.forEach(s => add(s, 'dive'));
    return out;
  }

  function tideMovement(when, tides){
    if(!tides || !tides.predictions || !tides.predictions.length) return { moving: false, range: null, rising: null };
    const t = +when;
    const preds = tides.predictions.map(p => ({
      t: new Date(p.t || p.time).getTime(),
      v: parseFloat(p.v != null ? p.v : p.height)
    })).filter(p => isFinite(p.t) && isFinite(p.v)).sort((a, b) => a.t - b.t);
    if(preds.length < 2) return { moving: false, range: null, rising: null };
    let i = 0;
    while(i < preds.length - 1 && preds[i + 1].t < t) i++;
    const a = preds[Math.max(0, i)];
    const b = preds[Math.min(preds.length - 1, i + 1)];
    const rising = b.v > a.v;
    const day = preds.filter(p => Math.abs(p.t - t) < 16 * HR);
    let lo = Infinity, hi = -Infinity;
    day.forEach(p => { lo = Math.min(lo, p.v); hi = Math.max(hi, p.v); });
    const range = isFinite(lo) && isFinite(hi) ? hi - lo : null;
    const dtH = Math.max(0.25, (b.t - a.t) / HR);
    const rate = Math.abs(b.v - a.v) / dtH;
    return { moving: rate >= 0.15, range, rising, rate };
  }

  /**
   * Calibration: typical night on decent reef ~50–65; stacked dusk+moving tide+calm ~80–92;
   * daytime / blown seas / wrong habitat stay mid-low. Out of season capped so map never looks "hot".
   */
  function scoreLobsterSpot(spot, ctx){
    const when = ctx.when || new Date();
    const hour = when.getHours() + when.getMinutes() / 60;
    const text = blobText(spot);
    let s = 30;

    if(/artificial|reef|wreck|module|jetty|breakwater|pinnacle|wall|cavern|rockpile|rip\s*rap/i.test(text)) s += 18;
    else if(/rock|ledge|cobble|boulder|hard\s*bottom/i.test(text)) s += 12;
    if(/kelp/i.test(text)) s += 8;
    if(/lobster/i.test(text)) s += 10;

    const d = spot.depthFt && spot.depthFt.mid;
    if(d != null){
      if(d >= 15 && d <= 80) s += 16;
      else if(d >= 10 && d <= 120) s += 8;
      else if(d > 120) s -= 8;
      else s -= 4;
    } else s += 2;

    /* Nocturnal forage window */
    if(hour >= 18 || hour < 5) s += 22;
    else if(hour >= 16.5 && hour < 18) s += 14; /* dusk deploy */
    else if(hour >= 5 && hour < 7) s += 8;
    else s -= 10; /* daytime dens — harder hunt */

    const tide = tideMovement(when, ctx.tides);
    if(tide.moving) s += 10;
    else if(tide.range != null) s -= 4;
    if(tide.rising) s += 3;

    const seas = ctx.seasFt;
    if(seas != null){
      if(seas <= 1.5) s += 8;
      else if(seas <= 2.5) s += 2;
      else if(seas <= 4) s -= 12;
      else s -= 22;
    } else s -= 3;

    const wind = ctx.windKt;
    if(wind != null){
      if(wind < 8) s += 6;
      else if(wind < 14) s += 1;
      else if(wind >= 18) s -= 14;
      else s -= 6;
    } else s -= 2;

    if(spot.smcaWarn) s -= 4; /* limited-take — verify CCR */

    if(ctx.season && !ctx.season.inSeason) s = Math.min(s, 34);

    return clamp(Math.round(s), 5, 98);
  }

  function marineSeasFt(marine){
    const c = marine && (marine.current || marine);
    if(!c) return null;
    const sw = (c.swell_wave_height != null ? c.swell_wave_height : 0) * 3.28084;
    const ww = (c.wind_wave_height != null ? c.wind_wave_height : 0) * 3.28084;
    const tot = Math.sqrt(sw * sw + ww * ww);
    return isFinite(tot) ? tot : null;
  }
  function windKt(wx){
    const c = wx && (wx.current || wx);
    if(!c || c.wind_speed_10m == null) return null;
    return c.wind_speed_10m * 1.94384;
  }

  function getPlanWhen(){
    if(!planDateOnly) return new Date();
    const tm = ($('lobPlanTime') && $('lobPlanTime').value) || '18:00';
    const parts = tm.split(':');
    const d = new Date(planDateOnly + 'T00:00:00');
    d.setHours(+parts[0] || 0, +parts[1] || 0, 0, 0);
    return d;
  }

  function setPlanWhen(when){
    const d = when instanceof Date ? when : new Date(when);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    planDateOnly = y + '-' + m + '-' + day;
    const btn = $('lobPlanDateBtn');
    if(btn) btn.textContent = m + '/' + day + '/' + y;
    const ti = $('lobPlanTime');
    if(ti){
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      ti.value = hh + ':' + mm;
    }
    const lab = $('lobPlanLabel');
    if(lab) lab.textContent = d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function buildCtx(when){
    const marine = opts.getMarine ? opts.getMarine() : null;
    const wx = opts.getWx ? opts.getWx() : null;
    const tides = opts.getTides ? opts.getTides() : null;
    const season = seasonStatus(when);
    return {
      when: when,
      tides: tides,
      seasFt: marineSeasFt(marine),
      windKt: windKt(wx),
      season: season,
      hab: opts.getHabOutlook ? opts.getHabOutlook() : null
    };
  }

  function rankSpots(when){
    const bp = opts.getPos ? opts.getPos() : { lat: 33.84817, lon: -118.39633 };
    const ctx = buildCtx(when);
    const pool = buildSpotPool();
    const allPins = pool.map(spot => {
      const distNm = haversineM(bp.lat, bp.lon, spot.lat, spot.lon) / NM;
      const score = scoreLobsterSpot(spot, ctx);
      return { spot, score, distNm, ctx, groupKey: groupKey(spot) };
    }).filter(r => !r.spot.srcSpot || !r.spot.srcSpot.regional || r.distNm <= 35);

    /* One rank entry per Fish/Dive/PIN feature group — best hunt score; nearer breaks ties. */
    const byGroup = new Map();
    for(let i = 0; i < allPins.length; i++){
      const row = allPins[i];
      const prev = byGroup.get(row.groupKey);
      if(!prev || row.score > prev.score || (row.score === prev.score && row.distNm < prev.distNm)){
        byGroup.set(row.groupKey, row);
      }
    }
    const ranked = [...byGroup.values()].sort((a, b) => b.score - a.score || a.distNm - b.distNm);
    lastRanked = ranked;
    return { ranked, allPins, ctx, bp };
  }

  function bannerHtml(ctx){
    const bits = [];
    if(!ctx.season.inSeason){
      const next = ctx.season.nextOpen || ctx.season.open;
      bits.push({
        cls: 'lob-banner-closed',
        html: '<strong>Out of season.</strong> Recreational CA spiny lobster is closed right now. Next opener ~' +
          next.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) +
          ' (' + esc(ctx.season.label) + ' season). Map scores are capped so nothing looks “hot.” Verify dates at CDFW.'
      });
    } else {
      bits.push({
        cls: 'lob-banner-open',
        html: '<strong>Season open</strong> (' + esc(ctx.season.label) + ') through ' +
          ctx.season.close.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
          '. Legal keepers only: <strong>3¼″ carapace</strong>, bag <strong>7/person</strong>, license + lobster report card. Divers: hands only. Hoop nets: ≤5/person, ≤10/vessel, pull ≤ every 2 hours.'
      });
    }
    const hab = ctx.hab;
    if(hab && (hab.level === 'elevated' || hab.level === 'watch')){
      bits.push({
        cls: 'lob-banner-hab',
        html: '<strong>Shellfish / HAB caution.</strong> ' + esc(hab.text || 'Elevated Pseudo-nitzschia / domoic acid outlook near SoCal — check CDPH before eating lobster meat.')
      });
    } else {
      bits.push({
        cls: 'lob-banner-info',
        html: 'Always check <a href="https://www.cdph.ca.gov/Programs/CEH/DRSEM/Pages/EMB/Shellfish/Shellfish-Advisories.aspx" target="_blank" rel="noopener">CDPH shellfish advisories</a> before eating. This tool is habitat + timing intel — not a guarantee of bugs, size, or legal take.'
      });
    }
    return bits.map(b => '<div class="lob-banner ' + b.cls + '">' + b.html + '</div>').join('');
  }

  function glanceHtml(ctx, ranked){
    const top = ranked[0];
    const tide = tideMovement(ctx.when, ctx.tides);
    const hour = ctx.when.getHours() + ctx.when.getMinutes() / 60;
    let windowLbl = 'Daytime dens';
    if(hour >= 18 || hour < 5) windowLbl = 'Night forage';
    else if(hour >= 16.5) windowLbl = 'Dusk deploy';
    else if(hour < 7) windowLbl = 'Dawn leftover';
    return '' +
      '<div class="card"><div class="ok">Hunt score</div><div class="ov" style="color:' + scoreColor(top ? top.score : 0) + '">' +
        (top ? top.score : '—') + '/100</div><div class="os">' + (ctx.season.inSeason ? 'In season' : 'Closed — capped') + '</div></div>' +
      '<div class="card"><div class="ok">Window</div><div class="ov">' + esc(windowLbl) + '</div><div class="os">Bugs forage after dark</div></div>' +
      '<div class="card"><div class="ok">Tide</div><div class="ov">' +
        (tide.moving ? (tide.rising ? 'Moving (flood)' : 'Moving (ebb)') : 'Slack-ish') +
        '</div><div class="os">' + (tide.range != null ? 'Day range ~' + f1(tide.range) + ' ft' : 'Tide data loading') + '</div></div>' +
      '<div class="card"><div class="ok">Seas / wind</div><div class="ov">' +
        (ctx.seasFt != null ? f1(ctx.seasFt) + ' ft' : '—') +
        '</div><div class="os">' + (ctx.windKt != null ? f0(ctx.windKt) + ' kt wind' : 'Wind —') + '</div></div>';
  }

  function listHtml(ranked){
    const top = ranked.filter(r => r.distNm <= LOBSTER_MAP_FIT_NM * 2.5).slice(0, LOBSTER_PICKER_POOL);
    if(!top.length) return '<p class="prose">No structure pins in range.</p>';
    return top.map((r, i) => {
      const d = r.spot.depthFt && r.spot.depthFt.mid != null ? f0(r.spot.depthFt.mid) + ' ft' : (r.spot.depth || '—');
      const label = groupListName(r.spot);
      const modNote = (r.spot.featureGroupSize > 1 && r.spot.name && r.spot.name !== r.spot.featureGroupName)
        ? ' · best module: ' + r.spot.name
        : '';
      return '<div class="lob-row" data-id="' + esc(r.spot.id) + '">' +
        '<span class="lob-rank" style="background:' + scoreColor(r.score) + '">#' + (i + 1) + '</span>' +
        '<div class="lob-row-body">' +
          '<div class="lob-name">' + esc(label) + '</div>' +
          '<div class="lob-meta">' + f1(r.distNm) + ' nm · ' + esc(String(d)) + ' · ' + esc(r.spot.methods) +
            esc(modNote) +
            (r.spot.smcaWarn ? ' · <span class="lob-warn">check SMCA</span>' : '') +
          '</div>' +
        '</div>' +
        '<b style="color:' + scoreColor(r.score) + '">' + r.score + '</b>' +
      '</div>';
    }).join('') +
      '<p class="plan-note" style="margin-top:8px">Same-reef modules from Fish + Dive count once · # = hunt rank · best module shown when grouped.</p>';
  }

  function tipsHtml(){
    return '<ul class="lob-tips">' +
      '<li><strong>Structure:</strong> rocky reef edges, kelp holdfasts, artificial reefs, wrecks, jetties — dens by day, forage onto sand at night.</li>' +
      '<li><strong>Timing:</strong> deploy hoop nets before dusk; dive/freedive after dark with a buddy and light. Day hunts work dens (antennae) but score lower here.</li>' +
      '<li><strong>Depth:</strong> most recreational take ~15–80 ft; shallow early season, deeper after winter storms.</li>' +
      '<li><strong>Measure:</strong> 3¼″ carapace (eye socket rear → carapace rear) in the water / immediately; shorts go back unharmed.</li>' +
      '<li><strong>MPAs:</strong> red SMR / no-take zones on the map = no lobster. Orange SMCA = limited take — verify CCR §632 before dropping nets or diving.</li>' +
      '</ul>' +
      '<p class="prose" style="font-size:12px">' +
        (opts && opts.linkHtml ? opts.linkHtml('https://wildlife.ca.gov/Conservation/Marine/Invertebrates/Lobster', 'CDFW recreational lobster', 'Season, size, gear') : '') +
        ' · ' +
        (opts && opts.linkHtml ? opts.linkHtml('https://www.cdph.ca.gov/Programs/CEH/DRSEM/Pages/EMB/Shellfish/Shellfish-Advisories.aspx', 'CDPH shellfish advisories', 'Toxins / consumption') : '') +
      '</p>';
  }

  function windowsHtml(ctx){
    const base = new Date(ctx.when.getTime());
    base.setMinutes(0, 0, 0);
    const rows = [];
    for(let h = 0; h < 24; h += 2){
      const t = new Date(base.getTime() + h * HR);
      const c = Object.assign({}, ctx, { when: t, season: seasonStatus(t) });
      /* score a synthetic “good reef” proxy via median of top 3 actual spots at that hour */
      const pool = (lastRanked || []).slice(0, 8);
      let avg = 0, n = 0;
      pool.forEach(r => {
        avg += scoreLobsterSpot(r.spot, c);
        n++;
      });
      const score = n ? Math.round(avg / n) : scoreLobsterSpot({ name: 'reef', depthFt: { mid: 40 }, habitat: 'rocky reef kelp' }, c);
      rows.push({ t, score });
    }
    rows.sort((a, b) => b.score - a.score);
    const best = rows.slice(0, 4);
    return '<div class="lob-windows">' + best.map(r =>
      '<div class="lob-win"><b style="color:' + scoreColor(r.score) + '">' + r.score + '</b> ' +
        r.t.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) +
      '</div>'
    ).join('') + '</div>' +
      '<p class="prose" style="font-size:12px;margin-top:8px">Best windows blend night hours, moving tide, and calm seas — same model as the map colors.</p>';
  }

  function markerHtml(rank, score, mode){
    const col = scoreColor(score);
    if(mode === 'dot'){
      return '<div style="width:10px;height:10px;border-radius:50%;background:' + col +
        ';border:1.5px solid #fff;opacity:0.9;box-shadow:0 0 4px rgba(0,0,0,.75)"></div>';
    }
    const sz = rank <= 6 ? 28 : 24;
    const fs = rank <= 6 ? 12 : 10;
    return '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:' + col +
      ';border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-family:var(--font-mono,ui-monospace,monospace);font-size:' +
      fs + 'px;font-weight:700;color:#060a10;box-shadow:0 0 8px rgba(0,0,0,.85)">' + rank + '</div>';
  }

  async function ensureMap(){
    if(mapInited && map){
      try{ map.invalidateSize(true); }catch(e){ /* ignore */ }
      return map;
    }
    if(mapInitPromise) return mapInitPromise;
    mapInitPromise = (async () => {
      if(!opts.loadLeaflet) throw new Error('Leaflet loader missing');
      await opts.loadLeaflet();
      if(!global.L) throw new Error('Leaflet missing');
      const el = $('lobsterMap');
      if(!el) return null;
      if(mapInited && map) return map;

      const bp = (opts.getPos && opts.getPos()) || { lat: 33.84817, lon: -118.39633 };
      el.innerHTML = '';
      try{ delete el._leaflet_id; }catch(e){ el._leaflet_id = undefined; }

      /* setView before basemap — otherwise tile layers never request (black pane). */
      const m = global.L.map(el, {
        zoomControl: true,
        attributionControl: true,
        minZoom: 7,
        maxZoom: 19
      }).setView([bp.lat, bp.lon], 11);
      map = m;

      if(opts.planMapBaseLayer){
        try{ await opts.planMapBaseLayer(m, { seafloorDem: true }); }
        catch(e){ console.warn('lobster basemap', e); }
      }
      if(opts.addCoastOverlay){
        try{ opts.addCoastOverlay(global.L.layerGroup().addTo(m)); }
        catch(e){ console.warn('lobster coast', e); }
      }
      spotLayer = global.L.layerGroup().addTo(m);
      boatMarker = global.L.marker([bp.lat, bp.lon], {
        icon: global.L.divIcon({
          className: 'boat-icon',
          html: '<div style="font-size:24px;line-height:1;filter:drop-shadow(0 0 5px #3dd6f5)">▲</div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        }),
        zIndexOffset: 1000
      }).addTo(m);
      mapInited = true;
      if(opts.ensureMpaOverlay){
        try{ await opts.ensureMpaOverlay(m, 'lobPlan'); }
        catch(e){ console.warn('lobster MPA', e); }
      }
      try{ if(spotLayer.bringToFront) spotLayer.bringToFront(); }catch(e){ /* ignore */ }
      setTimeout(() => { try{ m.invalidateSize(true); }catch(e){ /* ignore */ } }, 80);
      return m;
    })().catch(e => {
      mapInitPromise = null;
      mapInited = false;
      map = null;
      spotLayer = null;
      boatMarker = null;
      throw e;
    });
    return mapInitPromise;
  }

  function paintMap(ranked, allPins, bp){
    if(!map || !spotLayer || !boatMarker) return 0;
    spotLayer.clearLayers();
    boatMarker.setLatLng([bp.lat, bp.lon]);
    const localGroups = ranked.filter(r => r.distNm <= LOBSTER_MAP_FIT_NM * 1.8);
    const featured = localGroups.slice(0, 40);
    const featuredIds = new Set(featured.map(r => r.spot.id));
    /* Other modules of ranked groups + unranked pins — unnumbered dots (Fish/Dive pattern). */
    const siblingDots = (allPins || []).filter(r =>
      r.distNm <= LOBSTER_MAP_FIT_NM * 1.8 && !featuredIds.has(r.spot.id)
    ).slice(0, 80);

    featured.forEach((r, i) => {
      const rank = i + 1;
      const sz = rank <= 6 ? 28 : 24;
      const icon = global.L.divIcon({
        className: 'lob-map-pin',
        html: markerHtml(rank, r.score, 'rank'),
        iconSize: [sz, sz],
        iconAnchor: [sz / 2, sz / 2]
      });
      const depth = r.spot.depthFt && r.spot.depthFt.mid != null ? f0(r.spot.depthFt.mid) + ' ft' : (r.spot.depth || '—');
      const label = groupListName(r.spot);
      const modLine = (r.spot.featureGroupSize > 1)
        ? '<br><span style="opacity:.85">Best module: ' + esc(r.spot.name) + '</span>'
        : '';
      const marker = global.L.marker([r.spot.lat, r.spot.lon], {
        icon,
        zIndexOffset: 700 - i
      });
      marker.bindPopup(
        '<strong>' + esc(label) + '</strong>' + modLine + '<br>' +
        'Hunt ' + r.score + '/100 · ' + f1(r.distNm) + ' nm · ' + esc(String(depth)) + '<br>' +
        esc(r.spot.methods) +
        (r.spot.smcaWarn ? '<br><em>Verify SMCA take rules</em>' : '')
      );
      spotLayer.addLayer(marker);
    });

    siblingDots.forEach((r, i) => {
      const icon = global.L.divIcon({
        className: 'lob-map-pin',
        html: markerHtml(0, r.score, 'dot'),
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });
      const depth = r.spot.depthFt && r.spot.depthFt.mid != null ? f0(r.spot.depthFt.mid) + ' ft' : (r.spot.depth || '—');
      const marker = global.L.marker([r.spot.lat, r.spot.lon], {
        icon,
        zIndexOffset: 40
      });
      marker.bindPopup(
        '<strong>' + esc(r.spot.name) + '</strong><br>' +
        (r.spot.featureGroupName ? '<span style="opacity:.85">Part of ' + esc(r.spot.featureGroupName) + '</span><br>' : '') +
        'Hunt ' + r.score + '/100 · ' + f1(r.distNm) + ' nm · ' + esc(String(depth))
      );
      spotLayer.addLayer(marker);
    });

    try{ if(spotLayer.bringToFront) spotLayer.bringToFront(); }catch(e){ /* ignore */ }
    const ang = LOBSTER_MAP_FIT_NM / 60;
    map.fitBounds([[bp.lat - ang, bp.lon - ang], [bp.lat + ang, bp.lon + ang]], { maxZoom: 12, animate: false });
    setTimeout(() => {
      try{
        map.invalidateSize(true);
        if(spotLayer && spotLayer.bringToFront) spotLayer.bringToFront();
      }catch(e){ /* ignore */ }
    }, 80);
    lastPaintKey = bp.lat.toFixed(4) + ',' + bp.lon.toFixed(4) + ':' + featured.length;
    return featured.length;
  }

  function render(){
    const when = getPlanWhen();
    const { ranked, allPins, ctx, bp } = rankSpots(when);
    const banner = $('lobBanner');
    if(banner) banner.innerHTML = bannerHtml(ctx);
    const glance = $('lobGlance');
    if(glance) glance.innerHTML = glanceHtml(ctx, ranked);
    const list = $('lobTopPicks');
    if(list) list.innerHTML = listHtml(ranked);
    const tips = $('lobTips');
    if(tips) tips.innerHTML = tipsHtml();
    const wins = $('lobWindows');
    if(wins) wins.innerHTML = windowsHtml(ctx);
    const legend = $('lobsterMapLegend');
    if(legend){
      legend.innerHTML = rampLegendHtml() +
        '<div class="legend" style="margin-top:8px;font-size:11px">' +
          (opts && opts.mpaLegendHtml ? opts.mpaLegendHtml() : '') +
          '<span style="margin-left:8px">Fish + Dive feature groups · same-reef modules once · no-take excluded when known</span>' +
        '</div>';
    }
    ensureMap().then(() => {
      const n = paintMap(ranked, allPins, bp);
      if(opts.ensureMpaOverlay){
        Promise.resolve(opts.ensureMpaOverlay(map, 'lobPlan')).then(() => {
          try{ if(spotLayer && spotLayer.bringToFront) spotLayer.bringToFront(); }catch(e){ /* ignore */ }
          if(n === 0 || (map && map.getPane && map.getPane('markerPane') &&
              map.getPane('markerPane').children.length === 0)){
            paintMap(ranked, allPins, bp);
          }
        }).catch(()=>{});
      }
    }).catch(e => console.error('lobster map', e));
  }

  function onTabShow(){
    if(!planDateOnly){
      const dusk = new Date();
      if(dusk.getHours() < 17) dusk.setHours(18, 0, 0, 0);
      setPlanWhen(dusk);
    }
    render();
  }

  function bindUi(){
    const nowBtn = $('lobPlanNow');
    if(nowBtn) nowBtn.onclick = () => { setPlanWhen(new Date()); render(); };
    const time = $('lobPlanTime');
    if(time){
      time.addEventListener('change', () => render());
      time.addEventListener('input', () => render());
    }
    const dateBtn = $('lobPlanDateBtn');
    if(dateBtn && opts.openPlanCalendar){
      dateBtn.onclick = () => {
        const initial = getPlanWhen();
        opts.openPlanCalendar(initial, (picked) => {
          if(!picked) return;
          const t = getPlanWhen();
          picked.setHours(t.getHours(), t.getMinutes(), 0, 0);
          setPlanWhen(picked);
          render();
        });
      };
    }
    const cal = $('lobBtnCal');
    if(cal && dateBtn) cal.onclick = () => dateBtn.click();
  }

  function init(o){
    opts = o || {};
    bindUi();
  }

  function invalidateMap(){
    if(map) setTimeout(() => { try { map.invalidateSize(true); } catch (e) { /* ignore */ } }, 100);
  }

  global.BoatLobster = {
    init,
    render,
    onTabShow,
    ensureMap,
    invalidateMap,
    seasonStatus,
    LOBSTER_GOOD_AT,
    LOBSTER_FAIR_AT
  };
})(typeof window !== 'undefined' ? window : globalThis);

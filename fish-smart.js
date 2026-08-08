/**
 * BoatBoard Fish smart layer — SST + plankton synthesis, technique bands,
 * species bite likelihood, and concise rig/iron tactics for intermediate anglers.
 * Consumes ocean samples / takeaways provided by index.html (no invented GPS).
 */
(function (global) {
  'use strict';

  /** Prefer matching longer keys first when normalizing free-text species chips. */
  var SPECIES_PROFILES = [
    {
      id: 'yellowtail',
      match: /\byellowtail\b|\byt\b|amberjack/i,
      label: 'Yellowtail',
      depth: 'mixed',
      sstIdeal: [66, 74],
      sstOk: [63, 78],
      chl: 'edge',
      tod: { dawn: 78, morning: 82, midday: 58, afternoon: 72, dusk: 80, night: 35 },
      solunarBoost: 8,
      tideIncoming: 4,
      noteWarm: 'Warm water + bait = iron/feather game',
      noteCool: 'Cool for YT — look for warm fingers or go structure'
    },
    {
      id: 'bonito',
      match: /\bbonito\b/i,
      label: 'Bonito',
      depth: 'surface',
      sstIdeal: [64, 72],
      sstOk: [60, 76],
      chl: 'edge',
      tod: { dawn: 70, morning: 85, midday: 55, afternoon: 78, dusk: 75, night: 30 },
      solunarBoost: 6,
      tideIncoming: 2,
      noteWarm: 'Chase birds and surface marks on the warm side of color',
      noteCool: 'Bonito thin when water stays cool — keep a yo-yo ready anyway'
    },
    {
      id: 'barracuda',
      match: /\bbarracuda\b|\bcuda\b/i,
      label: 'Barracuda',
      depth: 'surface',
      sstIdeal: [63, 72],
      sstOk: [58, 76],
      chl: 'moderate',
      tod: { dawn: 65, morning: 80, midday: 50, afternoon: 78, dusk: 70, night: 25 },
      solunarBoost: 4,
      tideIncoming: 2,
      noteWarm: 'Troll feathers / cast irons when bait is up',
      noteCool: 'Cuda quieter in cool water — still possible on warm edges'
    },
    {
      id: 'calico',
      match: /\bcalico\b|\bkelp bass\b/i,
      label: 'Calico bass',
      depth: 'mid',
      sstIdeal: [60, 70],
      sstOk: [55, 74],
      chl: 'moderate',
      tod: { dawn: 90, morning: 85, midday: 48, afternoon: 62, dusk: 88, night: 40 },
      solunarBoost: 10,
      tideIncoming: 8,
      noteWarm: 'Kelp edges and high spots — live bait or swimbait',
      noteCool: 'Still fishable; slow presentations tight to structure'
    },
    {
      id: 'sandbass',
      match: /\bsand bass\b|\bsandbass\b/i,
      label: 'Sand bass',
      depth: 'bottom',
      sstIdeal: [58, 70],
      sstOk: [54, 74],
      chl: 'green',
      tod: { dawn: 78, morning: 80, midday: 55, afternoon: 65, dusk: 82, night: 45 },
      solunarBoost: 6,
      tideIncoming: 6,
      noteWarm: 'Soft bottom / module edges with live bait',
      noteCool: 'Reliable on structure even when pelagics are quiet'
    },
    {
      id: 'halibut',
      match: /\bhalibut\b/i,
      label: 'Halibut',
      depth: 'bottom',
      sstIdeal: [58, 68],
      sstOk: [54, 72],
      chl: 'green',
      tod: { dawn: 88, morning: 82, midday: 45, afternoon: 55, dusk: 80, night: 35 },
      solunarBoost: 8,
      tideIncoming: 10,
      noteWarm: 'Sand-to-structure transitions on moving water',
      noteCool: 'Classic cool-water target — work flats and channel edges'
    },
    {
      id: 'rockfish',
      match: /\brockfish\b|\blingcod\b|\bsculpin\b|\bsheephead\b/i,
      label: 'Rockfish / bottom',
      depth: 'bottom',
      sstIdeal: [52, 64],
      sstOk: [48, 70],
      chl: 'any',
      tod: { dawn: 70, morning: 75, midday: 72, afternoon: 70, dusk: 68, night: 55 },
      solunarBoost: 4,
      tideIncoming: 2,
      noteWarm: 'Still work — fish the cooler / deeper relief',
      noteCool: 'Prime cold-water structure game'
    },
    {
      id: 'white seabass',
      match: /\bwhite\s*seabass\b|\bwsb\b/i,
      label: 'White seabass',
      depth: 'mid',
      sstIdeal: [58, 66],
      sstOk: [54, 70],
      chl: 'green',
      tod: { dawn: 85, morning: 70, midday: 40, afternoon: 50, dusk: 82, night: 55 },
      solunarBoost: 10,
      tideIncoming: 8,
      noteWarm: 'Squid / live bait near kelp when forage is present',
      noteCool: 'WSB like cooler green water — dawn/dusk priority'
    }
  ];

  function clamp(n, lo, hi) {
    n = +n;
    if (!isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
  }

  function dayPeriod(hour) {
    hour = +hour;
    if (hour >= 5 && hour < 7) return 'dawn';
    if (hour >= 7 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 15) return 'midday';
    if (hour >= 15 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 21) return 'dusk';
    return 'night';
  }

  function profileForSpecies(name) {
    var s = String(name || '');
    for (var i = 0; i < SPECIES_PROFILES.length; i++) {
      if (SPECIES_PROFILES[i].match.test(s)) return SPECIES_PROFILES[i];
    }
    return null;
  }

  function classifyFishStyle(spot) {
    if (global.__BOAT_BRIEFING_SYNTH__ && global.__BOAT_BRIEFING_SYNTH__.classifyFishStyle) {
      return global.__BOAT_BRIEFING_SYNTH__.classifyFishStyle(spot);
    }
    if (!spot) return 'structure';
    if (spot.fishStyle === 'surface' || spot.fishStyle === 'structure') return spot.fishStyle;
    var tactics = String(spot.tactics || '');
    var habitat = String(spot.habitat || '');
    var name = String(spot.name || '');
    var text = tactics + ' ' + habitat + ' ' + name;
    if (/\btrolls?\b|\bfeathers?\b|surface\s*irons?|yo-?yos?|cast\s+irons?|slow[- ]trolls?|fly[- ]lines?/i.test(tactics))
      return 'surface';
    if (/open[- ]water|pelagic\s+corridor|color[- ]breaks?|bait\s*balls?|kelp\s+padd(?:y|ies)|weed\s+lines?/i.test(text))
      return 'surface';
    return 'structure';
  }

  /**
   * Build a lightweight ocean context from Open-Meteo SST + Plankton tab samples/takeaway.
   * oceanIn: {
   *   sstF, chlAvg, chlBand, chlSamples:[{id,name,val,lat,lon}],
   *   takeawayText, sstZoneHint, chlTime, sourceNotes:[]
   * }
   */
  function normalizeOcean(oceanIn, ctx) {
    var o = oceanIn || {};
    var sstF = o.sstF != null ? +o.sstF : (ctx && ctx.sstF != null ? +ctx.sstF : null);
    var chlAvg = o.chlAvg != null && isFinite(+o.chlAvg) ? +o.chlAvg : null;
    var samples = Array.isArray(o.chlSamples) ? o.chlSamples : [];
    if (chlAvg == null && samples.length) {
      var vals = samples.map(function (s) { return s.val; }).filter(function (v) { return v != null && isFinite(v); });
      if (vals.length) chlAvg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    }
    var band = o.chlBand || null;
    if (!band && chlAvg != null) {
      if (chlAvg < 0.12) band = 'ultra-clear';
      else if (chlAvg < 0.25) band = 'clear';
      else if (chlAvg < 0.45) band = 'green';
      else if (chlAvg < 0.8) band = 'very-green';
      else band = 'bloom';
    }
    return {
      sstF: sstF != null && isFinite(sstF) ? sstF : null,
      chlAvg: chlAvg,
      chlBand: band,
      chlSamples: samples,
      takeawayText: o.takeawayText || '',
      sstZoneHint: o.sstZoneHint || '',
      chlTime: o.chlTime || null,
      sourceNotes: o.sourceNotes || [],
      hasChl: chlAvg != null || !!(o.takeawayText),
      hasSst: sstF != null && isFinite(sstF)
    };
  }

  function nearestChlSample(lat, lon, samples) {
    if (!samples || !samples.length || lat == null || lon == null) return null;
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      if (s.val == null || !isFinite(s.val) || s.lat == null || s.lon == null) continue;
      var dlat = (s.lat - lat) * 60;
      var dlon = (s.lon - lon) * 60 * Math.cos(lat * Math.PI / 180);
      var d = Math.sqrt(dlat * dlat + dlon * dlon);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best ? { sample: best, nmApprox: bestD } : null;
  }

  function chlBandFromVal(v) {
    if (v == null || !isFinite(v)) return null;
    if (v < 0.12) return 'ultra-clear';
    if (v < 0.25) return 'clear';
    if (v < 0.45) return 'green';
    if (v < 0.8) return 'very-green';
    return 'bloom';
  }

  /**
   * Bias ocean context toward a mark: prefer pin-local CHL cell when present,
   * else nearest CHL_ZONES sample. SST stays boat/model (Open-Meteo at vessel).
   */
  function localizeOceanToSpot(spot, oceanIn, ctx) {
    var ocean = normalizeOcean(oceanIn, ctx);
    ocean.sourceNotes = (ocean.sourceNotes || []).slice().filter(function (n) {
      return !/^chl nearest zone/i.test(String(n || '')) && !/^chl at mark/i.test(String(n || ''));
    });
    delete ocean.localChlName;
    delete ocean.localChlNm;
    delete ocean.pinLocalChl;
    if (!spot || spot.lat == null || spot.lon == null) return ocean;

    var pin = null;
    var samples = ocean.chlSamples || [];
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      if (!s || !s.pinLocal || s.val == null || !isFinite(s.val)) continue;
      if (s.lat == null || s.lon == null) continue;
      if (Math.abs(s.lat - spot.lat) < 1e-3 && Math.abs(s.lon - spot.lon) < 1e-3) {
        pin = s;
        break;
      }
    }
    if (pin) {
      ocean.chlAvg = pin.val;
      ocean.chlBand = chlBandFromVal(pin.val) || ocean.chlBand;
      ocean.localChlName = pin.name || 'mark cell';
      ocean.localChlNm = 0;
      ocean.pinLocalChl = true;
      ocean.hasChl = true;
      ocean.sourceNotes.push('chl at mark · VIIRS 4 km cell');
      return ocean;
    }

    var near = nearestChlSample(spot.lat, spot.lon, ocean.chlSamples);
    if (near && near.sample && near.sample.val != null && isFinite(near.sample.val)) {
      ocean.chlAvg = near.sample.val;
      ocean.chlBand = chlBandFromVal(near.sample.val) || ocean.chlBand;
      ocean.localChlName = near.sample.name || near.sample.id || null;
      ocean.localChlNm = near.nmApprox;
      ocean.pinLocalChl = false;
      ocean.hasChl = true;
      var note = 'chl nearest zone' +
        (ocean.localChlName ? ' · ' + ocean.localChlName : '') +
        (near.nmApprox != null && isFinite(near.nmApprox) ? ' (~' + Math.round(near.nmApprox * 10) / 10 + ' nm)' : '');
      ocean.sourceNotes.push(note);
    }
    return ocean;
  }

  /** Modest site-fit adjustment from SST match + nearby chlorophyll productivity. */
  function oceanSiteDelta(spot, ctx, oceanIn) {
    var ocean = normalizeOcean(oceanIn, ctx);
    var d = 0;
    var notes = [];
    var style = classifyFishStyle(spot);
    var spText = ((spot && spot.species) || []).join(' ').toLowerCase();
    var wantsPelagic = /yellowtail|bonito|barracuda|dorado|tuna/.test(spText) || style === 'surface';
    var wantsBottom = /rockfish|lingcod|sculpin|halibut|sand bass|sheephead/.test(spText);
    var wantsBass = /calico|kelp bass|sand bass|bass/.test(spText);

    if (ocean.sstF != null && spot && spot.minSstF != null) {
      var gap = ocean.sstF - spot.minSstF;
      if (gap < -2) { d -= 2; notes.push('SST below spot comfort'); }
      else if (gap >= 5) { d += 2; notes.push('SST well above spot min'); }
    }

    var near = nearestChlSample(spot && spot.lat, spot && spot.lon, ocean.chlSamples);
    var localChl = near && near.sample ? near.sample.val : ocean.chlAvg;
    if (localChl != null) {
      if (wantsPelagic) {
        if (localChl >= 0.2 && localChl < 0.8) { d += 4; notes.push('productivity near color-break range'); }
        else if (localChl < 0.12) { d += 1; notes.push('blue water — pelagics may run deeper'); }
        else if (localChl >= 0.8) { d += 2; notes.push('bloom — fish the blue edge'); }
      } else if (wantsBass || wantsBottom) {
        if (localChl >= 0.25 && localChl < 0.8) { d += 3; notes.push('green water feeds bait on structure'); }
        else if (localChl < 0.15) { d -= 1; notes.push('clear/blue — structure still works, bait thinner'); }
      }
      if (near && near.sample && near.sample.name) {
        notes.push('chl ref ~' + near.sample.name);
      }
    } else if (ocean.chlBand) {
      if (wantsPelagic && (ocean.chlBand === 'green' || ocean.chlBand === 'very-green')) {
        d += 2; notes.push('regional green water favors bait edges');
      } else if (wantsPelagic && ocean.chlBand === 'bloom') {
        d += 1; notes.push('bloom region — work edges');
      } else if ((wantsBass || wantsBottom) && (ocean.chlBand === 'green' || ocean.chlBand === 'very-green')) {
        d += 2; notes.push('productive water for structure forage');
      }
    }

    return { delta: Math.round(clamp(d, -6, 7)), notes: notes };
  }

  /** Mild global bite nudge from regional plankton (does not replace tide/wind model). */
  function oceanBiteDelta(ctx, oceanIn) {
    var ocean = normalizeOcean(oceanIn, ctx);
    var d = 0;
    var notes = [];
    if (ocean.chlAvg != null) {
      if (ocean.chlAvg >= 0.25 && ocean.chlAvg < 0.8) {
        d += 4; notes.push('productive plankton band — bait more likely');
      } else if (ocean.chlAvg >= 0.8) {
        d += 2; notes.push('bloom signal — fish edges, expect murk');
      } else if (ocean.chlAvg < 0.12) {
        d -= 2; notes.push('ultra-clear — thinner nearshore bait');
      }
    } else if (ocean.takeawayText) {
      if (/bloom|elevated plankton|very green|productive/i.test(ocean.takeawayText)) {
        d += 2; notes.push('plankton takeaway: productive');
      } else if (/clear blue|ultra-clear|mostly clear/i.test(ocean.takeawayText)) {
        d -= 1; notes.push('plankton takeaway: clear/blue');
      }
    }
    return { delta: Math.round(clamp(d, -4, 5)), notes: notes };
  }

  function sstFitScore(sstF, ideal, ok) {
    if (sstF == null || !isFinite(sstF)) return { mult: 0.85, note: 'SST unknown' };
    if (sstF >= ideal[0] && sstF <= ideal[1]) return { mult: 1.08, note: 'in preferred temp' };
    if (sstF >= ok[0] && sstF <= ok[1]) return { mult: 0.95, note: 'workable temp' };
    if (sstF < ok[0]) return { mult: 0.72, note: 'cool for this species' };
    return { mult: 0.78, note: 'warm for this species' };
  }

  function chlFitMult(chlPref, ocean) {
    var band = ocean.chlBand;
    var avg = ocean.chlAvg;
    if (!band && avg == null) return { mult: 1, note: null };
    if (chlPref === 'any') return { mult: 1, note: null };
    if (chlPref === 'edge') {
      if (avg != null && avg >= 0.2 && avg < 0.8) return { mult: 1.1, note: 'color-break productivity' };
      if (band === 'bloom' || band === 'ultra-clear') return { mult: 1.05, note: 'edge game still on' };
      if (band === 'clear' || band === 'green' || band === 'very-green') return { mult: 1.06, note: null };
      return { mult: 1, note: null };
    }
    if (chlPref === 'green' || chlPref === 'moderate') {
      if (avg != null && avg >= 0.25) return { mult: 1.08, note: 'green water helps' };
      if (avg != null && avg < 0.15) return { mult: 0.9, note: 'clearer than ideal' };
      if (band === 'green' || band === 'very-green' || band === 'bloom') return { mult: 1.06, note: null };
    }
    return { mult: 1, note: null };
  }

  /**
   * Species bite likelihood at plan time (0–100 heuristic, honest when data thin).
   */
  function speciesBiteLikelihood(speciesName, ctx, oceanIn) {
    var ocean = normalizeOcean(oceanIn, ctx);
    var prof = profileForSpecies(speciesName);
    var hour = ctx && ctx.hour != null ? ctx.hour : new Date().getHours();
    var period = dayPeriod(hour);
    if (!prof) {
      return {
        species: String(speciesName || 'Unknown'),
        pct: null,
        label: 'unknown',
        why: 'No local profile — treat as situational',
        uncertain: true
      };
    }
    var base = prof.tod[period] != null ? prof.tod[period] : 55;
    var sst = sstFitScore(ocean.sstF, prof.sstIdeal, prof.sstOk);
    var chl = chlFitMult(prof.chl, ocean);
    var score = base * sst.mult * chl.mult;
    if (ctx && ctx.sol && ctx.sol.active) score += prof.solunarBoost;
    else if (ctx && ctx.sol && ctx.sol.minutes != null && ctx.sol.minutes <= 90) score += Math.round(prof.solunarBoost / 2);
    if (ctx && ctx.tide && ctx.tide.rising && prof.tideIncoming) score += prof.tideIncoming;
    if (ctx && ctx.wind != null && ctx.wind >= 18 && (prof.depth === 'surface' || prof.depth === 'mixed')) score -= 12;
    if (ctx && ctx.seas != null && ctx.seas > 3.5 && prof.depth === 'surface') score -= 10;

    var pct = Math.round(clamp(score, 8, 96));
    var label = pct >= 72 ? 'likely' : pct >= 52 ? 'fair' : pct >= 35 ? 'slim' : 'poor';
    var bits = [];
    bits.push(period);
    if (sst.note) bits.push(sst.note);
    if (chl.note) bits.push(chl.note);
    if (ocean.sstF == null) bits.push('no SST yet');
    if (!ocean.hasChl) bits.push('plankton not sampled');
    var why = (ocean.sstF != null && ocean.sstF < prof.sstIdeal[0] ? prof.noteCool : prof.noteWarm);
    return {
      species: prof.label,
      id: prof.id,
      pct: pct,
      label: label,
      depth: prof.depth,
      why: why + ' · ' + bits.join(', '),
      uncertain: ocean.sstF == null && !ocean.hasChl
    };
  }

  function speciesLikelihoodForSpot(spot, ctx, oceanIn) {
    var ocean = localizeOceanToSpot(spot, oceanIn, ctx);
    var list = (spot && spot.species && spot.species.length) ? spot.species : ['calico bass', 'sand bass'];
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var row = speciesBiteLikelihood(list[i], ctx, ocean);
      var key = row.id || row.species;
      if (seen[key]) continue;
      seen[key] = true;
      out.push(row);
    }
    out.sort(function (a, b) {
      var pa = a.pct == null ? -1 : a.pct;
      var pb = b.pct == null ? -1 : b.pct;
      return pb - pa;
    });
    return out;
  }

  /** Boat-centric / multi-spot aggregate when no mark is selected. */
  function speciesLikelihoodPanel(ctx, oceanIn, rankedTop) {
    var ocean = normalizeOcean(oceanIn, ctx);
    var bag = {};
    var sources = rankedTop || [];
    for (var i = 0; i < sources.length && i < 8; i++) {
      var spot = sources[i].spot || sources[i];
      var rows = speciesLikelihoodForSpot(spot, ctx, ocean);
      for (var j = 0; j < rows.length; j++) {
        var r = rows[j];
        var key = r.id || r.species;
        if (!bag[key] || (r.pct != null && (bag[key].pct == null || r.pct > bag[key].pct))) {
          bag[key] = r;
        }
      }
    }
    /* Always include common SoCal targets so the panel isn't empty on thin spot lists. */
    var defaults = ['calico bass', 'sand bass', 'halibut', 'bonito', 'yellowtail', 'rockfish'];
    for (var d = 0; d < defaults.length; d++) {
      var row = speciesBiteLikelihood(defaults[d], ctx, ocean);
      var k = row.id || row.species;
      if (!bag[k]) bag[k] = row;
    }
    var list = Object.keys(bag).map(function (k) { return bag[k]; });
    list.sort(function (a, b) {
      return (b.pct == null ? -1 : b.pct) - (a.pct == null ? -1 : a.pct);
    });
    return list.slice(0, 7);
  }

  /**
   * Technique band: surface | mid | bottom | mixed — tied to mark style, TOD, SST/chl, species.
   */
  function recommendTechnique(spot, ctx, oceanIn) {
    var ocean = localizeOceanToSpot(spot, oceanIn, ctx);
    var style = classifyFishStyle(spot);
    var hour = ctx && ctx.hour != null ? ctx.hour : new Date().getHours();
    var period = dayPeriod(hour);
    var sp = speciesLikelihoodForSpot(spot, ctx, ocean);
    var top = sp[0];
    var votes = { surface: 0, mid: 0, bottom: 0 };

    if (style === 'surface') votes.surface += 4;
    else votes.mid += 1;

    for (var i = 0; i < Math.min(sp.length, 4); i++) {
      var w = Math.max(1, 4 - i);
      var dep = sp[i].depth || 'mid';
      if (dep === 'mixed') { votes.surface += w * 0.5; votes.mid += w * 0.5; }
      else votes[dep] = (votes[dep] || 0) + w;
    }

    if (period === 'dawn' || period === 'dusk') {
      votes.surface += 1.5;
      votes.mid += 1;
    } else if (period === 'midday') {
      votes.bottom += 2;
      votes.mid += 1;
      votes.surface -= 1;
    } else if (period === 'night') {
      votes.bottom += 1;
      votes.mid += 0.5;
      votes.surface -= 2;
    }

    if (ocean.sstF != null && ocean.sstF >= 66) votes.surface += 1.5;
    if (ocean.sstF != null && ocean.sstF < 60) { votes.bottom += 1.5; votes.surface -= 1; }
    if (ocean.chlBand === 'ultra-clear' || ocean.chlBand === 'clear') {
      votes.mid += 1;
      if (style === 'surface') votes.surface += 0.5;
    }
    if (ocean.chlBand === 'green' || ocean.chlBand === 'very-green' || ocean.chlBand === 'bloom') {
      votes.surface += 1;
      votes.mid += 0.5;
    }
    if (ctx && ctx.wind != null && ctx.wind >= 16) votes.surface -= 2;
    if (ctx && ctx.seas != null && ctx.seas > 3) votes.surface -= 1.5;

    var depthStr = String((spot && spot.depth) || '');
    var deepFt = parseInt(depthStr, 10);
    if (isFinite(deepFt) && deepFt >= 120) votes.bottom += 2;
    if (/180|200|fathom|deep/i.test(depthStr)) votes.bottom += 1;

    var entries = [
      { band: 'surface', v: votes.surface },
      { band: 'mid', v: votes.mid },
      { band: 'bottom', v: votes.bottom }
    ].sort(function (a, b) { return b.v - a.v; });

    var best = entries[0];
    var second = entries[1];
    var band = best.band;
    var mixed = second && (best.v - second.v) < 1.6;
    if (mixed) band = 'mixed';

    var labels = {
      surface: 'Surface',
      mid: 'Mid-water',
      bottom: 'Bottom',
      mixed: 'Mixed'
    };
    var present = {
      surface: 'Troll feathers / cast irons & yo-yos; watch birds and bait on the sounder.',
      mid: 'Live bait or swimbaits 8–25 ft down on kelp edges and module tops — keep moving until you mark fish.',
      bottom: 'Dropper loops, yo-yo to the reef, or drag soft plastics along the sand-rock transition.',
      mixed: 'Start where bait shows (surface or mid), then drop to structure if the school settles.'
    };

    var whyParts = [];
    if (style === 'surface') whyParts.push('mark is surface/troll oriented');
    else whyParts.push('structure mark');
    whyParts.push(period + ' window');
    if (top && top.pct != null) whyParts.push(top.species + ' leading (~' + top.pct + '%)');
    if (ocean.sstF != null) whyParts.push('SST ~' + Math.round(ocean.sstF) + '°F (boat/model)');
    if (ocean.localChlName) whyParts.push('nearest chl · ' + ocean.localChlName);
    else if (ocean.chlBand) whyParts.push(ocean.chlBand + ' plankton');
    if (!ocean.hasChl) whyParts.push('plankton thin/missing — technique leans on time + SST');

    var tech = {
      band: band,
      label: labels[band] || band,
      presentation: present[band] || present.mixed,
      why: whyParts.join(' · '),
      votes: votes,
      topSpecies: top || null,
      period: period,
      style: style
    };
    tech.intel = buildFishingIntel(spot, ctx, ocean, tech, sp);
    return tech;
  }

  /**
   * Concise intermediate tactics: depth call, rigs, iron/lure color, bait note.
   * Driven by technique band + leading species + light/water (chl), not essays.
   */
  function buildFishingIntel(spot, ctx, ocean, tech, likes) {
    var band = (tech && tech.band) || 'mixed';
    var period = (tech && tech.period) || dayPeriod(ctx && ctx.hour != null ? ctx.hour : new Date().getHours());
    var top = (likes && likes[0]) || (tech && tech.topSpecies) || null;
    var sid = (top && top.id) || '';
    var chl = ocean && ocean.chlBand;
    var green =
      chl === 'green' || chl === 'very-green' || chl === 'bloom';
    var blue =
      chl === 'ultra-clear' || chl === 'clear';
    var lowLight =
      period === 'dawn' || period === 'dusk' || period === 'night';
    var midday = period === 'midday';
    var windy = ctx && ctx.wind != null && ctx.wind >= 16;
    var rough = ctx && ctx.seas != null && ctx.seas > 3;

    var depthCalls = {
      surface: { call: 'Top fish', why: 'Bait/birds up or warm surface window — stay shallow until marks fade.' },
      mid: { call: 'Mid-column', why: 'Work 8–25 ft on kelp tops / module edges; sounder first, then settle.' },
      bottom: { call: 'Bottom fish', why: 'Midday, cool water, or structure lean — fish the reef/sand transition.' },
      mixed: { call: 'Mixed', why: 'Start where bait shows (top/mid); drop if the school settles on structure.' }
    };
    if (band === 'surface' && (windy || rough)) {
      depthCalls.surface.why = 'Surface lean still on — shorten casts / tighter feathers if wind chops the top.';
    }
    if (band === 'bottom' && midday) {
      depthCalls.bottom.why = 'Sun high — fish deeper / tighter to relief; skip a long surface hunt.';
    }
    if (band === 'surface' && (period === 'dawn' || period === 'dusk')) {
      depthCalls.surface.why = 'Low-light window — top-water / shallow iron before the school drops.';
    }
    if (top && top.pct != null && top.pct >= 55) {
      if (sid === 'rockfish' || sid === 'halibut' || sid === 'sandbass') {
        if (band !== 'surface') depthCalls[band].why = top.species + ' leading — keep presentations on or near the bottom.';
      } else if (sid === 'bonito' || sid === 'barracuda') {
        if (band === 'surface' || band === 'mixed') {
          depthCalls[band].why = top.species + ' leading — stay on top until bait disappears.';
        }
      } else if (sid === 'yellowtail' && band === 'mixed') {
        depthCalls.mixed.why = 'YT leading — fly-line/iron first; yo-yo the high spot if they pin to structure.';
      }
    }
    var depth = depthCalls[band] || depthCalls.mixed;

    var env = {
      green: green,
      blue: blue,
      lowLight: lowLight,
      midday: midday,
      chl: chl,
      period: period,
      band: band,
      bloom: chl === 'bloom' || chl === 'very-green'
    };
    var rigs = pickRigs(band, sid, spot);
    var iron = pickIronLure(band, sid, env);
    var forage = pickForage(band, sid, env, ocean, ctx);
    var bait = pickBaitNote(band, sid, period, ocean, ctx, forage);

    var bullets = [];
    if (rigs.length) bullets.push('Rig: ' + rigs.join(' · '));
    if (iron) {
      var ironLine = 'Iron/lure: ' + iron.type;
      if (iron.color) ironLine += ' · ' + iron.color;
      if (iron.altColor) ironLine += ' (alt ' + iron.altColor + ')';
      if (iron.size) ironLine += ' · ' + iron.size;
      bullets.push(ironLine);
    }
    if (forage && forage.line) bullets.push(forage.line);
    if (bait) bullets.push(bait);

    return {
      depthCall: depth.call,
      depthWhy: depth.why,
      rigs: rigs,
      iron: iron,
      forage: forage || null,
      bait: bait || null,
      bullets: bullets
    };
  }

  function pickRigs(band, sid, spot) {
    var depthStr = String((spot && spot.depth) || '');
    var deep = /180|200|fathom|deep/i.test(depthStr) || (parseInt(depthStr, 10) >= 120);
    var out = [];

    if (sid === 'halibut') {
      out.push('Sliding sinker / Carolina');
      out.push('Soft plastic on ½–1 oz');
    } else if (sid === 'rockfish') {
      out.push(deep ? 'Dropper loop 8–16 oz' : 'Dropper loop 4–8 oz');
      out.push(deep ? 'Slow-pitch / butterfly' : 'Yo-yo to the reef');
    } else if (sid === 'sandbass') {
      out.push('Drop-shot or Carolina');
      out.push('Light sliding sinker');
    } else if (sid === 'calico') {
      out.push('Fly-line / free-spool live bait');
      out.push('Weedless swimbait');
    } else if (sid === 'white seabass') {
      out.push('Fly-line live squid');
      out.push('Slow mid-column drift');
    } else if (sid === 'yellowtail') {
      if (band === 'bottom' || band === 'mid') out.push('Yo-yo iron on the high spot');
      else out.push('Fly-line / surface iron');
      out.push('Troll feathers if bait is up');
    } else if (sid === 'bonito' || sid === 'barracuda') {
      out.push('Troll feathers');
      out.push('Cast chrome / small iron');
    } else {
      /* band defaults when species profile thin */
      if (band === 'surface') {
        out.push('Troll feathers');
        out.push('Cast yo-yo / surface iron');
      } else if (band === 'mid') {
        out.push('Fly-line live bait');
        out.push('Swimbait 8–25 ft');
      } else if (band === 'bottom') {
        out.push(deep ? 'Dropper loop / slow-pitch' : 'Dropper loop or sliding sinker');
        out.push('Yo-yo the relief');
      } else {
        out.push('Fly-line or surface iron first');
        out.push('Dropper ready if they pin');
      }
    }
    return out.slice(0, 2);
  }

  /**
   * Iron / jig / soft-plastic color by species + light + water color.
   * Returns type, primary color, optional alt, and size hint for SoCal tackle boxes.
   */
  function pickIronLure(band, sid, env) {
    var green = env.green;
    var blue = env.blue;
    var lowLight = env.lowLight;
    var midday = env.midday;
    var bloom = !!env.bloom || env.chl === 'bloom';
    var type = null;
    var color = null;
    var altColor = null;
    var size = null;

    if (sid === 'yellowtail') {
      type = band === 'bottom' || band === 'mid'
        ? 'Yo-yo iron (Tady / Salas style) on the high spot'
        : 'Surface iron / fly-line iron';
      size = band === 'bottom' || band === 'mid' ? '4–6 oz class' : 'light–medium surface iron';
      if (lowLight || green) {
        color = 'Green sardine or green mackerel';
        altColor = 'Dark back / purple chrome';
      } else if (blue && midday) {
        color = 'Chrome or pure blue/white';
        altColor = 'Light green chrome';
      } else if (blue) {
        color = 'Blue/white or chrome';
        altColor = 'Green sardine';
      } else {
        color = 'Blue/white or green chrome';
        altColor = 'Mackerel';
      }
    } else if (sid === 'bonito') {
      type = 'Small iron / trolling feathers / candy-bar';
      size = '2–4 oz iron or #2–#4 feathers';
      if (lowLight || green) {
        color = 'Green/chrome or dark-back sardine';
        altColor = 'Purple chrome';
      } else {
        color = 'Chrome or blue/white';
        altColor = 'Light green chrome';
      }
    } else if (sid === 'barracuda') {
      type = 'Feathers / slim surface iron';
      size = 'slim profile — match anchovy/sardine length';
      color = blue || midday ? 'Chrome or blue/white' : 'Green chrome or dark back';
      altColor = 'White feather with flash';
    } else if (sid === 'calico') {
      type = 'Weedless 4–6" swimbait / soft plastic';
      size = '4–6" paddle-tail; ½–1 oz weight';
      if (green || lowLight || bloom) {
        color = 'Dark baitfish, green pumpkin, or black/blue flake';
        altColor = 'Motor oil or junebug';
      } else if (blue) {
        color = 'Sardine, blue/silver, or ghost minnow';
        altColor = 'White/chartreuse trailer';
      } else {
        color = 'Sardine or blue/silver';
        altColor = 'Green baitfish';
      }
    } else if (sid === 'sandbass') {
      type = 'Grub / curly-tail / drop-shot soft plastic';
      size = '3–5" grub on ⅜–¾ oz';
      if (green || lowLight || bloom) {
        color = 'Motor oil, root beer, or dark purple';
        altColor = 'Black/chartreuse';
      } else {
        color = 'White, pearl, or chartreuse';
        altColor = 'Smoke / salt-and-pepper';
      }
    } else if (sid === 'halibut') {
      type = 'Big swimbait / scampi / leadhead';
      size = '5–8" swimbait or 1–3 oz scampi';
      if (green || lowLight) {
        color = 'White, bone, or dark sardine';
        altColor = 'Glow white / chartreuse';
      } else {
        color = 'White, silver, or sardine';
        altColor = 'Blue/silver or pink';
      }
    } else if (sid === 'rockfish') {
      type = bloom
        ? 'Shrimp fly / dark metal jig (big silhouette)'
        : 'Shrimp fly / slow-pitch / butterfly jig';
      size = 'match depth — heavier on deep drops';
      if (lowLight || green || bloom) {
        color = 'Dark red, purple, or black shrimp';
        altColor = 'Glow pink / orange shrimp';
      } else if (blue) {
        color = 'Pink or orange shrimp; chrome metal as backup';
        altColor = 'White/glow shrimp fly';
      } else {
        color = 'Pink shrimp or red/white';
        altColor = 'Chrome / blue metal';
      }
    } else if (sid === 'white seabass') {
      type = 'Live squid first — soft squid imitation only as backup';
      color = 'Natural translucent / white squid plastic';
      altColor = 'Light green glow squid (murk)';
      size = 'match local squid size';
    } else if (band === 'surface' || band === 'mixed') {
      type = 'Surface iron / feathers';
      size = 'light–medium';
      if (lowLight || green) {
        color = 'Green sardine or dark-back chrome';
        altColor = 'Purple / mackerel';
      } else if (blue) {
        color = 'Chrome or blue/white';
        altColor = 'Green chrome';
      } else {
        color = 'Blue/white';
        altColor = 'Green sardine';
      }
    } else if (band === 'bottom') {
      type = 'Yo-yo iron or soft plastic on the relief';
      if (green || lowLight) {
        color = 'Dark profile — purple, green pumpkin, or black';
        altColor = 'Glow white';
      } else {
        color = 'Chrome, white, or sardine';
        altColor = 'Pink shrimp tone';
      }
    } else {
      type = 'Swimbait or live-bait presentation';
      color = green || lowLight ? 'Darker baitfish / green pumpkin' : 'Sardine / blue-silver';
      altColor = green || lowLight ? 'White/chartreuse' : 'Green baitfish';
    }

    if (bloom && color && sid !== 'white seabass') {
      color = color + ' — bigger / darker silhouette in murk';
    }
    if (!type) return null;
    return { type: type, color: color, altColor: altColor, size: size };
  }

  /**
   * Shrimp vs squid vs fish (sardine/anchovy/mackerel) forage pick for the mark.
   * Primary is what to pin first; secondary is the swap if the bite is soft.
   */
  function pickForage(band, sid, env, ocean, ctx) {
    var period = (env && env.period) || 'morning';
    var lowLight = !!(env && env.lowLight);
    var green = !!(env && env.green);
    var bloom = !!(env && env.bloom);
    var outgoing = ctx && ctx.tide && ctx.tide.rising === false;
    var warm = ocean && ocean.sstF != null && ocean.sstF >= 64;
    var primary = 'fish';
    var secondary = 'squid';
    var skip = null;
    var why = '';
    var detail = '';

    if (sid === 'white seabass') {
      primary = 'squid';
      secondary = 'fish';
      skip = 'shrimp';
      why = 'WSB key on live squid — fish bait is a distant backup; shrimp almost never.';
      detail = 'Pin live squid (fly-line or slow mid-column). Keep a sardine ready only if squid dies off.';
    } else if (sid === 'rockfish') {
      primary = 'squid';
      secondary = 'shrimp';
      skip = null;
      why = 'Bottom fish crush squid strips; shrimp-mimic jigs/flies match local forage.';
      detail = bloom || lowLight || green
        ? 'Squid strip on the dropper first; dark red/purple shrimp fly if they ignore strips. Cut fish (mackerel) for lingcod.'
        : 'Squid strip or pink shrimp fly; chrome jig as a search bait. Fish strip only if you want lingcod/big bottom.';
    } else if (sid === 'halibut') {
      primary = outgoing || green ? 'squid' : 'fish';
      secondary = primary === 'squid' ? 'fish' : 'squid';
      skip = 'shrimp';
      why = outgoing
        ? 'Outgoing tide on sand edges — squid and slow swimbaits out-fish shrimp.'
        : 'Halibut want a big protein profile — live squid or sardine/mackerel, not shrimp.';
      detail = primary === 'squid'
        ? 'Live or fresh squid on a sliding sinker; swap to sardine/anchovy if squid is scarce. Skip shrimp.'
        : 'Live sardine or mackerel first; squid strip/whole on the sand edge as backup. Skip shrimp.';
    } else if (sid === 'calico') {
      primary = lowLight ? 'fish' : (green || bloom ? 'squid' : 'fish');
      secondary = primary === 'fish' ? 'squid' : 'fish';
      skip = 'shrimp';
      why = 'Calicos eat baitfish on the edge; squid shines when water greens or light drops.';
      detail = period === 'dawn' || period === 'dusk'
        ? 'Live sardine on a short flat-line at light change; squid if they pin to kelp mid-column. Skip shrimp.'
        : primary === 'squid'
          ? 'Live squid or squid strip tight to kelp; keep sardines for a surface/edge bite. Skip shrimp.'
          : 'Live sardine/anchovy first; squid when they bury in the kelp. Skip shrimp.';
    } else if (sid === 'sandbass') {
      primary = green || bloom || band === 'bottom' ? 'squid' : 'fish';
      secondary = primary === 'squid' ? 'fish' : 'squid';
      skip = null;
      why = 'Sand bass sit on soft bottom — squid and small fish baits; shrimp plastics work as a third option.';
      detail = primary === 'squid'
        ? 'Live squid or squid strip on Carolina/drop-shot; sardine as backup; shrimp-mimic grub if both fail.'
        : 'Live sardine first on the sand edge; squid strip if they want a slower meal; shrimp grub as a last plastic.';
    } else if (sid === 'yellowtail') {
      primary = 'fish';
      secondary = 'squid';
      skip = 'shrimp';
      why = 'YT are a sardine/anchovy game; squid only when they pin to structure; never shrimp.';
      detail = period === 'midday' || band === 'bottom' || band === 'mid'
        ? 'Yo-yo or fly-line live sardine if irons quiet; squid on the high spot when they pin. Skip shrimp.'
        : 'Fly-line live sardine/anchovy when birds/bait show; keep squid only as a structure backup. Skip shrimp.';
    } else if (sid === 'bonito' || sid === 'barracuda') {
      primary = 'fish';
      secondary = null;
      skip = 'shrimp';
      why = warm
        ? 'Warm water — feathers/iron usually enough; fish bait only if they won’t commit.'
        : 'Pelagics key on baitfish; squid/shrimp rarely help on a boil.';
      detail = warm && sid === 'bonito'
        ? 'Bait optional — chrome/feathers first. If needed: small live sardine or anchovy. Skip squid/shrimp.'
        : 'Small live sardine or anchovy on a flat-line; irons/feathers do most of the work. Skip squid/shrimp.';
    } else if (band === 'bottom') {
      primary = 'squid';
      secondary = 'shrimp';
      why = 'Default bottom forage — squid strip, then shrimp-mimic jig.';
      detail = 'Squid strip on a dropper first; pink/dark shrimp fly next; cut fish if you want lingcod.';
    } else if (band === 'surface') {
      primary = 'fish';
      secondary = 'squid';
      skip = 'shrimp';
      why = 'Surface window = match the baitfish school.';
      detail = 'Live sardine/anchovy or match with iron/feathers; squid only if they drop to structure. Skip shrimp.';
    } else {
      primary = green || bloom ? 'squid' : 'fish';
      secondary = primary === 'squid' ? 'fish' : 'squid';
      why = 'Mixed mark — start with the forage the sounder shows.';
      detail = primary === 'squid'
        ? 'Start squid (strip or live) on structure; swap to sardine if bait marks are up. Shrimp jig as a third bottom option.'
        : 'Start live sardine/anchovy; squid if they pin to kelp/reef. Shrimp only as a bottom plastic.';
    }

    var forageLabel = {
      fish: 'fish (sardine / anchovy / mackerel)',
      squid: 'squid',
      shrimp: 'shrimp'
    };
    var line = 'Forage: ' + forageLabel[primary] + ' first';
    if (secondary && secondary !== primary) line += ' · ' + forageLabel[secondary] + ' backup';
    if (skip) line += ' · skip ' + skip;
    if (why) line += ' — ' + why;

    return {
      primary: primary,
      secondary: secondary,
      skip: skip,
      why: why,
      detail: detail,
      line: line
    };
  }

  function pickBaitNote(band, sid, period, ocean, ctx, forage) {
    var f = forage || pickForage(band, sid, {
      period: period,
      band: band,
      lowLight: period === 'dawn' || period === 'dusk' || period === 'night',
      green: ocean && (ocean.chlBand === 'green' || ocean.chlBand === 'very-green' || ocean.chlBand === 'bloom'),
      bloom: ocean && (ocean.chlBand === 'bloom' || ocean.chlBand === 'very-green')
    }, ocean, ctx);

    var tip = f.detail || '';
    if (sid === 'halibut' && ctx && ctx.tide && ctx.tide.rising === false) {
      tip = 'Drag sand edges on the outgoing with ' +
        (f.primary === 'squid' ? 'squid' : 'sardine/mackerel') +
        '; keep the bait just ticking the bottom.';
    } else if (sid === 'calico' && (period === 'dawn' || period === 'dusk')) {
      tip = 'Short bites at light change — live sardine on the kelp edge; have squid ready if they bury.';
    } else if (band === 'bottom' && period === 'midday' && sid !== 'rockfish' && sid !== 'white seabass') {
      tip = (tip ? tip + ' ' : '') + 'Sun high — skip a long top hunt; bait the relief.';
    }

    if (!tip) {
      tip = 'Match hook size to the forage — ' +
        (f.primary === 'shrimp' ? 'shrimp flies/jigs' :
          f.primary === 'squid' ? 'live or strip squid' :
            'live sardine, anchovy, or mackerel') + '.';
    }
    return 'Bait: ' + tip;
  }

  /** Compact bait + forage string for Plan/On site cards and map popups. */
  function baitSummaryLine(tech) {
    if (!tech || !tech.intel) return '';
    var intel = tech.intel;
    var parts = [];
    if (intel.forage) {
      var fl = {
        fish: 'fish bait (sardine/anchovy)',
        squid: 'squid',
        shrimp: 'shrimp'
      };
      var s = fl[intel.forage.primary] || intel.forage.primary;
      if (intel.forage.secondary && intel.forage.secondary !== intel.forage.primary) {
        s += ' · ' + (fl[intel.forage.secondary] || intel.forage.secondary) + ' backup';
      }
      if (intel.forage.skip) s += ' · skip ' + intel.forage.skip;
      parts.push(s);
    }
    if (intel.iron && intel.iron.color) {
      parts.push('jig/iron: ' + intel.iron.color +
        (intel.iron.altColor ? ' (alt ' + intel.iron.altColor + ')' : ''));
    }
    return parts.join(' — ');
  }

  function techniqueBadgeHtml(tech, escFn) {
    var esc = typeof escFn === 'function' ? escFn : function (s) { return String(s == null ? '' : s); };
    if (!tech || !tech.band) return '';
    var cls = 'fish-tech-badge fish-tech-' + tech.band;
    var title = (tech.why || '') + (tech.presentation ? ' — ' + tech.presentation : '');
    return '<span class="' + cls + '" title="' + esc(title) + '">' + esc(tech.label) + '</span>';
  }

  function likelihoodBarHtml(rows, escFn, opts) {
    var esc = typeof escFn === 'function' ? escFn : function (s) { return String(s == null ? '' : s); };
    opts = opts || {};
    if (!rows || !rows.length) {
      return '<p class="fish-smart-meta">Species likelihood needs trip time + conditions.</p>';
    }
    var html = '<div class="fish-species-like">';
    if (opts.title) html += '<div class="fish-smart-h">' + esc(opts.title) + '</div>';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var pct = r.pct == null ? 0 : r.pct;
      var lab = r.label || '—';
      var col = pct >= 72 ? 'var(--good)' : pct >= 52 ? 'var(--fair)' : 'var(--poor)';
      html += '<div class="fish-like-row" title="' + esc(r.why || '') + '">' +
        '<span class="fish-like-name">' + esc(r.species) + '</span>' +
        '<span class="fish-like-bar"><i style="width:' + pct + '%;background:' + col + '"></i></span>' +
        '<span class="fish-like-pct" style="color:' + col + '">' + (r.pct == null ? '—' : pct + '%') + ' ' + esc(lab) + '</span>' +
        '</div>';
    }
    if (opts.footnote) html += '<p class="fish-smart-meta">' + esc(opts.footnote) + '</p>';
    html += '</div>';
    return html;
  }

  function techniquePanelHtml(tech, escFn) {
    var esc = typeof escFn === 'function' ? escFn : function (s) { return String(s == null ? '' : s); };
    if (!tech) return '';
    var intel = tech.intel || null;
    var html = '<div class="fish-tech-panel">' +
      '<div class="fish-smart-h">How to fish · ' + esc(tech.label) + '</div>';
    if (intel && intel.depthCall) {
      html += '<div class="fish-intel-badges">' +
        '<span class="fish-intel-badge fish-tech-' + esc(tech.band) + '">' + esc(intel.depthCall) + '</span>' +
        '</div>';
      if (intel.depthWhy) html += '<p class="fish-tech-body">' + esc(intel.depthWhy) + '</p>';
    } else {
      html += '<p class="fish-tech-body">' + esc(tech.presentation) + '</p>';
    }
    if (intel && intel.bullets && intel.bullets.length) {
      html += '<ul class="fish-intel-list">';
      for (var i = 0; i < intel.bullets.length; i++) {
        html += '<li>' + esc(intel.bullets[i]) + '</li>';
      }
      html += '</ul>';
    }
    html += '<p class="fish-smart-meta">' + esc(tech.why) + '</p></div>';
    return html;
  }

  /** One-liner for top-pick cards — depth + iron color + forage, no essay. */
  function intelOneLiner(tech) {
    if (!tech || !tech.intel) return '';
    var intel = tech.intel;
    var parts = [];
    if (intel.depthCall) parts.push(intel.depthCall);
    if (intel.iron) {
      var ironBit = intel.iron.color || intel.iron.type;
      if (intel.iron.color && intel.iron.altColor) ironBit += ' / alt ' + intel.iron.altColor;
      parts.push(ironBit);
    } else if (intel.rigs && intel.rigs[0]) {
      parts.push(intel.rigs[0]);
    }
    if (intel.forage && intel.forage.primary) {
      var fl = { fish: 'fish bait', squid: 'squid', shrimp: 'shrimp' };
      var forageBit = fl[intel.forage.primary] || intel.forage.primary;
      if (intel.forage.skip) forageBit += ', skip ' + intel.forage.skip;
      parts.push(forageBit);
    }
    return parts.slice(0, 3).join(' — ');
  }

  /** Prose for Plan advice — intermediate voice, synthesizes SST + plankton. */
  function oceanAdviceBits(ctx, oceanIn, tech) {
    var ocean = normalizeOcean(oceanIn, ctx);
    var parts = [];
    if (ocean.hasSst) {
      if (ocean.sstF >= 67) {
        parts.push('SST ~' + Math.round(ocean.sstF) + '°F favors pelagics if bait shows — keep irons ready while you work structure.');
      } else if (ocean.sstF >= 62) {
        parts.push('SST ~' + Math.round(ocean.sstF) + '°F is classic kelp-bass water; troll only if you mark bait or birds.');
      } else {
        parts.push('Cooler SST ~' + Math.round(ocean.sstF) + '°F — lean rockfish / bass / halibut on structure rather than a long surface hunt.');
      }
    }
    if (ocean.takeawayText) {
      var short = ocean.takeawayText.length > 160 ? ocean.takeawayText.slice(0, 157) + '…' : ocean.takeawayText;
      parts.push('Plankton read: ' + short);
    } else if (ocean.chlBand) {
      var map = {
        'ultra-clear': 'Ultra-clear water regionally — bait may sit deeper; fish blue edges if you find a green filament.',
        'clear': 'Mostly clear/blue-green — normal SoCal mixed fishing; watch for subtle color breaks.',
        'green': 'Green productive water — bait more likely on kelp and chlorophyll fronts.',
        'very-green': 'Very green water — fish the green-to-blue edge; viz drops in the thickest patches.',
        'bloom': 'Bloom signal — don\'t fish the soup; troll or drift the blue side of the filament.'
      };
      if (map[ocean.chlBand]) parts.push(map[ocean.chlBand]);
    } else {
      parts.push('Plankton samples not in yet — rankings lean on tide, wind, seas, and model SST (open Plankton tab to refresh).');
    }
    /* Technique detail lives in the smart panel / top-pick How lines — keep advice tight. */
    if (tech && tech.label) {
      parts.push('Lead technique: ' + tech.label.toLowerCase() + '.');
    }
    return parts;
  }

  function enrichAdviceText(baseText, ctx, oceanIn, ranked, tech) {
    var bits = oceanAdviceBits(ctx, oceanIn, tech);
    var where = '';
    if (ranked && ranked.length) {
      var top = ranked.slice(0, 3).map(function (r) {
        var name = (r.spot && r.spot.name) ? r.spot.name : '';
        name = name.replace(/ — .*/, '').replace(/ &.*/, '');
        if (name.length > 22) name = name.slice(0, 20) + '…';
        var techR = recommendTechnique(r.spot, ctx, oceanIn);
        return name + ' (' + techR.label.toLowerCase() + ')';
      });
      where = ' Where: prioritize ' + top.join('; ') + '.';
    }
    var oceanBlock = bits.length ? ' ' + bits.join(' ') : '';
    return String(baseText || '') + oceanBlock + where;
  }

  /** Extra briefing paragraphs when live ocean context is available. */
  function briefingOceanParagraphs(spot, ctx, oceanIn) {
    var ocean = localizeOceanToSpot(spot, oceanIn, ctx);
    var tech = recommendTechnique(spot, ctx, ocean);
    var likes = speciesLikelihoodForSpot(spot, ctx, ocean).slice(0, 4);
    var likeTxt = likes.map(function (r) {
      return r.species + ' ' + (r.pct == null ? '?' : r.pct + '% (' + r.label + ')');
    }).join('; ');
    var intel = tech.intel;
    var p1 = 'Conditions synthesis: ' +
      (intel && intel.depthCall ? intel.depthCall + ' (' + tech.label.toLowerCase() + ')' : 'fish ' + tech.label.toLowerCase()) +
      ' — ' + (intel && intel.depthWhy ? intel.depthWhy : tech.presentation) +
      ' (' + tech.why + ').';
    var pIntel = '';
    if (intel && intel.bullets && intel.bullets.length) {
      pIntel = intel.bullets.join(' ');
    }
    var p2 = likeTxt
      ? ('Bite lean at this mark (trip time): ' + likeTxt +
        (ocean.sstF == null && !ocean.hasChl
          ? ' — confidence limited until SST/plankton load.'
          : '.'))
      : '';
    var p3 = '';
    if (ocean.localChlName) {
      p3 = (ocean.pinLocalChl ? 'Chlorophyll at this mark' : ('Nearest chlorophyll zone: ' + ocean.localChlName)) +
        (ocean.chlAvg != null ? ' (~' + ocean.chlAvg.toFixed(2) + ' mg m⁻³, ' + (ocean.chlBand || 'band n/a') + ')' : '') +
        (ocean.pinLocalChl
          ? ' — VIIRS 4 km cell at the published pin (not inventing GPS).'
          : ' — nearest regional zone sample.');
    } else if (ocean.takeawayText) p3 = 'Regional plankton: ' + ocean.takeawayText;
    else if (ocean.chlBand) p3 = 'Regional chlorophyll band: ' + ocean.chlBand +
      (ocean.chlAvg != null ? ' (~' + ocean.chlAvg.toFixed(2) + ' mg m⁻³)' : '') + '.';
    else p3 = 'No fresh chlorophyll sample yet — open the Plankton tab (NASA 1 km map) or wait for VIIRS NRT; clouds often blank the latest day.';
    return [p1, pIntel, p2, p3].filter(Boolean);
  }

  function smartPlanPanelHtml(escFn, opts) {
    var esc = typeof escFn === 'function' ? escFn : function (s) { return String(s == null ? '' : s); };
    opts = opts || {};
    var tech = opts.tech;
    var likes = opts.likes || [];
    var ocean = normalizeOcean(opts.ocean, opts.ctx);
    if (opts.ocean && (opts.ocean.localChlName || opts.ocean.pinLocalChl)) {
      ocean.localChlName = opts.ocean.localChlName || ocean.localChlName;
      ocean.localChlNm = opts.ocean.localChlNm;
      ocean.pinLocalChl = !!opts.ocean.pinLocalChl;
      if (opts.ocean.chlAvg != null) ocean.chlAvg = opts.ocean.chlAvg;
      if (opts.ocean.chlBand) ocean.chlBand = opts.ocean.chlBand;
      ocean.hasChl = true;
    }
    var spotLabel = opts.spotLabel || '';
    var localized = !!opts.localized;
    var html = '<div class="fish-smart-card">';
    html += '<div class="fish-smart-h">' +
      (localized && spotLabel
        ? ('Smart read · ' + esc(spotLabel))
        : 'Smart read · where & how') +
      '</div>';
    if (opts.whereLine) html += '<p class="fish-tech-body">' + esc(opts.whereLine) + '</p>';
    if (tech) html += techniquePanelHtml(tech, esc);
    var likeTitle = localized && spotLabel
      ? ('Species bite lean · ' + spotLabel)
      : 'Species bite lean (trip time)';
    var likeFoot;
    if (localized) {
      if (ocean.hasChl) {
        if (ocean.pinLocalChl) {
          likeFoot = 'Listed species + trip time + boat/model SST + chlorophyll at this mark (VIIRS 4 km cell).';
        } else if (ocean.localChlName) {
          likeFoot = 'Listed species + trip time + boat/model SST + chlorophyll near ' + ocean.localChlName +
            (ocean.localChlNm != null && isFinite(ocean.localChlNm)
              ? ' (~' + (Math.round(ocean.localChlNm * 10) / 10) + ' nm)'
              : '') + '.';
        } else {
          likeFoot = 'Listed species + trip time + boat/model SST + regional chlorophyll.';
        }
      } else {
        likeFoot = 'Listed species + trip time + boat/model SST — plankton sample missing (clouds/lag); wider uncertainty until VIIRS loads.';
      }
    } else {
      likeFoot = ocean.hasChl
        ? 'Heuristic from time of day, solunar/tide, Open-Meteo SST, and regional chlorophyll — not a guarantee.'
        : 'Heuristic from time of day, solunar/tide, and SST — plankton not loaded yet; wider uncertainty.';
    }
    html += likelihoodBarHtml(likes, esc, {
      title: likeTitle,
      footnote: likeFoot
    });
    if (ocean.chlTime || (ocean.sourceNotes && ocean.sourceNotes.length) || ocean.localChlName) {
      var src = [];
      if (ocean.chlTime) src.push('chl scene ' + String(ocean.chlTime).slice(0, 10));
      if (ocean.localChlName) src.push((ocean.pinLocalChl ? 'mark cell · ' : 'nearest zone · ') + ocean.localChlName);
      if (ocean.sourceNotes && ocean.sourceNotes.length) src = src.concat(ocean.sourceNotes);
      html += '<p class="fish-smart-meta">' + esc(src.join(' · ')) + '</p>';
    }
    html += '</div>';
    return html;
  }

  global.BoatFishSmart = {
    SPECIES_PROFILES: SPECIES_PROFILES,
    dayPeriod: dayPeriod,
    normalizeOcean: normalizeOcean,
    localizeOceanToSpot: localizeOceanToSpot,
    nearestChlSample: nearestChlSample,
    oceanSiteDelta: oceanSiteDelta,
    oceanBiteDelta: oceanBiteDelta,
    speciesBiteLikelihood: speciesBiteLikelihood,
    speciesLikelihoodForSpot: speciesLikelihoodForSpot,
    speciesLikelihoodPanel: speciesLikelihoodPanel,
    recommendTechnique: recommendTechnique,
    buildFishingIntel: buildFishingIntel,
    pickIronLure: pickIronLure,
    pickForage: pickForage,
    pickBaitNote: pickBaitNote,
    baitSummaryLine: baitSummaryLine,
    techniqueBadgeHtml: techniqueBadgeHtml,
    likelihoodBarHtml: likelihoodBarHtml,
    techniquePanelHtml: techniquePanelHtml,
    intelOneLiner: intelOneLiner,
    oceanAdviceBits: oceanAdviceBits,
    enrichAdviceText: enrichAdviceText,
    briefingOceanParagraphs: briefingOceanParagraphs,
    smartPlanPanelHtml: smartPlanPanelHtml,
    classifyFishStyle: classifyFishStyle,
    profileForSpecies: profileForSpecies
  };
})(typeof window !== 'undefined' ? window : globalThis);

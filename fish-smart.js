/**
 * BoatBoard Fish smart layer — SST + plankton synthesis, technique bands,
 * and species bite likelihood for intermediate anglers.
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
   * Bias ocean context toward a mark: nearest CHL_ZONES sample (not a pin-local pixel).
   * SST stays boat/model — never invent pin GPS or pin SST.
   */
  function localizeOceanToSpot(spot, oceanIn, ctx) {
    var ocean = normalizeOcean(oceanIn, ctx);
    ocean.sourceNotes = (ocean.sourceNotes || []).slice().filter(function (n) {
      return !/^chl nearest zone/i.test(String(n || ''));
    });
    delete ocean.localChlName;
    delete ocean.localChlNm;
    if (!spot || spot.lat == null || spot.lon == null) return ocean;
    var near = nearestChlSample(spot.lat, spot.lon, ocean.chlSamples);
    if (near && near.sample && near.sample.val != null && isFinite(near.sample.val)) {
      ocean.chlAvg = near.sample.val;
      ocean.chlBand = chlBandFromVal(near.sample.val) || ocean.chlBand;
      ocean.localChlName = near.sample.name || near.sample.id || null;
      ocean.localChlNm = near.nmApprox;
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

    return {
      band: band,
      label: labels[band] || band,
      presentation: present[band] || present.mixed,
      why: whyParts.join(' · '),
      votes: votes,
      topSpecies: top || null
    };
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
    return '<div class="fish-tech-panel">' +
      '<div class="fish-smart-h">How to fish · ' + esc(tech.label) + '</div>' +
      '<p class="fish-tech-body">' + esc(tech.presentation) + '</p>' +
      '<p class="fish-smart-meta">' + esc(tech.why) + '</p></div>';
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
    var p1 = 'Conditions synthesis: fish ' + tech.label.toLowerCase() +
      ' here — ' + tech.presentation + ' (' + tech.why + ').';
    var p2 = likeTxt
      ? ('Bite lean at this mark (trip time): ' + likeTxt +
        (ocean.sstF == null && !ocean.hasChl
          ? ' — confidence limited until SST/plankton load.'
          : '.'))
      : '';
    var p3 = '';
    if (ocean.localChlName) {
      p3 = 'Nearest chlorophyll zone for this mark: ' + ocean.localChlName +
        (ocean.chlAvg != null ? ' (~' + ocean.chlAvg.toFixed(2) + ' mg m⁻³, ' + (ocean.chlBand || 'band n/a') + ')' : '') +
        ' — zone sample, not a pin-local satellite pixel.';
    } else if (ocean.takeawayText) p3 = 'Regional plankton: ' + ocean.takeawayText;
    else if (ocean.chlBand) p3 = 'Regional chlorophyll band: ' + ocean.chlBand +
      (ocean.chlAvg != null ? ' (~' + ocean.chlAvg.toFixed(2) + ' mg m⁻³)' : '') + '.';
    else p3 = 'No fresh chlorophyll sample in cache — use Plankton tab map for color breaks; do not invent a pin-local reading.';
    return [p1, p2, p3].filter(Boolean);
  }

  function smartPlanPanelHtml(escFn, opts) {
    var esc = typeof escFn === 'function' ? escFn : function (s) { return String(s == null ? '' : s); };
    opts = opts || {};
    var tech = opts.tech;
    var likes = opts.likes || [];
    var ocean = normalizeOcean(opts.ocean, opts.ctx);
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
    var likeFoot = localized
      ? ('This mark’s listed species + trip time, solunar/tide, boat/model SST, and nearest regional chlorophyll zone — not a pin-local pixel. Missing plankton = wider uncertainty.')
      : 'Heuristic from time of day, solunar/tide, Open-Meteo SST, and regional chlorophyll — not a guarantee. Missing plankton = wider uncertainty.';
    html += likelihoodBarHtml(likes, esc, {
      title: likeTitle,
      footnote: likeFoot
    });
    if (ocean.chlTime || (ocean.sourceNotes && ocean.sourceNotes.length) || ocean.localChlName) {
      var src = [];
      if (ocean.chlTime) src.push('chl scene ' + String(ocean.chlTime).slice(0, 10));
      if (ocean.localChlName) src.push('nearest zone · ' + ocean.localChlName);
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
    techniqueBadgeHtml: techniqueBadgeHtml,
    likelihoodBarHtml: likelihoodBarHtml,
    techniquePanelHtml: techniquePanelHtml,
    oceanAdviceBits: oceanAdviceBits,
    enrichAdviceText: enrichAdviceText,
    briefingOceanParagraphs: briefingOceanParagraphs,
    smartPlanPanelHtml: smartPlanPanelHtml,
    classifyFishStyle: classifyFishStyle,
    profileForSpecies: profileForSpecies
  };
})(typeof window !== 'undefined' ? window : globalThis);

'use strict';
/**
 * Site-specific multi-paragraph briefings for every dive site and fishing spot.
 * Curated prose in dive-briefings-data.js wins when substantial; otherwise templates
 * interpolate name, depth, face, habitat, species, trust flags, and King Harbor run.
 * Lazy — call only when a site/spot is selected (do not pre-render at boot).
 */
(function (global) {
  var SLIP = { lat: 33.84817, lon: -118.39633 };
  var NM = 3440.065;

  function haversineNm(aLat, aLon, bLat, bLon) {
    var r1 = aLat * Math.PI / 180, r2 = bLat * Math.PI / 180;
    var dLat = (bLat - aLat) * Math.PI / 180, dLon = (bLon - aLon) * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(r1) * Math.cos(r2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * NM * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function bearingDeg(aLat, aLon, bLat, bLon) {
    var φ1 = aLat * Math.PI / 180, φ2 = bLat * Math.PI / 180;
    var Δλ = (bLon - aLon) * Math.PI / 180;
    var y = Math.sin(Δλ) * Math.cos(φ2);
    var x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function compass(d) {
    if (d == null || !isFinite(d)) return 'offshore';
    return ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
      [Math.round(((d % 360) + 360) % 360 / 22.5) % 16];
  }

  function f1(n) {
    return (Math.round(n * 10) / 10).toFixed(1);
  }

  function runFromSlip(lat, lon) {
    if (lat == null || lon == null || !isFinite(lat) || !isFinite(lon)) return null;
    var nm = haversineNm(SLIP.lat, SLIP.lon, lat, lon);
    var brg = bearingDeg(SLIP.lat, SLIP.lon, lat, lon);
    return { nm: nm, brg: brg, label: f1(nm) + ' nm at ' + Math.round(brg) + '° ' + compass(brg) };
  }

  function regionOf(name, lat, regional) {
    var n = String(name || '').toLowerCase();
    if (/catalina|avalon|two harbors|isthmus|farnsworth|casino|descanso/.test(n)) return 'catalina';
    if (/anacapa|santa cruz|santa rosa|san miguel|channel island/.test(n)) return 'channel';
    if (/san diego|mission bay|la jolla|point loma|coronado|torrey|del mar|imperial beach|wreck alley|yukon|ruby/.test(n)) return 'sandiego';
    if (/newport|huntington|bolsa|dana point|laguna|oceanside|carlsbad|pendleton|san clemente/.test(n) ||
        (lat != null && lat < 33.55 && lat > 32.9 && !/catalina/.test(n))) return 'oc';
    if (/palos verdes|abalone|portuguese|pt vicente|point vicente|rocky point|honeymoon|christmas tree|lunada|malaga|haggerty|bluff cove|marineland|long point pv|biodome|neptune|jenny lynne|the crane|resort point|halfway reef|kevin/.test(n)) return 'pv';
    if (/redondo|hermosa|king harbor|manhattan|el segundo|torrance|santa monica|marina del rey|venice|malibu|topanga|palawan|barge 287/.test(n)) return 'smb';
    if (regional) return 'regional';
    if (lat != null && lat >= 33.7 && lat <= 34.1) return 'smb';
    return 'socal';
  }

  function depthPhrase(depth) {
    if (depth == null || depth === '') return 'typical recreational depths';
    if (typeof depth === 'number' && isFinite(depth)) return 'about ' + Math.round(depth) + ' ft typical max';
    return String(depth);
  }

  function trustLine(flags) {
    var bits = [];
    if (flags.verified) bits.push('multi-source verified GPS');
    if (flags.cdfgAppendix) bits.push('CDFG Artificial Reef Appendix');
    if (flags.kmlImported) bits.push('San Diego Fishing Spots.kml chart waypoint');
    if (flags.userTrusted) bits.push('user-trusted pin-review');
    if (!bits.length) return 'Published chart coordinates are shown as-is — never nudged.';
    return 'Coordinate trust: ' + bits.join(' · ') + '. Displayed GPS is never nudged.';
  }

  /** Map live DIVE_SITES ids → curated dive-briefings-data.js keys (legacy / module aliases). */
  var DIVE_BRIEFING_ALIASES = {
    hermosa: 'hermosa', hermosareefb: 'hermosa', hermosareefc: 'hermosa', hermosareefd: 'hermosa', hermosactr: 'hermosa',
    redondoreefa: 'redondoreefa', barge287: 'barge287', redondoreefc: 'redondoreefa', redondoreefd: 'redondoreefa',
    redondoreefe: 'redondoreefa', redondoreeff: 'redondoreefa', redondoreefg: 'redondoreefa', redondoreefh: 'redondoreefa',
    redondoreefi: 'redondoreefa', redondoreefj: 'redondoreefa', redondoreefk: 'redondoreefa', redondoctr: 'redondoreefa',
    palawan: 'palawan', cdfg_palawan_ar: 'palawan',
    mdreyreef: 'mdreyreef', mdrey2a: 'mdreyreef', mdrey1ctr: 'mdreyreef',
    smbayreef: 'smbayreef', smbay13: 'smbayreef', smbay14: 'smbayreef', smareefa: 'smbayreef',
    topanga: 'topanga', cdfg_topanga_ar: 'topanga',
    malibureef: 'malibureef', cdfg_malibu_ar_b: 'malibureef',
    wreckalley: 'wreckalley', horseshoe: 'horseshoe', valiant: 'valiant', casino: 'casino',
    farnsworth: 'farnsworth', birdrock: 'birdrock', wormreef: 'wormreef', longpoint: 'longpoint',
    goatharbor: 'goatharbor', henrock: 'henrock', shiprock: 'shiprock',
    ut_chinapointcatalina_167: 'chineserocks',
    ut_benweston_151: 'benweston',
    dive_ver_churchrock: 'churchrock',
    ut_eaglereef_195: 'eaglereef',
    franko_eagle_reef_west_dive: 'eaglereef',
    franko_isthmus_cove_dive: 'twoharbors',
    newportreef: 'newportjetty', hbreefa: 'strandsoff', hbreefb: 'strandsoff', hbreefc: 'strandsoff', hbreefd: 'strandsoff',
    oceanside1: 'delmar', oceanside2: 'delmar', carlsbad: 'delmar', pacificbeach: 'pescadero', torreypines2: 'torrey',
    ssavalonbow: 'rockypoint', westeaglereef: 'eaglereef', churchrock: 'churchrock', indianrock: 'casino',
    empirelanding: 'goatharbor',
    pv_portuguesepoint: 'portuguese', pv_neptunearch: 'pvcaves', pv_halfwayreef: 'honeymoon',
    pv_jennylynne: 'longpoint', pv_kevinsreef: 'honeymoon', pv_resortpointwall: 'honeymoon',
    pv_thecrane: 'rockypoint', pv_biodome: 'ptvicente', pv_ptvicentepinnacles: 'ptvicente',
    pv_stonypoint_catalina: 'shiprock',
    ut_rockyptkelppalosverdes_43: 'rockypoint', ut_rockypoint85ft_339: 'rockypoint',
    ut_rockypointpinnacle25ft_340: 'rockypoint', ut_redondocanyonwestwall_332: 'redondoreefa',
    ut_marinelandreef80ft_283: 'ptvicente',     ut_venicereef_429: 'hermosa',
    hermosahardbottom: 'hermosa',
    manhattanhardbottom: 'hermosa',
    sculpinhardbottom: 'hermosa',
    insidesouthbankpinnacle: 'horseshoe',
    pv_pvr_2a: 'portuguese',
    pv_pvr_5c: 'pvrrestoration',
    pv_ptfermin_usc: 'rockypoint',
    pv_portuguesekelp_usc: 'portuguese',
    cat_yellowtailpoint: 'empirelanding',
    cat_eaglerock_west: 'shiprock',
    johnsonsrocks: 'shiprock',
    thirtysixfathompinnacle: 'horseshoe',
    ci_rockfish_1: 'shiprock',
    ci_rockfish_2: 'shiprock',
    ci_rockfish_3: 'shiprock',
    oc_pinnacles: 'strandsoff',
    danahardbottom: 'strandsoff',
    golfballreef: 'golfball',
    merrysreef: 'merrysreef',
    hawthornereef: 'hawthorne',
    thirtysevenfathomspot: 'horseshoe',
    fortyfathomcurve: 'horseshoe',
    fortysevenfathomridge: 'horseshoe',
    cat_littlegeiger: 'goatharbor', cat_littlefarnsworth: 'farnsworth', cat_garibaldireef: 'casino',
    cat_doctorscove: 'goatharbor', cat_lulureef: 'eaglereef', cat_nooksandcrannies: 'shiprock'
  };

  function briefingIsSubstantial(blocks) {
    if (!blocks || !blocks.length) return false;
    var chars = 0, paras = 0;
    for (var i = 0; i < blocks.length; i++) {
      var body = blocks[i] && blocks[i].body;
      if (!body) continue;
      for (var j = 0; j < body.length; j++) {
        chars += String(body[j] || '').length;
        paras++;
      }
    }
    return paras >= 6 && chars >= 900;
  }

  function resolveCuratedDive(site, curatedMap) {
    if (!site || !curatedMap) return null;
    var id = site.id;
    if (curatedMap[id] && briefingIsSubstantial(curatedMap[id])) return curatedMap[id];
    var alias = DIVE_BRIEFING_ALIASES[id];
    if (alias && curatedMap[alias] && briefingIsSubstantial(curatedMap[alias])) {
      return curatedMap[alias];
    }
    /* Module family: cdfg_santa_monica_bay_ar_* → smbayreef */
    if (/santa_monica|smbay|santamonicaartificial/.test(id) && curatedMap.smbayreef && briefingIsSubstantial(curatedMap.smbayreef))
      return curatedMap.smbayreef;
    if (/marina.?del.?rey|mdrey|marinadelrey/.test(id) && curatedMap.mdreyreef && briefingIsSubstantial(curatedMap.mdreyreef))
      return curatedMap.mdreyreef;
    if (/bolsa/.test(id) && curatedMap.horseshoe && briefingIsSubstantial(curatedMap.horseshoe))
      return curatedMap.horseshoe;
    if (/huntington|newport|pendleton/.test(id) && curatedMap.strandsoff)
      return expandThin(curatedMap.strandsoff, site);
    if (/oceanside|carlsbad|pacific.?beach|torrey|international.?reef|mission.?bay/.test(id) && curatedMap.wreckalley)
      return expandThin(curatedMap.wreckalley, site);
    if (curatedMap[id]) return expandThin(curatedMap[id], site);
    if (alias && curatedMap[alias]) return expandThin(curatedMap[alias], site);
    return null;
  }

  function expandThin(blocks, site) {
    if (briefingIsSubstantial(blocks)) return blocks;
    return synthesizeDiveBriefing(site, null);
  }

  function synthAccess(site, region, run) {
    if (site.boat) {
      return 'Boat dive from King Harbor' + (run ? ' (' + run.label + ')' : '') +
        '. Favor a lee anchor relative to the face bearing' +
        (site.face != null ? ' (~' + Math.round(site.face) + '° ' + compass(site.face) + ')' : '') +
        ' and keep a surface watch for traffic.';
    }
    if (region === 'pv') {
      return 'Primarily a Palos Verdes shore or short boat run' + (run ? ' — ' + run.label + ' from the slip' : '') +
        '. Expect cobble or bluff access, surge in the shallows, and a compass exit bearing toward the trail.';
    }
    if (region === 'catalina') {
      return 'Catalina access: Avalon / Two Harbors or a crossing from King Harbor' +
        (run ? ' (~' + f1(run.nm) + ' nm)' : '') + '. Pick the lee shore for the day\'s wind.';
    }
    return 'Approach from King Harbor' + (run ? ' on ' + run.label : '') +
      '. Confirm parking, MPA boundaries, and vessel traffic before gearing up.';
  }

  function synthesizeDiveBriefing(site, intel) {
    var name = site.name || site.id || 'This site';
    var depth = depthPhrase(site.depth);
    var region = regionOf(name, site.lat, site.regional);
    var run = runFromSlip(site.lat, site.lon);
    var face = site.face != null ? Math.round(site.face) + '° ' + compass(site.face) : 'variable';
    var intelHaz = (intel && intel.hazards) ? intel.hazards.slice(0, 4) : null;
    var intelSp = (intel && intel.species) ? intel.species : null;
    var intelStruct = intel && intel.structure;
    var trust = trustLine({
      verified: !!site.verified,
      cdfgAppendix: !!site.cdfgAppendix,
      kmlImported: !!site.kmlImported,
      userTrusted: !!site.userTrusted
    });

    var character =
      /wreck|barge|palawan|avalon|jenny|yukon|ruby|el rey/i.test(name) ? 'wreck / artificial structure' :
      /artificial reef|cdfg|module|pvr/i.test(name) ? 'artificial reef modules' :
      /canyon|wall|pinnacle|arch|cave/i.test(name) ? 'high-relief rock / wall' :
      /kelp|cove|point|rock|reef/i.test(name) ? 'kelp reef and sand channels' :
      'SoCal hard bottom and sand';

    var why1 = name + ' is a ' + character + ' dive with depth character around ' + depth +
      '. Facing roughly ' + face + ', it sits in the ' +
      ({ pv: 'Palos Verdes / open-coast', smb: 'Santa Monica Bay', catalina: 'Catalina Island',
         oc: 'Orange County', sandiego: 'San Diego', channel: 'Channel Islands', regional: 'regional SoCal',
         socal: 'Southern California' }[region] || 'Southern California') +
      ' pattern — useful for planning from the Port Royal / King Harbor slip.';

    var why2 = intelStruct
      ? ('Bottom / topo: ' + intelStruct + '. ' + trust)
      : ('Expect ' + character + ' with sand transitions at the edges. ' +
        (site.cdfgAppendix ? 'CDFG modules attract bass, sheephead, and rockfish as algae encrusts concrete. ' : '') +
        (site.boat ? 'Live-boat or shot-line protocols keep the group together in traffic. ' : '') +
        trust);

    var why3 = 'Best windows: mornings after small swell and light wind; fall through spring often clear faster than midsummer plankton blooms. ' +
      synthAccess(site, region, run) +
      (site.regional ? ' Marked regional — plan fuel, weather, and daylight for a longer run.' : ' Local-day-trip scale when seas allow.');

    var nav1 = 'Depth zones cluster around ' + depth +
      '. Primary POIs follow the named structure — work the high spots, then drop to the sand edge for rays and larger bass. ' +
      (site.face != null ? 'Swell exposure is strongest when seas arrive near ' + face + '; pick the lee face when possible. ' : '') +
      'Navigation: compass + boat silhouette; deploy an SMB on ascent in vessel traffic.';

    var nav2 = intelHaz && intelHaz.length
      ? ('Hazards on file: ' + intelHaz.join('; ') + '. Carry a cutting tool for monofilament, maintain buoyancy off urchin rock, and never penetrate overhead without wreck/cave training.')
      : ('Hazards: surge in shallows, monofilament on structure, boat traffic on weekends, and silt if finning too hard on sand. ' +
        (/smca|reserve|ecological|no-take|mpa/i.test(name) || region === 'pv'
          ? 'Confirm CDFW MPA boundaries — several PV/Catalina marks are no-take.'
          : 'Confirm current CDFW take rules before any harvest.'));

    var nav3 = 'Entry / approach: ' + synthAccess(site, region, run) +
      ' Exit on the reciprocal bearing; afternoon onshore wind can make surface swims tiring. ' +
      (intel && intel.notes ? intel.notes : 'Read local dive reports the morning of — vis and surge change fast on the open coast.');

    var life1 = intelSp && intelSp.length
      ? ('Resident focus: ' + intelSp.join(', ') + '. Work kelp fronds and rock cracks slowly before scanning the sand apron.')
      : ('Classic SoCal reef fish: kelp / calico bass, sheephead, garibaldi on cleaner rock, opaleye and senorita in the canopy, sand bass over the toe.');

    var life2 = 'Sand and outer fringe: bat rays, occasional white seabass on spring kelp lines, horn sharks resting by day, and lobster / octopus in cracks at night (observe only inside no-take zones). Macro hunters should check shaded north faces for nudibranchs after cool-water spells.';

    var life3 = 'Seasonal tips: spring nesting garibaldi and Spanish shawl peaks; summer thickest Macrocystis; fall often best vis from King Harbor runs. ' +
      (region === 'catalina' || region === 'channel'
        ? 'Island sites can show sea lions — keep arms in and never chase.'
        : 'Bay sites trade drama for reliability when PV or Catalina is blown out.');

    return [
      { h: 'Why dive here', body: [why1, why2, why3] },
      { h: 'Navigation, POIs & hazards', body: [nav1, nav2, nav3] },
      { h: 'Marine life by zone', body: [life1, life2, life3] }
    ];
  }

  function diveBriefingFor(site, curatedMap, intelMap) {
    if (!site) return null;
    var intel = intelMap && site.id ? intelMap[site.id] : null;
    var curated = resolveCuratedDive(site, curatedMap || {});
    if (curated && briefingIsSubstantial(curated)) return curated;
    if (curated) {
      /* Prefer synth over stubby curated one-liners */
      return synthesizeDiveBriefing(site, intel);
    }
    return synthesizeDiveBriefing(site, intel);
  }

  /**
   * fishStyle: 'structure' (default) vs 'surface' (troll / surface iron / open-water pelagic drift).
   * Explicit spot.fishStyle wins. Else surface only when tactics/habitat use troll, feathers,
   * surface/yo-yo irons, slow-troll, fly-line, or open-water / color-break / paddy framing.
   * Plain "drift" on reef/modules stays structure. Pelagic species alone do not flip the class.
   * Keep in sync with classifyFishStyle in index.html.
   */
  function classifyFishStyle(spot) {
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

  /** Map FISH_SPOTS names → fish-spot-intel.js slugs (reef families / aliases). */
  var FISH_INTEL_ALIASES = {
    /* CDFG Hermosa modules */
    'hermosa beach artificial reef a': 'hermosareef',
    'hermosa beach artificial reef b': 'hermosareef',
    'hermosa beach artificial reef c': 'hermosareef',
    'hermosa beach artificial reef d': 'hermosareef',
    'hermosa beach artificial reef center': 'hermosareef',
    /* CDFG Redondo + barge */
    'redondo beach artificial reef a': 'redondoreef',
    'barge 287 - redondo beach artificial reef b': 'redondoreef',
    'redondo beach artificial reef c': 'redondoreef',
    'redondo beach artificial reef d': 'redondoreef',
    'redondo beach artificial reef e': 'redondoreef',
    'redondo beach artificial reef f': 'redondoreef',
    'redondo beach artificial reef g': 'redondoreef',
    'redondo beach artificial reef h': 'redondoreef',
    'redondo beach artificial reef i': 'redondoreef',
    'redondo beach artificial reef j': 'redondoreef',
    'redondo beach artificial reef k': 'redondoreef',
    'redondo beach artificial reef center': 'redondoreef',
    'ss palawan wreck fish grounds': 'palawan',
    'horseshoe kelp - san pedro bay': 'horseshoe',
    'rocky pt kelp — palos verdes': 'rockypoint',
    'worm reef fish grounds — rocky point': 'rockypoint',
    'ss avalon wreck fish grounds — palos verdes': 'ssavalon',
    'golf ball reef — haggerty\'s / bluff cove': 'golfball',
    'the crane — haggerty\'s offshore': 'crane',
    'merry\'s reef — honeymoon cove offshore': 'merrysreef',
    'halfway reef — pv (christmas tree–honeymoon)': 'halfway',
    'kevin\'s reef — christmas tree cove offshore': 'halfway',
    'resort point wall — pv': 'resortpoint',
    'hawthorne reef (barberpole) — pv': 'hawthorne',
    'pt vicente pinnacles — palos verdes': 'ptvicente',
    'biodome — pt vicente': 'ptvicente',
    'portuguese point high spot — pv': 'portuguese',
    'portuguese kelp — palos verdes (usc waypoint)': 'portuguese',
    'pvr restoration reef — module 2a': 'pvr',
    'pvr restoration reef — module 5c': 'pvr',
    'redondo canyon west wall': 'redondocanyon',
    '36 fathom pinnacle': 'thirtysixfathom',
    '37 fathom spot': 'thirtysevenfathom',
    '40 fathom curve': 'fortyfathom',
    '47 fathom ridge': 'fortysevenfathom',
    'marina del rey artificial reef (center)': 'mdreyreef',
    'marina del rey artificial reef 2a': 'mdreyreef',
    'marina del rey artificial reef 1 center': 'mdreyreef',
    'hermosa hard bottom': 'hermosahardbottom',
    'manhattan hard bottom': 'manhattanhardbottom',
    'inside south bank pinnacle 26 fathom': 'insidesouthbank',
    'sculpin hardbottom area': 'sculpinhardbottom',
    'pt. fermin kelp — san pedro (usc waypoint)': 'ptfermin',
    'jenny lynne wreck — long point pv': 'jennlynne'
  };

  function resolveFishIntel(spot, intelMap) {
    if (!spot || !intelMap) return null;
    if (spot.id && intelMap[spot.id]) return intelMap[spot.id];
    var name = String(spot.name || '');
    var key = FISH_INTEL_ALIASES[name.toLowerCase()];
    if (key && intelMap[key]) return intelMap[key];
    var n = name.toLowerCase();
    if (/hermosa.*artificial\s*reef|hermosa beach artificial/.test(n) && intelMap.hermosareef) return intelMap.hermosareef;
    if (/barge\s*287|redondo.*artificial\s*reef/.test(n) && intelMap.redondoreef) return intelMap.redondoreef;
    if (/palawan/.test(n) && intelMap.palawan) return intelMap.palawan;
    if (/horseshoe/.test(n) && intelMap.horseshoe) return intelMap.horseshoe;
    if (/worm\s*reef|rocky\s*pt\s*kelp|rocky point kelp/.test(n) && intelMap.rockypoint) return intelMap.rockypoint;
    if (/ss\s*avalon|avalon wreck/.test(n) && intelMap.ssavalon) return intelMap.ssavalon;
    if (/golf\s*ball/.test(n) && intelMap.golfball) return intelMap.golfball;
    if (/\bcrane\b/.test(n) && /haggerty/.test(n) && intelMap.crane) return intelMap.crane;
    if (/merry'?s\s*reef/.test(n) && intelMap.merrysreef) return intelMap.merrysreef;
    if (/halfway\s*reef|kevin'?s\s*reef/.test(n) && intelMap.halfway) return intelMap.halfway;
    if (/resort\s*point/.test(n) && intelMap.resortpoint) return intelMap.resortpoint;
    if (/hawthorne|barberpole/.test(n) && intelMap.hawthorne) return intelMap.hawthorne;
    if (/biodome|pt\.?\s*vicente\s*pinnacle|point vicente pinnacle/.test(n) && intelMap.ptvicente) return intelMap.ptvicente;
    if (/portuguese/.test(n) && intelMap.portuguese) return intelMap.portuguese;
    if (/\bpvr\b|restoration reef/.test(n) && intelMap.pvr) return intelMap.pvr;
    if (/redondo\s*canyon/.test(n) && intelMap.redondocanyon) return intelMap.redondocanyon;
    if (/36\s*fathom/.test(n) && intelMap.thirtysixfathom) return intelMap.thirtysixfathom;
    if (/37\s*fathom/.test(n) && intelMap.thirtysevenfathom) return intelMap.thirtysevenfathom;
    if (/40\s*fathom/.test(n) && intelMap.fortyfathom) return intelMap.fortyfathom;
    if (/47\s*fathom/.test(n) && intelMap.fortysevenfathom) return intelMap.fortysevenfathom;
    if (/marina\s*del\s*rey.*artificial|mdrey/.test(n) && intelMap.mdreyreef) return intelMap.mdreyreef;
    if (/hermosa\s*hard\s*bottom/.test(n) && intelMap.hermosahardbottom) return intelMap.hermosahardbottom;
    if (/manhattan\s*hard\s*bottom/.test(n) && intelMap.manhattanhardbottom) return intelMap.manhattanhardbottom;
    if (/inside\s*south\s*bank/.test(n) && intelMap.insidesouthbank) return intelMap.insidesouthbank;
    if (/sculpin\s*hardbottom|sculpin hard bottom/.test(n) && intelMap.sculpinhardbottom) return intelMap.sculpinhardbottom;
    if (/fermin/.test(n) && intelMap.ptfermin) return intelMap.ptfermin;
    if (/jenny\s*lynne/.test(n) && intelMap.jennlynne) return intelMap.jennlynne;
    return null;
  }

  function fishBriefingFor(spot, distNm, intelMap) {
    if (!spot) return null;
    var intel = resolveFishIntel(spot, intelMap || global.__BOAT_FISH_SPOT_INTEL__ || {});
    return synthesizeFishBriefing(spot, distNm, intel);
  }

  function synthesizeFishBriefing(spot, distNm, intel) {
    if (!spot) return null;
    if (intel == null && arguments.length < 3) {
      intel = resolveFishIntel(spot, global.__BOAT_FISH_SPOT_INTEL__ || null);
    }
    var name = spot.name || 'This mark';
    var species = (spot.species && spot.species.length) ? spot.species : ['calico bass', 'sand bass', 'rockfish'];
    var habitat = spot.habitat || 'Offshore structure';
    var tactics = spot.tactics || 'Drift or live bait on structure.';
    var depth = spot.depth || 'mixed depths';
    var style = classifyFishStyle(spot);
    var surface = style === 'surface';
    var region = regionOf(name, spot.lat, spot.regional);
    var run = runFromSlip(spot.lat, spot.lon);
    var nm = distNm != null && isFinite(distNm) ? distNm : (run ? run.nm : null);
    var trust = trustLine({
      verified: !!spot.verified,
      cdfgAppendix: !!spot.cdfgAppendix,
      kmlImported: !!spot.kmlImported,
      userTrusted: !!spot.userTrusted
    });
    var tide = spot.bestTide === 'incoming' ? 'incoming tide' :
      spot.bestTide === 'outgoing' ? 'outgoing tide' : 'either tide phase';
    var tod = spot.bestTime || 'morning';
    var face = spot.face != null ? Math.round(spot.face) + '° ' + compass(spot.face) : null;
    var intelHaz = (intel && intel.hazards) ? intel.hazards.slice(0, 4) : null;

    var why1 = name + ' targets ' + species.slice(0, 4).join(', ') +
      ' over ' + habitat.toLowerCase() + ' in the ' + depth + ' band' +
      (surface ? ' — a surface / troll–oriented mark when bait is up' : '') + '. ' +
      'From Port Royal / King Harbor this is a ' +
      (nm != null ? f1(nm) + ' nm run' + (run ? ' (~' + Math.round(run.brg) + '° ' + compass(run.brg) + ')' : '') : 'charted local mark') +
      (spot.regional ? ' (regional day-trip fuel plan)' : ' for a same-day turn.') + ' ' + trust;

    var why2 = intel && intel.structure
      ? ('Structure / water: ' + intel.structure +
        (intel.speciesNotes ? ' Species quirks: ' + intel.speciesNotes + '.' : ''))
      : (surface
        ? ('Water character: ' + habitat +
          '. Watch for bait marks, color/temp breaks, and birds — troll feathers or cast surface irons along the edge, then slide to nearby structure if the bite goes quiet.')
        : ('Structure character: ' + habitat +
          '. ' + (/artificial|module|cdfg|pvr|wreck|barge|pipe/i.test(name + habitat)
            ? 'Work high spots and module edges up-current; fish stack on the first relief that breaks the sand.'
            : /kelp|cove|point|rock/i.test(name + habitat)
              ? 'Work kelp edges and rock fingers; keep baits just outside the fronds to avoid snags while staying in the strike zone.'
              : 'Probe hard-to-soft transitions with the sounder — marks often sit on the first color change.')));

    var why3 = 'Condition filter: prefer ' + tod + ' windows and ' + tide +
      (spot.minSstF ? '; water above ~' + spot.minSstF + '°F helps warm-water species' : '') +
      '. ' + (face ? 'Spot face ~' + face + ' — lee up when swell is large. ' : '') +
      (intel && intel.bestWhen ? ('Local window: ' + intel.bestWhen + '. ') : '') +
      ({ pv: 'PV marks fish best after several calm days when vis clears and kelp stands up.',
         smb: 'Santa Monica Bay marks are the slip\'s bread-and-butter when west swell is up on PV.',
         catalina: 'Catalina crossings need a weather window; fish the lee kelp line first.',
         oc: 'OC / south county marks are longer runs — stack with fuel and an early departure.',
         sandiego: 'San Diego chart marks are expedition-scale from King Harbor.',
         regional: 'Treat as a dedicated run, not a quick harbor hop.',
         socal: 'Match seas and wind to the exposure before leaving the breakwater.' }[region] || '');

    var tech1 = intel && intel.approach
      ? ('Primary approach: ' + intel.approach + ' Chart tactics: ' + tactics)
      : (surface
        ? ('Primary approach: ' + tactics +
          ' Sounder for bait and temperature edges first — set a controlled troll or open-water drift along the color break, then cast irons/feathers when marks boil.')
        : ('Primary approach: ' + tactics +
          ' Sounder first — idle across the high spot, mark fish and relief, then set a controlled drift or short-soak anchor up-current of the bite.'));

    var tech2 = surface
      ? ('Bait & presentation: feathers, yo-yos, and surface irons when bait is up; live sardine on a short flat-line or kite when YT/bonito show. ' +
        'Keep a structure rod ready if the school stacks on nearby kelp or a high spot.')
      : ('Bait & presentation: match the forage — live sardine/squid for bass and sheephead, dropper-loop squid for rockfish, iron or feathers when pelagics show. ' +
        'Keep leader abrasion-resistant around reef; retie after snags. Vertical jigs excel on steep module faces; swimbaits shine on kelp edges.');

    var tech3 = 'Boat craft from King Harbor: clear the breakwater, then run ' +
      (run ? run.label : 'to the mark') +
      (surface
        ? '. Give wide berth to dive flags and other trollers; circle bait schools wide rather than cutting through. '
        : '. Watch for dive flags on shared reefs (Hermosa / Redondo modules, PV coves). ') +
      (intelHaz && intelHaz.length
        ? ('Hazards on file: ' + intelHaz.join('; ') + '. ')
        : '') +
      'If wind builds afternoon, fish the closest productive ' + (surface ? 'bait line' : 'structure') + ' on the way home rather than extending the run.';

    var season1 = intel && intel.speciesNotes
      ? ('Targets & quirks: ' + intel.speciesNotes +
        (surface
          ? ' Surface seasons still favor bonito / barracuda / yellowtail when SST and bait align in summer–fall.'
          : ' Calico and sand bass remain available year-round on structure when the window is workable.'))
      : (surface
        ? ('Targets by season: bonito / barracuda / yellowtail when SST and bait align in summer–fall; ' +
          'calico and sand bass remain available on adjacent structure year-round.')
        : ('Targets by season: calico and sand bass year-round on structure; sheephead stronger on warmer months; rockfish deeper in winter cold; ' +
          (species.join(' ').toLowerCase().indexOf('bonito') >= 0 || species.join(' ').toLowerCase().indexOf('yellowtail') >= 0
            ? 'bonito / yellowtail when SST and bait align in summer–fall.'
            : 'pelagics occasional when bait and SST push into the bay.')));

    var season2 = 'MPA & regs: several PV and Catalina marks sit in or beside SMCAs — know no-take lines before fishing Portuguese Point, Pt Vicente, Abalone Cove, or island parks. ' +
      'Depth and rockfish closures change — verify current CDFW regs the morning of the trip.';

    var season3 = intel && intel.notes
      ? ('Local tip: ' + intel.notes)
      : (surface
        ? ('Local tip: if surface fish shut off, slide toward the nearest kelp high spot or Horseshoe structure pin rather than making a long reposition. ' +
          'Feature-group siblings often share one bait corridor.')
        : ('Local tip: pair this mark with a nearby module or kelp line for a two-stop loop without a long reposition. ' +
          'If the bite is soft, slide 0.1–0.2 nm along the same contour rather than abandoning the complex — feature groups often share one reef system.'));

    return [
      { h: 'Why fish here', body: [why1, why2, why3] },
      { h: 'Approach, tactics & boat craft', body: [tech1, tech2, tech3] },
      { h: 'Seasonal notes & regulations', body: [season1, season2, season3] }
    ];
  }

  /**
   * Compact live “today” strip for On site briefing cards.
   * cond: { loading, empty, swellLabel, windLabel, tideLabel, sstLabel, caveat }
   */
  function liveConditionsStripHtml(escFn, cond) {
    var esc = typeof escFn === 'function' ? escFn : function (s) { return String(s == null ? '' : s); };
    cond = cond || {};
    if (cond.loading) {
      return '<div class="briefing-live-strip loading">' +
        '<strong>Today\u2019s conditions</strong>' +
        '<p class="briefing-live-meta">Loading live swell, wind, tide &amp; SST\u2026</p></div>';
    }
    if (cond.empty) {
      return '<div class="briefing-live-strip empty">' +
        '<strong>Today\u2019s conditions</strong>' +
        '<p class="briefing-live-meta">Live conditions not ready yet \u2014 wait for the marine/weather refresh, or open Overview and pull to refresh.</p></div>';
    }
    var swell = cond.swellLabel != null && cond.swellLabel !== '' ? cond.swellLabel : '\u2014';
    var wind = cond.windLabel != null && cond.windLabel !== '' ? cond.windLabel : '\u2014';
    var tide = cond.tideLabel != null && cond.tideLabel !== '' ? cond.tideLabel : '\u2014';
    var sst = cond.sstLabel != null && cond.sstLabel !== '' ? cond.sstLabel : '\u2014';
    var seasWind = swell === '\u2014' && wind === '\u2014' ? '\u2014' :
      (swell === '\u2014' ? wind : (wind === '\u2014' ? swell : swell + ' · ' + wind));
    var caveat = cond.caveat || 'Live model near the boat — not baked into briefing prose.';
    return '<div class="briefing-live-strip">' +
      '<strong>Today\u2019s conditions</strong>' +
      '<div class="briefing-live-grid">' +
      '<div><span>Swell / wind</span><b>' + esc(seasWind) + '</b></div>' +
      '<div><span>Tide window</span><b>' + esc(tide) + '</b></div>' +
      '<div><span>SST</span><b>' + esc(sst) + '</b></div>' +
      '</div>' +
      '<p class="briefing-live-caveat">' + esc(caveat) + '</p></div>';
  }

  function briefingBlocksToHtml(esc, blocks, title) {
    if (!blocks || !blocks.length) return '';
    var html = title ? '<h3>' + esc(title) + '</h3>' : '';
    html += '<div class="dive-briefing-prose">';
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (!b || !b.h) continue;
      html += '<h4 class="dive-briefing-h">' + esc(b.h) + '</h4>';
      var body = b.body || [];
      for (var j = 0; j < body.length; j++) html += '<p>' + esc(body[j]) + '</p>';
    }
    html += '</div>';
    return html;
  }

  global.__BOAT_BRIEFING_SYNTH__ = {
    diveBriefingFor: diveBriefingFor,
    synthesizeDiveBriefing: synthesizeDiveBriefing,
    synthesizeFishBriefing: synthesizeFishBriefing,
    fishBriefingFor: fishBriefingFor,
    resolveFishIntel: resolveFishIntel,
    classifyFishStyle: classifyFishStyle,
    briefingBlocksToHtml: briefingBlocksToHtml,
    liveConditionsStripHtml: liveConditionsStripHtml,
    DIVE_BRIEFING_ALIASES: DIVE_BRIEFING_ALIASES,
    FISH_INTEL_ALIASES: FISH_INTEL_ALIASES,
    runFromSlip: runFromSlip
  };
})(typeof window !== 'undefined' ? window : globalThis);

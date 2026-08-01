'use strict';
/* BoatBoard dive conditions module — scoring/rendering ported from DiveCast */

(function () {
  const M2FT = 3.28084;
  const HR = 3600e3;
  const NM_R = 3440.065;
  const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const STAR_PATH = 'M12 2.5l2.83 5.9 6.47.83-4.75 4.48 1.22 6.4L12 17l-5.77 3.1 1.22-6.4L2.7 9.23l6.47-.83z';
  const SLOTS = [{ h: 7, lbl: '7 AM' }, { h: 12, lbl: 'Noon' }, { h: 17, lbl: '5 PM' }];
  const SLIP = { lat: 33 + 50/60 + 53.4/3600, lon: -(118 + 23/60 + 46.8/3600) };
  /** Nearest-site pool for On site picker and Plan tab list (map plots all trusted DIVE_SITES). */
  const SITE_PICKER_POOL = 25;
  /** Numbered markers on plan map = top N of the score-ranked pool (feature groups). */
  const DIVE_MAP_MAX_MARKERS = 25;
  const DIVE_MAP_LOCAL_NM = 30;
  /** Fit the dive map to this radius around the boat so far CDFG modules don't zoom the view to all of CA. */
  const DIVE_MAP_FIT_NM = 10;
  /**
   * Modules/sections of the same reef (e.g. CDFG Hermosa A–D) share a feature group when their
   * normalized base name matches and they lie within this radius. Ranking / picker / plan lists
   * count one spot per group; the map still plots every pin. No coordinate nudging.
   */
  const FEATURE_GROUP_NM = 1.0;
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;

  const STATIONS = [
    { id: '9410738', name: 'King Harbor, Redondo Beach', lat: 33.842, lon: -118.398 },
    { id: '9410079', name: 'Avalon, Catalina Island', lat: 33.345, lon: -118.325 },
    { id: '9410660', name: 'Los Angeles, Outer Harbor', lat: 33.720, lon: -118.272 },
    { id: '9410840', name: 'Santa Monica', lat: 34.008, lon: -118.500 },
    { id: '9410230', name: 'La Jolla (Scripps Pier)', lat: 32.867, lon: -117.257 },
    { id: '9410170', name: 'San Diego Bay', lat: 32.714, lon: -117.174 },
    { id: '9410580', name: 'Newport Bay Entrance', lat: 33.603, lon: -117.883 },
    { id: '9411340', name: 'Santa Barbara', lat: 34.405, lon: -119.685 }
  ];

  /*
   * Dive site coordinates - MULTI-SOURCE VERIFIED water GPS ONLY.
   * Policy: never manually nudge/push coords; never display unverified pins.
   * Source of truth + source URLs: verified-water-pins.json
   * Archive of prior unverified list: dive-sites-unverified-archive.js
   * Validate: cscript //Nologo audit-all-water-pins.js
   */
  const DIVE_SITES = [
    { id: 'hermosa', name: 'Hermosa Beach Artificial Reef A', lat: 33.8541667, lon: -118.4138889, face: 250, depth: 30, verified: true , cdfgAppendix: true, userTrusted: true},
    { id: 'hermosareefb', name: 'Hermosa Beach Artificial Reef B', lat: 33.8544444, lon: -118.4130556, face: 250, depth: 60, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'hermosareefc', name: 'Hermosa Beach Artificial Reef C', lat: 33.8536111, lon: -118.4136111, face: 250, depth: 55, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'hermosareefd', name: 'Hermosa Beach Artificial Reef D', lat: 33.8530556, lon: -118.4127778, face: 250, depth: 55, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'hermosactr', name: 'Hermosa Beach Artificial Reef Center', lat: 33.8536111, lon: -118.4133333, face: 250, depth: 55, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'redondoreefa', name: 'Redondo Beach Artificial Reef A', lat: 33.8383333, lon: -118.4094444, face: 200, depth: 72, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'barge287', name: 'Barge 287 - Redondo Beach Artificial Reef B', lat: 33.8383333, lon: -118.4091667, face: 200, depth: 65, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'redondoreefc', name: 'Redondo Beach Artificial Reef C', lat: 33.8380556, lon: -118.4086111, face: 200, depth: 60, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'redondoreefd', name: 'Redondo Beach Artificial Reef D', lat: 33.8377778, lon: -118.4091667, face: 200, depth: 65, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'redondoreefe', name: 'Redondo Beach Artificial Reef E', lat: 33.8375, lon: -118.4086111, face: 200, depth: 65, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'redondoreeff', name: 'Redondo Beach Artificial Reef F', lat: 33.8372222, lon: -118.4094444, face: 200, depth: 65, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'redondoreefg', name: 'Redondo Beach Artificial Reef G', lat: 33.8372222, lon: -118.4088889, face: 200, depth: 65, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'redondoreefh', name: 'Redondo Beach Artificial Reef H', lat: 33.8372222, lon: -118.4083333, face: 200, depth: 65, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'redondoreefi', name: 'Redondo Beach Artificial Reef I', lat: 33.8369444, lon: -118.4091667, face: 200, depth: 65, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'redondoreefj', name: 'Redondo Beach Artificial Reef J', lat: 33.8366667, lon: -118.4094444, face: 200, depth: 65, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'redondoreefk', name: 'Redondo Beach Artificial Reef K', lat: 33.8363889, lon: -118.4086111, face: 200, depth: 65, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'redondoctr', name: 'Redondo Beach Artificial Reef Center', lat: 33.8372222, lon: -118.4088889, face: 200, depth: 65, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'palawan', name: 'SS Palawan - San Pedro / Redondo artificial reef', lat: 33.8236111, lon: -118.4147222, face: 190, depth: 120, verified: true, boat: true, userTrusted: true},
    { id: 'mdreyreef', name: 'Marina del Rey Artificial Reef (Center)', lat: 33.9683333, lon: -118.4863889, face: 250, depth: 65, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'mdrey2a', name: 'Marina del Rey Artificial Reef 2A', lat: 33.9672222, lon: -118.4869444, face: 250, depth: 65, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'mdrey1ctr', name: 'Marina del Rey Artificial Reef 1 Center', lat: 33.965, lon: -118.4861111, face: 250, depth: 65, verified: true, boat: true , cdfgAppendix: true, userTrusted: true},
    { id: 'smbayreef', name: 'Santa Monica Bay Artificial Reef (Center)', lat: 34.0130556, lon: -118.5425, face: 270, depth: 65, verified: true, boat: true, regional: true , cdfgAppendix: true, userTrusted: true},
    { id: 'smbay13', name: 'Santa Monica Bay Artificial Reef #13', lat: 34.0130778, lon: -118.54065, face: 270, depth: 60, verified: true, boat: true, regional: true , cdfgAppendix: true, userTrusted: true},
    { id: 'smbay14', name: 'Santa Monica Bay Artificial Reef #14', lat: 34.0140194, lon: -118.5438333, face: 270, depth: 60, verified: true, boat: true, regional: true , cdfgAppendix: true, userTrusted: true},
    { id: 'smareefa', name: 'Santa Monica Artificial Reef A', lat: 34.0094444, lon: -118.5297222, face: 270, depth: 60, verified: true, boat: true, regional: true , cdfgAppendix: true, userTrusted: true},
    { id: 'topanga', name: 'Topanga Artificial Reef - Malibu', lat: 34.0272222, lon: -118.5325, face: 200, depth: 55, verified: true, boat: true, regional: true, userTrusted: true},
    { id: 'malibureef', name: 'Malibu Artificial Reef A', lat: 34.0301806, lon: -118.6505306, face: 205, depth: 60, verified: true, boat: true, regional: true , cdfgAppendix: true, userTrusted: true},
    { id: 'newportreef', name: 'Newport Beach Artificial Reef (Center)', lat: 33.6036111, lon: -117.9636111, face: 200, depth: 72, verified: true, boat: true, regional: true , cdfgAppendix: true, userTrusted: true},
    { id: 'hbreefa', name: 'Huntington Beach Artificial Reef A Center', lat: 33.6144444, lon: -117.9830556, face: 200, depth: 60, verified: true, boat: true, regional: true , cdfgAppendix: true, userTrusted: true},
    { id: 'hbreefb', name: 'Huntington Beach Artificial Reef B Center', lat: 33.6213889, lon: -117.9975, face: 200, depth: 60, verified: true, boat: true, regional: true , cdfgAppendix: true, userTrusted: true},
    { id: 'hbreefc', name: 'Huntington Beach Artificial Reef C Center', lat: 33.6191667, lon: -117.9880556, face: 200, depth: 60, verified: true, boat: true, regional: true , cdfgAppendix: true, userTrusted: true},
    { id: 'hbreefd', name: 'Huntington Beach Artificial Reef D Center', lat: 33.6244444, lon: -118.0011111, face: 200, depth: 60, verified: true, boat: true, regional: true , cdfgAppendix: true, userTrusted: true},
    { id: 'wreckalley', name: 'Mission Bay Kelp Reef / Wreck Alley - San Diego', lat: 32.77, lon: -117.2677778, face: 280, depth: 80, verified: true, boat: true, regional: true , cdfgAppendix: true, userTrusted: true},
    { id: 'horseshoe', name: 'Horseshoe Kelp - San Pedro Bay', lat: 33.6678333, lon: -118.2025, face: 270, depth: 45, verified: true, boat: true, userTrusted: true},
    { id: 'valiant', name: 'Valiant Wreck - Descanso Bay / Avalon', lat: 33.350856, lon: -118.325962, face: 55, depth: 90, verified: true, boat: true, userTrusted: true},
    { id: 'casino', name: 'Casino Point - Avalon', lat: 33.3491, lon: -118.32466, face: 45, depth: 40, verified: true, userTrusted: true},
    { id: 'farnsworth', name: 'Farnsworth Bank - Catalina', lat: 33.3436667, lon: -118.5165333, face: 270, depth: 65, verified: true, boat: true, regional: true, userTrusted: true},
    { id: 'oceanside1', name: 'Oceanside Artificial Reef 1 Center', lat: 33.1825, lon: -117.4166667, face: 270, depth: 90, verified: true, boat: true, regional: true , cdfgAppendix: true, userTrusted: true},
    { id: 'oceanside2', name: 'Oceanside Artificial Reef 2 Center', lat: 33.2111583, lon: -117.4288389, face: 270, depth: 55, verified: true, boat: true, regional: true , cdfgAppendix: true, userTrusted: true},
    { id: 'carlsbad', name: 'Carlsbad Artificial Reef (module 8 / published center)', lat: 33.0833333, lon: -117.3191667, face: 270, depth: 50, verified: true, boat: true, regional: true, userTrusted: true},
    { id: 'pacificbeach', name: 'Pacific Beach Artificial Reef Center', lat: 32.7930556, lon: -117.2763889, face: 270, depth: 55, verified: true, boat: true, regional: true , cdfgAppendix: true, userTrusted: true},
    { id: 'torreypines2', name: 'Torrey Pines Artificial Reef 2', lat: 32.8930556, lon: -117.2597222, face: 270, depth: 44, verified: true, boat: true, regional: true , cdfgAppendix: true, userTrusted: true},
    /* —— CDFG Artificial Reef Appendix —— */
    /* Official DocumentID=30217 — cdfgAppendix:true */
    { id: 'cdfg_atascadero_ar', name: 'Atascadero Artificial Reef', lat: 35.3933333, lon: -120.8755556, face: 250, depth: 55, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_san_luis_obispo_ar', name: 'San Luis Obispo Artificial Reef', lat: 35.1902778, lon: -120.8319444, face: 250, depth: 47, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pitas_point_ar', name: 'Pitas Point Artificial Reef', lat: 34.3022222, lon: -119.3683333, face: 250, depth: 28, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_malibu_ar_b', name: 'Malibu Artificial Reef B', lat: 34.0302778, lon: -118.6513889, face: 250, depth: 60, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_topanga_ar', name: 'Topanga Artificial Reef', lat: 34.0272222, lon: -118.5325, face: 250, depth: 28, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_2', name: 'Santa Monica Bay Artificial Reef 2', lat: 34.0141667, lon: -118.5341667, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_3', name: 'Santa Monica Bay Artificial Reef 3', lat: 34.0172389, lon: -118.53605, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_4', name: 'Santa Monica Bay Artificial Reef 4', lat: 34.0182639, lon: -118.5382444, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_5', name: 'Santa Monica Bay Artificial Reef 5', lat: 34.0196, lon: -118.5404333, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_6', name: 'Santa Monica Bay Artificial Reef 6', lat: 34.0220556, lon: -118.5447222, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_7', name: 'Santa Monica Bay Artificial Reef 7', lat: 34.0229472, lon: -118.5469222, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_8', name: 'Santa Monica Bay Artificial Reef 8', lat: 34.0211111, lon: -118.5477778, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_9', name: 'Santa Monica Bay Artificial Reef 9', lat: 34.0080556, lon: -118.5344444, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_10', name: 'Santa Monica Bay Artificial Reef 10', lat: 34.0100139, lon: -118.5339389, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_11', name: 'Santa Monica Bay Artificial Reef 11', lat: 34.0115194, lon: -118.5361389, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_12', name: 'Santa Monica Bay Artificial Reef 12', lat: 34.0118806, lon: -118.5383278, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_15', name: 'Santa Monica Bay Artificial Reef 15', lat: 34.0138889, lon: -118.5483333, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_16', name: 'Santa Monica Bay Artificial Reef 16', lat: 34.0158333, lon: -118.5508333, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_17', name: 'Santa Monica Bay Artificial Reef 17', lat: 34.0025, lon: -118.5372222, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_18', name: 'Santa Monica Bay Artificial Reef 18', lat: 34.0049556, lon: -118.5370278, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_19', name: 'Santa Monica Bay Artificial Reef 19', lat: 34.0047222, lon: -118.5405556, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_20', name: 'Santa Monica Bay Artificial Reef 20', lat: 34.0058333, lon: -118.5436111, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_21', name: 'Santa Monica Bay Artificial Reef 21', lat: 34.0075, lon: -118.5466667, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_22', name: 'Santa Monica Bay Artificial Reef 22', lat: 34.0088889, lon: -118.5497222, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_23', name: 'Santa Monica Bay Artificial Reef 23', lat: 34.0105556, lon: -118.5513889, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santa_monica_bay_ar_24', name: 'Santa Monica Bay Artificial Reef 24', lat: 34.0108333, lon: -118.5541667, face: 250, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_palawan_ar', name: 'SS Palawan Artificial Reef', lat: 33.8236111, lon: -118.4147222, face: 250, depth: 120, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_a', name: 'Bolsa Chica Artificial Reef A', lat: 33.6591278, lon: -118.1007972, face: 250, depth: 92, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_c', name: 'Bolsa Chica Artificial Reef C', lat: 33.6547778, lon: -118.1021389, face: 250, depth: 90, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_d', name: 'Bolsa Chica Artificial Reef D', lat: 33.6543472, lon: -118.0994806, face: 250, depth: 90, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_e', name: 'Bolsa Chica Artificial Reef E', lat: 33.6503333, lon: -118.1028056, face: 250, depth: 90, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_g', name: 'Bolsa Chica Artificial Reef G', lat: 33.6468611, lon: -118.1057222, face: 250, depth: 90, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_h', name: 'Bolsa Chica Artificial Reef H', lat: 33.6452222, lon: -118.1017778, face: 250, depth: 90, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_11', name: 'Bolsa Chica Artificial Reef 11', lat: 33.6536111, lon: -118.1012222, face: 250, depth: 90, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_12', name: 'Bolsa Chica Artificial Reef 12', lat: 33.6494444, lon: -118.1048611, face: 250, depth: 90, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_18', name: 'Bolsa Chica Artificial Reef 18', lat: 33.6528611, lon: -118.0998611, face: 250, depth: 90, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_19', name: 'Bolsa Chica Artificial Reef 19', lat: 33.659, lon: -118.09875, face: 250, depth: 85, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_20', name: 'Bolsa Chica Artificial Reef 20', lat: 33.65825, lon: -118.0967222, face: 250, depth: 85, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_23', name: 'Bolsa Chica Artificial Reef 23', lat: 33.6572778, lon: -118.0994444, face: 250, depth: 85, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_24', name: 'Bolsa Chica Artificial Reef 24', lat: 33.6567222, lon: -118.0973889, face: 250, depth: 85, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_25', name: 'Bolsa Chica Artificial Reef 25', lat: 33.6518611, lon: -118.0985556, face: 250, depth: 90, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_27', name: 'Bolsa Chica Artificial Reef 27', lat: 33.6505556, lon: -118.0991389, face: 250, depth: 90, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_29', name: 'Bolsa Chica Artificial Reef 29', lat: 33.6490833, lon: -118.0996389, face: 250, depth: 90, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_bolsa_chica_ar_31', name: 'Bolsa Chica Artificial Reef 31', lat: 33.6477778, lon: -118.1003056, face: 250, depth: 95, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_huntington_beach_ar_a1', name: 'Huntington Beach Artificial Reef A1', lat: 33.6152778, lon: -117.9808333, face: 200, depth: 60, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_huntington_beach_ar_a3', name: 'Huntington Beach Artificial Reef A3', lat: 33.6138889, lon: -117.98, face: 200, depth: 60, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_newport_beach_ar_a', name: 'Newport Beach Artificial Reef A', lat: 33.6022222, lon: -117.9644444, face: 200, depth: 72, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_newport_beach_ar_c', name: 'Newport Beach Artificial Reef C', lat: 33.6044444, lon: -117.9622222, face: 200, depth: 72, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pendleton_ar_1', name: 'Pendleton Artificial Reef 1', lat: 33.3248, lon: -117.5277889, face: 200, depth: 43, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pendleton_ar_3', name: 'Pendleton Artificial Reef 3', lat: 33.3237806, lon: -117.5268306, face: 200, depth: 43, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceanside_ar_2_1a', name: 'Oceanside Artificial Reef 2 1A', lat: 33.2042167, lon: -117.4348111, face: 200, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceanside_ar_2_2a', name: 'Oceanside Artificial Reef 2 2A', lat: 33.2057639, lon: -117.4344778, face: 200, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceanside_ar_2_3a', name: 'Oceanside Artificial Reef 2 3A', lat: 33.2068028, lon: -117.4362667, face: 200, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceanside_ar_2_4a', name: 'Oceanside Artificial Reef 2 4A', lat: 33.208775, lon: -117.43735, face: 200, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceanside_ar_2_1b', name: 'Oceanside Artificial Reef 2 1B', lat: 33.2067917, lon: -117.4276333, face: 200, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceanside_ar_2_2b', name: 'Oceanside Artificial Reef 2 2B', lat: 33.208725, lon: -117.4295361, face: 200, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceanside_ar_2_3b', name: 'Oceanside Artificial Reef 2 3B', lat: 33.21035, lon: -117.4313306, face: 200, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceanside_ar_2_4b', name: 'Oceanside Artificial Reef 2 4B', lat: 33.2123028, lon: -117.4323833, face: 200, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceanside_ar_2_1c', name: 'Oceanside Artificial Reef 2 1C', lat: 33.212, lon: -117.4193806, face: 200, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceanside_ar_2_2c', name: 'Oceanside Artificial Reef 2 2C', lat: 33.2132639, lon: -117.4204361, face: 200, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceanside_ar_2_3c', name: 'Oceanside Artificial Reef 2 3C', lat: 33.215175, lon: -117.4217694, face: 200, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceanside_ar_2_4c', name: 'Oceanside Artificial Reef 2 4C', lat: 33.2174889, lon: -117.4233528, face: 200, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceanside_ar_1a', name: 'Oceanside Artificial Reef 1A', lat: 33.1830556, lon: -117.4169444, face: 200, depth: 91, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceanside_ar_1g', name: 'Oceanside Artificial Reef 1G', lat: 33.1818889, lon: -117.4180556, face: 200, depth: 91, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceanside_ar_1h', name: 'Oceanside Artificial Reef 1H', lat: 33.1816667, lon: -117.4163889, face: 200, depth: 91, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_carlsbad_ar_1', name: 'Carlsbad Artificial Reef 1', lat: 33.0887472, lon: -117.3203111, face: 270, depth: 48, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_carlsbad_ar_2', name: 'Carlsbad Artificial Reef 2', lat: 33.0872361, lon: -117.3197333, face: 270, depth: 48, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_carlsbad_ar_3', name: 'Carlsbad Artificial Reef 3', lat: 33.0860444, lon: -117.3192333, face: 270, depth: 48, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_carlsbad_ar_4', name: 'Carlsbad Artificial Reef 4', lat: 33.0843111, lon: -117.3186806, face: 270, depth: 48, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_carlsbad_ar_6', name: 'Carlsbad Artificial Reef 6', lat: 33.0865, lon: -117.3203333, face: 270, depth: 48, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_carlsbad_ar_7', name: 'Carlsbad Artificial Reef 7', lat: 33.0848333, lon: -117.3198333, face: 270, depth: 48, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_carlsbad_ar_8', name: 'Carlsbad Artificial Reef 8', lat: 33.0833333, lon: -117.3191667, face: 270, depth: 48, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_carlsbad_ar_9', name: 'Carlsbad Artificial Reef 9', lat: 33.0876667, lon: -117.3236667, face: 270, depth: 48, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_carlsbad_ar_10', name: 'Carlsbad Artificial Reef 10', lat: 33.0863333, lon: -117.323, face: 270, depth: 48, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_carlsbad_ar_11', name: 'Carlsbad Artificial Reef 11', lat: 33.0846667, lon: -117.3223333, face: 270, depth: 48, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_carlsbad_ar_12', name: 'Carlsbad Artificial Reef 12', lat: 33.0828333, lon: -117.322, face: 270, depth: 48, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_torrey_pines_ar_1', name: 'Torrey Pines Artificial Reef 1', lat: 32.8866667, lon: -117.2638889, face: 270, depth: 67, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pacific_beach_ar_1a', name: 'Pacific Beach Artificial Reef 1A', lat: 32.7888889, lon: -117.2783333, face: 270, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pacific_beach_ar_2a', name: 'Pacific Beach Artificial Reef 2A', lat: 32.7902778, lon: -117.2791667, face: 270, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pacific_beach_ar_3a', name: 'Pacific Beach Artificial Reef 3A', lat: 32.7930556, lon: -117.2805556, face: 270, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pacific_beach_ar_4a', name: 'Pacific Beach Artificial Reef 4A', lat: 32.7944444, lon: -117.2819444, face: 270, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pacific_beach_ar_1b', name: 'Pacific Beach Artificial Reef 1B', lat: 32.79, lon: -117.275, face: 270, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pacific_beach_ar_2b', name: 'Pacific Beach Artificial Reef 2B', lat: 32.7916667, lon: -117.275, face: 270, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pacific_beach_ar_4b', name: 'Pacific Beach Artificial Reef 4B', lat: 32.7961111, lon: -117.2763889, face: 270, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pacific_beach_ar_1c', name: 'Pacific Beach Artificial Reef 1C', lat: 32.7916667, lon: -117.27, face: 270, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pacific_beach_ar_2c', name: 'Pacific Beach Artificial Reef 2C', lat: 32.7933333, lon: -117.27, face: 270, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pacific_beach_ar_3c', name: 'Pacific Beach Artificial Reef 3C', lat: 32.7955556, lon: -117.2705556, face: 270, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pacific_beach_ar_4c', name: 'Pacific Beach Artificial Reef 4C', lat: 32.7972222, lon: -117.2716667, face: 270, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_mission_bay_park_el_rey_wreck', name: 'Mission Bay Park El Rey Wreck', lat: 32.7641667, lon: -117.2772222, face: 270, depth: 80, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_mission_bay_park_ruby_e_wreck', name: 'Mission Bay Park Ruby E Wreck', lat: 32.7672222, lon: -117.2766667, face: 270, depth: 90, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_mission_bay_park_nel_tower', name: 'Mission Bay Park NEL Tower', lat: 32.7727778, lon: -117.2675, face: 270, depth: 60, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_mission_bay_park_concrete_rubble', name: 'Mission Bay Park Concrete Rubble', lat: 32.7641667, lon: -117.2752778, face: 270, depth: 85, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_international_reef_1', name: 'International Reef 1', lat: 32.5445278, lon: -117.2480833, face: 270, depth: 165, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_international_reef_missile_tower', name: 'International Reef Missile Tower', lat: 32.5415833, lon: -117.2465, face: 270, depth: 165, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    /* —— CDFG appendix sync (missing modules) —— */
    { id: 'cdfg_santamonicaartificialreefc_33', name: 'Santa Monica Artificial Reef C', lat: 34.0091667, lon: -118.5306778, face: 250, depth: 60, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef2a_35', name: 'Marina Del Rey Artificial Reef 2A', lat: 33.9666667, lon: -118.4861111, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef2i_43', name: 'Marina Del Rey Artificial Reef 2I', lat: 33.9680556, lon: -118.4852778, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef2k_45', name: 'Marina Del Rey Artificial Reef 2K', lat: 33.9686111, lon: -118.4872222, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef2m_47', name: 'Marina Del Rey Artificial Reef 2M', lat: 33.9688889, lon: -118.4852778, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef2o_49', name: 'Marina Del Rey Artificial Reef 2O', lat: 33.9691667, lon: -118.4866667, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef1q_52', name: 'Marina Del Rey Artificial Reef 1Q', lat: 33.9655556, lon: -118.4869444, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef1r_53', name: 'Marina Del Rey Artificial Reef 1R', lat: 33.9658333, lon: -118.4861111, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsachicaartificialreeff_79', name: 'Bolsa Chica Artificial Reef F', lat: 33.6496389, lon: -118.10175, face: 250, depth: 90, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_bolsachicaartificialreef9_82', name: 'Bolsa Chica Artificial Reef 9', lat: 33.6552639, lon: -118.0989889, face: 250, depth: 90, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsachicaartificialreef10_83', name: 'Bolsa Chica Artificial Reef 10', lat: 33.6554556, lon: -118.1010222, face: 250, depth: 90, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsachicaartificialreef13_86', name: 'Bolsa Chica Artificial Reef 13', lat: 33.6540278, lon: -118.0984444, face: 250, depth: 90, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsachicaartificialreef14_87', name: 'Bolsa Chica Artificial Reef 14', lat: 33.6558333, lon: -118.1022222, face: 250, depth: 90, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsachicaartificialreef15_88', name: 'Bolsa Chica Artificial Reef 15', lat: 33.655, lon: -118.1030556, face: 250, depth: 90, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsachicaartificialreef16_89', name: 'Bolsa Chica Artificial Reef 16', lat: 33.6541667, lon: -118.1033333, face: 250, depth: 90, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsachicaartificialreef17_90', name: 'Bolsa Chica Artificial Reef 17', lat: 33.6536111, lon: -118.1027778, face: 250, depth: 90, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsachicaartificialreef21_94', name: 'Bolsa Chica Artificial Reef 21', lat: 33.6581111, lon: -118.0991944, face: 250, depth: 85, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsachicaartificialreef22_95', name: 'Bolsa Chica Artificial Reef 22', lat: 33.6574444, lon: -118.097, face: 250, depth: 85, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsachicaartificialreef28_101', name: 'Bolsa Chica Artificial Reef 28', lat: 33.6497778, lon: -118.0993056, face: 250, depth: 90, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_bolsachicaartificialreef30_103', name: 'Bolsa Chica Artificial Reef 30', lat: 33.6484444, lon: -118.0998889, face: 250, depth: 95, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_bolsachicaartificialreef32_105', name: 'Bolsa Chica Artificial Reef 32', lat: 33.6469167, lon: -118.1004167, face: 250, depth: 100, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_bolsachicaartificialreef33_106', name: 'Bolsa Chica Artificial Reef 33', lat: 33.6462222, lon: -118.1008056, face: 250, depth: 100, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_huntingtonbeachartificialree_120', name: 'Huntington Beach Artificial Reef D4', lat: 33.6233333, lon: -118.0005556, face: 250, depth: 60, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pendletonartificialreef7_134', name: 'Pendleton Artificial Reef 7', lat: 33.3249639, lon: -117.5269111, face: 200, depth: 43, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_carlsbadartificialreef5_162', name: 'Carlsbad Artificial Reef 5', lat: 33.088, lon: -117.3206667, face: 270, depth: 48, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pacificbeachartificialreef3b_178', name: 'Pacific Beach Artificial Reef 3B', lat: 32.7938889, lon: -117.2761111, face: 270, depth: 57, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_internationalreef3_192', name: 'International Reef 3', lat: 32.54375, lon: -117.2472222, face: 270, depth: 165, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    /* —— CDFG appendix sync (missing modules) —— */
    { id: 'cdfg_santamonicaartificialreefa_31', name: 'Santa Monica Artificial Reef A', lat: 34.0095, lon: -118.5303333, face: 250, depth: 60, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_santamonicaartificialreefb_32', name: 'Santa Monica Artificial Reef B', lat: 34.0091667, lon: -118.53, face: 250, depth: 60, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef2b_36', name: 'Marina Del Rey Artificial Reef 2B', lat: 33.9667111, lon: -118.4863889, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef2c_37', name: 'Marina Del Rey Artificial Reef 2C', lat: 33.9668056, lon: -118.4866667, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef2d_38', name: 'Marina Del Rey Artificial Reef 2D', lat: 33.9669444, lon: -118.4869444, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef2e_39', name: 'Marina Del Rey Artificial Reef 2E', lat: 33.9668056, lon: -118.4858333, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef2f_40', name: 'Marina Del Rey Artificial Reef 2F', lat: 33.9669444, lon: -118.4861111, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef2g_41', name: 'Marina Del Rey Artificial Reef 2G', lat: 33.9670833, lon: -118.4866667, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef2l_46', name: 'Marina Del Rey Artificial Reef 2L', lat: 33.9686111, lon: -118.4877778, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef2n_48', name: 'Marina Del Rey Artificial Reef 2N', lat: 33.9688889, lon: -118.4861111, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef2p_50', name: 'Marina Del Rey Artificial Reef 2P', lat: 33.9691667, lon: -118.4875, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_marinadelreyartificialreef1t_55', name: 'Marina Del Rey Artificial Reef 1T', lat: 33.9644444, lon: -118.4861111, face: 250, depth: 65, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_bolsachicaartificialreef26_99', name: 'Bolsa Chica Artificial Reef 26', lat: 33.6511389, lon: -118.0988611, face: 250, depth: 90, cdfgAppendix: true, boat: true, userTrusted: true},
    { id: 'cdfg_huntingtonbeachartificialree_108', name: 'Huntington Beach Artificial Reef A2', lat: 33.6144444, lon: -117.9802778, face: 200, depth: 60, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_huntingtonbeachartificialree_110', name: 'Huntington Beach Artificial Reef A4', lat: 33.6136111, lon: -117.9797222, face: 200, depth: 60, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_huntingtonbeachartificialree_111', name: 'Huntington Beach Artificial Reef B1', lat: 33.6194444, lon: -117.9883333, face: 200, depth: 60, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_huntingtonbeachartificialree_113', name: 'Huntington Beach Artificial Reef B3', lat: 33.6186111, lon: -117.9877778, face: 200, depth: 60, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_huntingtonbeachartificialree_114', name: 'Huntington Beach Artificial Reef C1', lat: 33.6216667, lon: -117.9977778, face: 200, depth: 60, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_huntingtonbeachartificialree_116', name: 'Huntington Beach Artificial Reef C3', lat: 33.6208333, lon: -117.9972222, face: 200, depth: 60, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_huntingtonbeachartificialree_117', name: 'Huntington Beach Artificial Reef D1', lat: 33.6247222, lon: -118.0013889, face: 250, depth: 60, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_huntingtonbeachartificialree_119', name: 'Huntington Beach Artificial Reef D3', lat: 33.6238889, lon: -118.0008333, face: 250, depth: 60, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_newportbeachartificialreefb_126', name: 'Newport Beach Artificial Reef B', lat: 33.6036111, lon: -117.9638889, face: 200, depth: 72, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_newportbeachartificialreefe_128', name: 'Newport Beach Artificial Reef E', lat: 33.6019444, lon: -117.9647222, face: 200, depth: 72, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pendletonartificialreef4_132', name: 'Pendleton Artificial Reef 4', lat: 33.3249, lon: -117.5274333, face: 200, depth: 43, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pendletonartificialreef6_133', name: 'Pendleton Artificial Reef 6', lat: 33.3251861, lon: -117.5274056, face: 200, depth: 43, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_pendletonartificialreefcente_135', name: 'Pendleton Artificial Reef Center', lat: 33.325, lon: -117.5283333, face: 200, depth: 43, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceansideartificialreef1b_150', name: 'Oceanside Artificial Reef 1B', lat: 33.1833333, lon: -117.4163889, face: 200, depth: 67, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceansideartificialreef1c_151', name: 'Oceanside Artificial Reef 1C', lat: 33.1827778, lon: -117.4169444, face: 200, depth: 91, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceansideartificialreef1d_152', name: 'Oceanside Artificial Reef 1D', lat: 33.1830556, lon: -117.4163889, face: 200, depth: 91, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceansideartificialreef1e_153', name: 'Oceanside Artificial Reef 1E', lat: 33.1825, lon: -117.4172222, face: 200, depth: 91, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_oceansideartificialreef1f_154', name: 'Oceanside Artificial Reef 1F', lat: 33.1825, lon: -117.4163889, face: 200, depth: 91, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_internationalreef2_191', name: 'International Reef 2', lat: 32.5443611, lon: -117.2483333, face: 270, depth: 165, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_internationalreef4_193', name: 'International Reef 4', lat: 32.5441111, lon: -117.2467222, face: 270, depth: 165, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'cdfg_internationalreef5_194', name: 'International Reef 5', lat: 32.5447222, lon: -117.2473611, face: 270, depth: 165, cdfgAppendix: true, boat: true, regional: true, userTrusted: true},
    { id: 'birdrock', name: 'Bird Rock — Catalina (Isthmus)', lat: 33.4524, lon: -118.4887333, face: 350, depth: 80, verified: true, boat: true, regional: true, userTrusted: true},
    { id: 'ssavalonbow', name: 'SS Avalon wreck bow — Palos Verdes', lat: 33.78855, lon: -118.4280333, face: 300, depth: 70, verified: true, boat: true, userTrusted: true},
    { id: 'wormreef', name: 'Worm Reef — Rocky Point offshore', lat: 33.7711, lon: -118.4343, face: 220, depth: 45, verified: true, boat: true, userTrusted: true},
    { id: 'longpoint', name: 'Long Point — Catalina', lat: 33.4057667, lon: -118.3666667, face: 90, depth: 50, verified: true, boat: true, regional: true, userTrusted: true},
    { id: 'westeaglereef', name: 'West Eagle Reef — Catalina (Isthmus)', lat: 33.4613, lon: -118.51145, face: 90, depth: 55, verified: true, boat: true, regional: true, userTrusted: true},
    { id: 'goatharbor', name: 'Goat Harbor — Catalina', lat: 33.4165, lon: -118.3961, face: 90, depth: 40, verified: true, boat: true, regional: true, userTrusted: true},
    { id: 'henrock', name: 'Hen Rock — Catalina', lat: 33.40085, lon: -118.3664, face: 90, depth: 45, verified: true, boat: true, regional: true, userTrusted: true},
    { id: 'churchrock', name: 'Church Rock — Catalina', lat: 33.29675, lon: -118.3269833, face: 90, depth: 45, verified: true, boat: true, regional: true, userTrusted: true},
    { id: 'shiprock', name: 'Ship Rock — Catalina (Isthmus)', lat: 33.4631983, lon: -118.4916767, face: 90, depth: 80, verified: true, boat: true, regional: true, userTrusted: true},
    { id: 'indianrock', name: 'Indian Rock — Emerald Bay / Catalina', lat: 33.467997, lon: -118.526799, face: 90, depth: 45, verified: true, boat: true, regional: true, userTrusted: true},
    { id: 'empirelanding', name: 'Empire Landing — Catalina', lat: 33.4319444, lon: -118.4430556, face: 90, depth: 50, verified: true, boat: true, regional: true, userTrusted: true},
    /* —— Trusted fish→dive sync (userTrusted / kmlImported; coords verbatim) —— */
    { id: 'ut_14milebank_51', name: '14 Mile Bank', lat: 33.3984, lon: -118.0034, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_150kelpreefnorth_54', name: '150 Kelp Reef North', lat: 33.5947, lon: -118.1515, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_150kelpreefsouth_55', name: '150 Kelp Reef South', lat: 33.58, lon: -118.1433, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_9milebankn_128', name: '9 Mile Bank (N)', lat: 32.655, lon: -117.4433, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_9milebanks_129', name: '9 Mile Bank (S)', lat: 32.5267, lon: -117.34, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_abalonepoint_131', name: 'Abalone Point', lat: 33.5527, lon: -117.8218, face: 200, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_archrockhalfspot_136', name: 'Arch Rock - Half Spot', lat: 33.5837, lon: -117.8662, face: 200, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_avalonbank_138', name: 'Avalon Bank', lat: 33.4117, lon: -118.225, face: 270, depth: 75, boat: true, kmlImported: true, userTrusted: true},
    { id: 'ut_bullkelpla_154', name: 'Bull Kelp (LA)', lat: 33.635, lon: -118.2342, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_carringtonpointstaywestofm_162', name: 'Carrington Point (stay west of MPA line)', lat: 34.04, lon: -120.0883, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_castlerock_163', name: 'Castle Rock', lat: 33.035, lon: -118.6142, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_catharbor_164', name: 'Cat Harbor', lat: 33.4233, lon: -118.5083, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_catrock_165', name: 'Cat Rock', lat: 34.0027, lon: -119.423, face: 250, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_chinapointcatalina_167', name: 'China Point - Catalina', lat: 33.3283, lon: -118.4688, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_chinapointsanclementeislan_168', name: 'China Point - San Clemente Island', lat: 32.7958, lon: -118.4333, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_chineseharbor_169', name: 'Chinese Harbor', lat: 34.0242, lon: -119.6117, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_clusterpointreef_174', name: 'Cluster Point Reef', lat: 33.9225, lon: -120.1883, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_crystalcove2spot_180', name: 'Crystal Cove (#2 Spot)', lat: 33.5637, lon: -117.8385, face: 200, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_delmarkelp_184', name: 'Del Mar Kelp', lat: 32.95, lon: -117.2792, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_delmarkelpsouthend_185', name: 'Del Mar Kelp South End', lat: 32.9494, lon: -117.2767, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_delmarkelpdownhillcurrento_186', name: 'Del Mar Kelp, downhill current only', lat: 32.9594, lon: -117.2791, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_desperationreef_189', name: 'Desperation Reef', lat: 32.7587, lon: -118.4087, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_dollypartonbank_190', name: 'Dolly Parton Bank', lat: 32.975, lon: -117.59, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_doublerigsreef_192', name: 'Double Rigs Reef', lat: 33.5902, lon: -118.1315, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_eaglereef_195', name: 'Eagle Reef', lat: 33.4603, lon: -118.5073, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_eaglesnest_196', name: 'Eagle\'s Nest', lat: 33.9317, lon: -120.0017, face: 250, depth: 75, boat: true, kmlImported: true, userTrusted: true},
    { id: 'ut_eastanacapareef1_197', name: 'East Anacapa Reef #1', lat: 34.0358, lon: -119.3108, face: 250, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_eastanacapareef2_198', name: 'East Anacapa Reef #2', lat: 34.0208, lon: -119.345, face: 250, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_eastanacapareef3_199', name: 'East Anacapa Reef #3', lat: 34.0208, lon: -119.3307, face: 250, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_easthorseshoe_205', name: 'East Horseshoe', lat: 33.645, lon: -118.2045, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_eastpoint_207', name: 'East Point', lat: 33.9075, lon: -119.9658, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_ferminreef65ft_213', name: 'Fermin Reef 65ft', lat: 33.7008, lon: -118.2905, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_forneyscove_217', name: 'Forney\'s Cove', lat: 34.0525, lon: -119.9145, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_frogrock_219', name: 'Frog Rock', lat: 33.3625, lon: -118.3338, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_hancockbank_227', name: 'Hancock Bank', lat: 32.5683, lon: -119.6995, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_harborreef_228', name: 'Harbor Reef', lat: 33.449071, lon: -118.488659, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true, verified: true },
    { id: 'ut_hiddenreef_232', name: 'Hidden Reef', lat: 33.7283, lon: -119.16, face: 250, depth: 75, boat: true, kmlImported: true, userTrusted: true},
    { id: 'ut_horseshoe_235', name: 'Horseshoe', lat: 33.64, lon: -118.2333, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_horseshoenorth_236', name: 'Horseshoe North', lat: 33.6667, lon: -118.2223, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_horseshoesouth_237', name: 'Horseshoe South', lat: 33.6645, lon: -118.225, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_imperialbeachkelp_242', name: 'Imperial Beach Kelp', lat: 32.575, lon: -117.16, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_imperialbeachkelpsouthend_243', name: 'Imperial Beach Kelp South End', lat: 32.55, lon: -117.15, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_imperialbeachpier_244', name: 'Imperial Beach Pier', lat: 32.58, lon: -117.135, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_insidebullkelp_246', name: 'Inside Bull Kelp', lat: 32.823, lon: -117.3018, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_insideswbank33fathoms_248', name: 'Inside SW Bank 33 Fathoms', lat: 33.8658, lon: -118.5073, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_ironboundcove_260', name: 'Iron Bound cove', lat: 33.4465, lon: -118.5767, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_isthmushighspot_261', name: 'Isthmus High Spot', lat: 33.455, lon: -118.4902, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true, verified: true },
    { id: 'ut_italiangardensarea_262', name: 'Italian Gardens area', lat: 33.4125, lon: -118.3833, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, verified: true, userTrusted: true},
    { id: 'ut_johnsonrockcautionboilerro_264', name: 'Johnson Rock - Caution Boiler rocks', lat: 33.4775, lon: -118.5893, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true, verified: true },
    { id: 'ut_kidneybank_266', name: 'Kidney Bank', lat: 33.5745, lon: -119.0142, face: 270, depth: 75, boat: true, kmlImported: true, userTrusted: true},
    { id: 'ut_lajollacanyonshelfrockfish_269', name: 'La Jolla Canyon Shelf Rockfish Area', lat: 32.875, lon: -117.3167, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_lajollacove_270', name: 'La Jolla Cove', lat: 32.8555, lon: -117.2717, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_lajollashelfhardbottom_271', name: 'La Jolla Shelf Hardbottom', lat: 32.855, lon: -117.3208, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_lighthousekelp_273', name: 'Lighthouse Kelp', lat: 32.657, lon: -117.2628, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_lostpoint_276', name: 'Lost Point', lat: 32.851, lon: -118.5035, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_mackerelbank_279', name: 'Mackerel Bank', lat: 33.0367, lon: -118.3933, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_malibuartificialreef_281', name: 'Malibu Artificial Reef', lat: 34.0248, lon: -118.6505, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_marinelandreef80ft_283', name: 'Marineland Reef 80ft', lat: 33.734, lon: -118.401, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_newhoperock_292', name: 'New Hope Rock', lat: 32.6857, lon: -117.2665, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_newportreef2_295', name: 'Newport Reef #2', lat: 33.6013, lon: -117.9587, face: 200, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_newportreef3_296', name: 'Newport Reef #3', lat: 33.6022, lon: -117.9583, face: 200, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_newportreef4_297', name: 'Newport Reef #4', lat: 33.6027, lon: -117.9573, face: 200, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_northwestsouthbank_300', name: 'North west South Bank', lat: 33.9, lon: -118.6078, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_northwestharbor_303', name: 'Northwest Harbor', lat: 33.0333, lon: -118.5875, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_oceanparkreef_304', name: 'Ocean Park Reef', lat: 33.987, lon: -118.503, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_olympicrock_307', name: 'Olympic Rock', lat: 33.6388, lon: -118.2347, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_osbornbank_309', name: 'Osborn Bank', lat: 33.36, lon: -119.0417, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_pacificbeachpoint_310', name: 'Pacific Beach Point', lat: 32.8102, lon: -117.2922, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_pointlajolla_316', name: 'Point La Jolla', lat: 32.85, lon: -117.2792, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_pointlomakelp_317', name: 'Point Loma Kelp', lat: 32.7, lon: -117.2717, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_pointlomalight_318', name: 'Point Loma Light', lat: 32.6633, lon: -117.2417, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_potatobank_321', name: 'Potato Bank', lat: 33.25, lon: -119.8267, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_purseseinerock_327', name: 'Purse Seine Rock', lat: 32.8705, lon: -118.4125, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_pyramidcove_328', name: 'Pyramid Cove', lat: 32.8167, lon: -118.3833, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_pyramidcoveanchorage_329', name: 'Pyramid Cove Anchorage', lat: 32.8146, lon: -118.3979, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_pyramidhead_330', name: 'Pyramid Head', lat: 32.8167, lon: -118.35, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_pyramidreef_331', name: 'Pyramid Reef', lat: 32.8, lon: -118.3583, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_redondocanyonwestwall_332', name: 'Redondo Canyon West Wall', lat: 33.834, lon: -118.4367, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_ribbonrock_335', name: 'Ribbon Rock', lat: 33.44, lon: -118.5722, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_rockquarry_336', name: 'Rock Quarry', lat: 33.4423, lon: -118.4662, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_rockypoint85ft_339', name: 'Rocky Point 85ft', lat: 33.771, lon: -118.4387, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_rockypointpinnacle25ft_340', name: 'Rocky Point Pinnacle 25ft', lat: 33.777, lon: -118.4297, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_sanclementeartificialreef_345', name: 'San Clemente Artificial Reef', lat: 33.3982, lon: -117.62, face: 200, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_santabarbaraislandlight_349', name: 'Santa Barbara Island Light', lat: 33.4867, lon: -119.03, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_santarosareef_350', name: 'Santa Rosa Reef', lat: 33.9675, lon: -120.236, face: 250, depth: 75, boat: true, kmlImported: true, userTrusted: true},
    { id: 'ut_seabassrock75ft_352', name: 'Seabass Rock 75ft', lat: 33.4388, lon: -118.4353, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_sealrock_353', name: 'Seal Rock', lat: 33.5447, lon: -117.8057, face: 200, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_sentinelrock_356', name: 'Sentinel Rock', lat: 33.368, lon: -118.4883, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_shortbank_358', name: 'Short Bank', lat: 33.916, lon: -118.5528, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_smugglerscove_361', name: 'Smuggler\'s Cove', lat: 34.0223, lon: -119.5373, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_southbank33fathoms_363', name: 'South Bank 33 Fathoms', lat: 33.8833, lon: -118.5635, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_southbankbumps_364', name: 'South Bank Bumps', lat: 33.8983, lon: -118.5812, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_southbankoutsideedge_365', name: 'South Bank Outside Edge', lat: 33.8805, lon: -118.6187, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_southbankwest_366', name: 'South Bank West', lat: 33.892, lon: -118.594, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_southeastbank_367', name: 'South East Bank', lat: 33.5688, lon: -118.1387, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_sverdrupbank_375', name: 'Sverdrup Bank', lat: 33.1472, lon: -120.45, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_swbank40fathoms_376', name: 'SW Bank 40 Fathoms', lat: 33.8678, lon: -118.5825, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_swcornerofroundkelp_378', name: 'SW Corner of Round Kelp', lat: 32.8405, lon: -117.2982, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_swamisreef_379', name: 'Swami\'s Reef', lat: 33.0333, lon: -117.3, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_tannerbank_380', name: 'Tanner Bank', lat: 32.7, lon: -119.1333, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_thearch_385', name: 'The Arch', lat: 34.0173, lon: -119.3535, face: 250, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_thecove_390', name: 'The Cove', lat: 32.8557, lon: -117.277, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_torreypinesartificialreef4_415', name: 'Torrey Pines Artificial Reef 4B', lat: 32.7989, lon: -117.2764, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_varietykelp_428', name: 'Variety Kelp', lat: 32.8018, lon: -117.2818, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_venicereef_429', name: 'Venice Reef', lat: 33.9783, lon: -118.4933, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true },
    { id: 'ut_westcove_433', name: 'West Cove', lat: 33.0083, lon: -118.5945, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_westend_434', name: 'West End', lat: 33.4788, lon: -118.6033, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_westend_435', name: 'West End', lat: 34.0167, lon: -119.45, face: 250, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_westendcastlerock_436', name: 'West End (Castle Rock)', lat: 33.0345, lon: -118.613, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_westendcatalina_437', name: 'West End (Catalina)', lat: 33.4792, lon: -118.6113, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_whiterock_439', name: 'White Rock', lat: 32.893, lon: -118.4393, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_bigkelpreefbkr_532', name: 'Big Kelp Reef - BKR', lat: 34.019, lon: -118.7847, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_middlekelphardbottom_538', name: 'Middle Kelp - Hard Bottom', lat: 33.423, lon: -117.6587, face: 200, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_paradisecove_540', name: 'Paradise Cove', lat: 34.0167, lon: -118.7833, face: 250, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_sanclementekelp_542', name: 'San Clemente Kelp', lat: 33.4075, lon: -117.6357, face: 200, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_sanmateopoint_543', name: 'San Mateo Point', lat: 33.3827, lon: -117.6133, face: 200, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    /* —— Pin-trust yes dive promotes (coords verbatim) —— */
    { id: 'pv_portuguesepoint', name: 'Portuguese Point high spot — PV', lat: 33.73585, lon: -118.3761, face: 220, depth: 35, userTrusted: true },
    { id: 'pv_neptunearch', name: 'Neptune Cove Underwater Arch — PV', lat: 33.7512667, lon: -118.4178333, face: 210, depth: 28, userTrusted: true },
    { id: 'pv_halfwayreef', name: 'Halfway Reef — PV (Christmas Tree–Honeymoon)', lat: 33.76265, lon: -118.4255667, face: 220, depth: 72, boat: true, userTrusted: true },
    { id: 'pv_jennylynne', name: 'Jenny Lynne wreck — Long Point PV', lat: 33.733, lon: -118.3968, face: 210, depth: 145, boat: true, userTrusted: true },
    { id: 'pv_kevinsreef', name: 'Kevin\'s Reef — Christmas Tree Cove offshore', lat: 33.7616833, lon: -118.4256167, face: 215, depth: 75, boat: true, userTrusted: true },
    { id: 'pv_resortpointwall', name: 'Resort Point Wall — PV', lat: 33.76455, lon: -118.428, face: 225, depth: 70, boat: true, userTrusted: true },
    { id: 'pv_thecrane', name: 'The Crane — Haggerty\'s offshore', lat: 33.8049333, lon: -118.409, face: 250, depth: 45, boat: true, userTrusted: true },
    /* —— Trusted fish→dive sync (userTrusted / kmlImported; coords verbatim) —— */
    { id: 'ut_longpoint_278', name: 'Long Point', lat: 33.4063, lon: -118.3653, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    /* —— Pin-trust yes dive promotes (coords verbatim) —— */
    { id: 'pv_stonypoint_catalina', name: 'Stony Point — Catalina', lat: 33.4747667, lon: -118.55415, face: 250, depth: 50, boat: true, userTrusted: true },
    /* —— Trusted fish→dive sync (userTrusted / kmlImported; coords verbatim) —— */
    { id: 'ut_arguellocanyon_144', name: 'Arguello Canyon', lat: 34.3667, lon: -121.0667, face: 205, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_benweston_151', name: 'Ben Weston', lat: 33.357, lon: -118.4902, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_boxcanyon_155', name: 'Box Canyon', lat: 33.3215, lon: -117.5087, face: 200, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_boxcanyon2_156', name: 'Box Canyon #2', lat: 33.318, lon: -117.5293, face: 200, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_coronadocanyon_182', name: 'Coronado Canyon', lat: 32.505, lon: -117.2917, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_eastendsealrocks_208', name: 'East End - Seal Rocks', lat: 33.3062, lon: -118.3033, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_lionshead_277', name: 'Lions Head', lat: 33.4472, lon: -118.5008, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_palisades_306', name: 'Palisades', lat: 33.322, lon: -118.3713, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_saltaverde_338', name: 'Salta Verde', lat: 33.3138, lon: -118.4213, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_sealrocks_348', name: 'Seal Rocks', lat: 33.3062, lon: -118.3057, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_sealrocks_349', name: 'Seal Rocks', lat: 33.4047, lon: -117.6177, face: 200, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_silvercanyon_353', name: 'Silver Canyon', lat: 33.3183, lon: -118.3915, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_slidequarry_354', name: 'Slide - Quarry', lat: 33.322, lon: -118.3038, face: 270, depth: 75, boat: true, kmlImported: true, regional: true, userTrusted: true},
    { id: 'ut_starlight_366', name: 'Starlight', lat: 33.48, lon: -118.5983, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_theslide_392', name: 'The Slide', lat: 33.2833, lon: -118.2445, face: 270, depth: 75, boat: true, kmlImported: true, userTrusted: true},
    /* —— Pin-trust yes dive promotes (coords verbatim) —— */
    { id: 'cat_littlegeiger', name: 'Little Geiger Cove — Catalina', lat: 33.4571333, lon: -118.5118667, face: 250, depth: 50, boat: true, userTrusted: true },
    { id: 'cat_littlefarnsworth', name: 'Little Farnsworth / Pinnacle Rock — Catalina', lat: 33.3337833, lon: -118.3076333, face: 250, depth: 50, boat: true, userTrusted: true },
    { id: 'cat_garibaldireef', name: 'Garibaldi Reef — Catalina (east end)', lat: 33.3260167, lon: -118.3053167, face: 250, depth: 50, boat: true, userTrusted: true },
    /* —— Trusted fish→dive sync (userTrusted / kmlImported; coords verbatim) —— */
    { id: 'ut_rockyptkelppalosverdes_43', name: 'Rocky Pt Kelp — Palos Verdes', lat: 33.7705, lon: -118.4353333, face: 220, depth: 55, boat: true, userTrusted: true },
    /* —— Trusted fish→dive sync (userTrusted / kmlImported; coords verbatim) —— */
    { id: 'ut_monarchboilerrocks_540', name: 'Monarch Boiler Rocks', lat: 33.4828, lon: -117.7345, face: 200, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    { id: 'ut_orangerocks_542', name: 'Orange Rocks', lat: 33.3015, lon: -118.3405, face: 270, depth: 75, boat: true, userTrusted: true, kmlImported: true, regional: true },
    /* —— Pin-trust yes dive promotes (coords verbatim) —— */
    { id: 'pv_biodome', name: 'Biodome — Pt Vicente', lat: 33.7418333, lon: -118.4152167, face: 250, depth: 50, boat: true, userTrusted: true },
    { id: 'cat_doctorscove', name: 'Doctor\'s Cove — Catalina (Emerald Bay NW)', lat: 33.471, lon: -118.5313, face: 250, depth: 50, boat: true, userTrusted: true },
    { id: 'cat_lulureef', name: 'Lulu Reef — Catalina (inshore Eagle Reef)', lat: 33.45475, lon: -118.5063333, face: 250, depth: 50, boat: true, userTrusted: true },
    { id: 'cat_nooksandcrannies', name: 'Nooks and Crannies — Catalina', lat: 33.4234833, lon: -118.4132, face: 250, depth: 50, boat: true, userTrusted: true },
    /* —— Near-slip trusted fish→dive mirrors (KML + userTrusted; coords verbatim) —— */
    { id: 'hermosahardbottom', name: 'Hermosa Hard Bottom', lat: 33.8682, lon: -118.4205, face: 250, depth: 75, boat: true, kmlImported: true, userTrusted: true },
    { id: 'manhattanhardbottom', name: 'Manhattan Hard Bottom', lat: 33.88, lon: -118.4333, face: 250, depth: 75, boat: true, kmlImported: true, userTrusted: true }
  ];

  /** Pre-dive briefing — loaded from dive-briefings-data.js (sectioned { h, body[] } per site). */
  const DIVE_BRIEFINGS = (typeof window !== 'undefined' && window.__BOAT_DIVE_BRIEFINGS__) || {};
  /** Entry/logistics/hazards — loaded from dive-site-intel.js (keyed by site id). */
  const DIVE_SITE_INTEL = (typeof window !== 'undefined' && window.__BOAT_DIVE_SITE_INTEL__) || {};
  const BRIEFING_SYNTH = (typeof window !== 'undefined' && window.__BOAT_BRIEFING_SYNTH__) || null;
  const HAB_CACHE_MS = 45 * 60e3;
  const HAB_LS_KEY = 'habCharmLast';
  const HAB_LS_MAX_AGE_MS = 7 * 24 * 60 * 60e3;
  const HAB_THRESH = { watch: 0.25, elevated: 0.45 };
  const HAB_HOSTS = [
    'https://coastwatch.pfeg.noaa.gov/erddap/griddap/',
    'https://oceanview.pfeg.noaa.gov/erddap/griddap/'
  ];
  let habCache = null;

  let $ = id => document.getElementById(id);
  let getPos, fetchJSON, linkHtml, store;
  let getMarine, getWx, getTides, loadLeafletFn, openPlanCalendar;
  let planMapBaseLayerFn, addCoastOverlayFn, isOnLandFn, metersEastOfShorelineFn, localEastMFn;
  let current = null, S = null, evalWhen = null, lastM = null, lastR = null, curStation = null;
  let nearest = [], loaded = new Set(), stylesInjected = false;
  let diveMap = null, diveMapInited = false, diveSpotLayer = null, diveBoatMarker = null, lastRanked = [], lastAllRanked = [];
  let userPlanWhen = null;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const avg = arr => { const v = arr.filter(x => x != null && isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const mx = arr => { const v = arr.filter(x => x != null && isFinite(x)); return v.length ? Math.max(...v) : null; };
  const f1 = v => v == null || !isFinite(v) ? '—' : (Math.round(v * 10) / 10).toFixed(1);
  const f0 = v => v == null || !isFinite(v) ? '—' : String(Math.round(v));
  const compass = d => d == null ? '—' : COMPASS[Math.round(((d % 360) + 360) % 360 / 22.5) % 16];
  const angDist = (a, b) => { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  const fmtTime = d => { let h = d.getHours() % 12 || 12, m = String(d.getMinutes()).padStart(2, '0'); return h + ':' + m + (d.getHours() < 12 ? ' am' : ' pm'); };
  const fmtDay = d => d.toLocaleDateString('en-US', { weekday: 'short' });
  const fmtFull = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + fmtTime(d);
  const shortMark = d => fmtDay(d) + ' ' + ((d.getHours() % 12) || 12) + (d.getHours() < 12 ? 'a' : 'p');
  const toLocalInput = d => { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); };
  const toLocalDate = d => { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
  const toLocalTime = d => { const p = n => String(n).padStart(2, '0'); return p(d.getHours()) + ':' + p(d.getMinutes()); };

  function formatPlanDate(d) {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  function readDiveWhen() {
    if (!userPlanWhen) return null;
    const te = $('divePlanTime');
    const when = new Date(userPlanWhen.getTime());
    if (te && te.value) {
      const parts = te.value.split(':');
      when.setHours(+parts[0] || 0, +parts[1] || 0, 0, 0);
    } else {
      when.setHours(8, 0, 0, 0);
    }
    return when;
  }
  function setDiveWhen(when) {
    const d = when instanceof Date ? when : new Date(when);
    if (!isFinite(+d)) return;
    userPlanWhen = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const btn = $('divePlanDateBtn');
    if (btn) btn.textContent = formatPlanDate(d);
    const te = $('divePlanTime');
    if (te) te.value = toLocalTime(d);
  }
  function openDiveDatePicker() {
    const cur = readDiveWhen() || userPlanWhen || new Date();
    const opener = openPlanCalendar || (window.PlanCalendar && window.PlanCalendar.open.bind(window.PlanCalendar));
    if (!opener) return;
    opener(cur, day => {
      const merged = readDiveWhen() || new Date();
      day.setHours(merged.getHours(), merged.getMinutes(), 0, 0);
      setDiveWhen(day);
      applyPlanWhenChange();
    });
  }
  function applyPlanWhenChange() {
    const d = readDiveWhen();
    if (!d) return;
    evalWhen = d;
    syncRecommendations(getMarine && getMarine(), getWx && getWx(), getTides && getTides());
    if (S && current) renderAt(d);
  }
  function diveScoreColor(score) {
    if (score >= 75) return '#3dff9a';
    if (score >= 55) return '#3dd6f5';
    if (score >= 40) return '#ffb020';
    return '#ff6644';
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const slice = (arr, a, b) => arr.slice(Math.max(0, a), Math.max(0, b));

  function haversineNm(lat1, lon1, lat2, lon2) {
    const p = Math.PI / 180;
    const dLat = (lat2 - lat1) * p, dLon = (lon2 - lon1) * p;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(dLon / 2) ** 2;
    return 2 * NM_R * Math.asin(Math.sqrt(a));
  }

  /**
   * Strip module/unit/section/block/letter/number suffixes so "Redondo Beach Artificial Reef A"
   * and "Barge 287 - Redondo Beach Artificial Reef B" share a base. Same base far apart do not
   * merge (see assignFeatureGroups + FEATURE_GROUP_NM). No reefId in CDFG JSON — name+prox only.
   */
  function stripFeatureSuffixes(name) {
    let s = String(name || '').trim();
    const afterDash = s.match(/[\u2013\u2014\-]\s*(.+\b(?:Artificial\s+)?Reef\b.*)$/i);
    if (afterDash) s = afterDash[1];
    s = s.replace(/\([^)]*\)/g, ' ');
    s = s.replace(/\b(module|unit|section|block|mod)\s*[#.]?\s*[a-z0-9]+\b/gi, ' ');
    s = s.replace(/\bcenter\b/gi, ' ');
    /* "Reef 2 1A" → keep complex id "2"; do not later strip that lone number. */
    let keptComplex = false;
    s = s.replace(/\b((?:artificial\s+)?reef)\s+(\d+)\s+[A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)*\s*$/i, (_, reef, num) => {
      keptComplex = true;
      return reef + ' ' + num;
    });
    /* Letter / alnum modules: A, B, 1A, A1, 2M */
    s = s.replace(/\b((?:artificial\s+)?reef)\s+(?:\d+[A-Za-z][A-Za-z0-9]*|[A-Za-z][A-Za-z0-9]*)\s*$/i, '$1');
    if (!keptComplex) s = s.replace(/\b((?:artificial\s+)?reef)\s+\d+\s*$/i, '$1');
    return s.replace(/\s+/g, ' ').trim();
  }

  /**
   * CDFG naming variants: "Santa Monica Bay Artificial Reef" ≡ "Santa Monica Artificial Reef".
   * Collapse optional "Bay" immediately before "Artificial Reef" for matching only (display keeps source name;
   * group label still prefers the shorter strip). Proximity (FEATURE_GROUP_NM) still required — does not
   * merge unrelated "X" vs "X Bay" complexes that are far apart.
   */
  function featureBaseKey(name) {
    return stripFeatureSuffixes(name).toLowerCase()
      .replace(/&amp;/g, 'and')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\bbay\s+(?=artificial\s+reef\b)/g, '')
      .trim();
  }

  function featureDisplayName(name) {
    const s = stripFeatureSuffixes(name);
    return s || String(name || '').trim();
  }

  function groupListName(site) {
    const base = site.featureGroupName || featureDisplayName(site.name) || site.name;
    const n = site.featureGroupSize || 1;
    return n > 1 ? base + ' · ' + n + ' modules' : base;
  }

  let FEATURE_GROUP_COUNT = DIVE_SITES.length;

  /** Explicit groups from pin-feature-groups-data.js (review UI) — force-union by published coords. */
  function applyExplicitPinFeatureGroups(union, preferredName, preferredId) {
    const doc = (typeof window !== 'undefined' && window.PIN_FEATURE_GROUPS) || null;
    const groups = (doc && doc.groups) || [];
    const matchTolNm = 0.05;
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      if (!g || !g.members || !g.members.length) continue;
      const idxs = [];
      for (let mi = 0; mi < g.members.length; mi++) {
        const m = g.members[mi];
        if (!m || m.lat == null || m.lon == null) continue;
        if (m.kind === 'fish') {
          /* Still match by coords — same reef may appear only as fish in the group file. */
        }
        for (let i = 0; i < DIVE_SITES.length; i++) {
          const s = DIVE_SITES[i];
          if (m.diveId && s.id && String(m.diveId) === String(s.id)) {
            if (idxs.indexOf(i) < 0) idxs.push(i);
            continue;
          }
          if (haversineNm(s.lat, s.lon, m.lat, m.lon) <= matchTolNm) {
            if (idxs.indexOf(i) < 0) idxs.push(i);
          }
        }
      }
      if (idxs.length < 2 && !(idxs.length === 1 && g.displayName)) {
        if (idxs.length === 1 && g.displayName) {
          preferredName[idxs[0]] = g.displayName;
          if (g.groupId) preferredId[idxs[0]] = g.groupId;
        }
        continue;
      }
      for (let k = 1; k < idxs.length; k++) union(idxs[0], idxs[k]);
      for (let k = 0; k < idxs.length; k++) {
        if (g.displayName) preferredName[idxs[k]] = g.displayName;
        if (g.groupId) preferredId[idxs[k]] = g.groupId;
      }
    }
  }

  /** Tag each DIVE_SITES entry with featureGroup / featureGroupName / featureGroupSize. */
  function assignFeatureGroups() {
    const n = DIVE_SITES.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (a, b) => { parent[find(a)] = find(b); };
    const keys = DIVE_SITES.map(s => featureBaseKey(s.name));
    const labels = DIVE_SITES.map(s => featureDisplayName(s.name));
    const byKey = new Map();
    for (let i = 0; i < n; i++) {
      const k = keys[i] || ('__id_' + DIVE_SITES[i].id);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(i);
    }
    for (const idxs of byKey.values()) {
      if (idxs.length < 2) continue;
      for (let a = 0; a < idxs.length; a++) {
        for (let b = a + 1; b < idxs.length; b++) {
          const ia = idxs[a], ib = idxs[b];
          if (haversineNm(DIVE_SITES[ia].lat, DIVE_SITES[ia].lon, DIVE_SITES[ib].lat, DIVE_SITES[ib].lon) <= FEATURE_GROUP_NM) {
            union(ia, ib);
          }
        }
      }
    }
    const preferredName = Object.create(null);
    const preferredId = Object.create(null);
    applyExplicitPinFeatureGroups(union, preferredName, preferredId);
    const members = new Map();
    for (let i = 0; i < n; i++) {
      const r = find(i);
      if (!members.has(r)) members.set(r, []);
      members.get(r).push(i);
    }
    let gid = 0;
    for (const idxs of members.values()) {
      let groupId = null;
      let groupName = null;
      for (let j = 0; j < idxs.length; j++) {
        if (!groupId && preferredId[idxs[j]]) groupId = preferredId[idxs[j]];
        if (!groupName && preferredName[idxs[j]]) groupName = preferredName[idxs[j]];
      }
      if (!groupId) groupId = 'fg_' + (gid++);
      else gid++;
      if (!groupName) {
        groupName = labels[idxs[0]] || DIVE_SITES[idxs[0]].name;
        for (let j = 1; j < idxs.length; j++) {
          const cand = labels[idxs[j]] || DIVE_SITES[idxs[j]].name;
          if (cand.length < groupName.length) groupName = cand;
        }
      }
      for (const i of idxs) {
        DIVE_SITES[i].featureGroup = groupId;
        DIVE_SITES[i].featureGroupName = groupName;
        DIVE_SITES[i].featureGroupSize = idxs.length;
      }
    }
    FEATURE_GROUP_COUNT = members.size;
  }
  assignFeatureGroups();

  function defaultPos() {
    return getPos ? getPos() : SLIP;
  }

  function destPt(lat, lon, brgDeg, distM) {
    const R = 6371000, br = brgDeg * D2R, la = lat * D2R, lo = lon * D2R, d = distM / R;
    const nla = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(br));
    const nlo = lo + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(nla));
    return { lat: nla * R2D, lon: ((nlo * R2D + 540) % 360) - 180 };
  }

  const fmtSiteCoords = (lat, lon) => lat.toFixed(6) + ', ' + lon.toFixed(6);
  const fmtSiteCoordsDepth = site => {
    const coords = fmtSiteCoords(site.lat, site.lon);
    return site.depth != null ? coords + ' · ~' + site.depth + ' ft' : coords;
  };

  /** Map pin at stored published GPS only — never apply mapOffshoreM / seaward display nudges. */
  function siteMapPos(site) {
    return { lat: site.lat, lon: site.lon };
  }

  /** COAST_GEO has no OC/SD mainland lines — skip false east-of-shore positives there. */
  function isCoastGeoGap(lat, lon) {
    if (lon > -118.05 && lat >= 33.45 && lat <= 33.72) return true; /* Orange County */
    if (lon > -117.35 && lat >= 32.5 && lat <= 33.05) return true; /* San Diego coast */
    return false;
  }

  /** Dev boot check — warn when coords are on land, east of shore, or too close to bluff (audit 2026-07). */
  function validateDiveSiteCoords() {
    if (!isOnLandFn) return;
    for (const site of DIVE_SITES) {
      if (site.mapOffshoreM) continue;
      const gap = isCoastGeoGap(site.lat, site.lon);
      const onLand = isOnLandFn(site.lat, site.lon);
      const eastM = metersEastOfShorelineFn ? metersEastOfShorelineFn(site.lat, site.lon) : 0;
      const loc = typeof localEastMFn === 'function' ? localEastMFn(site.lat, site.lon) : null;
      if (onLand) {
        console.warn('[BoatDive] ON LAND:', site.id, site.name, fmtSiteCoords(site.lat, site.lon));
      } else if (eastM > 0 && !gap) {
        console.warn('[BoatDive] EAST of shoreline (+' + Math.round(eastM) + ' m):', site.id, site.name, fmtSiteCoords(site.lat, site.lon));
      } else if (loc && !gap && loc.distM < 120 && loc.eastM > -80) {
        console.warn('[BoatDive] NEARSHORE/bluff (localEast ' + loc.eastM + ' m, dist ' + loc.distM + ' m):', site.id, site.name, fmtSiteCoords(site.lat, site.lon));
      }
    }
  }

  /** One entry per feature group — nearest member to (lat,lon). Pool size = groups, not raw pins. */
  function nearestSites(lat, lon, n, maxNm) {
    const withDist = DIVE_SITES.map(s => ({ ...s, dist: haversineNm(lat, lon, s.lat, s.lon) }));
    const best = new Map();
    for (const s of withDist) {
      const g = s.featureGroup || s.id;
      const prev = best.get(g);
      if (!prev || s.dist < prev.dist) best.set(g, s);
    }
    let list = [...best.values()].sort((a, b) => a.dist - b.dist);
    /* Keep picker/rank pools local — with grouping, an uncapped pool of 80 would include all CA groups. */
    if (maxNm != null && isFinite(maxNm)) list = list.filter(s => s.dist <= maxNm);
    return list.slice(0, n || 10);
  }

  /**
   * Rank feature groups (default) or every pin (opts.everyPin for map coloring).
   * Group score = best composite among members; representative pin = that best-scoring member
   * (nearest-to-boat breaks ties). List/picker distance is the representative's distance.
   */
  function rankSitesAt(when, marine, wx, tides, lat, lon, limit, opts) {
    const everyPin = opts && opts.everyPin;
    const Ssaved = S;
    S = parseSeries(marine, wx, tides);
    if (!S.ok.marine && !S.ok.wx) { S = Ssaved; return []; }

    if (everyPin) {
      const sites = DIVE_SITES.map(s => ({ ...s, dist: haversineNm(lat, lon, s.lat, s.lon) }));
      const ranked = sites.map(site => {
        const m = snapshotAt(site, when);
        const R = scoreDive(site, m);
        return { site, m, R, dist: site.dist };
      }).sort((a, b) => b.R.composite - a.R.composite);
      S = Ssaved;
      return ranked;
    }

    const groupPool = nearestSites(lat, lon, limit || FEATURE_GROUP_COUNT, limit ? DIVE_MAP_FIT_NM : null);
    const want = new Set(groupPool.map(s => s.featureGroup || s.id));
    const byGroup = new Map();
    for (const s of DIVE_SITES) {
      const g = s.featureGroup || s.id;
      if (limit && !want.has(g)) continue;
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(s);
    }

    const ranked = [];
    for (const members of byGroup.values()) {
      let best = null;
      for (const raw of members) {
        const dist = haversineNm(lat, lon, raw.lat, raw.lon);
        const site = { ...raw, dist };
        const m = snapshotAt(site, when);
        const R = scoreDive(site, m);
        const row = { site, m, R, dist };
        if (!best || R.composite > best.R.composite || (R.composite === best.R.composite && dist < best.dist)) {
          best = row;
        }
      }
      ranked.push(best);
    }
    ranked.sort((a, b) => b.R.composite - a.R.composite);
    S = Ssaved;
    return ranked;
  }

  function nearestStation(lat, lon) {
    let best = STATIONS[0], bd = 1e9;
    for (const s of STATIONS) {
      const dLat = (s.lat - lat) * 69, dLon = (s.lon - lon) * 57.5;
      const d = dLat * dLat + dLon * dLon;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  function siteById(id) {
    return DIVE_SITES.find(s => s.id === id) || DIVE_SITES[0];
  }

  async function storeGet(key) {
    if (!store) return null;
    const v = store.get(key);
    return v && typeof v.then === 'function' ? await v : v;
  }

  async function storeSet(key, val) {
    if (!store) return;
    const r = store.set(key, val);
    if (r && typeof r.then === 'function') await r;
  }

  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const css = document.createElement('style');
    css.textContent = [
      '.dive-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}',
      '.dive-row select{flex:1;min-height:44px}',
      '.dive-stars{position:relative;display:inline-block;line-height:0}',
      '.dive-stars .row{white-space:nowrap}',
      '.dive-stars .row.fill{position:absolute;inset:0;overflow:hidden;width:0%}',
      '.dive-stars svg{width:36px;height:36px;margin-right:3px}',
      '.dive-stars .base svg path{fill:none;stroke:var(--ink3);stroke-width:1.6}',
      '.dive-stars .fill svg path{fill:var(--fair);stroke:var(--fair);stroke-width:1.6}',
      '.dive-glance{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-top:10px}',
      '.dive-glance .g{border-left:2px solid var(--line);padding:2px 0 2px 10px}',
      '.dive-glance .g b{display:block;font-family:var(--font-mono,var(--mono));font-size:15px;font-weight:600}',
      '.dive-glance .g span{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);font-weight:600}',
      '.dive-factor{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:8px}',
      '.dive-factor summary{list-style:none;cursor:pointer;padding:12px 14px;position:relative}',
      '.dive-factor summary::-webkit-details-marker{display:none}',
      '.dive-factor .fhead{display:flex;justify-content:space-between;gap:8px}',
      '.dive-factor .fname{font-weight:600;font-size:14px}',
      '.dive-factor .fstat{font-family:var(--font-mono,var(--mono));font-size:12px;font-weight:500;color:var(--ink2);text-align:right}',
      '.dive-factor .fscore{display:flex;align-items:center;gap:8px;margin:6px 0 4px}',
      '.dive-factor .bar{flex:1;height:5px;background:var(--line2,#1a2530);border-radius:3px;overflow:hidden}',
      '.dive-factor .bar i{display:block;height:100%;border-radius:3px}',
      '.dive-factor .fnum{font-family:var(--font-mono,var(--mono));font-size:12px;font-weight:500;width:52px;text-align:right;color:var(--ink2)}',
      '.dive-factor .fsum{font-size:13px;color:var(--ink2);line-height:1.45}',
      '.dive-factor .fbody{border-top:1px solid var(--line);padding:12px 14px 16px;font-size:13px;line-height:1.5}',
      '.dive-factor .fbody h4{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink3);font-weight:600;margin:12px 0 4px}',
      '.dive-factor .fbody p{margin:0 0 6px;color:var(--ink2)}',
      '.dive-factor .fbody p.d{font-family:var(--font-mono,var(--mono));font-size:12px;font-weight:500}',
      '.dive-factor .fw{font-family:var(--font-mono,var(--mono));font-size:11px;font-weight:500;color:var(--ink3);margin-top:8px}',
      '.dive-outlook{display:grid;grid-template-columns:minmax(58px,80px) repeat(3,1fr);gap:5px}',
      '.dive-outlook .ohead{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink3);font-weight:600;text-align:center}',
      '.dive-outlook .oday{font-family:var(--font-mono,var(--mono));font-size:11px;font-weight:500;color:var(--ink2);line-height:1.25}',
      'button.oslot{min-height:44px;font-family:var(--font-mono,var(--mono));font-size:13px;font-weight:500;padding:4px;border-radius:8px;background:var(--card);border:1px solid var(--line);cursor:pointer}',
      'button.oslot.past{opacity:.4}',
      'button.oslot small{display:block;font-size:10px;color:var(--ink3)}',
      '.dive-verdict{font-size:22px;font-weight:700;margin-top:8px}',
      '.dive-meta{font-family:var(--font-mono,var(--mono));font-size:12px;font-weight:500;color:var(--ink2);margin-top:4px}',
      '.dive-srcchips{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}',
      '.dive-whenrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}',
      '.dive-whenrow input[type=datetime-local]{min-height:44px;font-family:var(--font-mono,var(--mono));font-size:13px;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:8px;padding:6px 8px}',
      '.dive-tidewrap svg{width:100%;height:auto;display:block}',
      '.dive-tidewrap svg text{font-family:var(--font-mono,var(--mono))}',
      '.dive-tidesum{font-size:12px;color:var(--ink2);margin-top:6px;line-height:1.45}',
      '.dive-briefing-card{margin-bottom:10px}',
      '.dive-briefing-card h3{margin:0 0 12px;font-size:15px;font-weight:600}',
      '.dive-briefing-card .dive-briefing-prose{font-size:14px;color:var(--ink2);line-height:1.65}',
      '.dive-briefing-card .dive-briefing-prose p{margin:0 0 12px}',
      '.dive-briefing-card .dive-briefing-h{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink3);font-weight:600;margin:18px 0 8px;padding-top:4px;border-top:1px solid var(--line)}',
      '.dive-briefing-card .dive-briefing-prose .dive-briefing-h:first-child{margin-top:0;padding-top:0;border-top:none}',
      '.dive-briefing-card .dive-briefing-prose p:last-child{margin-bottom:0}',
      '.dive-briefing-placeholder{font-size:13px;color:var(--ink3);line-height:1.5}',
      '@media(max-width:719px){.dive-briefing-card .dive-briefing-prose{max-height:min(70vh,640px);overflow-y:auto;padding-right:4px}}',
      '.dive-hab-banner{padding:10px 12px;border-radius:10px;border:1px solid var(--line);margin-bottom:10px;font-size:13px;line-height:1.5}',
      '.dive-hab-banner.watch{background:#1a1408;border-color:#4a4020;color:var(--fair)}',
      '.dive-hab-banner.elevated{background:#1a0c0c;border-color:#4a2020;color:var(--poor)}',
      '.dive-hab-banner.clear{background:#0a1a12;border-color:#1a4030;color:var(--good)}',
      '.dive-hab-banner.info{background:var(--card);color:var(--ink2)}',
      '.dive-hab-banner b{display:block;font-size:14px;font-weight:600;margin-bottom:4px}',
      '.dive-hab-banner .hab-src{font-family:var(--font-mono,var(--mono));font-size:11px;font-weight:500;color:var(--ink3);margin-top:6px}',
      '.dive-intel-card{margin-bottom:10px}',
      '.dive-intel-card h3{margin:0 0 10px;font-size:15px;font-weight:600}',
      '.dive-intel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:10px}',
      '.dive-intel-grid div{border-left:2px solid var(--line);padding:2px 0 2px 10px}',
      '.dive-intel-grid span{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);font-weight:600}',
      '.dive-intel-grid b{font-family:var(--font-mono,var(--mono));font-size:13px;font-weight:600}',
      '.dive-intel-hazards{margin:8px 0;padding:8px 10px;border-radius:8px;background:#1a0c0c;border:1px solid #4a2020}',
      '.dive-intel-hazards ul{margin:4px 0 0;padding-left:18px;color:var(--poor);font-size:13px;line-height:1.45}',
      '.dive-intel-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}',
      '.dive-trends-card{margin-bottom:10px}',
      '.dive-trends-card h3{margin:0 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);font-weight:600}',
      '.dive-trends-row{display:grid;grid-template-columns:1fr;gap:6px}',
      '@media(min-width:520px){.dive-trends-row{grid-template-columns:1fr 1fr}}'
    ].join('');
    document.head.appendChild(css);
  }

  function marineURL(s) {
    return 'https://marine-api.open-meteo.com/v1/marine?latitude=' + s.lat + '&longitude=' + s.lon +
      '&hourly=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,wind_wave_height,wind_wave_period,sea_surface_temperature' +
      '&past_days=3&forecast_days=7&timezone=auto&cell_selection=sea';
  }

  function weatherURL(s) {
    return 'https://api.open-meteo.com/v1/forecast?latitude=' + s.lat + '&longitude=' + s.lon +
      '&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation' +
      '&past_days=3&forecast_days=7&timezone=auto&wind_speed_unit=kn&precipitation_unit=inch';
  }

  function tideURL(stationId) {
    const d = new Date(Date.now() - 24 * HR);
    const bd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&datum=MLLW&time_zone=lst_ldt' +
      '&interval=hilo&units=english&format=json&application=BoatBoard&station=' + stationId + '&begin_date=' + bd + '&range=216';
  }

  function parseSeries(marine, wx, tides) {
    const out = { ok: { marine: false, wx: false, tides: false }, mar: null, wx: null, tideEv: [] };
    if (marine && marine.hourly && marine.hourly.time && marine.hourly.time.length) {
      const H = marine.hourly;
      const ft = a => (a || []).map(v => v == null ? null : v * M2FT);
      out.mar = {
        ms: H.time.map(t => new Date(t).getTime()),
        waveFt: ft(H.wave_height), per: H.wave_period || [],
        swellFt: ft(H.swell_wave_height), swellPer: H.swell_wave_period || [], swellDir: H.swell_wave_direction || [],
        wwFt: ft(H.wind_wave_height), wwPer: H.wind_wave_period || [],
        sstF: (H.sea_surface_temperature || []).map(v => v == null ? null : v * 9 / 5 + 32)
      };
      out.ok.marine = true;
    }
    if (wx && wx.hourly && wx.hourly.time && wx.hourly.time.length) {
      const H = wx.hourly;
      out.wx = {
        ms: H.time.map(t => new Date(t).getTime()),
        wind: H.wind_speed_10m || [], gust: H.wind_gusts_10m || [], wdir: H.wind_direction_10m || [],
        precip: H.precipitation || []
      };
      out.ok.wx = true;
    }
    if (tides && tides.predictions && tides.predictions.length) {
      out.tideEv = tides.predictions.map(p => ({ t: new Date(p.t.replace(' ', 'T')), v: parseFloat(p.v), type: p.type }));
      out.ok.tides = out.tideEv.length >= 2;
    }
    return out;
  }

  function idxAt(ms, when) {
    const w = +when;
    if (!ms.length || w < ms[0] - 1800e3 || w > ms[ms.length - 1] + HR) return -1;
    let i = ms.length - 1;
    while (i > 0 && ms[i] > w) i--;
    return i;
  }

  function tideAt(when) {
    const ev = S.tideEv; if (!ev || ev.length < 2) return null;
    const w = +when;
    for (let k = 0; k < ev.length - 1; k++) {
      if (+ev[k].t <= w && w <= +ev[k + 1].t) {
        const a = ev[k], b = ev[k + 1], f = (w - +a.t) / (+b.t - +a.t);
        const h = a.v + (b.v - a.v) * (1 - Math.cos(Math.PI * f)) / 2;
        return { h, rising: b.type === 'H', next: b };
      }
    }
    return null;
  }

  function tideRangeFor(when) {
    const d = new Date(when);
    const evs = S.tideEv.filter(e => e.t.getFullYear() === d.getFullYear() && e.t.getMonth() === d.getMonth() && e.t.getDate() === d.getDate());
    const use = evs.length >= 2 ? evs : S.tideEv.slice(0, 4);
    if (!use.length) return null;
    return mx(use.map(e => e.v)) - Math.min(...use.map(e => e.v));
  }

  function snapshotAt(site, when) {
    const m = { ok: { marine: false, wx: false, tides: false }, when: new Date(+when) };
    const now = new Date();
    m.isNow = Math.abs(+when - +now) < 45 * 60e3;
    m.markLabel = m.isNow ? 'now' : shortMark(m.when);

    if (S.mar) {
      const A = S.mar, i = idxAt(A.ms, when);
      if (i >= 0) {
        m.waveNow = A.waveFt[i]; m.perNow = A.per[i];
        m.swellNow = A.swellFt[i]; m.swellPer = A.swellPer[i]; m.swellDir = A.swellDir[i];
        m.windWaveNow = A.wwFt[i]; m.windWavePer = A.wwPer[i];
        m.sstF = A.sstF[i];
        m.avg48 = avg(slice(A.waveFt, i - 48, i + 1));
        m.peak48 = mx(slice(A.waveFt, i - 48, i + 1));
        const p24 = avg(slice(A.waveFt, i - 24, i + 1)), n24 = avg(slice(A.waveFt, i + 1, i + 25));
        m.trendPct = (p24 && n24) ? (n24 - p24) / p24 : 0;
        const s0 = Math.max(0, i - 72);
        m.waveSeries = slice(A.waveFt, i - 72, i + 49);
        m.waveNowPos = i - s0;
        const t0 = Math.max(0, i - 24);
        m.trendWaveSeries = slice(A.waveFt, i - 24, i + 49);
        m.trendWaveNowPos = i - t0;
        m.ok.marine = m.waveNow != null;
      }
    }
    if (S.wx) {
      const A = S.wx, i = idxAt(A.ms, when);
      if (i >= 0) {
        m.windNow = A.wind[i]; m.gustNow = A.gust[i]; m.windDir = A.wdir[i];
        m.windAvg24 = avg(slice(A.wind, i - 24, i + 1));
        const p = A.precip;
        m.rain24 = slice(p, i - 24, i + 1).filter(v => v != null).reduce((a, b) => a + b, 0);
        m.rain72 = slice(p, i - 72, i + 1).filter(v => v != null).reduce((a, b) => a + b, 0);
        m.rainWindowHrs = i - Math.max(0, i - 72);
        m.lastRainHrs = null;
        for (let k = i; k >= Math.max(0, i - 72); k--) { if ((p[k] || 0) > 0.01) { m.lastRainHrs = i - k; break; } }
        const s0 = Math.max(0, i - 72);
        m.windSeries = slice(A.wind, i - 72, i + 25);
        m.windNowPos = i - s0;
        const t0 = Math.max(0, i - 24);
        m.trendWindSeries = slice(A.wind, i - 24, i + 49);
        m.trendWindNowPos = i - t0;
        m.ok.wx = m.windNow != null;
      }
    }
    const th = tideAt(when);
    if (th) {
      m.rising = th.rising; m.nextTide = th.next; m.tideH = th.h;
      m.tideRange = tideRangeFor(when);
      m.ok.tides = m.tideRange != null;
    }
    return m;
  }

  function dataBounds() {
    const los = [], his = [];
    if (S.mar) { los.push(S.mar.ms[0]); his.push(S.mar.ms[S.mar.ms.length - 1]); }
    if (S.wx) { los.push(S.wx.ms[0]); his.push(S.wx.ms[S.wx.ms.length - 1]); }
    if (!los.length) return null;
    return { lo: Math.max(...los), hi: Math.min(...his) };
  }

  function exposureFactor(swellDir, face) {
    if (face == null || face === '' || swellDir == null) return { f: 1, label: 'exposure unknown — full swell assumed' };
    const d = angDist(swellDir, Number(face));
    if (d <= 60) return { f: 1, label: 'hitting the site nearly head-on — full exposure' };
    if (d <= 90) return { f: 0.7, label: 'arriving at an oblique angle — energy reduced ~30%' };
    if (d <= 120) return { f: 0.45, label: 'wrapping around the site — energy reduced ~55%' };
    return { f: 0.3, label: 'site is sheltered from this direction — mostly refracted energy' };
  }

  function colorFor(s) { return s >= 75 ? 'var(--good)' : s >= 50 ? 'var(--fair)' : 'var(--poor)'; }

  function scoreDive(site, m) {
    const F = [], caps = [];
    const depth = site.depth || 30;
    const exp = exposureFactor(m.swellDir, site.face);
    let Heff = null;

    if (m.ok.marine) {
      const effSwell = (m.swellNow || 0) * exp.f;
      Heff = Math.sqrt(effSwell * effSwell + (m.windWaveNow || 0) * (m.windWaveNow || 0));
      const T = m.swellPer || m.perNow || 10;
      const L = 5.12 * T * T;
      const feltDepth = L / 2;
      const surgeAmp = Heff * Math.exp(-2 * Math.PI * depth / L);
      let s = 100 - 21 * Math.pow(Math.max(0, Heff - 0.7), 1.2);
      if (T >= 14 && Heff >= 2) s -= 8;
      s = clamp(Math.round(s), 4, 98);
      F.push({
        key: 'surge', name: 'Surge & swell energy', weight: 30, score: s,
        stat: f1(Heff) + ' ft eff @ ' + f0(T) + ' s',
        summary: surgeAmp < 0.5
          ? 'Little water movement expected at ' + depth + ' ft — swell energy is weak or blocked at this site.'
          : 'Expect roughly ' + f1(surgeAmp) + ' ft of back-and-forth water movement at ' + depth + ' ft.',
        data: [
          'Groundswell: ' + f1(m.swellNow) + ' ft @ ' + f0(m.swellPer) + ' s from ' + f0(m.swellDir) + '\u00b0 (' + compass(m.swellDir) + ')',
          'Wind waves on top: ' + f1(m.windWaveNow) + ' ft @ ' + f0(m.windWavePer) + ' s',
          'Site faces ' + (site.face != null && site.face !== '' ? f0(site.face) + '\u00b0 (' + compass(site.face) + ') — swell is ' + exp.label : 'open water (no exposure adjustment)'),
          'Effective combined seas: ' + f1(Heff) + ' ft \u00b7 wavelength \u2248 ' + f0(L) + ' ft \u00b7 felt down to \u2248 ' + f0(feltDepth) + ' ft',
          'Estimated surge at ' + depth + ' ft: \u00b1' + f1(surgeAmp) + ' ft of horizontal motion'
        ],
        spark: { series: m.waveSeries, nowPos: m.waveNowPos, unit: 'ft', label: 'Combined seas — 72 h before & 48 h after', markLabel: m.markLabel },
        why: 'Waves are orbital motion, and that motion penetrates to about half the wavelength (wavelength \u2248 5.12 \u00d7 period\u00b2, in feet). A 6-second wind chop dies out ~90 ft of wavelength down — you barely feel it at depth. A 15-second groundswell has a ~1,150 ft wavelength and will push you around even at 60+ ft, silting the bottom as it goes. This is why period matters as much as height, and why a site\u2019s facing direction can turn a big swell into a non-event.',
        scoring: 'Roughly: under ~1 ft of effective seas scores in the 90s, 2 ft \u2248 70, 3 ft \u2248 45, 4 ft \u2248 15. Long-period swell (\u226514 s) over 2 ft costs another 8 for deep surge. Swell arriving outside the site\u2019s exposure window is discounted 30\u201370% before any of this.'
      });
    }

    if (m.ok.marine || m.ok.wx) {
      let s = 88, parts = [];
      if (m.avg48 != null) {
        const avgEff = m.avg48 * (0.4 + 0.6 * exp.f);
        const stir = Math.max(0, avgEff - 1.2) * 17;
        s -= stir;
        if (stir > 1) parts.push('\u2212' + f0(stir) + ' for sediment stirred by recent seas (48-h avg ' + f1(m.avg48) + ' ft' + (exp.f < 1 ? ', reduced for shelter' : '') + ')');
      }
      if (m.rain72 != null) {
        const rp = Math.min(58, m.rain72 * 45 + (m.rain24 > 0.15 ? 12 : 0));
        s -= rp; if (rp > 1) parts.push('\u2212' + f0(rp) + ' for ' + f1(m.rain72) + '\u2033 of rain runoff in the past 72 h');
      }
      if (m.windAvg24 != null) {
        const mixp = Math.max(0, m.windAvg24 - 10) * 1.6;
        s -= mixp; if (mixp > 1) parts.push('\u2212' + f0(mixp) + ' for wind-driven mixing (24-h avg ' + f0(m.windAvg24) + ' kn)');
      }
      if (m.trendPct <= -0.15) { s += 7; parts.push('+7 — swell is dropping, water should be clearing'); }
      else if (m.trendPct >= 0.15) { s -= 7; parts.push('\u22127 — swell is building, expect it to get murkier'); }
      s = clamp(Math.round(s), 4, 96);
      const visFt = Math.round(3 + s * 0.26);
      F.push({
        key: 'vis', name: 'Visibility outlook', weight: 30, score: s, extra: { visFt },
        stat: '~' + visFt + ' ft est.',
        summary: 'Model-based estimate of roughly ' + visFt + ' ft of visibility. ' + (m.trendPct <= -0.15 ? 'Trend is improving.' : m.trendPct >= 0.15 ? 'Trend is worsening.' : 'Conditions look steady.'),
        data: [
          '48-h average seas: ' + f1(m.avg48) + ' ft (peak ' + f1(m.peak48) + ' ft) — the wave history before this moment stirs sediment that lingers',
          'Rain, prior 72 h: ' + f1(m.rain72) + '\u2033 (' + f1(m.rain24) + '\u2033 in the prior 24 h)',
          'Prior 24-h average wind: ' + f0(m.windAvg24) + ' kn',
          'Adjustments applied: ' + (parts.length ? parts.join(' \u00b7 ') : 'none — clean baseline')
        ],
        why: 'Visibility is mostly about what happened over the previous two or three days, not the moment itself. Days of waves keep fine sediment suspended long after the swell drops; rain flushes silt and everything on the streets into the water through storm drains; and sustained wind mixes the surface layer. The classic SoCal pattern for great vis: several days of small swell, no rain, light wind — often right after a swell fades. Note the model can\u2019t see plankton blooms or red tide, which can wreck vis on an otherwise perfect day.',
        scoring: 'Starts at 88. Subtracts ~17 points per foot the shelter-adjusted 48-hour sea state exceeds 1.2 ft, ~45 points per inch of 72-hour rainfall, and 1.6 points per knot the 24-hour wind average exceeds 10 kn. A clearly dropping swell adds 7; a building one subtracts 7. The score maps to an estimated range of roughly 5\u201328 ft.'
      });
    }

    if (m.ok.wx) {
      const gustEx = Math.max(0, (m.gustNow || 0) - (m.windNow || 0));
      let s = 100 - 3.6 * Math.max(0, (m.windNow || 0) - 4) - 1.2 * Math.max(0, gustEx - 4) - 5 * Math.max(0, (m.windWaveNow || 0) - 0.7);
      s = clamp(Math.round(s), 4, 98);
      F.push({
        key: 'wind', name: 'Wind & surface state', weight: 20, score: s,
        stat: f0(m.windNow) + ' kn ' + compass(m.windDir),
        summary: (m.windNow < 6 ? 'Near-glassy surface — easy entries, easy surface swims.' :
          m.windNow < 12 ? 'Light wind — some texture on the surface but very workable.' :
            m.windNow < 18 ? 'Choppy — surface swims and navigation get tiring.' :
              'Rough surface conditions — entries, exits, and boat ops all suffer.'),
        data: [
          'Wind: ' + f0(m.windNow) + ' kn from ' + f0(m.windDir) + '\u00b0 (' + compass(m.windDir) + '), gusting ' + f0(m.gustNow) + ' kn',
          'Locally generated wind waves: ' + f1(m.windWaveNow) + ' ft @ ' + f0(m.windWavePer) + ' s',
          'Prior 24-h average: ' + f0(m.windAvg24) + ' kn'
        ],
        spark: { series: m.windSeries, nowPos: m.windNowPos, unit: 'kn', label: 'Wind speed — 72 h before & 24 h after', markLabel: m.markLabel },
        why: 'Wind builds short-period chop within hours. It rarely affects you at depth, but it controls the hardest parts of a shore dive: getting in, getting out, and the surface swim. It also drives your safety-stop comfort and how easy it is to spot a surfaced buddy. SoCal has a strong daily rhythm — calm mornings, westerly sea breeze rising after noon — which is why locals dive early and why the noon and 5 PM outlook slots usually score below the 7 AM slot. Offshore (easterly/Santa Ana) wind flattens the surface but can bring its own hazards.',
        scoring: 'The first 4 kn are free (that\u2019s glassy). Beyond that it loses 3.6 points per knot of sustained wind, 1.2 per knot of gust excess beyond 4 kn over sustained, and 5 per foot of locally generated wind wave above 0.7 ft.'
      });
    }

    if (m.ok.wx) {
      const r = m.rain72;
      let s = r <= 0.02 ? 96 : r <= 0.1 ? 72 : r <= 0.25 ? 50 : r <= 0.5 ? 32 : r <= 1 ? 20 : 8;
      F.push({
        key: 'runoff', name: 'Runoff & water quality', weight: 10, score: s,
        stat: f1(r) + '\u2033 / 72 h',
        summary: r <= 0.02 ? 'No meaningful rain in the prior 3 days — runoff is not a concern.' :
          'Recent rain — expect turbid water near shore and elevated bacteria; the standard advisory is to stay out for 72 h after significant rain.',
        data: [
          'Rainfall, prior 72 h: ' + f1(m.rain72) + '\u2033 \u00b7 prior 24 h: ' + f1(m.rain24) + '\u2033',
          m.lastRainHrs == null ? 'Last measurable rain: none within the prior 72 h' : 'Last measurable rain: about ' + m.lastRainHrs + ' h before this time'
        ],
        why: 'In urban SoCal, rain doesn\u2019t just add fresh water — it flushes storm drains straight into the ocean, carrying silt, oil, and bacteria. LA County public health advises avoiding ocean-water contact for 72 hours after significant rain, and visibility near river mouths and drains can collapse for days. Offshore sites like Catalina recover much faster than mainland beaches below big watersheds.',
        scoring: 'Stepped on 72-hour rainfall totals: under 0.02\u2033 scores ~96; 0.1\u2033 ~72; 0.25\u2033 ~50; 0.5\u2033 ~32; an inch or more drops to 20 or below. Heavy recent rain also caps the overall rating (see methodology).'
      });
    }

    if (m.ok.tides) {
      let s = m.tideRange <= 3.5 ? 88 : m.tideRange <= 5.5 ? 74 : 56;
      if (m.rising) s += 8;
      s = clamp(Math.round(s), 4, 98);
      F.push({
        key: 'tide', name: 'Tide movement', weight: 10, score: s,
        stat: f1(m.tideRange) + ' ft range',
        summary: (m.rising == null ? 'Tide data available below.' :
          (m.rising ? 'Tide is coming in — incoming water is usually cleaner oceanic water.' : 'Tide is dropping — ebb flow can pull silt and back-bay water along the coast.')),
        data: [
          'Height at this time: ' + f1(m.tideH) + ' ft MLLW, ' + (m.rising ? 'rising' : 'falling'),
          'Day\u2019s tidal range: ' + f1(m.tideRange) + ' ft (' + (m.tideRange > 5.5 ? 'spring-tide territory — stronger tidal currents' : m.tideRange > 3.5 ? 'moderate' : 'mild — weak tidal currents') + ')',
          m.nextTide ? 'Next event: ' + (m.nextTide.type === 'H' ? 'high' : 'low') + ' of ' + f1(m.nextTide.v) + ' ft at ' + fmtDay(m.nextTide.t) + ' ' + fmtTime(m.nextTide.t) : 'No upcoming event parsed'
        ],
        why: 'Tides matter two ways. First, water movement: the bigger the day\u2019s range (spring tides, around full/new moons), the stronger the currents as water moves — worth timing your dive near a high or low (\u201cslack\u201d) when flow pauses. Second, water quality: an incoming (flooding) tide pushes clean offshore water toward the beach, while an outgoing tide can drag turbid harbor and back-bay water across a site. Divers often aim for the last hour of the flood.',
        scoring: 'Ranges up to 3.5 ft score ~88, up to 5.5 ft ~74, larger spring-tide ranges ~56. A rising tide at the evaluated time adds 8.'
      });
    }

    const wSum = F.reduce((a, f) => a + f.weight, 0) || 1;
    let composite = Math.round(F.reduce((a, f) => a + f.score * f.weight, 0) / wSum);
    if (Heff != null && Heff >= 4 && composite > 40) { composite = 40; caps.push('capped: surf entry through ' + f1(Heff) + ' ft seas is hazardous'); }
    if (m.rain72 >= 1 && composite > 45) { composite = 45; caps.push('capped: >1\u2033 of rain in 72 h — water-quality advisory'); }
    else if (m.rain72 >= 0.5 && composite > 65) { composite = 65; caps.push('capped: recent rain — 72-hour water-quality advisory in effect'); }
    const stars = clamp(Math.round(composite / 10) / 2, 1, 5);
    const verdict = stars >= 4.5 ? 'Exceptional' : stars >= 3.5 ? 'Good' : stars >= 2.5 ? 'Fair' : stars >= 1.5 ? 'Poor' : 'Blown out';
    return { factors: F, composite, stars, verdict, caps };
  }

  function starSVG() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR_PATH + '"/></svg>'; }

  function stars(rating) {
    return '<div class="dive-stars" role="img" aria-label="' + rating + ' out of 5 stars">' +
      '<div class="row base">' + starSVG().repeat(5) + '</div>' +
      '<div class="row fill" style="width:' + (rating / 5 * 100) + '%">' + starSVG().repeat(5) + '</div></div>';
  }

  function sparkSVG(sp) {
    const vals = (sp.series || []).map(v => v == null ? null : v);
    const clean = vals.filter(v => v != null);
    if (clean.length < 4) return '';
    const w = 320, h = 64, padT = 14, padB = 14;
    const vmax = Math.max(...clean), vmin = Math.min(...clean);
    const span = (vmax - vmin) || 1;
    const X = i => (i / (vals.length - 1)) * w;
    const Y = v => padT + (1 - (v - vmin) / span) * (h - padT - padB);
    let past = '', fut = '';
    vals.forEach((v, i) => {
      if (v == null) return;
      if (i <= sp.nowPos) past += (past ? ' L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1);
      else fut += (fut ? ' L' : 'M' + X(sp.nowPos).toFixed(1) + ' ' + Y(vals[sp.nowPos] == null ? clean[0] : vals[sp.nowPos]).toFixed(1) + ' L') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1);
    });
    const nx = X(sp.nowPos).toFixed(1);
    const nowV = vals[sp.nowPos];
    const mark = sp.markLabel || 'now';
    return '<div class="spark"><svg viewBox="0 0 ' + w + ' ' + (h + 16) + '" role="img" aria-label="' + esc(sp.label) + '">' +
      '<text x="0" y="10" font-size="9" fill="var(--ink3)" font-family="var(--font-mono,var(--mono))">' + esc(sp.label) + '</text>' +
      '<path d="' + past + '" fill="none" stroke="var(--ink2)" stroke-width="1.6"/>' +
      '<path d="' + fut + '" fill="none" stroke="var(--ink3)" stroke-width="1.4" stroke-dasharray="3 3"/>' +
      '<line x1="' + nx + '" y1="' + padT + '" x2="' + nx + '" y2="' + (h - 2) + '" stroke="var(--warn)" stroke-width="1.2"/>' +
      (nowV != null ? '<circle cx="' + nx + '" cy="' + Y(nowV).toFixed(1) + '" r="2.6" fill="var(--warn)"/>' +
        '<text x="' + clamp(+nx + 5, 0, w - 78) + '" y="' + (h + 12) + '" font-size="9.5" fill="var(--warn)" font-family="var(--font-mono,var(--mono))">' + esc(mark) + ' ' + f1(nowV) + ' ' + sp.unit + '</text>' : '') +
      '<text x="0" y="' + (h + 12) + '" font-size="9" fill="var(--ink3)" font-family="var(--font-mono,var(--mono))">' + esc(sp.pastLabel || '\u221272 h') + '</text>' +
      '<text x="' + (w - 30) + '" y="' + (h + 12) + '" font-size="9" fill="var(--ink3)" font-family="var(--font-mono,var(--mono))">' + esc(sp.futureLabel || '+48 h') + '</text>' +
      '<text x="' + (w - 40) + '" y="10" font-size="9" fill="var(--ink3)" font-family="var(--font-mono,var(--mono))">' + f1(vmin) + '\u2013' + f1(vmax) + '</text>' +
      '</svg></div>';
  }

  function renderFactors(F) {
    const box = $('diveFactors');
    if (!box) return;
    box.innerHTML = F.map(f => {
      const c = colorFor(f.score);
      return '<details class="dive-factor">' +
        '<summary>' +
        '<div class="fhead"><span class="fname">' + esc(f.name) + '</span><span class="fstat">' + esc(f.stat) + '</span></div>' +
        '<div class="fscore"><span class="bar"><i style="width:' + f.score + '%;background:' + c + '"></i></span><span class="fnum">' + f.score + '/100</span></div>' +
        '<p class="fsum">' + esc(f.summary) + '</p>' +
        '</summary>' +
        '<div class="fbody">' +
        '<h4>What the data shows</h4>' + f.data.map(d => '<p class="d">' + esc(d) + '</p>').join('') +
        (f.spark ? sparkSVG(f.spark) : '') +
        '<h4>Why it matters</h4><p class="why">' + esc(f.why) + '</p>' +
        '<h4>How it\u2019s scored</h4><p class="why">' + esc(f.scoring) + '</p>' +
        '<p class="fw">Weight: ' + f.weight + '% of the overall rating</p>' +
        '</div></details>';
    }).join('');
  }

  function renderHero(site, m, R) {
    const box = $('diveHero');
    if (!box) return;
    let chips = '';
    if (!m.isNow) chips += '<span class="chip a">' + (+m.when > Date.now() ? 'forecast \u00b7 ' : 'hindcast \u00b7 ') + fmtFull(m.when) + '</span> ';
    if (Math.abs(m.trendPct || 0) >= 0.12) {
      const up = m.trendPct > 0;
      chips += '<span class="chip ' + (up ? 'y' : 'g') + '">swell ' + (up ? 'building \u2191 ' : 'dropping \u2193 ') + Math.abs(Math.round(m.trendPct * 100)) + '%</span> ';
    }
    if (R.caps && R.caps.length) chips += '<span class="chip y">' + esc(R.caps.join(' \u00b7 ')) + '</span>';

    const g = [];
    if (m.waveNow != null) g.push(['Seas', f1(m.waveNow) + ' ft @ ' + f0(m.perNow) + ' s']);
    if (m.windNow != null) g.push(['Wind', f0(m.windNow) + ' kn ' + compass(m.windDir)]);
    if (m.sstF != null) g.push(['Water', f0(m.sstF) + ' \u00b0F']);
    if (m.nextTide) g.push(['Next ' + (m.nextTide.type === 'H' ? 'high' : 'low'), fmtTime(m.nextTide.t)]);

    box.innerHTML =
      stars(R.stars) +
      '<div class="dive-verdict">' + esc(R.verdict) + '</div>' +
      '<div class="dive-meta">' + R.stars.toFixed(1) + ' \u2605 \u00b7 ' + R.composite + '/100</div>' +
      (chips ? '<div style="margin-top:8px">' + chips + '</div>' : '') +
      '<div class="dive-glance grid3">' + g.map(x => '<div class="g"><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>').join('') + '</div>' +
      '<div class="dive-srcchips">' +
      '<span class="chip ' + (m.ok.marine ? 'g' : 'y') + '">wave model ' + (m.ok.marine ? '\u2713' : '\u2715') + '</span>' +
      '<span class="chip ' + (m.ok.wx ? 'g' : 'y') + '">weather ' + (m.ok.wx ? '\u2713' : '\u2715') + '</span>' +
      '<span class="chip ' + (m.ok.tides ? 'g' : 'y') + '">tides ' + (m.ok.tides ? '\u2713' : '\u2715') + '</span></div>';
  }

  function renderTideCurve(when) {
    const box = $('diveTideCurve'), sum = $('diveTideSum');
    if (!box) return;
    if (!S || !S.tideEv.length) {
      box.innerHTML = '<p class="skel">Tide data unavailable' + (curStation ? ' for ' + esc(curStation.name) : '') + '.</p>';
      if (sum) sum.textContent = '';
      return;
    }
    const w0 = +when - 6 * HR, w1 = +when + 24 * HR;
    const N = 96, pts = [];
    for (let k = 0; k <= N; k++) {
      const t = w0 + (w1 - w0) * k / N;
      const r = tideAt(t);
      if (r) pts.push({ t, h: r.h });
    }
    if (pts.length < 10) {
      box.innerHTML = '<p class="skel">Tide predictions don\u2019t cover this time window.</p>';
      if (sum) sum.textContent = 'Station: ' + esc(curStation.name);
      return;
    }
    const evs = S.tideEv.filter(e => +e.t >= w0 && +e.t <= w1);
    const hs = pts.map(p => p.h).concat(evs.map(e => e.v));
    let hmin = Math.min(...hs, 0), hmax = Math.max(...hs);
    const pad = (hmax - hmin) * 0.12 || 1; hmin -= pad * 0.4; hmax += pad;
    const W = 340, H = 128, padT = 8, padB = 18;
    const X = t => (t - w0) / (w1 - w0) * W;
    const Y = h => padT + (1 - (h - hmin) / (hmax - hmin)) * (H - padT - padB);
    let path = '';
    pts.forEach((p, i) => { path += (i ? ' L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p.h).toFixed(1); });
    const r0 = tideAt(+when);
    const zx = Y(0);
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tide height curve">';
    if (0 >= hmin && 0 <= hmax) {
      svg += '<line x1="0" y1="' + zx.toFixed(1) + '" x2="' + W + '" y2="' + zx.toFixed(1) + '" stroke="var(--line)" stroke-width="1"/>' +
        '<text x="2" y="' + (zx - 3).toFixed(1) + '" font-size="8.5" fill="var(--ink3)" font-family="var(--font-mono,var(--mono))">0 MLLW</text>';
    }
    svg += '<path d="' + path + '" fill="none" stroke="var(--accent)" stroke-width="1.8"/>';
    for (const e of evs) {
      const ex = X(+e.t), ey = Y(e.v);
      const above = e.type === 'H';
      svg += '<circle cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="2.4" fill="var(--accent)"/>' +
        '<text x="' + clamp(ex, 26, W - 26).toFixed(1) + '" y="' + (above ? ey - 6 : ey + 13).toFixed(1) + '" text-anchor="middle" font-size="9" fill="var(--ink2)" font-family="var(--font-mono,var(--mono))">' +
        (above ? 'H ' : 'L ') + f1(e.v) + ' \u00b7 ' + fmtTime(e.t) + '</text>';
    }
    if (r0) {
      const mxp = X(+when);
      svg += '<line x1="' + mxp.toFixed(1) + '" y1="' + padT + '" x2="' + mxp.toFixed(1) + '" y2="' + (H - padB) + '" stroke="var(--warn)" stroke-width="1.2"/>' +
        '<circle cx="' + mxp.toFixed(1) + '" cy="' + Y(r0.h).toFixed(1) + '" r="3" fill="var(--warn)"/>' +
        '<text x="' + clamp(mxp + 4, 0, W - 60).toFixed(1) + '" y="' + (H - 5) + '" font-size="9" fill="var(--warn)" font-family="var(--font-mono,var(--mono))">' + esc(lastM && lastM.markLabel || 'now') + ' ' + f1(r0.h) + ' ft</text>';
    }
    svg += '</svg>';
    box.innerHTML = svg;
    const nx = r0 && r0.next;
    if (sum) {
      sum.innerHTML = (r0 ? '<strong>' + f1(r0.h) + ' ft and ' + (r0.rising ? 'rising' : 'falling') + '</strong>' +
        (nx ? ' \u2014 next ' + (nx.type === 'H' ? 'high' : 'low') + ' ' + f1(nx.v) + ' ft at ' + fmtDay(nx.t) + ' ' + fmtTime(nx.t) : '') + '. ' : '') +
        'Station: ' + esc(curStation.name) + ' (#' + curStation.id + '). ' +
        '<a href="https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=' + curStation.id + '" target="_blank" rel="noopener">Full NOAA tide predictions \u2192</a>';
    }
  }

  function renderOutlook(site) {
    const box = $('diveOutlook');
    if (!box) return;
    const now = new Date();
    const b = dataBounds();
    let html = '<div class="dive-outlook"><span></span>' + SLOTS.map(s => '<span class="ohead">' + s.lbl + '</span>').join('');
    for (let d = 0; d < 5; d++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
      html += '<span class="oday">' + fmtDay(day) + '<br>' + (day.getMonth() + 1) + '/' + day.getDate() + '</span>';
      for (const sl of SLOTS) {
        const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), sl.h);
        if (!b || +when < b.lo || +when > b.hi) { html += '<button class="oslot" disabled>\u2014</button>'; continue; }
        const m = snapshotAt(site, when);
        if (!m.ok.marine && !m.ok.wx) { html += '<button class="oslot" disabled>\u2014</button>'; continue; }
        const R = scoreDive(site, m);
        const past = +when < +now - 30 * 60e3;
        html += '<button class="oslot' + (past ? ' past' : '') + '" data-ts="' + (+when) + '" style="color:' + colorFor(R.composite) + '">' +
          '<b>' + R.stars.toFixed(1) + '\u2605' + (R.caps.length ? '\u26a0' : '') + '</b><small>' + esc(R.verdict) + '</small></button>';
      }
    }
    html += '</div>';
    box.innerHTML = html;
  }

  function renderSources(site, station) {
    const box = $('diveSources');
    if (!box || !linkHtml) return;
    let html =
      linkHtml('https://cdip.ucsd.edu/m/forecast/model_grid/?wave_model=socal', 'CDIP SoCal wave forecast', 'Cross-check the swell model against Scripps\u2019 nearshore grid') +
      linkHtml('https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=' + station.id, 'NOAA tide predictions', 'Official tide tables — ' + station.name) +
      linkHtml('https://ocean.weather.gov/Pac_tab.php', 'OPC Pacific marine', 'Offshore charts — see swells coming days out') +
      linkHtml('https://graphical.weather.gov/sectors/loxMarineLoop.php#tabs', 'NOAA graphical marine (LA/Oxnard)', 'Coastal wind & wave forecast maps') +
      linkHtml('https://www.weather.gov/wrh/TextProduct?product=srflox', 'NWS LOX surf forecast', 'Forecaster-written surf zone discussion');
    if (site.cam) html += linkHtml(site.cam, site.camLabel || 'Site webcam / report', 'Look at the actual water before you drive');
    box.innerHTML = html;
  }

  function siteBriefing(site) {
    if (!site) return null;
    if (BRIEFING_SYNTH && typeof BRIEFING_SYNTH.diveBriefingFor === 'function') {
      return BRIEFING_SYNTH.diveBriefingFor(site, DIVE_BRIEFINGS, DIVE_SITE_INTEL);
    }
    return DIVE_BRIEFINGS[site.id] || null;
  }

  function siteIntel(site) {
    if (!site) return null;
    return DIVE_SITE_INTEL[site.id] || null;
  }

  function lon360(lon) {
    return lon < 0 ? lon + 360 : lon;
  }

  function habQuery(lat, lon) {
    /* Nearshore harbor cells are often null — sample a small box and take the max. */
    const la0 = (lat - 0.2).toFixed(2);
    const la1 = (lat + 0.2).toFixed(2);
    const lo = lon360(lon);
    const lo0 = (lo - 0.25).toFixed(2);
    const lo1 = (lo + 0.25).toFixed(2);
    const box = '[(last)][(' + la0 + '):(' + la1 + ')][(' + lo0 + '):(' + lo1 + ')]';
    return 'wvcharmV3_0day.json?' +
      'cellular_domoic' + box + ',' +
      'particulate_domoic' + box + ',' +
      'pseudo_nitzschia' + box;
  }

  function parseHabRows(rows) {
    if (!rows || !rows.length) return null;
    let best = null;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.length) continue;
      const cell = row[3], part = row[4], pseudo = row[5];
      const vals = [cell, part, pseudo].filter(v => v != null && isFinite(v));
      if (!vals.length) continue;
      const maxProb = Math.max(...vals);
      if (!best || maxProb > best.maxProb) {
        best = {
          cellular: cell, particulate: part, pseudo: pseudo, maxProb,
          time: row[0] || null,
          sampleLat: row[1], sampleLon: row[2]
        };
      }
    }
    if (best) return best;
    const row0 = rows[0];
    return {
      cellular: null, particulate: null, pseudo: null, maxProb: null,
      time: row0 && row0[0] ? row0[0] : null
    };
  }

  function fetchHabJsonp(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const cb = '_boatHabJsonp_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
      const script = document.createElement('script');
      let done = false;
      const finish = (err, data) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
        if (err) reject(err);
        else resolve(data);
      };
      const timer = setTimeout(() => finish(new Error('HAB JSONP timeout')), timeoutMs || 14000);
      window[cb] = data => finish(null, data);
      script.onerror = () => finish(new Error('HAB JSONP failed'));
      script.src = url + (url.indexOf('?') >= 0 ? '&.jsonp=' : '?.jsonp=') + cb;
      document.head.appendChild(script);
    });
  }

  async function persistHab(lat, lon, data) {
    if (!data || data.maxProb == null) return;
    try {
      await storeSet(HAB_LS_KEY, JSON.stringify({
        lat, lon, at: Date.now(), data: {
          cellular: data.cellular, particulate: data.particulate, pseudo: data.pseudo,
          maxProb: data.maxProb, time: data.time
        }
      }));
    } catch (e) { /* ignore quota */ }
  }

  async function readPersistedHab(lat, lon) {
    try {
      const raw = await storeGet(HAB_LS_KEY);
      if (!raw) return null;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!parsed || !parsed.data || parsed.data.maxProb == null) return null;
      if (Date.now() - (parsed.at || 0) > HAB_LS_MAX_AGE_MS) return null;
      if (lat != null && lon != null && parsed.lat != null && parsed.lon != null) {
        const dlat = Math.abs(parsed.lat - lat);
        const dlon = Math.abs(parsed.lon - lon);
        if (dlat > 0.6 || dlon > 0.8) return null;
      }
      return {
        ...parsed.data,
        cached: true,
        source: 'cache',
        cachedAt: parsed.at
      };
    } catch (e) {
      return null;
    }
  }

  async function fetchHabLive(lat, lon) {
    const q = habQuery(lat, lon);
    let lastErr = null;
    for (let h = 0; h < HAB_HOSTS.length; h++) {
      const url = HAB_HOSTS[h] + q;
      if (fetchJSON) {
        try {
          const j = await fetchJSON(url);
          const data = parseHabRows(j && j.table && j.table.rows);
          if (data) return Object.assign(data, { source: 'live', cached: false });
        } catch (e) {
          lastErr = e;
        }
      }
      try {
        const j = await fetchHabJsonp(url);
        const data = parseHabRows(j && j.table && j.table.rows);
        if (data) return Object.assign(data, { source: 'jsonp', cached: false });
      } catch (e) {
        lastErr = e;
      }
    }
    if (lastErr) throw lastErr;
    return null;
  }

  async function fetchHabAlert(lat, lon, force) {
    const now = Date.now();
    if (!force && habCache && habCache.lat === lat && habCache.lon === lon && now - habCache.at < HAB_CACHE_MS) {
      return habCache.data;
    }
    try {
      const data = await fetchHabLive(lat, lon);
      if (data && data.maxProb != null) {
        await persistHab(lat, lon, data);
        habCache = { lat, lon, at: now, data };
        return data;
      }
      /* Live responded but coastal cell nulls — still prefer any nearby persisted reading. */
      const stale = await readPersistedHab(lat, lon);
      if (stale) {
        habCache = { lat, lon, at: now, data: stale };
        return stale;
      }
      if (data) {
        habCache = { lat, lon, at: now, data };
        return data;
      }
    } catch (e) {
      const stale = await readPersistedHab(lat, lon);
      if (stale) {
        habCache = { lat, lon, at: now, data: stale };
        return stale;
      }
    }
    return null;
  }

  function seasonalHabNote() {
    const mo = new Date().getMonth();
    if (mo >= 3 && mo <= 9) {
      return 'Spring–summer is peak Pseudo-nitzschia / domoic acid season along the SoCal coast — shellfish advisories and reduced vis are possible even when models show low risk.';
    }
    return 'Winter typically sees lower HAB risk, but offshore transport can still bring blooms after storms.';
  }

  function fmtHabCachedAt(hab) {
    if (!hab || !hab.cachedAt) return '';
    try {
      return new Date(hab.cachedAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  }

  function habLevel(data) {
    if (!data || data.maxProb == null) return 'unknown';
    if (data.maxProb >= HAB_THRESH.elevated) return 'elevated';
    if (data.maxProb >= HAB_THRESH.watch) return 'watch';
    return 'clear';
  }

  function renderHabBanner(site, hab) {
    const box = $('diveHabBanner');
    if (!box) return;
    const lvl = habLevel(hab);
    const cachedNote = hab && hab.cached
      ? ' Cached C-HARM from ' + (fmtHabCachedAt(hab) || 'an earlier session') + '.'
      : '';
    let cls = 'dive-hab-banner ', title = '', body = '';
    if (lvl === 'elevated') {
      cls += 'elevated';
      title = 'Harmful algae — elevated risk';
      body = 'NOAA C-HARM nowcast shows elevated probability of Pseudo-nitzschia or domoic acid near this site. Primarily a shellfish-consumption and visibility concern — not a typical skin contact hazard. Avoid eating local shellfish; expect possible vis reduction.' + cachedNote;
    } else if (lvl === 'watch') {
      cls += 'watch';
      title = 'Harmful algae watch';
      body = 'C-HARM indicates moderate bloom probability offshore. Monitor CDPH shellfish advisories; vis may be lower than swell models suggest.' + cachedNote;
    } else if (lvl === 'clear') {
      cls += 'clear';
      title = 'Harmful algae — low risk today';
      body = 'C-HARM nowcast shows low Pseudo-nitzschia / domoic acid probability near this location. Models miss local blooms — still check recent diver reports.' + cachedNote;
    } else {
      cls += 'info';
      title = 'Harmful algae (HAB) awareness';
      body = seasonalHabNote() + ' Verify CDPH advisories before eating shellfish.';
    }
    const pct = hab && hab.maxProb != null ? Math.round(hab.maxProb * 100) + '% max probability' : '';
    const detail = hab ? [
      hab.pseudo != null ? 'Pseudo-nitzschia ' + Math.round(hab.pseudo * 100) + '%' : null,
      hab.cellular != null ? 'cellular DA ' + Math.round(hab.cellular * 100) + '%' : null,
      hab.particulate != null ? 'particulate DA ' + Math.round(hab.particulate * 100) + '%' : null
    ].filter(Boolean).join(' · ') : '';
    const srcLabel = hab && hab.cached
      ? 'Source: cached NOAA C-HARM (CoastWatch ERDDAP)'
      : 'Source: NOAA C-HARM v3.1 nowcast (CoastWatch ERDDAP)';
    box.className = cls;
    box.hidden = false;
    box.innerHTML =
      '<b>' + esc(title) + '</b>' +
      '<p style="margin:0">' + esc(body) + '</p>' +
      (detail ? '<p style="margin:6px 0 0;font-family:var(--mono);font-size:12px;color:inherit;opacity:.9">' + esc(detail) + (pct ? ' · ' + pct : '') + '</p>' : '') +
      '<div class="hab-src">' + esc(srcLabel) +
      (hab && hab.time ? ' · ' + esc(hab.time) : '') +
      ' · <a href="https://www.cdph.ca.gov/Programs/CEH/DRSEM/Pages/FDBPrograms/FoodSafetyProgram/DomoicAcid.aspx" target="_blank" rel="noopener" style="color:inherit">CDPH domoic acid advisories ↗</a></div>';
  }

  function recommendHeadings(site, m) {
    const intel = siteIntel(site);
    const baseEntry = intel && intel.entryHeading != null ? intel.entryHeading :
      (site.entryHeading != null ? site.entryHeading : (site.face != null ? site.face : 270));
    const baseExit = intel && intel.exitHeading != null ? intel.exitHeading :
      (site.exitHeading != null ? site.exitHeading : ((baseEntry + 180) % 360));
    let entry = baseEntry;
    let exit = baseExit;
    let entryNote = site.boat ? 'Boat entry — descend near mooring; surface swim bearing for shore exits.' : 'Swim offshore on this bearing toward the dive area.';
    let exitNote = site.boat ? 'Surface return toward vessel / mooring on this bearing.' : 'Return to shore on this bearing — pick a fixed landmark before descending.';

    if (m && m.swellDir != null && (m.swellNow || 0) >= 1.2) {
      const swellFrom = m.swellDir;
      const leeApproach = (swellFrom + 180) % 360;
      const exp = angDist(baseEntry, leeApproach);
      if (exp > 50) {
        entryNote = 'Swell from ' + f0(swellFrom) + '° (' + compass(swellFrom) + ') — lee approach ~' + f0(leeApproach) + '° may reduce surge on entry (base ' + f0(baseEntry) + '°).';
      } else {
        entryNote = 'Swell aligned with entry — expect surge; time sets carefully.';
      }
    }
    if (m && m.windNow >= 10) {
      exitNote += ' Wind ' + f0(m.windNow) + ' kn from ' + compass(m.windDir) + ' — allow drift on surface swim.';
    }
    return { entry, exit, entryNote, exitNote, baseEntry, baseExit };
  }

  function renderSiteIntel(site, m) {
    const box = $('diveSiteIntel');
    if (!box || !site) return;
    const intel = siteIntel(site);
    const hd = recommendHeadings(site, m);
    let html = '<div class="card dive-intel-card"><h3>Site intel — ' + esc(site.name) + '</h3>';

    html += '<div class="dive-intel-grid">' +
      '<div><span>Entry heading</span><b>' + f0(hd.entry) + '° ' + compass(hd.entry) + '</b></div>' +
      '<div><span>Return heading</span><b>' + f0(hd.exit) + '° ' + compass(hd.exit) + '</b></div>' +
      '<div><span>Site faces</span><b>' + (site.face != null ? f0(site.face) + '° ' + compass(site.face) : '—') + '</b></div>' +
      '<div><span>Depth band</span><b>' + (site.depth != null ? '~' + site.depth + ' ft max' : '—') + '</b></div>' +
      '</div>' +
      '<p class="mono" style="font-size:12px;color:var(--ink2);line-height:1.5;margin:0 0 8px">' +
      esc(hd.entryNote) + ' ' + esc(hd.exitNote) + '</p>';

    if (intel) {
      html += '<div class="sec" style="margin-top:8px">Logistics</div>' +
        '<div class="util-kv">' +
        '<div><span>Access</span><b>' + esc(intel.access || (site.boat ? 'boat' : 'shore')) + '</b></div>' +
        (intel.launch ? '<div><span>Launch / boat</span><b>' + esc(intel.launch) + '</b></div>' : '') +
        (intel.parking ? '<div><span>Parking</span><b>' + esc(intel.parking) + '</b></div>' : '') +
        (intel.fees ? '<div><span>Fees</span><b>' + esc(intel.fees) + '</b></div>' : '') +
        '</div>';
      if (intel.structure) {
        html += '<div class="sec" style="margin-top:8px">Structure &amp; terrain</div>' +
          '<p class="mono" style="font-size:12px;color:var(--ink2);line-height:1.5;margin:0">' + esc(intel.structure) + '</p>';
      }
      if (intel.species && intel.species.length) {
        html += '<div class="sec" style="margin-top:8px">Marine life</div>' +
          '<div class="dive-intel-tags">' + intel.species.map(s => '<span class="chip a">' + esc(s) + '</span>').join('') + '</div>';
      }
      if (intel.hazards && intel.hazards.length) {
        html += '<div class="dive-intel-hazards"><b style="font-size:12px">Diver beware</b><ul>' +
          intel.hazards.map(h => '<li>' + esc(h) + '</li>').join('') + '</ul></div>';
      }
      if (intel.notes) {
        html += '<p class="prose" style="font-size:13px;color:var(--ink2);margin:10px 0 0;line-height:1.5">' + esc(intel.notes) + '</p>';
      }
      if (intel.bestWhen) {
        html += '<p class="mono" style="font-size:11px;color:var(--ink3);margin:6px 0 0">Best when: ' + esc(intel.bestWhen) + '</p>';
      }
    } else {
      html += '<p class="dive-briefing-placeholder" style="margin-top:8px">No detailed intel on file for this site — headings use site exposure (' +
        (site.face != null ? f0(site.face) + '°' : 'unknown') + '). Check briefing below and local reports.</p>';
    }
    html += '</div>';
    box.innerHTML = html;
  }

  function renderTrends(site, when) {
    const box = $('diveTrends');
    if (!box || !site || !S) return;
    const m = snapshotAt(site, when instanceof Date ? when : new Date(when));
    if (!m.ok.marine && !m.ok.wx) {
      box.innerHTML = '<div class="skel">Trend charts load with marine data…</div>';
      return;
    }
    const trendSpark = { pastLabel: '\u221224 h', futureLabel: '+48 h', markLabel: m.markLabel };
    const sparks = [];
    if (m.trendWaveSeries && m.trendWaveSeries.length >= 4) {
      sparks.push(sparkSVG(Object.assign({}, trendSpark, {
        series: m.trendWaveSeries, nowPos: m.trendWaveNowPos, unit: 'ft',
        label: 'Combined seas — 24 h past & 48 h ahead'
      })));
    }
    if (m.trendWindSeries && m.trendWindSeries.length >= 4) {
      sparks.push(sparkSVG(Object.assign({}, trendSpark, {
        series: m.trendWindSeries, nowPos: m.trendWindNowPos, unit: 'kn',
        label: 'Wind speed — 24 h past & 48 h ahead'
      })));
    }
    if (!sparks.length) {
      box.innerHTML = '';
      return;
    }
    const trendTxt = Math.abs(m.trendPct || 0) >= 0.08
      ? 'Swell trend: ' + (m.trendPct > 0 ? 'building +' : 'dropping ') + Math.abs(Math.round(m.trendPct * 100)) + '% over next 24 h vs prior 24 h.'
      : 'Swell steady — little change expected in next 24 h.';
    box.innerHTML =
      '<div class="card dive-trends-card">' +
      '<h3>Conditions trends · ' + esc(site.name) + '</h3>' +
      '<p class="mono" style="font-size:11px;color:var(--ink3);margin:0 0 8px">' + esc(trendTxt) + '</p>' +
      '<div class="dive-trends-row">' + sparks.join('') + '</div></div>';
  }

  function briefingBlockHtml(block) {
    if (typeof block === 'string') return '<p>' + esc(block) + '</p>';
    if (!block || !block.h) return '';
    return '<h4 class="dive-briefing-h">' + esc(block.h) + '</h4>' +
      (block.body || []).map(p => '<p>' + esc(p) + '</p>').join('');
  }

  function renderDiveBriefing(site) {
    const box = $('diveSiteBriefing');
    if (!box) return;
    if (!site) {
      box.innerHTML = '<p class="dive-briefing-placeholder">Select a dive site from the dropdown above to load the pre-dive briefing.</p>';
      return;
    }
    const blocks = siteBriefing(site);
    if (!blocks || !blocks.length) {
      box.innerHTML = '<p class="dive-briefing-placeholder">No briefing on file for <strong>' + esc(site.name) + '</strong> yet — check entry notes below and local dive reports before entering the water.</p>';
      return;
    }
    box.innerHTML =
      '<h3>Pre-dive briefing — ' + esc(site.name) + '</h3>' +
      '<div class="dive-briefing-prose">' +
      blocks.map(briefingBlockHtml).join('') +
      '</div>';
  }

  function renderSiteGuide() {
    const box = $('diveSiteGuide');
    if (!box) return;
    if (!current) {
      renderDiveBriefing(null);
      return;
    }
    const site = current;
    const m = lastM;
    const R = lastR;
    const face = site.face != null ? f0(site.face) + '\u00b0 ' + compass(site.face) : '\u2014';
    const depth = site.depth != null ? '~' + site.depth + ' ft typical max' : '\u2014';
    let entry = 'Confirm shore access, parking, and MPA boundaries before entering the water.';
    if (/cove|harbor|bay|Shore/i.test(site.name)) entry = 'Protected cove or harbor — often calmer at the surface; watch surge on outgoing tide and boat traffic.';
    if (/pier|Harbor|harbor/i.test(site.name)) entry = 'Harbor or pier area — stay clear of vessel traffic; check local dive flags and permitted zones.';
    if (/Catalina|Island|Anacapa|Barbara/i.test(site.name)) entry = 'Island site — boat access only for most divers; favor the lee shore when wind is up.';
    if (/Wreck|Alley|Barge|Palawan|UB-88|Submarine|Star of Scotland/i.test(site.name) || site.boat) entry = 'Boat dive — run from King Harbor or charter; check MPA boundaries and surface conditions before entering.';

    let exposure = 'Load site data in Plan to see swell exposure at this mark.';
    let effSeas = '\u2014';
    if (m && m.ok && (m.ok.marine || m.ok.wx)) {
      const exp = exposureFactor(m.swellDir, site.face);
      exposure = exp.label;
      if (m.ok.marine) {
        const effSwell = (m.swellNow || 0) * exp.f;
        const heff = Math.sqrt(effSwell * effSwell + (m.windWaveNow || 0) * (m.windWaveNow || 0));
        effSeas = f1(heff) + ' ft effective @ surface';
      }
    }

    let tideTip = 'See tide curve below for entry timing.';
    if (m && m.ok && m.ok.tides) {
      if (m.rising) tideTip = 'Incoming tide — often better viz pushing offshore; entry can get surge-heavy near end of flood.';
      else if (m.rising === false) tideTip = 'Outgoing tide — easier beach exits in some coves; watch surge on rocky entries.';
    }

    const q = site.lat + ',' + site.lon;
    let html =
      '<div class="card"><h3>' + esc(site.name) + '</h3>' +
      '<p class="fish-verdict" style="font-size:14px;margin-bottom:10px">' + esc(entry) + '</p>' +
      '<div class="util-kv">' +
      '<div><span>Site faces</span><b>' + face + '</b></div>' +
      '<div><span>Depth band</span><b>' + depth + '</b></div>' +
      '<div><span>Distance</span><b>' + f1(site.dist != null ? site.dist : haversineNm((getPos && getPos().lat) || SLIP.lat, (getPos && getPos().lon) || SLIP.lon, site.lat, site.lon)) + ' nm</b></div>' +
      '<div><span>Coords</span><b>' + fmtSiteCoords(site.lat, site.lon) + '</b></div>' +
      (R ? '<div><span>Rating now</span><b style="color:' + colorFor(R.composite) + '">' + R.composite + '/100 · ' + R.stars.toFixed(1) + '\u2605</b></div>' : '<div><span>Rating</span><b>\u2014</b></div>') +
      '<div><span>Surface seas</span><b>' + effSeas + '</b></div>' +
      '</div>' +
      '<div class="sec" style="margin-top:12px">Swell exposure</div>' +
      '<p class="mono" style="font-size:12px;color:var(--ink2);line-height:1.5">' + esc(exposure) + '</p>' +
      '<div class="sec" style="margin-top:12px">Entry &amp; tide</div>' +
      '<p class="mono" style="font-size:12px;color:var(--ink2);line-height:1.5">' + esc(tideTip) + '</p>' +
      '</div>' +
      '<div class="sec">Bathymetry &amp; maps</div>' +
      linkHtml('https://www.google.com/maps/@' + site.lat + ',' + site.lon + ',14z/data=!5m1!1e4', 'Google Maps · depth layer', 'Satellite terrain near ' + esc(site.name)) +
      linkHtml('https://www.ncei.noaa.gov/maps/bathymetry/', 'NOAA NCEI bathymetry', 'Regional seafloor charts') +
      linkHtml('https://maps.google.com/?q=' + q, 'Open coordinates', 'Navigation & satellite view') +
      linkHtml('https://wildlife.ca.gov/Fishing/Ocean/Regulations/Fishing-Map', 'CDFW marine map', 'MPA & closure boundaries');

    if (site.cam) html += linkHtml(site.cam, site.camLabel || 'Site webcam', 'Live look at conditions before you go');
    box.innerHTML = html;
    renderDiveBriefing(site);
    refreshDiveSeafloor(site);
  }

  function refreshDiveSeafloor(site) {
    if (!window.SeafloorRender || !site) return;
    const p = getPos ? getPos() : null;
    const lat = p?.lat ?? site.lat;
    const lon = p?.lon ?? site.lon;
    window.SeafloorRender.update('diveSeafloorRender', {
      centerLat: lat,
      centerLon: lon,
      markLat: site.lat,
      markLon: site.lon,
      markLabel: site.name,
      habitat: site.depth != null ? 'Site depth ~' + site.depth + ' ft' : '',
      radiusNm: 2.2,
      metaEl: 'diveSeafloorMeta'
    });
  }

  function renderRecommendations(when, marine, wx, tides, lat, lon) {
    const box = $('diveRecs');
    if (!box) return;
    const whenD = when instanceof Date ? when : new Date(when);
    if (!marine && !wx && !tides) {
      box.innerHTML = '<div class="skel">Waiting for forecast data — open Overview or refresh.</div>';
      return;
    }
    const ranked = rankSitesAt(whenD, marine, wx, tides, lat, lon, SITE_PICKER_POOL);
    if (!ranked.length) {
      box.innerHTML = '<div class="skel">Could not rank sites — forecast may not cover this time.</div>';
      return;
    }
    const top = ranked[0];
    if (!current || !loaded.has(current.id)) current = top.site;

    box.innerHTML = ranked.map(({ site, R, dist, m }, i) => {
      const sel = current && current.id === site.id;
      const cap = R.caps && R.caps.length ? ' · ' + esc(R.caps[0]) : '';
      const seas = m.waveNow != null ? f1(m.waveNow) + ' ft seas' : '';
      const boatTag = site.boat ? ' · boat' : '';
      const label = groupListName(site);
      return '<div class="dive-rec' + (i === 0 ? ' best' : '') + (sel ? ' active' : '') + '" tabindex="0" role="button" data-site-id="' + esc(site.id) + '">' +
        '<span class="dr-rank">#' + (i + 1) + '</span>' +
        '<div class="dr-body">' +
        '<b>' + esc(label) + (sel ? ' ✓' : '') + '</b>' +
        '<div class="dr-coords">' + fmtSiteCoordsDepth(site) + '</div>' +
        '<div class="dr-meta">' + R.composite + '/100 · ' + R.stars.toFixed(1) + '\u2605 · ' + f1(dist) + ' nm' + boatTag +
        (seas ? ' · ' + seas : '') + '</div>' +
        '<div class="dr-verdict">' + esc(R.verdict) + cap + '</div>' +
        '</div></div>';
    }).join('') +
    '<p class="plan-note" style="margin-top:8px"><strong>' + ranked.length + '</strong> spots ranked by dive score among nearest groups within ~' + DIVE_MAP_FIT_NM + ' nm (of <strong>' + FEATURE_GROUP_COUNT + '</strong> feature groups · <strong>' + DIVE_SITES.length + '</strong> pins). Map numbers top ' + Math.min(DIVE_MAP_MAX_MARKERS, ranked.length) + '; other pins are unnumbered dots. Same-reef modules count once. Conditions at <strong>' + fmtFull(whenD) + '</strong>.</p>';

    lastRanked = ranked;
    renderSiteSelect();
    const allRanked = rankSitesAt(whenD, marine, wx, tides, lat, lon, null, { everyPin: true });
    renderDivePlanMap(ranked, allRanked, lat, lon);
  }

  async function ensureDivePlanMap() {
    if (!loadLeafletFn) return false;
    try { await loadLeafletFn(); } catch (e) { return false; }
    if (!window.L) return false;
    const host = $('divePlanMap');
    if (!host) return false;
    if (diveMap) {
      diveMap.invalidateSize(true);
      return true;
    }
    host.innerHTML = '';
    const pos = defaultPos();
    diveMap = L.map(host, { zoomControl: true, attributionControl: false, minZoom: 7, maxZoom: 19 })
      .setView([pos.lat, pos.lon], 14);
    if (planMapBaseLayerFn) planMapBaseLayerFn(diveMap);
    else {
      diveMap.getContainer().classList.add('ocean-map-dark');
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        attribution: 'Imagery © Esri — Maxar, Earthstar Geographics, USDA FSA, USGS, AeroGRID, IGN, GIS User Community'
      }).addTo(diveMap);
    }
    if (addCoastOverlayFn) addCoastOverlayFn(L.layerGroup().addTo(diveMap));
    if (window.BoatMpa?.initLayer) window.BoatMpa.initLayer(diveMap);
    diveSpotLayer = L.layerGroup().addTo(diveMap);
    diveBoatMarker = L.marker([pos.lat, pos.lon], {
      icon: L.divIcon({
        className: 'boat-icon',
        html: '<div style="font-size:22px;line-height:1;filter:drop-shadow(0 0 5px #3dd6f5)">▲</div>',
        iconSize: [22, 22], iconAnchor: [11, 11]
      }),
      zIndexOffset: 1000
    }).addTo(diveMap);
    diveMapInited = true;
    if (window.BoatMpa?.ensureOverlay) window.BoatMpa.ensureOverlay(diveMap, 'divePlan');
    return true;
  }

  function divePlanVisible() {
    const tab = document.querySelector('#tab-dive.tabpanel.active');
    const plan = document.querySelector('#tab-dive .subpanel[data-subpanel="plan"].active');
    return !!(tab && plan);
  }

  function diveMapMarkerHtml(rank, score, mode) {
    const col = diveScoreColor(score);
    if (mode === 'dot') {
      return '<div style="width:10px;height:10px;border-radius:50%;background:' + col + ';border:1.5px solid #fff;opacity:0.8;box-shadow:0 0 4px rgba(0,0,0,.7)"></div>';
    }
    if (mode === 'secondary') {
      return '<div style="width:14px;height:14px;border-radius:50%;background:' + col + ';border:2px solid #fff;opacity:0.85;box-shadow:0 0 6px rgba(0,0,0,.8)"></div>';
    }
    const sz = rank <= 6 ? 28 : 24;
    const fs = rank <= 6 ? 12 : 10;
    return '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:' + col + ';border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-family:var(--font-mono,ui-monospace,monospace);font-size:' + fs + 'px;font-weight:700;color:#060a10;box-shadow:0 0 8px rgba(0,0,0,.85)">' + rank + '</div>';
  }

  function applyDiveMapView(bounds, lat, lon) {
    if (!diveMap) return;
    const fit = () => {
      diveMap.invalidateSize(true);
      if (bounds && bounds.isValid()) {
        diveMap.fitBounds(bounds.pad(0.12), { maxZoom: 12, animate: false });
        if (diveMap.getZoom() < 8) diveMap.setZoom(8, { animate: false });
      } else {
        diveMap.setView([lat, lon], 11, { animate: false });
      }
    };
    fit();
    setTimeout(fit, 100);
  }

  function renderDivePlanMap(listRanked, allRanked, lat, lon) {
    lastRanked = listRanked || lastRanked;
    lastAllRanked = allRanked || lastAllRanked;
    if (!lastRanked.length || !divePlanVisible()) return;
    const render = (attempt) => {
      if (!divePlanVisible()) return;
      ensureDivePlanMap().then(ok => {
        if (!divePlanVisible()) return;
        if (!ok) {
          if (attempt < 6) setTimeout(() => render(attempt + 1), 200);
          return;
        }
        if (!diveMap || !diveSpotLayer) return;
        diveSpotLayer.clearLayers();
        if (diveBoatMarker) diveBoatMarker.setLatLng([lat, lon]);
        const featured = lastRanked.slice(0, DIVE_MAP_MAX_MARKERS);
        const featuredIds = new Set(featured.map(r => r.site.id));
        /* Fit to local waters only — still plot every ranked site as a marker. */
        const fitBounds = L.latLngBounds([[lat, lon]]);
        let plotted = 0;

        featured.forEach(({ site, R, dist }, i) => {
          const rank = i + 1;
          const mpos = siteMapPos(site);
          if (dist <= DIVE_MAP_FIT_NM) fitBounds.extend([mpos.lat, mpos.lon]);
          plotted++;
          const sz = rank <= 6 ? 28 : 24;
          const icon = L.divIcon({
            className: '',
            html: diveMapMarkerHtml(rank, R.composite, 'numbered'),
            iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2]
          });
          const label = groupListName(site);
          L.marker([mpos.lat, mpos.lon], { icon, zIndexOffset: 500 - i })
            .bindPopup('<b>#' + rank + ' ' + esc(label) + '</b><br><span style="font-family:var(--font-mono,monospace);font-size:12px;font-weight:500">' + fmtSiteCoordsDepth(site) + '</span><br>' + R.composite + '/100 · ' + R.stars.toFixed(1) + '\u2605<br>' + esc(R.verdict) + '<br>' + f1(dist) + ' nm' + (site.featureGroupSize > 1 ? '<br><span style="opacity:.85">Best module: ' + esc(site.name) + '</span>' : ''))
            .addTo(diveSpotLayer);
        });

        lastAllRanked.filter(r => !featuredIds.has(r.site.id)).forEach(({ site, R, dist }) => {
          const mpos = siteMapPos(site);
          if (dist <= DIVE_MAP_FIT_NM) fitBounds.extend([mpos.lat, mpos.lon]);
          plotted++;
          const dotSz = dist > DIVE_MAP_LOCAL_NM ? 10 : 14;
          const icon = L.divIcon({
            className: '',
            html: diveMapMarkerHtml(0, R.composite, dist > DIVE_MAP_LOCAL_NM ? 'dot' : 'secondary'),
            iconSize: [dotSz, dotSz], iconAnchor: [dotSz / 2, dotSz / 2]
          });
          L.marker([mpos.lat, mpos.lon], { icon, zIndexOffset: 50 })
            .bindPopup('<b>' + esc(site.name) + '</b><br><span style="font-family:var(--font-mono,monospace);font-size:12px;font-weight:500">' + fmtSiteCoordsDepth(site) + '</span><br>' + R.composite + '/100 · ' + R.stars.toFixed(1) + '\u2605<br>' + esc(R.verdict) + '<br>' + f1(dist) + ' nm' + (site.cdfgAppendix ? '<br>CDFG appendix' : ''))
            .addTo(diveSpotLayer);
        });

        applyDiveMapView(fitBounds, lat, lon);
        if (window.BoatMpa?.ensureOverlay) window.BoatMpa.ensureOverlay(diveMap, 'divePlan');
        const leg = $('divePlanMapLegend');
        const mpaLeg = window.BoatMpa?.legendHtml ? window.BoatMpa.legendHtml() : '';
        const localN = lastAllRanked.filter(r => r.dist <= DIVE_MAP_FIT_NM).length;
        const localGroups = new Set(
          lastAllRanked.filter(r => r.dist <= DIVE_MAP_FIT_NM).map(r => r.site.featureGroup || r.site.id)
        ).size;
        if (leg) leg.innerHTML =
          '<span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#3dff9a;vertical-align:middle;margin-right:3px"></i> Great</span>' +
          '<span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#3dd6f5;vertical-align:middle;margin-right:3px"></i> Good</span>' +
          '<span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ffb020;vertical-align:middle;margin-right:3px"></i> Fair</span>' +
          '<span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff6644;vertical-align:middle;margin-right:3px"></i> Poor</span>' +
          '<span># = top ' + Math.min(DIVE_MAP_MAX_MARKERS, lastRanked.length) + ' spots · ' + plotted + ' pins · ~' + DIVE_MAP_FIT_NM + ' nm (' + localGroups + ' spots / ' + localN + ' pins)</span>' +
          mpaLeg;
      });
    };
    render(0);
  }

  function invalidatePlanMap() {
    if (!divePlanVisible()) return;
    const pos = defaultPos();
    if (lastRanked.length) renderDivePlanMap(lastRanked, lastAllRanked, pos.lat, pos.lon);
    else ensureDivePlanMap();
  }

  function syncRecommendations(marine, wx, tides) {
    const when = readDiveWhen() || new Date();
    const pos = defaultPos();
    renderRecommendations(when, marine || (getMarine && getMarine()), wx || (getWx && getWx()), tides || (getTides && getTides()), pos.lat, pos.lon);
  }

  function setBanner(msg, isErr) {
    const b = $('diveBanner');
    if (!b) return;
    if (!msg) { b.hidden = true; return; }
    b.hidden = false;
    b.className = 'banner' + (isErr ? ' err' : '');
    b.innerHTML = msg;
  }

  function renderSiteSelect() {
    const sel = $('diveSiteSel');
    if (!sel) return;
    let html = '';
    for (const s of nearest) {
      html += '<option value="' + s.id + '">' + esc(groupListName(s)) + ' \u00b7 ' + f1(s.dist) + ' nm \u00b7 ' + fmtSiteCoordsDepth(s) + '</option>';
    }
    sel.innerHTML = html;
    if (current) sel.value = current.id;
  }

  function updateNearestList(lat, lon, keepId) {
    nearest = nearestSites(lat, lon, SITE_PICKER_POOL, DIVE_MAP_FIT_NM);
    if (keepId && nearest.some(s => s.id === keepId)) {
      current = siteById(keepId);
    } else {
      current = nearest[0] || DIVE_SITES[0];
    }
    renderSiteSelect();
  }

  function renderAt(whenArg) {
    if (!current || !S) return;
    const now = new Date();
    let when = whenArg instanceof Date ? whenArg : (whenArg ? new Date(whenArg) : (readDiveWhen() || now));
    if (!isFinite(+when)) when = now;
    const b = dataBounds();
    const msgs = [];
    if (b) {
      const cl = clamp(+when, b.lo, b.hi);
      if (Math.abs(cl - +when) > 30 * 60e3) {
        msgs.push('<strong>Out of range.</strong> Loaded data covers ' + fmtFull(new Date(b.lo)) + ' through ' + fmtFull(new Date(b.hi)) + ' — showing the nearest available time instead.');
        when = new Date(cl);
      }
    }
    const m = snapshotAt(current, when);
    const R = scoreDive(current, m);
    lastM = m; lastR = R;
    evalWhen = m.isNow ? null : new Date(+when);
    const aheadH = (+when - +now) / HR;
    if (aheadH > 120) msgs.push('<strong>5+ days out:</strong> wave and weather models have little skill this far ahead. Treat this as a rough tendency, not a forecast — re-check within 3 days of the dive.');
    else if (aheadH > 72) msgs.push('<strong>3\u20135 days out:</strong> useful for planning, but model accuracy drops at this range. Verify as the day approaches.');
    if (aheadH < -0.75) msgs.push('Showing a <strong>hindcast</strong> — the model\u2019s reconstruction of past conditions.');
    if ((m.ok.marine || m.ok.wx) && !m.ok.tides) msgs.push('Tide predictions don\u2019t cover this time — rating computed without the tide factor.');
    setBanner(msgs.join('<br>'));
    renderHero(current, m, R);
    renderFactors(R.factors);
    renderTrends(current, when);
    renderTideCurve(when);
    renderSiteGuide();
    renderSiteIntel(current, m);
    fetchHabAlert(current.lat, current.lon).then(h => renderHabBanner(current, h));
    const upd = $('diveUpdated');
    if (upd) upd.textContent = 'updated ' + fmtTime(new Date());
  }

  async function loadAll(site, force) {
    if (!site || !fetchJSON) return;
    setBanner('');
    const upd = $('diveUpdated');
    if (upd) upd.textContent = 'loading\u2026';
    const fac = $('diveFactors');
    if (fac) fac.innerHTML = '<div class="skel">Fetching marine model, weather, and tide data\u2026</div>';
    const out = $('diveOutlook');
    if (out) out.innerHTML = '<div class="skel">Computing outlook\u2026</div>';
    curStation = site.station ? (STATIONS.find(s => s.id === site.station) || nearestStation(site.lat, site.lon)) : nearestStation(site.lat, site.lon);

    let marine = null, wx = null, tides = null, staleNote = '';
    if (!force) {
      try {
        const cached = await storeGet('boatDiveCache:' + site.id);
        if (cached) {
          const c = typeof cached === 'string' ? JSON.parse(cached) : cached;
          if (c && (c.marine || c.wx || c.tides)) {
            S = parseSeries(c.marine, c.wx, c.tides);
            if (S.ok.marine || S.ok.wx) staleNote = 'Showing cached data from ' + new Date(c.at).toLocaleString() + '. Tap refresh for live data.<br>';
          }
        }
      } catch (e) { /* ignore */ }
    }

    const [mr, wr, tr] = await Promise.allSettled([
      fetchJSON(marineURL(site)), fetchJSON(weatherURL(site)), fetchJSON(tideURL(curStation.id))
    ]);
    marine = mr.status === 'fulfilled' ? mr.value : null;
    wx = wr.status === 'fulfilled' ? wr.value : null;
    tides = tr.status === 'fulfilled' ? tr.value : null;

    if (marine || wx || tides) {
      S = parseSeries(marine, wx, tides);
      await storeSet('boatDiveCache:' + site.id, JSON.stringify({ at: Date.now(), marine, wx, tides }));
      staleNote = '';
    } else if (!S || (!S.ok.marine && !S.ok.wx)) {
      setBanner('<strong>Couldn\u2019t reach the data services.</strong> Check your connection.', true);
      if (fac) fac.innerHTML = '';
      if (out) out.innerHTML = '';
      if (upd) upd.textContent = '';
      renderSources(site, curStation);
      return;
    }

    loaded.add(site.id);
    renderSources(site, curStation);
    renderOutlook(site);
    fetchHabAlert(site.lat, site.lon).then(h => renderHabBanner(site, h));
    if (!userPlanWhen) setDiveWhen(new Date());
    const target = evalWhen || readDiveWhen() || userPlanWhen || new Date();
    renderAt(target);
    syncRecommendations(getMarine && getMarine(), getWx && getWx(), getTides && getTides());
    if (staleNote) setBanner(staleNote + ($('diveBanner') && !$('diveBanner').hidden ? $('diveBanner').innerHTML : ''));
  }

  function init(opts) {
    getPos = opts.getPos;
    fetchJSON = opts.fetchJSON;
    linkHtml = opts.linkHtml;
    store = opts.store;
    getMarine = opts.getMarine;
    getWx = opts.getWx;
    getTides = opts.getTides;
    loadLeafletFn = opts.loadLeaflet;
    openPlanCalendar = opts.openPlanCalendar;
    planMapBaseLayerFn = opts.planMapBaseLayer;
    addCoastOverlayFn = opts.addCoastOverlay;
    isOnLandFn = opts.isOnLand;
    metersEastOfShorelineFn = opts.metersEastOfShoreline;
    localEastMFn = opts.localEastM;
    injectStyles();
    validateDiveSiteCoords();

    if (!userPlanWhen) setDiveWhen(new Date());
    else syncDiveDateBtn();
    const te = $('divePlanTime');
    if (te && !te.value && userPlanWhen) te.value = toLocalTime(new Date());

    function syncDiveDateBtn() {
      const btn = $('divePlanDateBtn');
      if (btn && userPlanWhen) btn.textContent = formatPlanDate(userPlanWhen);
    }

    if (te) te.addEventListener('change', applyPlanWhenChange);
    const btnDate = $('divePlanDateBtn');
    if (btnDate) btnDate.addEventListener('click', openDiveDatePicker);
    const btnCal = $('diveBtnCal');
    if (btnCal) btnCal.addEventListener('click', openDiveDatePicker);

    const pos = defaultPos();
    updateNearestList(pos.lat, pos.lon, null);

    const sel = $('diveSiteSel');
    if (sel) {
      sel.addEventListener('change', e => {
        current = siteById(e.target.value);
        evalWhen = null;
        renderDiveBriefing(current);
        loadAll(current);
      });
    }
    const recs = $('diveRecs');
    if (recs) {
      recs.addEventListener('click', e => {
        const row = e.target.closest('.dive-rec');
        if (!row || !row.dataset.siteId) return;
        current = siteById(row.dataset.siteId);
        renderSiteSelect();
        loadAll(current);
        syncRecommendations(getMarine && getMarine(), getWx && getWx(), getTides && getTides());
      });
      recs.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const row = e.target.closest('.dive-rec');
        if (!row) return;
        e.preventDefault();
        row.click();
      });
    }
    const btnRef = $('diveBtnRefresh');
    if (btnRef) btnRef.addEventListener('click', () => loadAll(current, true));
    const btnNow = $('diveBtnNow');
    if (btnNow) btnNow.addEventListener('click', () => {
      setDiveWhen(new Date());
      evalWhen = readDiveWhen();
      if (S) renderAt(evalWhen);
      syncRecommendations(getMarine && getMarine(), getWx && getWx(), getTides && getTides());
    });
    const outlook = $('diveOutlook');
    if (outlook) outlook.addEventListener('click', e => {
      const btn = e.target.closest('.oslot');
      if (!btn || !btn.dataset.ts) return;
      const d = new Date(+btn.dataset.ts);
      setDiveWhen(d);
      applyPlanWhenChange();
    });

    const hero = $('diveHero');
    if (hero && !hero.innerHTML.trim()) hero.innerHTML = '<div class="skel">Select a site — data loads when you open this tab.</div>';
  }

  function onGps(posObj) {
    const lat = posObj && (posObj.lat != null ? posObj.lat : posObj.coords && posObj.coords.latitude);
    const lon = posObj && (posObj.lon != null ? posObj.lon : posObj.coords && posObj.coords.longitude);
    if (!isFinite(lat) || !isFinite(lon)) return;
    updateNearestList(lat, lon, current ? current.id : null);
    if (lastRanked.length) invalidatePlanMap();
    if (current && loaded.has(current.id) && S) renderAt(evalWhen || readDiveWhen() || new Date());
  }

  function onTabShow(marine, wx, tides) {
    if (!current) {
      const pos = defaultPos();
      updateNearestList(pos.lat, pos.lon, null);
    }
    const m = marine || (getMarine && getMarine());
    const w = wx || (getWx && getWx());
    const t = tides || (getTides && getTides());
    const de = $('divePlanDateBtn');
    if (!userPlanWhen) setDiveWhen(new Date());
    const when = readDiveWhen() || userPlanWhen || new Date();
    const pos = defaultPos();
    renderRecommendations(when, m, w, t, pos.lat, pos.lon);
    setTimeout(() => invalidatePlanMap(), 80);
    if (!current) return;
    if (!loaded.has(current.id) || !S) loadAll(current);
    else renderAt(evalWhen || readDiveWhen() || when);
  }

  function refresh() {
    if (current) loadAll(current, true);
  }

  window.BoatDive = {
    init,
    onGps,
    onTabShow,
    refresh,
    syncRecommendations,
    renderRecommendations,
    rankSitesAt,
    invalidatePlanMap,
    ensurePlanMap: invalidatePlanMap,
    nearestSites,
    parseSeries,
    snapshotAt,
    scoreDive,
    renderHero,
    renderFactors,
    renderOutlook,
    renderTideCurve,
    renderSources,
    renderSiteGuide,
    renderSiteIntel,
    renderTrends,
    renderHabBanner,
    fetchHabAlert,
    recommendHeadings,
    siteIntel,
    renderDiveBriefing,
    refreshDiveSeafloor,
    currentSite: () => current,
    sparkSVG,
    stars,
    DIVE_SITES,
    STATIONS,
    FEATURE_GROUP_NM,
    featureGroupCount: () => FEATURE_GROUP_COUNT,
    groupListName,
    featureBaseKey
  };
})();

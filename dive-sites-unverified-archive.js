/* Archived DIVE_SITES body prior to multi-source verification pass 2026-07-27.
 * DO NOT re-enable for map display without multi-source GPS confirmation.
 * See verified-water-pins.json
 */
module.exports = `

    /* —— King Harbor / Redondo / South Bay — PADI, OpenDiveSites, southcoastdivers.com —— */
    { id: 'veterans', name: 'Veterans Park — Redondo Beach', lat: 33.8383326, lon: -118.4268816, face: 250, depth: 40, cam: 'https://www.youtube.com/watch?v=TuVOKRP7IBA', camLabel: 'Veterans Park dive cam' }, // CDFG Redondo reef A water target
    { id: 'kingharbor', name: 'King Harbor — Redondo', lat: 33.8347222, lon: -118.428, face: 240, depth: 35 }, // harbor mouth water
    { id: 'torrance', name: 'Torrance Beach / Rat Beach', lat: 33.8090, lon: -118.3995, face: 245, depth: 25 }, // water kelp W of RAT Beach (N PV); not Flat Rock cluster
    { id: 'hermosa', name: 'Hermosa Beach Pier', lat: 33.8541667, lon: -118.425, face: 250, depth: 30 }, // CDFG Hermosa Beach 'A' 33°51'15N 118°24'50W nudged W off beach model land
    { id: 'malaga', name: 'Malaga Cove — Palos Verdes', lat: 33.8042, lon: -118.4025, face: 265, depth: 25 }, // water ~650 m W of Via Arroyo entry (33.8041,-118.3945); OpenDiveSites entry on land
    /* —— Palos Verdes coves & reefs — USC Sea Grant, diver.net, ScubaBoard —— */
    { id: 'abalone', name: 'Abalone Cove — Palos Verdes', lat: 33.7495, lon: -118.4165, face: 200, depth: 30 }, // water target, kelp west of Abalone Cove entry
    { id: 'honeymoon', name: 'Honeymoon Cove — Palos Verdes', lat: 33.7641, lon: -118.4268667, face: 220, depth: 25 }, // water target, kelp west of Paseo Del Mar entry; diver.net Merry's Reef 33°45.846N 118°25.612W
    { id: 'ptvicente', name: 'Point Vicente — Palos Verdes', lat: 33.7388, lon: -118.4149167, face: 225, depth: 40 }, // diver.net 33°44.328N 118°24.895W pinnacles, nudged seaward
    { id: 'pvcaves', name: 'PV Caves — Pt Vicente', lat: 33.7385333, lon: -118.4149167, face: 225, depth: 30 }, // water target, kelp west of PV Caves entry
    { id: 'sacred', name: 'Sacred Cove — Palos Verdes', lat: 33.7518, lon: -118.4155, face: 210, depth: 35 }, // USC Sea Grant #22 kelp ~200m W offshore (not bluff/trailhead @ -118.370333)
    { id: 'rockypoint', name: 'Rocky Point — Palos Verdes', lat: 33.7705, lon: -118.4353333, face: 220, depth: 35 }, // USC Sea Grant Rocky Pt Kelp 33°46.23N 118°26.12W
    { id: 'portuguese', name: 'Portuguese Bend — Palos Verdes', lat: 33.7345, lon: -118.4168, face: 220, depth: 30 }, // USC Sea Grant #23 pushed seaward to kelp
    { id: 'lunada', name: 'Lunada Bay — Palos Verdes', lat: 33.7683972, lon: -118.4273943, face: 230, depth: 30 }, // water target, kelp west of Lunada Bay entry
    /* —— San Pedro / PV offshore (boat) — wreck charts, southcoastdivers.com —— */
    { id: 'whitepoint', name: 'White Point Park — San Pedro', lat: 33.7139958, lon: -118.3625655, face: 200, depth: 30 }, // water target, kelp west of White Point entry (scdiving.com 33.7187,-118.3229)
    { id: 'golfball', name: 'Golf Ball Reef — Fermin Point', lat: 33.80825, lon: -118.4154833, face: 180, depth: 40, boat: true }, // diver.net 33°48.495N 118°24.569W (off Haggerty's kelp reef)
    { id: 'yellowtail', name: 'Yellowtail Reef — San Pedro', lat: 33.7245754, lon: -118.3954375, face: 190, depth: 55, boat: true }, // water target offshore Fermin Point kelp
    { id: 'horseshoe', name: 'Horseshoe Kelp — San Pedro Bay', lat: 33.7471836, lon: -118.418, face: 270, depth: 45, boat: true }, // outer Horseshoe kelp paddies, seaward of PV bluff
    { id: 'barge287', name: 'Barge 287 — San Pedro Bay', lat: 33.8298824, lon: -118.4128695, face: 200, depth: 65, boat: true }, // CDFG Redondo Beach 'B' barge reef 33°50'18N 118°24'33W (southcoastdivers.com)
    { id: 'palawan', name: 'SS Palawan — San Pedro', lat: 33.823611, lon: -118.4190523, face: 190, depth: 120, boat: true }, // southcoastdivers.com/CDFG 33°49'25N 118°24'53W
    { id: 'ub88', name: 'UB-88 Submarine — Catalina Channel', lat: 33.603533, lon: -118.234650, face: 270, depth: 190, boat: true },
    /* —— Catalina Island — CDFW MPA, OpenWaterAtlas, California Diving News —— */
    { id: 'casino', name: 'Casino Point — Avalon', lat: 33.3491, lon: -118.32466, face: 45, depth: 40 },
    { id: 'lovers', name: "Lover's Cove — Avalon", lat: 33.343749, lon: -118.320185, face: 60, depth: 30 },
    { id: 'descanso', name: 'Descanso Beach — Avalon', lat: 33.3518, lon: -118.3255, face: 55, depth: 30 }, // Descanso Bay kelp N of Casino; not Lover's Cove lat
    { id: 'bluecavern', name: 'Blue Cavern — Catalina UW Park', lat: 33.342947, lon: -118.319595, face: 45, depth: 85, boat: true },
    { id: 'eaglereef', name: 'Eagle Reef — Avalon', lat: 33.353255, lon: -118.328873, face: 90, depth: 55, boat: true },
    { id: 'wreckavalon', name: 'Star of Scotland — Avalon Wreck', lat: 33.339807, lon: -118.313854, face: 90, depth: 50, boat: true },
    { id: 'shiprock', name: 'Ship Rock — Catalina (Isthmus)', lat: 33.4631, lon: -118.4907, face: 90, depth: 50, boat: true },
    { id: 'longpoint', name: 'Long Point — Catalina W', lat: 33.405767, lon: -118.366667, face: 90, depth: 50, boat: true },
    { id: 'henrock', name: 'Hen Rock — Catalina', lat: 33.3625, lon: -118.325, face: 90, depth: 45, boat: true },
    { id: 'arrowpoint', name: 'Arrow Point — Catalina', lat: 33.378611, lon: -118.341667, face: 120, depth: 40 },
    { id: 'littleharbor', name: 'Little Harbor — Catalina', lat: 33.381934, lon: -118.358252, face: 150, depth: 35 },
    { id: 'isthmus', name: 'Isthmus Reef — Two Harbors', lat: 33.446667, lon: -118.488333, face: 180, depth: 40 },
    { id: 'emeraldbay', name: 'Emerald Bay — Catalina', lat: 33.460833, lon: -118.491389, face: 180, depth: 30 },
    { id: 'benweston', name: 'Ben Weston Beach — Catalina backside', lat: 33.326667, lon: -118.5175, face: 270, depth: 40, boat: true, regional: true },
    { id: 'farnsworth', name: 'Farnsworth Bank — Catalina', lat: 33.34, lon: -118.519167, face: 270, depth: 65, boat: true, regional: true },
    /* —— Malibu (regional) — southcoastdivers.com, OpenDiveSites —— */
    { id: 'leo', name: 'Leo Carrillo — Malibu', lat: 34.0445, lon: -118.93383333333, face: 205, depth: 25, regional: true }, // USC Sea Grant 34°02.67N 118°56.03W
    { id: 'ptdume', name: 'Point Dume — Malibu', lat: 33.992, lon: -118.812, face: 190, depth: 30, regional: true }, // water target, ~100 m offshore Point Dume kelp
    { id: 'paradise', name: 'Paradise Cove — Malibu', lat: 34.0118824, lon: -118.7952107, face: 200, depth: 25, regional: true }, // USC Sea Grant 34°01.22N 118°47.19W offshore kelp
    /* —— Orange County (regional) — OpenWaterAtlas, PADI, thescubadirectory.com —— */
    { id: 'shaws', name: "Shaw's Cove — Laguna Beach", lat: 33.5435, lon: -117.8025, face: 180, depth: 30, regional: true },
    { id: 'heisler', name: 'Heisler Park — Laguna Beach', lat: 33.5428, lon: -117.7945, face: 180, depth: 25, regional: true },
    { id: 'crystal', name: 'Crystal Cove — Newport Coast', lat: 33.5718, lon: -117.8495, face: 200, depth: 30, regional: true },
    { id: 'crescent', name: 'Crescent Bay — Laguna Beach', lat: 33.5458, lon: -117.8078, face: 180, depth: 25, regional: true },
    { id: 'newport', name: 'Newport Pier area', lat: 33.605833, lon: -117.932611, face: 200, depth: 25, regional: true },
    /* —— San Diego (regional) — OpenWaterAtlas, NOAA wreck charts —— */
    { id: 'lajolla', name: 'La Jolla Cove — San Diego', lat: 32.850833, lon: -117.272778, face: 310, depth: 25, regional: true },
    { id: 'lajollashores', name: 'La Jolla Shores — San Diego', lat: 32.858056, lon: -117.2575, face: 280, depth: 30, regional: true },
    { id: 'wreckalley', name: 'Wreck Alley — San Diego', lat: 32.764167, lon: -117.268333, face: 280, depth: 80, boat: true, regional: true },
    /* —— Channel Islands (regional, boat) — southcoastdivers.com, CDFW —— */
    { id: 'anacapa', name: 'Landing Cove — Anacapa Island', lat: 34.016667, lon: -119.362222, face: 90, depth: 40, regional: true },
    { id: 'potatoharbor', name: 'Potato Harbor — Anacapa N', lat: 34.016111, lon: -119.355833, face: 90, depth: 30, regional: true },
    { id: 'scorpion', name: 'Scorpion Anchorage — Santa Cruz Is.', lat: 34.050082, lon: -119.556222, face: 120, depth: 35, boat: true, regional: true },
    { id: 'santabarbara', name: 'Webster Point — Santa Barbara Is.', lat: 33.486667, lon: -119.0125, face: 180, depth: 40, boat: true, regional: true },
    /* —— Added SoCal sites — shore guides, wreck charts, OpenWaterAtlas —— */
    { id: 'haggerty', name: "Haggerty's / Bluff Cove — PV", lat: 33.8028, lon: -118.4058, face: 250, depth: 35 }, // Haggerty's kelp SW of Malaga; Crane bearing 33°48.296N 118°24.540W offshore
    { id: 'cabrillo', name: 'Cabrillo Beach — San Pedro', lat: 33.7125754, lon: -118.3629367, face: 200, depth: 25 },
    { id: 'neptune', name: "Neptune's Cove — Palos Verdes (Golden Cove)", lat: 33.7512667, lon: -118.4178333, face: 210, depth: 28 }, // diver.net Underwater Arch 33°45.076N 118°25.070W; Calle Entradero
    { id: 'littleflower', name: 'Little Flower Cove — PV', lat: 33.7545883, lon: -118.4178333, face: 215, depth: 28 },
    { id: 'manhattan', name: 'Manhattan Beach Reef', lat: 33.8844444, lon: -118.445, face: 250, depth: 25 },
    { id: 'pipeline', name: 'Pipeline Wreck — PV', lat: 33.7147178, lon: -118.3682872, face: 190, depth: 55, boat: true },
    { id: 'valiant', name: 'Valiant Wreck — Descanso Bay / Avalon', lat: 33.350856, lon: -118.325962, face: 55, depth: 90, boat: true }, // cawreckdivers / DiveJourney: yacht off Descanso Beach Avalon (NOT San Pedro / PV)
    { id: 'wreck140', name: 'PC-140 Wreck — San Pedro', lat: 33.7191667, lon: -118.3683333, face: 200, depth: 55, boat: true },
    { id: 'eureka', name: 'Eureka oil platform — San Pedro Bay', lat: 33.5638333, lon: -118.1166667, face: 270, depth: 80, boat: true },
    { id: 'birdrock', name: 'Bird Rock — Catalina', lat: 33.4503, lon: -118.4856, face: 180, depth: 45, boat: true },
    { id: 'catharbor', name: 'Cat Harbor — Catalina', lat: 33.441667, lon: -118.492955, face: 180, depth: 40, boat: true },
    { id: 'danapoint', name: 'Dana Point Headlands', lat: 33.4597220, lon: -117.6980560, face: 180, depth: 30, regional: true },
    { id: 'saltcreek', name: 'Salt Creek — Dana Point', lat: 33.473, lon: -117.724, face: 200, depth: 35, regional: true },
    { id: 'nichols', name: 'Nichols Canyon — Malibu', lat: 34.0347220, lon: -118.9047220, face: 200, depth: 30, regional: true },
    { id: 'sanclemente', name: 'San Clemente Pier — OC', lat: 33.4261110, lon: -117.6288333, face: 190, depth: 25, regional: true },
    /* —— PV / South Bay additions — diver.net, USC Sea Grant, CDFG —— */
    { id: 'merrysreef', name: "Merry's Reef — Honeymoon Cove offshore", lat: 33.7641, lon: -118.4268667, face: 220, depth: 55, boat: true }, // diver.net 33°45.846N 118°25.612W
    { id: 'resortpoint', name: 'Resort Point Wall — PV', lat: 33.76455, lon: -118.428, face: 225, depth: 70, boat: true }, // diver.net 33°45.873N 118°25.680W
    { id: 'christmastree', name: 'Christmas Tree Cove — PV', lat: 33.761, lon: -118.422, face: 215, depth: 30 }, // USC Sea Grant 33.761,-118.419 nudged W off bluff
    { id: 'marguerite', name: 'Marguerite Cove — PV', lat: 33.757, lon: -118.4185, face: 210, depth: 28 }, // USC Sea Grant 33.757,-118.418
    { id: 'hawthorne', name: 'Hawthorne Reef (Barberpole) — PV', lat: 33.7469, lon: -118.4205667, face: 225, depth: 85, boat: true }, // diver.net 33°44.814N 118°25.234W
    { id: 'halfway', name: 'Halfway Reef — PV', lat: 33.76265, lon: -118.4255667, face: 220, depth: 72, boat: true }, // diver.net 33°45.759N 118°25.534W
    { id: 'kevinsreef', name: "Kevin's Reef — Christmas Tree Cove offshore", lat: 33.7616833, lon: -118.4256167, face: 215, depth: 75, boat: true }, // diver.net 33°45.701N 118°25.537W
    { id: 'thecrane', name: "The Crane — Haggerty's offshore", lat: 33.8049333, lon: -118.409, face: 250, depth: 45, boat: true }, // diver.net 33°48.296N 118°24.540W
    { id: 'dominator', name: 'SS Dominator Wreck — Rocky Point', lat: 33.7735, lon: -118.431, face: 230, depth: 25 }, // 33°46'26N 118°25'42W nudged W to clear bluff model
    { id: 'wormreef', name: 'Worm Reef — Rocky Point offshore', lat: 33.7711, lon: -118.4343, face: 220, depth: 45, boat: true }, // diver.net 33°46.266N 118°26.058W
    { id: 'flatrock', name: 'Flat Rock — PV offshore kelp', lat: 33.774, lon: -118.4315, face: 250, depth: 40, boat: true },
    { id: 'oldmarineland', name: 'Old Marineland Cove — PV', lat: 33.7325, lon: -118.4175, face: 200, depth: 30 }, // USC Sea Grant 33.737,-118.395
    { id: 'kaplancove', name: 'Kaplan Cove — Pt Vicente MPA', lat: 33.7378333, lon: -118.4115846, face: 225, depth: 35 }, // USC Sea Grant 33.737,-118.401
    { id: 'inspiration', name: 'Inspiration Point — PV', lat: 33.7532, lon: -118.4165, face: 200, depth: 30 }, // USC Sea Grant 33.736,-118.368, pushed W
    { id: 'pvrrestoration', name: 'Palos Verdes Restoration Reef — Module 5C', lat: 33.7204718, lon: -118.352473, face: 190, depth: 55, boat: true }, // Frontiers FMARS 2022 as-built
    { id: 'olympic2', name: 'Olympic II Wreck — Horseshoe Kelp', lat: 33.7058333, lon: -118.3688333, face: 270, depth: 100, boat: true }, // CA Diving News / Horseshoe kelp bed
    { id: 'redondoreefa', name: "Redondo Beach Artificial Reef A", lat: 33.8383326, lon: -118.4268816, face: 200, depth: 72, boat: true }, // CDFG 33°50'18N 118°24'50W
    { id: 'hermosareefb', name: 'Hermosa Beach Artificial Reef B', lat: 33.8544444, lon: -118.4250556, face: 250, depth: 60, boat: true }, // CDFG 33°51'16N 118°24'47W
    { id: 'mdreyreef', name: 'Marina del Rey Artificial Reef', lat: 33.9683333, lon: -118.5063889, face: 250, depth: 65, boat: true }, // CDFG 33°58'06N 118°29'11W
    /* —— Catalina additions —— */
    { id: 'biggeiger', name: 'Big Geiger Cove — Catalina', lat: 33.461, lon: -118.5171667, face: 90, depth: 70, boat: true },
    { id: 'littlegeiger', name: 'Little Geiger Cove — Catalina', lat: 33.4571333, lon: -118.5118667, face: 90, depth: 50, boat: true },
    { id: 'diosadelmar', name: 'Diosa del Mar — Ship Rock area', lat: 33.4627700, lon: -118.4919250, face: 90, depth: 25, boat: true }, // 33°27'46N 118°29'31W
    { id: 'rockquarry', name: 'Rock Quarry — Catalina NE', lat: 33.3133333, lon: -118.3017167, face: 45, depth: 40, boat: true },
    { id: 'piratescove', name: 'Pirates Cove — Long Point Catalina', lat: 33.4058333, lon: -118.35, face: 90, depth: 45, boat: true },
    { id: 'goatharbor', name: 'Goat Harbor — Catalina', lat: 33.4083333, lon: -118.3533333, face: 90, depth: 35, boat: true },
    { id: 'howlands', name: "Howland's Landing — Catalina W", lat: 33.4583333, lon: -118.5033333, face: 90, depth: 40, boat: true },
    { id: 'seafangrotto', name: 'Sea Fan Grotto — Catalina', lat: 33.444, lon: -118.4742833, face: 90, depth: 55, boat: true },
    { id: 'midnighthour', name: 'F/V Midnight Hour — Catalina West End', lat: 33.4666667, lon: -118.625, face: 270, depth: 100, boat: true, regional: true }, // NOAA 33°28.00N 118°37.50W
    { id: 'suejac', name: 'SueJac Wreck — Avalon UW Park E', lat: 33.3435, lon: -118.319, face: 90, depth: 70, boat: true },
    /* —— Malibu / regional artificial reefs — CDFG —— */
    { id: 'smbayreef', name: 'Santa Monica Bay Artificial Reef', lat: 34.0130556, lon: -118.5725000, face: 270, depth: 65, boat: true, regional: true }, // CDFG 34°00'47N 118°32'33W
    { id: 'topanga', name: 'Topanga Artificial Reef — Malibu', lat: 34.0272222, lon: -118.5625000, face: 200, depth: 55, boat: true, regional: true }, // CDFG 34°01'38N 118°31'57W
    { id: 'malibureef', name: 'Malibu Artificial Reef A', lat: 34.0300000, lon: -118.6597222, face: 205, depth: 60, boat: true, regional: true }, // CDFG 34°01'48N 118°38'59W
    { id: 'treasureisland', name: 'Treasure Island / Montage — Laguna', lat: 33.5083333, lon: -117.7583333, face: 180, depth: 30, regional: true },
    { id: 'thousandsteps', name: 'Thousand Steps — South Laguna', lat: 33.5166667, lon: -117.7666667, face: 180, depth: 25, regional: true },
    /* —— Expansion Jul 2026 — PV coves, Catalina, OC, wrecks —— */
    { id: 'pelicancove', name: 'Pelican Cove — Palos Verdes', lat: 33.7406107, lon: -118.4109963, face: 215, depth: 28 },
    { id: 'pvshores', name: 'Palos Verdes Shores — PV', lat: 33.77415, lon: -118.4305, face: 255, depth: 30 },
    { id: 'pvcove', name: 'Palos Verdes Cove — PV', lat: 33.7535, lon: -118.4168, face: 200, depth: 30 },
    { id: 'terranea', name: 'Terranea Cove — PV', lat: 33.7322, lon: -118.4178, face: 205, depth: 28 },
    { id: 'forrestal', name: 'Forrestal Cove — PV', lat: 33.7448, lon: -118.4168, face: 200, depth: 30 },
    { id: 'bluffcove', name: 'Bluff Cove — Palos Verdes', lat: 33.7925, lon: -118.4105, face: 250, depth: 32 }, // Bluff Cove kelp (~0.9 mi S of Malaga); not Flat Rock lat
    { id: 'wayside', name: 'Wayside Park reef — PV', lat: 33.8050, lon: -118.4030, face: 250, depth: 28 }, // Wayside / Malaga bluff access kelp, N PV
    { id: 'longpointpv', name: 'Long Point offshore kelp — PV', lat: 33.7725, lon: -118.4285, face: 225, depth: 40, boat: true },
    { id: 'ptferminoff', name: 'Point Fermin outer reef — San Pedro', lat: 33.7125754, lon: -118.3659367, face: 200, depth: 35 },
    { id: 'portugueseoff', name: 'Portuguese Point offshore kelp — PV', lat: 33.7335, lon: -118.4185, face: 210, depth: 35 },
    { id: 'sacredoff', name: 'Sacred Cove outer reef — PV', lat: 33.7512, lon: -118.4175, face: 210, depth: 40 },
    { id: 'abaloneoff', name: 'Abalone Cove outer pinnacle — PV', lat: 33.7482, lon: -118.4188, face: 200, depth: 45, boat: true },
    { id: 'lunadaoff', name: 'Lunada Bay outer reef — PV', lat: 33.7674141, lon: -118.4294252, face: 230, depth: 45, boat: true },
    { id: 'ptvicenteoff', name: 'Pt Vicente outer pinnacles — PV', lat: 33.7325, lon: -118.4195, face: 225, depth: 55, boat: true },
    { id: 'pvrestmod3', name: 'PVR Restoration Reef — Module 3', lat: 33.7194958, lon: -118.3495634, face: 190, depth: 50, boat: true },
    { id: 'pvrestmod7', name: 'PVR Restoration Reef — Module 7', lat: 33.7214958, lon: -118.3545626, face: 190, depth: 52, boat: true },
    { id: 'rpvoffshore', name: 'RPV offshore kelp bar — PV', lat: 33.773, lon: -118.4315, face: 250, depth: 38, boat: true },
    { id: 'littlefloweroff', name: 'Little Flower outer reef — PV', lat: 33.7545883, lon: -118.4208333, face: 215, depth: 38 },
    { id: 'inspirationoff', name: 'Inspiration Point offshore — PV', lat: 33.7518, lon: -118.4172, face: 200, depth: 40, boat: true },
    { id: 'malagaoff', name: 'Malaga Cove outer kelp — PV', lat: 33.8035, lon: -118.4085, face: 265, depth: 35 }, // outer kelp seaward of Malaga shore dive
    { id: 'twoharbors', name: 'Two Harbors shore — Catalina', lat: 33.441667, lon: -118.492955, face: 180, depth: 35 },
    { id: 'sharkharbor', name: 'Shark Harbor — Catalina backside', lat: 33.4826670, lon: -118.6103330, face: 270, depth: 45, boat: true, regional: true },
    { id: 'cherrycove', name: 'Cherry Cove — Catalina', lat: 33.452, lon: -118.494, face: 180, depth: 40, boat: true },
    { id: 'pebblybeach', name: 'Pebbly Beach — Catalina', lat: 33.3077704, lon: -118.3530773, face: 45, depth: 30 }, // E channel kelp offshore
    { id: 'hamiltoncove', name: 'Hamilton Cove — Catalina', lat: 33.3427413, lon: -118.319015, face: 55, depth: 25 }, // mooring kelp garden E
    { id: 'toyonbay', name: 'Toyon Bay — Catalina', lat: 33.405, lon: -118.355, face: 90, depth: 40, boat: true },
    { id: 'willowcove', name: 'Willow Cove — Catalina', lat: 33.392, lon: -118.348, face: 90, depth: 35, boat: true },
    { id: 'silvercanyon', name: 'Silver Canyon — Catalina', lat: 33.398, lon: -118.352, face: 90, depth: 45, boat: true },
    { id: 'italians', name: 'Italian Gardens — Catalina', lat: 33.3768333, lon: -118.3418333, face: 45, depth: 50, boat: true },
    { id: 'moonstone', name: 'Moonstone Beach — Catalina', lat: 33.3146187, lon: -118.3610881, face: 45, depth: 35, boat: true },
    { id: 'buttonshell', name: 'Buttonshell Beach — Catalina', lat: 33.30885, lon: -118.3535413, face: 45, depth: 30, boat: true },
    { id: 'starlight', name: 'Starlight Beach — Catalina', lat: 33.415, lon: -118.358, face: 90, depth: 35, boat: true },
    { id: 'parsons', name: "Parsons Landing — Catalina", lat: 33.468, lon: -118.508, face: 90, depth: 40, boat: true },
    { id: 'whites', name: "White's Landing — Catalina", lat: 33.455, lon: -118.498, face: 90, depth: 35, boat: true },
    { id: 'johnsons', name: "Johnson's Landing — Catalina", lat: 33.448, lon: -118.492, face: 180, depth: 35, boat: true },
    { id: 'campfox', name: 'Camp Fox — Catalina', lat: 33.449, lon: -118.491, face: 180, depth: 30 },
    { id: 'gallagher', name: 'Gallagher Beach — Catalina W', lat: 33.462, lon: -118.512, face: 90, depth: 40, boat: true },
    { id: 'churchcove', name: 'Church Cove — Catalina', lat: 33.44165, lon: -118.49425, face: 180, depth: 35, boat: true },
    { id: 'ballastpt', name: 'Ballast Point — Catalina', lat: 33.344, lon: -118.316, face: 90, depth: 45, boat: true },
    { id: 'westendkelp', name: 'West End kelp — Catalina', lat: 33.4755279, lon: -118.5833333, face: 270, depth: 50, boat: true, regional: true },
    { id: 'airportreef', name: 'West Eagle Reef — Catalina isthmus', lat: 33.4613, lon: -118.51145, face: 90, depth: 55, boat: true },
    { id: 'metropole', name: 'Metropole Shipwreck — Avalon', lat: 33.34, lon: -118.314139, face: 90, depth: 55, boat: true },
    { id: 'nautilus', name: 'Nautilus wreck — Avalon', lat: 33.341, lon: -118.314885, face: 90, depth: 60, boat: true },
    { id: 'k26', name: 'K-26 wreck — Catalina', lat: 33.345, lon: -118.318, face: 90, depth: 65, boat: true },
    { id: 'avalonouter', name: 'Avalon Outer Reef — Catalina', lat: 33.352, lon: -118.327847, face: 90, depth: 50, boat: true },
    { id: 'garibaldbay', name: 'Garibaldi Bay — Catalina UW Park', lat: 33.348, lon: -118.323, face: 45, depth: 40 },
    { id: 'isthmuscove', name: 'Isthmus Cove — Two Harbors', lat: 33.444, lon: -118.490233, face: 180, depth: 30 },
    { id: 'littleharborback', name: 'Little Harbor backside — Catalina', lat: 33.3766493, lon: -118.3539267, face: 150, depth: 40, boat: true },
    { id: 'rattlesnake', name: 'Rattlesnake Canyon — Catalina', lat: 33.41, lon: -118.36, face: 90, depth: 45, boat: true },
    { id: 'cottonwood', name: 'Cottonwood Canyon — Catalina', lat: 33.42, lon: -118.365, face: 90, depth: 40, boat: true },
    { id: 'longbeachcove', name: 'Long Beach Cove — Catalina', lat: 33.4, lon: -118.345, face: 90, depth: 35, boat: true },
    { id: 'isthmushigh', name: 'Isthmus High Spot — Catalina', lat: 33.45, lon: -118.485, face: 180, depth: 55, boat: true },
    { id: 'lionhead', name: 'Lion Head Point — Catalina', lat: 33.365, lon: -118.335, face: 90, depth: 45, boat: true },
    { id: 'chineserocks', name: 'China Point — Catalina backside', lat: 33.3233333, lon: -118.4785833, face: 90, depth: 50, boat: true },
    { id: 'sealrocks', name: 'Seal Rocks — Catalina Isthmus', lat: 33.465, lon: -118.492, face: 180, depth: 40, boat: true },
    { id: 'geigerpoint', name: 'Geiger Point — Catalina W', lat: 33.459, lon: -118.515, face: 90, depth: 55, boat: true },
    { id: 'quarrywall', name: 'Rock Quarry wall — Catalina NE', lat: 33.312, lon: -118.303, face: 45, depth: 55, boat: true },
    { id: 'quarrycove', name: 'Quarry Cove — Catalina NE', lat: 33.2984646, lon: -118.3247815, face: 45, depth: 40, boat: true },
    { id: 'farnsworthe', name: 'Farnsworth East pinnacles — Catalina', lat: 33.342, lon: -118.517, face: 270, depth: 70, boat: true, regional: true },
    { id: 'farnsworthw', name: 'Farnsworth West pinnacles — Catalina', lat: 33.338, lon: -118.521, face: 270, depth: 75, boat: true, regional: true },
    { id: 'ssacademy', name: 'FS Loop wreck — San Pedro Bay', lat: 33.6957167, lon: -118.2619572, face: 190, depth: 85, boat: true },
    { id: 'ssresper', name: 'Georgia Straits wreck — San Pedro Bay', lat: 33.6914833, lon: -118.2087, face: 190, depth: 90, boat: true },
    { id: 'pc815', name: 'PC-815 wreck — San Diego Bay', lat: 32.6316667, lon: -117.2366667, face: 200, depth: 60, boat: true },
    { id: 'elly', name: 'Elly oil platform — San Pedro Bay', lat: 33.58375, lon: -118.1293333, face: 270, depth: 80, boat: true },
    { id: 'edith', name: 'Edith oil platform — San Pedro Bay', lat: 33.59581, lon: -118.141586, face: 270, depth: 80, boat: true },
    { id: 'esther', name: 'Ellen oil platform — San Pedro Bay', lat: 33.58239, lon: -118.12912, face: 270, depth: 80, boat: true },
    { id: 'gina', name: 'Ellen oil platform — San Pedro Bay', lat: 33.58239, lon: -118.12912, face: 270, depth: 80, boat: true },
    { id: 'smpier', name: 'Santa Monica Pier reef', lat: 33.9980000, lon: -118.5420000, face: 270, depth: 25, regional: true }, // offshore SM Bay reef W of pier
    { id: 'venice', name: 'Venice Beach nearshore reef', lat: 33.9850000, lon: -118.4880000, face: 270, depth: 25, regional: true }, // ~350 m offshore W of pier
    { id: 'playadelrey', name: 'Playa del Rey reef', lat: 33.9263139, lon: -118.472, face: 250, depth: 28 }, // ~200 m offshore W of beach
    { id: 'elporto', name: 'El Porto reef — Manhattan Beach', lat: 33.885, lon: -118.445, face: 250, depth: 28 },
    { id: 'kelpfinger', name: 'Kelp Finger reef — SM Bay', lat: 33.8999997, lon: -118.453668, face: 270, depth: 45, boat: true },
    { id: 'barge272', name: 'Barge 272 — San Pedro Bay', lat: 33.6958167, lon: -118.1755333, face: 200, depth: 70, boat: true },
    { id: 'redondocanyon', name: 'Redondo Canyon wall — SM Bay', lat: 33.855, lon: -118.44, face: 270, depth: 120, boat: true },
    { id: 'sshilda', name: 'Johanna Smith wreck — San Pedro Bay', lat: 33.7319167, lon: -118.1868333, face: 270, depth: 75, boat: true },
    { id: 'woodscove', name: "Wood's Cove — Laguna Beach", lat: 33.5375, lon: -117.798, face: 180, depth: 25, regional: true },
    { id: 'diverscove', name: "Diver's Cove — Laguna Beach", lat: 33.541, lon: -117.796, face: 180, depth: 25, regional: true },
    { id: 'victoria', name: 'Victoria Beach — Laguna', lat: 33.52, lon: -117.77, face: 180, depth: 25, regional: true },
    { id: 'fishermans', name: "Fisherman's Cove — Laguna", lat: 33.546, lon: -117.805, face: 180, depth: 28, regional: true },
    { id: 'moss', name: 'Moss Point — Laguna Beach', lat: 33.549, lon: -117.808, face: 180, depth: 30, regional: true },
    { id: 'archcove', name: 'Arch Cove — Laguna Beach', lat: 33.552, lon: -117.812, face: 180, depth: 28, regional: true },
    { id: 'emeraldlaguna', name: 'Emerald Bay — Laguna (not Catalina)', lat: 33.555, lon: -117.82, face: 180, depth: 25, regional: true },
    { id: 'doheny', name: 'Doheny Beach — Dana Point', lat: 33.465, lon: -117.69, face: 180, depth: 22, regional: true },
    { id: 'babybeach', name: 'Baby Beach — Dana Point', lat: 33.462, lon: -117.695, face: 180, depth: 20, regional: true },
    { id: 'strandsoff', name: 'The Strands offshore — Dana Point', lat: 33.478, lon: -117.73, face: 200, depth: 40, regional: true },
    { id: 'tstreet', name: 'T-Street — San Clemente', lat: 33.4200000, lon: -117.6248333, face: 190, depth: 25, regional: true },
    { id: 'calafia', name: 'Calafia Beach — San Clemente', lat: 33.4150000, lon: -117.6198333, face: 190, depth: 28, regional: true },
    { id: 'riviera', name: 'Riviera — San Clemente', lat: 33.4280000, lon: -117.6348333, face: 190, depth: 25, regional: true },
    { id: 'corona', name: 'Corona del Mar — Newport', lat: 33.5915, lon: -117.8750, face: 200, depth: 25, regional: true }, // CdM State Beach Tower 5 buoy/reef ~100–150 m S of beach (not parking 33.595,-117.870)
    { id: 'newportjetty', name: 'Newport Jetty — OC', lat: 33.608, lon: -117.928, face: 200, depth: 28, regional: true },
    { id: 'anacapaeast', name: 'Anacapa East End', lat: 34.008333, lon: -119.35, face: 90, depth: 40, boat: true, regional: true },
    { id: 'anacapawest', name: 'Anacapa West End', lat: 34.02, lon: -119.375, face: 270, depth: 45, boat: true, regional: true },
    { id: 'archrock', name: 'Arch Rock — Anacapa', lat: 34.012, lon: -119.358, face: 90, depth: 35, boat: true, regional: true },
    { id: 'cathedral', name: 'Cathedral Cove — Anacapa', lat: 34.015, lon: -119.36, face: 90, depth: 40, boat: true, regional: true },
    { id: 'yellowbanks', name: 'Yellow Banks — Anacapa', lat: 34.01, lon: -119.365, face: 90, depth: 50, boat: true, regional: true },
    { id: 'smugglers', name: "Smugglers Cove — Santa Cruz Is.", lat: 34.0283318, lon: -119.6083658, face: 120, depth: 35, boat: true, regional: true },
    { id: 'painted', name: 'Painted Cave area — Santa Cruz Is.', lat: 34.055, lon: -119.57, face: 120, depth: 45, boat: true, regional: true },
    { id: 'frysharbor', name: "Fry's Harbor — Santa Cruz Is.", lat: 34.0399989, lon: -119.6096127, face: 120, depth: 35, boat: true, regional: true },
    { id: 'sanmiguel', name: 'Cuyler Harbor — San Miguel Is.', lat: 34.05, lon: -120.35, face: 270, depth: 40, boat: true, regional: true },
    { id: 'santarosa', name: 'Bechers Bay — Santa Rosa Is.', lat: 33.9883333, lon: -120.1108333, face: 270, depth: 35, boat: true, regional: true },
    { id: 'hmcsyukon', name: 'HMCS Yukon — San Diego', lat: 32.77, lon: -117.27, face: 280, depth: 100, boat: true, regional: true },
    { id: 'rubyE', name: 'Ruby E wreck — San Diego', lat: 32.768, lon: -117.272, face: 280, depth: 85, boat: true, regional: true },
    { id: 'pescadero', name: 'Pescadero — La Jolla', lat: 32.848, lon: -117.275, face: 310, depth: 30, regional: true },
    { id: 'sunsetcliffs', name: 'Sunset Cliffs — San Diego', lat: 32.715, lon: -117.255, face: 280, depth: 25, regional: true },
    { id: 'swamis', name: "Swami's — Encinitas", lat: 33.035, lon: -117.292, face: 280, depth: 30, regional: true },
    { id: 'torrey', name: 'Torrey Pines — San Diego', lat: 32.92, lon: -117.252, face: 280, depth: 30, regional: true },
    { id: 'delmar', name: 'Del Mar kelp — San Diego', lat: 32.96, lon: -117.265, face: 280, depth: 35, regional: true },
    { id: 'coronado', name: 'Coronado kelp — San Diego', lat: 32.68, lon: -117.18, face: 270, depth: 35, regional: true },
    { id: 'pointloma', name: 'Point Loma outer kelp — San Diego', lat: 32.665, lon: -117.245, face: 270, depth: 45, boat: true, regional: true },
    { id: 'imperial', name: 'Imperial Beach — San Diego', lat: 32.58, lon: -117.13, face: 270, depth: 25, regional: true }
`;

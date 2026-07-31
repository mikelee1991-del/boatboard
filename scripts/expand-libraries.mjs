import fs from 'fs';
import path from 'path';

const root = path.dirname(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));

const NEW_DIVE = [
  /* —— PV coves & offshore — USC Sea Grant, diver.net —— */
  { id: 'pelicancove', name: 'Pelican Cove — Palos Verdes', lat: 33.7406107, lon: -118.4109963, face: 215, depth: 28 },
  { id: 'pvshores', name: 'Palos Verdes Shores — PV', lat: 33.77415, lon: -118.4305, face: 255, depth: 30 },
  { id: 'pvcove', name: 'Palos Verdes Cove — PV', lat: 33.7535, lon: -118.4168, face: 200, depth: 30 },
  { id: 'terranea', name: 'Terranea Cove — PV', lat: 33.7322, lon: -118.4178, face: 205, depth: 28 },
  { id: 'forrestal', name: 'Forrestal Cove — PV', lat: 33.7448, lon: -118.4168, face: 200, depth: 30 },
  { id: 'bluffcove', name: 'Bluff Cove — Palos Verdes', lat: 33.77715, lon: -118.4225, face: 250, depth: 32 },
  { id: 'wayside', name: 'Wayside Park reef — PV', lat: 33.77722, lon: -118.4228, face: 250, depth: 28 },
  { id: 'longpointpv', name: 'Long Point offshore kelp — PV', lat: 33.7725, lon: -118.4285, face: 225, depth: 40, boat: true },
  { id: 'ptferminoff', name: 'Point Fermin outer reef — San Pedro', lat: 33.7125754, lon: -118.3659367, face: 200, depth: 35 },
  { id: 'portugueseoff', name: 'Portuguese Point offshore kelp — PV', lat: 33.7335, lon: -118.4185, face: 210, depth: 35 },
  { id: 'sacredoff', name: 'Sacred Cove outer reef — PV', lat: 33.7512, lon: -118.4175, face: 210, depth: 40 },
  { id: 'abaloneoff', name: 'Abalone Cove outer pinnacle — PV', lat: 33.7482, lon: -118.4188, face: 200, depth: 45, boat: true },
  { id: 'lunadaoff', name: 'Lunada Bay outer reef — PV', lat: 33.7674141, lon: -118.4294252, face: 230, depth: 45, boat: true },
  { id: 'ptvicenteoff', name: 'Pt Vicente outer pinnacles — PV', lat: 33.7325, lon: -118.4195, face: 225, depth: 55, boat: true },
  { id: 'pvrestmod3', name: 'PVR Restoration Reef — Module 3', lat: 33.7194958, lon: -118.3495634, face: 190, depth: 50, boat: true },
  { id: 'pvrestmod7', name: 'PVR Restoration Reef — Module 7', lat: 33.7214958, lon: -118.3545626, face: 190, depth: 52, boat: true },
  { id: 'rpvoffshore', name: 'RPV offshore kelp bar — PV', lat: 33.7734, lon: -118.4288, face: 250, depth: 38, boat: true },
  { id: 'littlefloweroff', name: 'Little Flower outer reef — PV', lat: 33.7545883, lon: -118.4208333, face: 215, depth: 38 },
  { id: 'inspirationoff', name: 'Inspiration Point offshore — PV', lat: 33.7518, lon: -118.4172, face: 200, depth: 40, boat: true },
  { id: 'malagaoff', name: 'Malaga Cove outer kelp — PV', lat: 33.8035, lon: -118.4085, face: 265, depth: 35 },
  /* —— Catalina Island — OpenWaterAtlas, CDFW, California Diving News —— */
  { id: 'twoharbors', name: 'Two Harbors shore — Catalina', lat: 33.4416670, lon: -118.4897220, face: 180, depth: 35 },
  { id: 'sharkharbor', name: 'Shark Harbor — Catalina backside', lat: 33.4826670, lon: -118.6103330, face: 270, depth: 45, boat: true, regional: true },
  { id: 'cherrycove', name: 'Cherry Cove — Catalina', lat: 33.4520000, lon: -118.4940000, face: 180, depth: 40, boat: true },
  { id: 'pebblybeach', name: 'Pebbly Beach — Catalina', lat: 33.3283330, lon: -118.3350000, face: 45, depth: 30 },
  { id: 'hamiltoncove', name: 'Hamilton Cove — Catalina', lat: 33.3383330, lon: -118.3283330, face: 55, depth: 25 },
  { id: 'toyonbay', name: 'Toyon Bay — Catalina', lat: 33.4050000, lon: -118.3550000, face: 90, depth: 40, boat: true },
  { id: 'willowcove', name: 'Willow Cove — Catalina', lat: 33.3920000, lon: -118.3480000, face: 90, depth: 35, boat: true },
  { id: 'silvercanyon', name: 'Silver Canyon — Catalina', lat: 33.3980000, lon: -118.3520000, face: 90, depth: 45, boat: true },
  { id: 'italians', name: 'Italian Gardens — Catalina', lat: 33.3500000, lon: -118.3220000, face: 45, depth: 50, boat: true },
  { id: 'moonstone', name: 'Moonstone Beach — Catalina', lat: 33.3250000, lon: -118.3320000, face: 45, depth: 35, boat: true },
  { id: 'buttonshell', name: 'Buttonshell Beach — Catalina', lat: 33.3180000, lon: -118.3280000, face: 45, depth: 30, boat: true },
  { id: 'starlight', name: 'Starlight Beach — Catalina', lat: 33.4150000, lon: -118.3580000, face: 90, depth: 35, boat: true },
  { id: 'parsons', name: "Parsons Landing — Catalina", lat: 33.4680000, lon: -118.5080000, face: 90, depth: 40, boat: true },
  { id: 'whites', name: "White's Landing — Catalina", lat: 33.4550000, lon: -118.4980000, face: 90, depth: 35, boat: true },
  { id: 'johnsons', name: "Johnson's Landing — Catalina", lat: 33.4480000, lon: -118.4920000, face: 180, depth: 35, boat: true },
  { id: 'campfox', name: 'Camp Fox — Catalina', lat: 33.4490000, lon: -118.4910000, face: 180, depth: 30 },
  { id: 'gallagher', name: 'Gallagher Beach — Catalina W', lat: 33.4620000, lon: -118.5120000, face: 90, depth: 40, boat: true },
  { id: 'churchcove', name: 'Church Cove — Catalina', lat: 33.4420000, lon: -118.4880000, face: 180, depth: 35, boat: true },
  { id: 'ballastpt', name: 'Ballast Point — Catalina', lat: 33.3440000, lon: -118.3160000, face: 90, depth: 45, boat: true },
  { id: 'westendkelp', name: 'West End kelp — Catalina', lat: 33.4700000, lon: -118.6200000, face: 270, depth: 50, boat: true, regional: true },
  { id: 'airportreef', name: 'Airport Reef — Catalina', lat: 33.4050000, lon: -118.4150000, face: 90, depth: 55, boat: true },
  { id: 'metropole', name: 'Metropole Shipwreck — Avalon', lat: 33.3400000, lon: -118.3150000, face: 90, depth: 55, boat: true },
  { id: 'nautilus', name: 'Nautilus wreck — Avalon', lat: 33.3410000, lon: -118.3165000, face: 90, depth: 60, boat: true },
  { id: 'k26', name: 'K-26 wreck — Catalina', lat: 33.3450000, lon: -118.3180000, face: 90, depth: 65, boat: true },
  { id: 'avalonouter', name: 'Avalon Outer Reef — Catalina', lat: 33.3520000, lon: -118.3300000, face: 90, depth: 50, boat: true },
  { id: 'garibaldbay', name: 'Garibaldi Bay — Catalina UW Park', lat: 33.3480000, lon: -118.3230000, face: 45, depth: 40 },
  { id: 'isthmuscove', name: 'Isthmus Cove — Two Harbors', lat: 33.4440000, lon: -118.4870000, face: 180, depth: 30 },
  { id: 'littleharborback', name: 'Little Harbor backside — Catalina', lat: 33.3780000, lon: -118.3620000, face: 150, depth: 40, boat: true },
  { id: 'rattlesnake', name: 'Rattlesnake Canyon — Catalina', lat: 33.4100000, lon: -118.3600000, face: 90, depth: 45, boat: true },
  { id: 'cottonwood', name: 'Cottonwood Canyon — Catalina', lat: 33.4200000, lon: -118.3650000, face: 90, depth: 40, boat: true },
  { id: 'longbeachcove', name: 'Long Beach Cove — Catalina', lat: 33.4000000, lon: -118.3450000, face: 90, depth: 35, boat: true },
  { id: 'isthmushigh', name: 'Isthmus High Spot — Catalina', lat: 33.4500000, lon: -118.4850000, face: 180, depth: 55, boat: true },
  { id: 'lionhead', name: 'Lion Head Point — Catalina', lat: 33.3650000, lon: -118.3350000, face: 90, depth: 45, boat: true },
  { id: 'chineserocks', name: 'Chinese Rocks — Catalina', lat: 33.4300000, lon: -118.4750000, face: 90, depth: 50, boat: true },
  { id: 'sealrocks', name: 'Seal Rocks — Catalina Isthmus', lat: 33.4650000, lon: -118.4920000, face: 180, depth: 40, boat: true },
  { id: 'geigerpoint', name: 'Geiger Point — Catalina W', lat: 33.4590000, lon: -118.5150000, face: 90, depth: 55, boat: true },
  { id: 'quarrywall', name: 'Rock Quarry wall — Catalina NE', lat: 33.3120000, lon: -118.2980000, face: 45, depth: 55, boat: true },
  { id: 'quarrycove', name: 'Quarry Cove — Catalina NE', lat: 33.3150000, lon: -118.3000000, face: 45, depth: 40, boat: true },
  { id: 'farnsworthe', name: 'Farnsworth East pinnacles — Catalina', lat: 33.3420000, lon: -118.5170000, face: 270, depth: 70, boat: true, regional: true },
  { id: 'farnsworthw', name: 'Farnsworth West pinnacles — Catalina', lat: 33.3380000, lon: -118.5210000, face: 270, depth: 75, boat: true, regional: true },
  /* —— LA / South Bay wrecks & reefs —— */
  { id: 'ssacademy', name: 'SS Academy wreck — San Pedro Bay', lat: 33.7500000, lon: -118.4000000, face: 190, depth: 85, boat: true },
  { id: 'ssresper', name: 'SS Resper wreck — San Pedro Bay', lat: 33.7450000, lon: -118.3950000, face: 190, depth: 90, boat: true },
  { id: 'pc815', name: 'PC-815 wreck — San Pedro', lat: 33.7280000, lon: -118.2850000, face: 200, depth: 60, boat: true },
  { id: 'elly', name: 'Elly oil platform — SM Bay', lat: 33.8650000, lon: -118.4200000, face: 270, depth: 80, boat: true },
  { id: 'edith', name: 'Edith oil platform — SM Bay', lat: 33.8600000, lon: -118.4150000, face: 270, depth: 80, boat: true },
  { id: 'esther', name: 'Esther oil platform — SM Bay', lat: 33.8550000, lon: -118.4100000, face: 270, depth: 80, boat: true },
  { id: 'gina', name: 'Gina oil platform — SM Bay', lat: 33.8500000, lon: -118.4050000, face: 270, depth: 80, boat: true },
  { id: 'smpier', name: 'Santa Monica Pier reef', lat: 33.9980000, lon: -118.4980000, face: 270, depth: 25, regional: true },
  { id: 'venice', name: 'Venice Beach nearshore reef', lat: 33.9850000, lon: -118.4700000, face: 270, depth: 25, regional: true },
  { id: 'playadelrey', name: 'Playa del Rey reef', lat: 33.9600000, lon: -118.4500000, face: 250, depth: 28 },
  { id: 'elporto', name: 'El Porto reef — Manhattan Beach', lat: 33.8850000, lon: -118.4180000, face: 250, depth: 28 },
  { id: 'kelpfinger', name: 'Kelp Finger reef — SM Bay', lat: 33.9000000, lon: -118.4450000, face: 270, depth: 45, boat: true },
  { id: 'barge272', name: 'Barge 272 — San Pedro Bay', lat: 33.8200000, lon: -118.4100000, face: 200, depth: 70, boat: true },
  { id: 'redondocanyon', name: 'Redondo Canyon wall — SM Bay', lat: 33.8550000, lon: -118.4400000, face: 270, depth: 120, boat: true },
  { id: 'sshilda', name: 'SS Hilda wreck — San Pedro', lat: 33.7380000, lon: -118.2900000, face: 200, depth: 75, boat: true },
  /* —— Orange County coves —— */
  { id: 'woodscove', name: "Wood's Cove — Laguna Beach", lat: 33.5375000, lon: -117.7980000, face: 180, depth: 25, regional: true },
  { id: 'diverscove', name: "Diver's Cove — Laguna Beach", lat: 33.5410000, lon: -117.7960000, face: 180, depth: 25, regional: true },
  { id: 'victoria', name: 'Victoria Beach — Laguna', lat: 33.5200000, lon: -117.7700000, face: 180, depth: 25, regional: true },
  { id: 'fishermans', name: "Fisherman's Cove — Laguna", lat: 33.5460000, lon: -117.8050000, face: 180, depth: 28, regional: true },
  { id: 'moss', name: 'Moss Point — Laguna Beach', lat: 33.5490000, lon: -117.8080000, face: 180, depth: 30, regional: true },
  { id: 'archcove', name: 'Arch Cove — Laguna Beach', lat: 33.5520000, lon: -117.8120000, face: 180, depth: 28, regional: true },
  { id: 'emeraldlaguna', name: 'Emerald Bay — Laguna (not Catalina)', lat: 33.5550000, lon: -117.8200000, face: 180, depth: 25, regional: true },
  { id: 'doheny', name: 'Doheny Beach — Dana Point', lat: 33.4650000, lon: -117.6900000, face: 180, depth: 22, regional: true },
  { id: 'babybeach', name: 'Baby Beach — Dana Point', lat: 33.4620000, lon: -117.6950000, face: 180, depth: 20, regional: true },
  { id: 'strandsoff', name: 'The Strands offshore — Dana Point', lat: 33.4780000, lon: -117.7300000, face: 200, depth: 40, regional: true },
  { id: 'tstreet', name: 'T-Street — San Clemente', lat: 33.4200000, lon: -117.6150000, face: 190, depth: 25, regional: true },
  { id: 'calafia', name: 'Calafia Beach — San Clemente', lat: 33.4150000, lon: -117.6100000, face: 190, depth: 28, regional: true },
  { id: 'riviera', name: 'Riviera — San Clemente', lat: 33.4280000, lon: -117.6250000, face: 190, depth: 25, regional: true },
  { id: 'corona', name: 'Corona del Mar — Newport', lat: 33.5915, lon: -117.8750, face: 200, depth: 25, regional: true },
  { id: 'newportjetty', name: 'Newport Jetty — OC', lat: 33.6080000, lon: -117.9280000, face: 200, depth: 28, regional: true },
  /* —— Channel Islands —— */
  { id: 'anacapaeast', name: 'Anacapa East End', lat: 34.0083330, lon: -119.3500000, face: 90, depth: 40, boat: true, regional: true },
  { id: 'anacapawest', name: 'Anacapa West End', lat: 34.0200000, lon: -119.3750000, face: 270, depth: 45, boat: true, regional: true },
  { id: 'archrock', name: 'Arch Rock — Anacapa', lat: 34.0120000, lon: -119.3580000, face: 90, depth: 35, boat: true, regional: true },
  { id: 'cathedral', name: 'Cathedral Cove — Anacapa', lat: 34.0150000, lon: -119.3600000, face: 90, depth: 40, boat: true, regional: true },
  { id: 'yellowbanks', name: 'Yellow Banks — Anacapa', lat: 34.0100000, lon: -119.3650000, face: 90, depth: 50, boat: true, regional: true },
  { id: 'smugglers', name: "Smugglers Cove — Santa Cruz Is.", lat: 34.0300000, lon: -119.5800000, face: 120, depth: 35, boat: true, regional: true },
  { id: 'painted', name: 'Painted Cave area — Santa Cruz Is.', lat: 34.0550000, lon: -119.5700000, face: 120, depth: 45, boat: true, regional: true },
  { id: 'frysharbor', name: "Fry's Harbor — Santa Cruz Is.", lat: 34.0400000, lon: -119.5900000, face: 120, depth: 35, boat: true, regional: true },
  { id: 'sanmiguel', name: 'Cuyler Harbor — San Miguel Is.', lat: 34.0500000, lon: -120.3500000, face: 270, depth: 40, boat: true, regional: true },
  { id: 'santarosa', name: 'Bechers Bay — Santa Rosa Is.', lat: 33.9900000, lon: -120.0800000, face: 270, depth: 35, boat: true, regional: true },
  /* —— San Diego —— */
  { id: 'hmcsyukon', name: 'HMCS Yukon — San Diego', lat: 32.7700000, lon: -117.2700000, face: 280, depth: 100, boat: true, regional: true },
  { id: 'rubyE', name: 'Ruby E wreck — San Diego', lat: 32.7680000, lon: -117.2720000, face: 280, depth: 85, boat: true, regional: true },
  { id: 'pescadero', name: 'Pescadero — La Jolla', lat: 32.8480000, lon: -117.2750000, face: 310, depth: 30, regional: true },
  { id: 'sunsetcliffs', name: 'Sunset Cliffs — San Diego', lat: 32.7150000, lon: -117.2550000, face: 280, depth: 25, regional: true },
  { id: 'swamis', name: "Swami's — Encinitas", lat: 33.0350000, lon: -117.2920000, face: 280, depth: 30, regional: true },
  { id: 'torrey', name: 'Torrey Pines — San Diego', lat: 32.9200000, lon: -117.2520000, face: 280, depth: 30, regional: true },
  { id: 'delmar', name: 'Del Mar kelp — San Diego', lat: 32.9600000, lon: -117.2650000, face: 280, depth: 35, regional: true },
  { id: 'coronado', name: 'Coronado kelp — San Diego', lat: 32.6800000, lon: -117.1800000, face: 270, depth: 35, regional: true },
  { id: 'pointloma', name: 'Point Loma outer kelp — San Diego', lat: 32.6650000, lon: -117.2450000, face: 270, depth: 45, boat: true, regional: true },
  { id: 'imperial', name: 'Imperial Beach — San Diego', lat: 32.5800000, lon: -117.1300000, face: 270, depth: 25, regional: true }
];

function fmtDive(s) {
  const parts = [`id: '${s.id}'`, `name: '${s.name.replace(/'/g, "\\'")}'`, `lat: ${s.lat.toFixed(7).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '.0')}`, `lon: ${s.lon.toFixed(7).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '.0')}`, `face: ${s.face}`, `depth: ${s.depth}`];
  if (s.boat) parts.push('boat: true');
  if (s.regional) parts.push('regional: true');
  return `    { ${parts.join(', ')} }`;
}

function mkBriefing(id, name, region, depth, boat) {
  const access = boat ? 'Boat access from King Harbor or local charters; pick lee shore when wind is up.' : 'Shore entry with surface swim to kelp line; morning dives beat afternoon wind chop.';
  const mpa = /Catalina|Anacapa|Santa Cruz|Laguna|PV|Palos Verdes|Abalone|Sacred|Avalon|Two Harbors/i.test(name)
    ? 'Verify CDFW MPA and no-take boundaries on the map before any harvest.'
    : 'Confirm current CDFW regulations and seasonal closures before any take dive.';
  return `  ${id}: [
    { h: 'Why dive here', body: [
      '${name} is a ${region} dive site with rocky reef and kelp structure in typical ${depth} ft depths. ${access}',
      'Classic SoCal kelp-forest character: garibaldi, kelp bass, sheephead, and sand channels for navigation. Best after several calm days when visibility clears.'
    ]},
    { h: 'Navigation, POIs & hazards', body: [
      'Water-side target coordinates place the pin on offshore kelp or reef, not on land. Depth zones follow local reef profile; stay clear of boat traffic and fishing lines on weekends.',
      'Hazards: surge on swell days, monofilament on structure, and afternoon onshore wind on surface swims. ${mpa}'
    ]},
    { h: 'Marine life by zone', body: [
      'Shallow reef and kelp (15–30 ft): garibaldi, senorita, opaleye, kelp bass, and moray eels in cracks. Mid-depth (30–50 ft): sheephead, calico bass, octopus, and horn sharks on sand.',
      'Seasonal: spring nudibranch activity and garibaldi nesting; white seabass occasionally pass outer kelp March–June. Macro hunters check shaded rock faces for nudibranchs and chestnut cowries.'
    ]}
  ]`;
}

function regionOf(name) {
  if (/Catalina|Avalon|Two Harbors|Isthmus|Geiger|Farnsworth|Hamilton|Toyon|Willow|Parsons|Shark Harbor/i.test(name)) return 'Catalina Island';
  if (/Palos Verdes|PV |— PV|San Pedro|Fermin|Portuguese|Abalone|Sacred|Lunada|Malaga|Haggerty|Bluff|Terranea|Forrestal|Wayside|RPV|Pt Vicente|Neptune|Rocky Point|Honeymoon/i.test(name)) return 'Palos Verdes Peninsula';
  if (/Laguna|Dana|Newport|OC|San Clemente|Corona|Doheny|Baby Beach|Strands|Emerald Bay — Laguna/i.test(name)) return 'Orange County';
  if (/Anacapa|Santa Cruz|San Miguel|Santa Rosa|Channel/i.test(name)) return 'Channel Islands';
  if (/San Diego|La Jolla|Encinitas|Coronado|Imperial|Torrey|Del Mar|Yukon|Ruby E|Sunset Cliffs|Swami/i.test(name)) return 'San Diego';
  if (/Malibu|Santa Monica|Venice|Playa|Manhattan|El Porto|SM Bay|Redondo|Hermosa|Torrance|King Harbor/i.test(name)) return 'Santa Monica Bay';
  return 'Southern California';
}

// Patch dive-engine.js
const dePath = path.join(root, 'dive-engine.js');
let de = fs.readFileSync(dePath, 'utf8');
const existingIds = [...de.matchAll(/\{ id: '([^']+)'/g)].map(m => m[1]);
const toAdd = NEW_DIVE.filter(s => !existingIds.includes(s.id));
if (!toAdd.length) { console.log('No new dive sites to add'); }
else {
  const block = '\n    /* —— Expansion Jul 2026 — PV coves, Catalina, OC, wrecks —— */\n' + toAdd.map(fmtDive).join(',\n');
  de = de.replace(/\n    \{ id: 'thousandsteps'[\s\S]*?\n  \];/, m => m.replace(/\n  \];/, ',' + block + '\n  ];'));
  fs.writeFileSync(dePath, de);
  console.log('Added dive sites:', toAdd.length);
}

// Patch briefings
const brPath = path.join(root, 'dive-briefings-data.js');
let br = fs.readFileSync(brPath, 'utf8');
const existingBr = [...br.matchAll(/^\s+(\w+):\s*\[/gm)].map(m => m[1]);
const brAdd = toAdd.filter(s => !existingBr.includes(s.id));
if (brAdd.length) {
  const brBlock = brAdd.map(s => mkBriefing(s.id, s.name.replace(/'/g, "\\'"), regionOf(s.name), s.depth, s.boat)).join(',\n');
  br = br.replace(/\n\};\s*$/, ',\n' + brBlock + '\n};\n');
  fs.writeFileSync(brPath, br);
  console.log('Added briefings:', brAdd.length);
}

// Fish spots — mirror new sites + extra fishing-only grounds
const NEW_FISH = [
  ...toAdd.map(s => ({
    name: s.name.replace(/ — /g, ' — ').includes('fish') ? s.name : s.name + ' kelp',
    lat: s.lat, lon: s.lon, face: s.face,
    species: s.boat && s.depth > 60 ? ['sand bass', 'calico bass', 'rockfish', 'sheephead'] : ['calico bass', 'barred sand bass', 'sheephead', 'halibut'],
    depth: `${Math.max(15, s.depth - 15)}–${s.depth + 20} ft`,
    habitat: s.boat ? 'Offshore kelp & reef' : 'Nearshore kelp & rocky reef',
    tactics: s.boat ? 'Drift kelp edges with live sardine on light wind mornings.' : 'Cast weedless baits to kelp fringes at dawn on incoming tide.',
    bestTide: 'incoming', bestTime: 'dawn', minSstF: s.regional ? 61 : 58,
    regional: s.regional || undefined
  })),
  /* extra fishing-only */
  { name: 'Neptune Cove arch kelp fish — Golden Cove', lat: 33.7512667, lon: -118.4178333, face: 210, species: ['calico bass', 'sand bass', 'sheephead', 'halibut'], depth: '25–55 ft', habitat: 'Arch reef & kelp', tactics: 'Halibut on sand lanes between reef fingers at dawn.', bestTide: 'incoming', bestTime: 'dawn', minSstF: 58 },
  { name: 'Little Flower Cove kelp — PV', lat: 33.7362000, lon: -118.3715000, face: 215, species: ['calico bass', 'sheephead', 'rockfish'], depth: '20–50 ft', habitat: 'Protected PV kelp pocket', tactics: 'Drift kelp on light wind; verify MPA boundaries.', bestTide: 'incoming', bestTime: 'morning', minSstF: 58 },
  { name: 'Goat Harbor kelp — Catalina N', lat: 33.4083333, lon: -118.3533333, face: 90, regional: true, species: ['calico bass', 'sheephead', 'rockfish'], depth: '20–55 ft', habitat: 'Long Point SMR kelp', tactics: 'Verify no-take SMR rules before fishing.', bestTide: 'either', bestTime: 'morning', minSstF: 61 },
  { name: 'Sea Fan Grotto fish — Catalina', lat: 33.4350000, lon: -118.4783333, face: 90, regional: true, species: ['calico bass', 'yellowtail', 'rockfish'], depth: '30–70 ft', habitat: 'Grotto reef & kelp', tactics: 'Yo-yo iron when bait stacks on clean water days.', bestTide: 'either', bestTime: 'morning', minSstF: 62 },
  { name: 'Howland\'s Landing kelp — Catalina W', lat: 33.4583333, lon: -118.5033333, face: 90, regional: true, species: ['calico bass', 'sheephead', 'rockfish'], depth: '25–60 ft', habitat: 'West-end cove kelp', tactics: 'Kelp fringe trolling on warm-water pushes.', bestTide: 'incoming', bestTime: 'morning', minSstF: 61 },
  { name: 'Ben Weston backside kelp — Catalina', lat: 33.326667, lon: -118.517500, face: 270, regional: true, species: ['calico bass', 'yellowtail', 'white seabass'], depth: '30–80 ft', habitat: 'Backside kelp & reef', tactics: 'Live squid when SST rises; plan weather window.', bestTide: 'incoming', bestTime: 'dawn', minSstF: 63 },
  { name: 'Lover\'s Cove fish — Avalon', lat: 33.343749, lon: -118.320185, face: 60, regional: true, species: ['calico bass', 'sheephead', 'garibaldi (NR)'], depth: '15–45 ft', habitat: 'Protected Avalon kelp', tactics: 'Check MLPA no-take zones near Casino Point.', bestTide: 'incoming', bestTime: 'morning', minSstF: 62 },
  { name: 'Descanso Beach kelp — Avalon', lat: 33.3518, lon: -118.3255, face: 55, regional: true, species: ['calico bass', 'yellowtail', 'sheephead'], depth: '20–55 ft', habitat: 'Avalon bay kelp', tactics: 'Kelp edges at first light before skiff traffic.', bestTide: 'incoming', bestTime: 'dawn', minSstF: 62 },
  { name: 'Blue Cavern fish — Catalina UW Park', lat: 33.342947, lon: -118.319595, face: 45, regional: true, species: ['calico bass', 'yellowtail', 'white seabass'], depth: '40–100 ft', habitat: 'Deep cavern reef', tactics: 'Boat only; live squid on outer wall when vis clears.', bestTide: 'either', bestTime: 'morning', minSstF: 63 },
  { name: 'Eagle Reef fish — Avalon', lat: 33.353255, lon: -118.328873, face: 90, regional: true, species: ['calico bass', 'yellowtail', 'rockfish'], depth: '30–80 ft', habitat: 'Offshore Avalon pinnacle', tactics: 'Drift pinnacle on slack; yo-yo iron when bait marks.', bestTide: 'either', bestTime: 'dawn', minSstF: 62 },
  { name: 'Hen Rock kelp — Catalina', lat: 33.362500, lon: -118.325000, face: 90, regional: true, species: ['calico bass', 'sheephead', 'rockfish'], depth: '25–65 ft', habitat: 'Near Avalon kelp rock', tactics: 'Short boat run from Avalon; kelp fringe at dawn.', bestTide: 'incoming', bestTime: 'dawn', minSstF: 61 },
  { name: 'Arrow Point kelp — Catalina', lat: 33.378611, lon: -118.341667, face: 120, regional: true, species: ['calico bass', 'sheephead', 'rockfish'], depth: '20–60 ft', habitat: 'North shore kelp point', tactics: 'Lee-side fishing when NW wind builds.', bestTide: 'either', bestTime: 'morning', minSstF: 61 },
  { name: 'Little Harbor kelp — Catalina', lat: 33.381934, lon: -118.358252, face: 150, regional: true, species: ['calico bass', 'sheephead', 'rockfish'], depth: '20–55 ft', habitat: 'Protected harbor kelp', tactics: 'Campground cove; verify Conservancy access rules.', bestTide: 'either', bestTime: 'morning', minSstF: 61 },
  { name: 'SueJac wreck fish — Avalon UW Park', lat: 33.3435000, lon: -118.3190000, face: 90, regional: true, species: ['sand bass', 'calico bass', 'rockfish'], depth: '50–80 ft', habitat: 'Avalon wreck rubble', tactics: 'Drift wreck edges; check UW Park boundaries.', bestTide: 'incoming', bestTime: 'morning', minSstF: 60 },
  { name: 'Diosa del Mar fish — Ship Rock', lat: 33.4627700, lon: -118.4919250, face: 90, regional: true, species: ['calico bass', 'yellowtail', 'sheephead'], depth: '15–45 ft', habitat: 'Isthmus shallow rubble', tactics: 'Kelp fringe trolling near Ship Rock on warm days.', bestTide: 'incoming', bestTime: 'morning', minSstF: 62 },
  { name: 'Worm Reef fish — Rocky Point PV', lat: 33.7711000, lon: -118.4343000, face: 220, species: ['calico bass', 'yellowtail', 'white seabass'], depth: '35–80 ft', habitat: 'Outer PV kelp & reef', tactics: 'Spring WSB/yellowtail congregation; yo-yo iron.', bestTide: 'either', bestTime: 'dawn', minSstF: 62 },
  { name: 'Kevin\'s Reef fish — PV offshore', lat: 33.7616833, lon: -118.4256167, face: 215, species: ['calico bass', 'sand bass', 'rockfish'], depth: '55–75 ft', habitat: 'Offshore pinnacle', tactics: 'Small pinnacle drift; watch trap lines in lobster season.', bestTide: 'either', bestTime: 'morning', minSstF: 58 },
  { name: 'SS Dominator rubble fish — Rocky Point', lat: 33.7738889, lon: -118.4283333, face: 230, species: ['calico bass', 'sand bass', 'rockfish'], depth: '15–40 ft', habitat: 'Wreck rubble & kelp', tactics: 'Calm-day kelp edges only; bass on structure.', bestTide: 'incoming', bestTime: 'morning', minSstF: 58 },
  { name: 'Kaplan Cove kelp fish — Pt Vicente', lat: 33.7370000, lon: -118.4010000, face: 225, species: ['calico bass', 'sheephead', 'rockfish'], depth: '25–60 ft', habitat: 'MPA-adjacent kelp', tactics: 'Work kelp outside MPA; verify CDFW maps.', bestTide: 'either', bestTime: 'dawn', minSstF: 60 },
  { name: 'PC-140 wreck fish — San Pedro', lat: 33.7325000, lon: -118.2916670, face: 200, species: ['sand bass', 'calico bass', 'rockfish'], depth: '45–65 ft', habitat: 'Wreck rubble', tactics: 'Drift wreck for bass on light wind days.', bestTide: 'either', bestTime: 'morning', minSstF: 58 },
  { name: 'UB-88 submarine fish grounds', lat: 33.603533, lon: -118.234650, face: 270, species: ['sand bass', 'rockfish', 'sculpin', 'lingcod'], depth: '150–220 ft', habitat: 'Deep Catalina Channel wreck', tactics: 'Deep dropper loops; check RCAs and depth limits.', bestTide: 'either', bestTime: 'morning', minSstF: 55 },
  { name: 'Scorpion Anchorage fish — Santa Cruz Is.', lat: 34.050082, lon: -119.556222, face: 120, regional: true, species: ['calico bass', 'yellowtail', 'rockfish'], depth: '25–70 ft', habitat: 'Island kelp anchorage', tactics: '~55 nm; plan full-day run; kelp at dawn.', bestTide: 'incoming', bestTime: 'dawn', minSstF: 62 },
  { name: 'Landing Cove fish — Anacapa', lat: 34.016667, lon: -119.362222, face: 90, regional: true, species: ['calico bass', 'sheephead', 'rockfish'], depth: '20–55 ft', habitat: 'Anacapa kelp cove', tactics: 'Channel Islands trip; verify MPA boundaries.', bestTide: 'incoming', bestTime: 'morning', minSstF: 61 },
  { name: 'Potato Harbor fish — Anacapa N', lat: 34.016111, lon: -119.355833, face: 90, regional: true, species: ['calico bass', 'rockfish', 'sheephead'], depth: '20–50 ft', habitat: 'North Anacapa kelp', tactics: 'Protected cove fishing on light wind days.', bestTide: 'either', bestTime: 'morning', minSstF: 61 },
  { name: 'Heisler Park kelp — Laguna', lat: 33.542800, lon: -117.794500, face: 180, regional: true, species: ['calico bass', 'sheephead', 'rockfish'], depth: '20–50 ft', habitat: 'Laguna nearshore kelp', tactics: 'Boat access; check MPAs before fishing.', bestTide: 'incoming', bestTime: 'dawn', minSstF: 60 },
  { name: 'Shaw\'s Cove kelp — Laguna', lat: 33.543500, lon: -117.802500, face: 180, regional: true, species: ['calico bass', 'sheephead', 'rockfish'], depth: '20–55 ft', habitat: 'Laguna reef & kelp', tactics: 'Offshore kelp drift at first light.', bestTide: 'incoming', bestTime: 'dawn', minSstF: 60 },
  { name: 'Wreck Alley fish — San Diego', lat: 32.764167, lon: -117.268333, face: 280, regional: true, species: ['sand bass', 'calico bass', 'rockfish', 'sculpin'], depth: '60–100 ft', habitat: 'SD wreck cluster', tactics: 'Multi-wreck drift; check depth and RCA rules.', bestTide: 'either', bestTime: 'morning', minSstF: 58 },
  { name: 'La Jolla Shores kelp fish', lat: 32.858056, lon: -117.257500, face: 280, regional: true, species: ['calico bass', 'yellowtail', 'bonito'], depth: '25–60 ft', habitat: 'La Jolla kelp forest', tactics: 'Full-day run; live mackerel at kelp paddies.', bestTide: 'incoming', bestTime: 'dawn', minSstF: 62 },
  { name: 'Leo Carrillo kelp — Malibu', lat: 34.0445000, lon: -118.9338333, face: 205, regional: true, species: ['calico bass', 'yellowtail', 'white seabass'], depth: '20–55 ft', habitat: 'North-county kelp', tactics: '~40 nm; early departure for dawn bite.', bestTide: 'either', bestTime: 'dawn', minSstF: 61 },
  { name: 'Paradise Cove kelp — Malibu', lat: 34.0203333, lon: -118.7915000, face: 200, regional: true, species: ['calico bass', 'yellowtail', 'barracuda'], depth: '20–60 ft', habitat: 'Malibu offshore kelp', tactics: 'USC Sea Grant kelp line; yo-yo iron when bait up.', bestTide: 'either', bestTime: 'dawn', minSstF: 61 }
];

function fmtFish(f) {
  const parts = [`name: '${f.name.replace(/'/g, "\\'")}'`, `lat: ${f.lat}`, `lon: ${f.lon}`];
  if (f.face != null) parts.push(`face: ${f.face}`);
  if (f.regional) parts.push('regional: true');
  parts.push(`species: [${f.species.map(s => `'${s}'`).join(', ')}]`);
  parts.push(`depth: '${f.depth}'`, `habitat: '${f.habitat.replace(/'/g, "\\'")}'`, `tactics: '${f.tactics.replace(/'/g, "\\'")}'`, `bestTide: '${f.bestTide}'`, `bestTime: '${f.bestTime}'`, `minSstF: ${f.minSstF}`);
  return `  { ${parts.join(', ')} }`;
}

const htmlPath = path.join(root, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const fm = html.match(/const FISH_SPOTS = \[([\s\S]*?)\];/);
const existingFish = [...fm[1].matchAll(/name: '([^']+)'/g)].map(m => m[1]);
const fishToAdd = NEW_FISH.filter(f => !existingFish.includes(f.name));
if (fishToAdd.length) {
  const fishBlock = '\n  /* —— Expansion Jul 2026 — PV, Catalina, OC, SD —— */\n' + fishToAdd.map(fmtFish).join(',\n');
  html = html.replace(/\n  \{ name: 'Oceanside Artificial Reef center'[\s\S]*?\n\};/, m => m.replace(/\n\};/, ',' + fishBlock + '\n};'));
  fs.writeFileSync(htmlPath, html);
  console.log('Added fish spots:', fishToAdd.length);
}

// Final counts
de = fs.readFileSync(dePath, 'utf8');
html = fs.readFileSync(htmlPath, 'utf8');
const diveCount = [...de.matchAll(/\{ id: '/g)].length;
const fishCount = [...html.match(/const FISH_SPOTS = \[([\s\S]*?)\];/)[1].matchAll(/name: '/g)].length;
const brCount = [...fs.readFileSync(brPath, 'utf8').matchAll(/^\s+\w+:\s*\[/gm)].length;
const dupIds = [...de.matchAll(/\{ id: '([^']+)'/g)].map(m => m[1]).filter((id, i, a) => a.indexOf(id) !== i);
console.log('FINAL dive:', diveCount, 'fish:', fishCount, 'briefings:', brCount, 'dup ids:', [...new Set(dupIds)]);

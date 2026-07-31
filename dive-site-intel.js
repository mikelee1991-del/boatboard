'use strict';
/** Site intel keyed by DIVE_SITES id — entry/exit, logistics, hazards, structure, species. */
window.__BOAT_DIVE_SITE_INTEL__ = {
  veterans: {
    entryHeading: 250, exitHeading: 70,
    access: 'shore', launch: 'King Harbor / Redondo ramp (boat optional)',
    parking: 'Veterans Park lot — fills early weekends; street parking on Esplanade',
    fees: 'Free street/lot; check city meters',
    structure: 'Sandy beach · Macrocystis kelp 15–30 ft · sand channels between paddies',
    species: ['garibaldi', 'kelp bass', 'sheephead', 'moray eel', 'octopus', 'bat ray'],
    hazards: ['Surf on south swell entry', 'King Harbor boat traffic weekends', 'Monofilament near pier influence'],
    notes: 'Classic South Bay kelp — swim ~200 m west to forest. Morning before onshore wind.',
    bestWhen: 'Fall–spring after 2–3 calm days; avoid afternoon chop'
  },
  kingharbor: {
    entryHeading: 240, exitHeading: 60,
    access: 'shore-swim or boat-drop', launch: 'King Harbor — slip at Port Royal',
    parking: 'Harbor lots / metered; do not stage on active ramps',
    fees: 'Harbor parking varies',
    structure: 'Outer breakwater rubble 15–40 ft · sand flats · sparse kelp patches',
    species: ['kelp bass', 'sand bass', 'sheephead', 'harbor seal', 'nudibranchs'],
    hazards: ['Heavy boat traffic — dive flag required', 'Do not enter inner channels', 'Debris on breakwater'],
    notes: 'Backup when open coast is blown out. Target outer breakwater face, not marina interior.',
    bestWhen: 'Slack tide mornings; late summer–fall when bay settles'
  },
  abalone: {
    entryHeading: 200, exitHeading: 20,
    access: 'shore', launch: 'Boat from King Harbor for outer reef',
    parking: 'Palos Verdes Drive South — long hike down; verify trail open',
    fees: 'Free trail parking; limited spaces',
    structure: 'Rocky cobble entry · kelp forest 15–40 ft · sand channels · tidepools',
    species: ['garibaldi', 'sheephead', 'torpedo ray', 'horn shark', 'lobster (observe only)'],
    hazards: ['Torpedo rays on sand flats — never touch', 'Steep hike with gear', 'Ecological reserve — no take', 'Surge on west swell'],
    notes: 'Flagship PV shore dive in no-take reserve. Time cobble entry between sets.',
    bestWhen: 'Calm mornings after several flat days; fall–spring vis'
  },
  ptvicente: {
    entryHeading: 225, exitHeading: 45,
    access: 'shore (advanced) or boat', launch: 'King Harbor / San Pedro charters',
    parking: 'Pt Vicente Interpretive Center area — respect trail closures',
    fees: 'Free lot when open',
    structure: 'Offshore pinnacles & kelp 20–55 ft · sand channels · MPA nearby',
    species: ['garibaldi', 'sheephead', 'white seabass (seasonal)', 'nudibranchs', 'octopus'],
    hazards: ['Exposed point — swell wraps', 'MPA boundaries — confirm on map', 'Rocky surge zone'],
    notes: 'Pinnacles seaward of Pt Vicente light. Boat preferred on swell days.',
    bestWhen: 'Light wind mornings; spring WSB passes outer kelp'
  },
  casino: {
    entryHeading: 45, exitHeading: 225,
    access: 'shore', launch: 'Catalina Express / boat from King Harbor',
    parking: 'Casino Dive Park — pay parking near Green Pier',
    fees: 'Catalina parking & park fees apply',
    structure: 'Protected underwater park · kelp & reef 15–40 ft · mooring field',
    species: ['garibaldi (protected)', 'kelp bass', 'octopus', 'moray', 'calico bass'],
    hazards: ['Mooring boat traffic in park', 'No take in UW park', 'Afternoon wind chop'],
    notes: 'Only shore dive with lifeguard-staffed park in CA. Reserve air — long surface swims rare.',
    bestWhen: 'Morning before Avalon wind; winter often clearest'
  },
  lovers: {
    entryHeading: 60, exitHeading: 240,
    access: 'shore (permit/guide historically — confirm access)', launch: 'Boat drop common',
    parking: 'Avalon — walk from Green Pier area',
    fees: 'Catalina fees; access rules change — verify locally',
    structure: 'Protected cove kelp 10–30 ft · rocky reef · sand patches',
    species: ['garibaldi', 'senorita', 'kelp bass', 'moray', 'nudibranchs'],
    hazards: ['Access restrictions — check before trip', 'Boat traffic in cove', 'Surge on east swell'],
    notes: 'Classic Avalon cove — historically guided; confirm current shore access.',
    bestWhen: 'Calm summer mornings; avoid east swell events'
  },
  descanso: {
    entryHeading: 55, exitHeading: 235,
    access: 'shore', launch: 'Descanso Beach Club boat ops nearby',
    parking: 'Descanso Beach pay parking',
    fees: 'Beach club parking fee',
    structure: 'Sandy beach · kelp garden 15–30 ft · Descanso rocks',
    species: ['garibaldi', 'kelp bass', 'octopus', 'sheephead'],
    hazards: ['Jet ski / paddle traffic near beach', 'Private beach rules — stay in dive zone'],
    notes: 'Easier entry than Lover\'s; good training site when Avalon is flat.',
    bestWhen: 'Morning glass; winter vis often best'
  },
  hermosa: {
    entryHeading: 250, exitHeading: 70,
    access: 'shore', launch: 'King Harbor for outer reef modules',
    parking: 'Hermosa Ave structure lots — competitive on weekends',
    fees: 'Paid lots typical',
    structure: 'CDFG artificial reef modules 20–30 ft · sand · kelp on structure',
    species: ['kelp bass', 'sand bass', 'sheephead', 'halibut on sand'],
    hazards: ['Pier fishing lines — stay south of pier', 'Shore break on south swell', 'Crowded beach'],
    notes: 'Swim ~250° to Hermosa Reef A modules; do not swim under pier.',
    bestWhen: 'Morning before sea breeze; after calm spell'
  },
  torrance: {
    entryHeading: 245, exitHeading: 65,
    access: 'shore', launch: 'King Harbor optional',
    parking: 'RAT Beach stairs — limited residential parking',
    fees: 'Street parking',
    structure: 'Sandy beach · kelp 15–30 ft · sand channels',
    species: ['garibaldi', 'kelp bass', 'opaleye', 'horn shark', 'bat ray'],
    hazards: ['Surf entry on south swell', 'Crowded beach stairs', 'Storm drain after rain'],
    notes: 'Middle-ground exposure between harbor and PV. West swim to kelp line.',
    bestWhen: 'Early morning; fall vis after flat days'
  },
  honeymoon: {
    entryHeading: 220, exitHeading: 40,
    access: 'shore', launch: 'Boat for Merry\'s / Resort Point',
    parking: 'Paseo Del Mar — residential; quiet entry',
    fees: 'Street parking',
    structure: 'Kelp forest 15–55 ft · Merry\'s Reef offshore (boat)',
    species: ['garibaldi', 'sheephead', 'kelp bass', 'octopus', 'WSB (spring)'],
    hazards: ['Cobble surge entry', 'Boat traffic on weekends', 'Thick kelp in summer'],
    notes: 'Honeymoon Cove entry; advanced divers boat to Merry\'s Reef north.',
    bestWhen: 'Calm mornings; spring for white seabass on outer reef'
  },
  sacred: {
    entryHeading: 210, exitHeading: 30,
    access: 'shore', launch: 'Boat for outer reef',
    parking: 'Trail from PV Drive — verify access & closures',
    fees: 'Free when trail open',
    structure: 'Kelp & rocky reef 15–35 ft · sand channels · scenic walls',
    species: ['garibaldi', 'sheephead', 'kelp bass', 'moray', 'nudibranchs'],
    hazards: ['Trail/landslide closures', 'Surge despite cove name', 'Reserve-adjacent — check MPA'],
    notes: 'Scenic PV cove; hike time counts against daylight.',
    bestWhen: 'Several days flat swell; morning entry'
  },
  whitepoint: {
    entryHeading: 200, exitHeading: 20,
    access: 'shore', launch: 'San Pedro / King Harbor',
    parking: 'White Point Park lot',
    fees: 'Free county lot',
    structure: 'Kelp & rocky reef 15–30 ft · sand · pipeline rubble offshore',
    species: ['garibaldi', 'kelp bass', 'sheephead', 'octopus', 'lobster (season/rules)'],
    hazards: ['Rocky entry surge', 'Urchins on exit', 'Occasional strong current'],
    notes: 'San Pedro shore classic — kelp west of entry. Less hike than PV coves.',
    bestWhen: 'Morning; avoid south swell days'
  },
  eaglereef: {
    entryHeading: 90, exitHeading: 270,
    access: 'boat', launch: 'King Harbor / Avalon charter',
    parking: 'Harbor slip or Catalina ferry',
    fees: 'Charter / mooring fees',
    structure: 'High-relief reef & kelp 30–55 ft · eagle-shaped rock formation',
    species: ['yellowtail', 'calico bass', 'sheephead', 'white seabass', 'moray'],
    hazards: ['Open channel swell', 'Boat traffic at moorings', 'Depth for OW divers on outer wall'],
    notes: 'Popular boat site east of Avalon. Moor on lee side when wind up.',
    bestWhen: 'Summer–fall; light wind mornings'
  },
  isthmus: {
    entryHeading: 180, exitHeading: 0,
    access: 'shore or boat', launch: 'Two Harbors mooring / Isthmus',
    parking: 'Two Harbors walk-in',
    fees: 'Catalina Conservancy / harbor fees',
    structure: 'Protected isthmus kelp 15–40 ft · rocky reef · mooring field',
    species: ['calico bass', 'yellowtail', 'sheephead', 'garibaldi', 'rockfish'],
    hazards: ['Mooring boat traffic', 'Afternoon westerly chop', 'Remote — plan air & comms'],
    notes: 'Two Harbors shore or mooring dive. Lee shore when westerly wind builds.',
    bestWhen: 'Morning before isthmus wind; summer pelagics'
  },
  shaws: {
    entryHeading: 180, exitHeading: 0,
    access: 'shore', launch: 'Boat from Dana/Newport for outer reef',
    parking: 'Shaw\'s Cove stair street — very limited',
    fees: 'Residential permit zones — read signs',
    structure: 'Rocky reef & kelp 15–30 ft · cove walls · sand bottom',
    species: ['garibaldi', 'sheephead', 'kelp bass', 'moray', 'lobster (rules)'],
    hazards: ['Rocky surge entry', 'Parking enforcement', 'Thick kelp summer'],
    notes: 'Iconic Laguna cove — enter on calm sets only. Respect resident access.',
    bestWhen: 'Early morning flat days; winter vis spikes'
  },
  lajolla: {
    entryHeading: 310, exitHeading: 130,
    access: 'shore', launch: 'La Jolla Shores boats for canyon',
    parking: 'Cove / Shores lots — competitive',
    fees: 'Paid lots weekends',
    structure: 'Sand beach · kelp & rocky reef 15–25 ft · sea caves nearby (advanced)',
    species: ['garibaldi', 'leopard shark (seasonal)', 'sheephead', 'sea lion (offshore)'],
    hazards: ['Surf zone entry', 'Seal lion interactions — keep distance', 'Cave overhead env (trained only)'],
    notes: 'San Diego classic — swim northwest to kelp. Leopard sharks on sand Aug–Sep.',
    bestWhen: 'Morning glass; Aug–Sep for leopard sharks'
  }
};

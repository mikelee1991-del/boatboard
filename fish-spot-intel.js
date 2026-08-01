'use strict';
/**
 * Thin curated fishing intel for high-value King Harbor / SoCal day-trip marks.
 * Keyed by stable slug — resolve via name aliases / reef-family match in briefing-synth.js.
 * Does NOT invent pins or GPS; enrich synthesizeFishBriefing only when present.
 */
window.__BOAT_FISH_SPOT_INTEL__ = {
  hermosareef: {
    structure: 'CDFG Hermosa Beach artificial reef modules on sand ~40–90 ft — discrete concrete piles with kelp/algae when mature',
    approach: 'Idle sounder across the module grid, mark the high pile, then set a controlled up-current drift; avoid swimming/finning under the Hermosa Pier',
    speciesNotes: 'Calico and sand bass stack on the first relief; sheephead work module cracks; rockfish on deeper toes when season open',
    hazards: ['Dive flags common on shared modules', 'Pier monofilament south of the pier line', 'Weekend recreational boat traffic'],
    notes: 'Bread-and-butter King Harbor hop — pair with Redondo modules if the bite softens.',
    bestWhen: 'Morning before sea breeze; either tide; after a few calm days when bait holds'
  },
  redondoreef: {
    structure: 'CDFG Redondo Beach artificial reef field + Barge 287 wreck module — sand apron with discrete high spots',
    approach: 'Mark barge/module silhouette on the sounder; short soak or drift up-current of the mark; give dive boats wide berth',
    speciesNotes: 'Bass and sheephead on structure year-round; sculpin/rockfish on deeper edges; occasional bonito when bait schools the sand',
    hazards: ['Heavy dive pressure on Barge 287 weekends', 'King Harbor entrance traffic nearby', 'Monofilament snags on wreck'],
    notes: 'Closest productive artificial reef complex to Port Royal — first stop when PV is blown out.',
    bestWhen: 'Incoming or either tide mornings; light wind'
  },
  palawan: {
    structure: 'SS Palawan wreck and surrounding reef ~90–130 ft west of Redondo',
    approach: 'Sounder the wreck high, drift the edges; dropper-loop for rockfish when open — keep a cutting tool ready',
    speciesNotes: 'Sand and calico bass on wreck edges; sheephead and rockfish in the rubble; sculpin on the sand toe',
    hazards: ['Depth and NDL discipline', 'Wreck snags / cables', 'Boat traffic on the Redondo grounds'],
    notes: 'Deeper than Hermosa/Redondo modules — plan gas and a backup shallow stop.',
    bestWhen: 'Calm mornings with small swell; incoming tide preferred'
  },
  horseshoe: {
    structure: 'Historic Horseshoe Kelp grounds — San Pedro Bay kelp/hard bottom corridor (surface + structure mix)',
    approach: 'Watch birds and bait first; troll feathers/irons along the edge, then slide to marked structure with live bait when the school stacks',
    speciesNotes: 'Bonito, barracuda, and yellowtail when SST and bait align; calico still available on remaining kelp/structure',
    hazards: ['Commercial and sport traffic', 'Shipping-lane awareness south of the breakwater', 'Sudden afternoon wind in the bay'],
    notes: 'Classic summer–fall surface iron / feather run from King Harbor when bait is up.',
    bestWhen: 'Warm SST (≥~62°F) mornings with bait marks; incoming tide'
  },
  rockypoint: {
    structure: 'Rocky Point / Worm Reef kelp complex — high-relief rock and Macrocystis fingers off western PV',
    approach: 'Work kelp edges and reef tops up-current; live bait or plastics just outside the fronds; slide between Rocky Pt Kelp and Worm Reef pins',
    speciesNotes: 'Calico and sheephead on the kelp line; spring yellowtail / white seabass reports on the outer structure',
    hazards: ['West swell wraps the point', 'MPA boundaries nearby — confirm CDFW lines', 'Dive traffic on calm weekends'],
    notes: 'Same complex as Worm Reef and nearby Avalon wreck fish grounds — treat as one reef system.',
    bestWhen: 'Dawn/morning after several calm days; incoming tide'
  },
  ssavalon: {
    structure: 'SS Avalon wreck on rocky reef north of Rocky Point / Palos Verdes Point ~70–80 ft',
    approach: 'Drift wreck edges; lobster observe-only unless season and zone allow — check swell before any soak',
    speciesNotes: 'Calico and sheephead on wreck relief; rockfish deeper; lobster in season where legal',
    hazards: ['Swell/current on the open PV coast', 'Wreck snags', 'MPA adjacency'],
    notes: 'Pairs with Rocky Point kelp on the same King Harbor run.',
    bestWhen: 'Incoming tide mornings; small west swell'
  },
  golfball: {
    structure: 'Golf Ball Reef pinnacle / kelp crown off Haggerty\'s–Bluff Cove — short King Harbor run',
    approach: 'Sounder the high spot, drift live bait or vertical jig the crown and sand edge; lee up when west swell is up',
    speciesNotes: 'Calico and sheephead on the crown; lingcod and rockfish on the sand toe',
    hazards: ['Weekend dive boats', 'Surge on the shallow crown', 'Monofilament'],
    notes: 'Often the first PV stop west of the harbor — pair with The Crane.',
    bestWhen: 'Morning glass; either tide'
  },
  crane: {
    structure: 'The Crane — offshore reef/kelp complex off Haggerty\'s ~30–60 ft',
    approach: 'Short run from King Harbor; drift the kelp edge up-current with live bait or swimbaits',
    speciesNotes: 'Calico and sand bass on the edge; sheephead in the rock; rockfish deeper',
    hazards: ['Shore-break surge closer in', 'Dive flags', 'Afternoon onshore wind'],
    notes: 'Near-slip dual with Golf Ball — easy two-stop loop without a long reposition.',
    bestWhen: 'Morning before sea breeze; incoming tide'
  },
  merrysreef: {
    structure: 'Merry\'s Reef kelp wall west of Honeymoon Cove ~35–55 ft',
    approach: 'Boat the wall toe; live squid or iron on the drop — pair with Resort Point / Halfway on the same run',
    speciesNotes: 'Calico and sheephead on the wall; rockfish on the toe; spring white seabass on the outer kelp',
    hazards: ['West/southwest swell exposure', 'Boat traffic on the Honeymoon complex', 'Thick summer kelp'],
    notes: 'Flagship PV boat kelp for King Harbor day trips when the coast is workable.',
    bestWhen: 'Dawn incoming; after a flat spell'
  },
  halfway: {
    structure: 'Halfway Reef / Kevin\'s Reef offshore between Christmas Tree and Honeymoon — marked high spots ~50–80 ft',
    approach: 'Mark the pinnacle on the sounder; live squid or vertical iron; slide 0.1 nm along contour if soft',
    speciesNotes: 'Calico and sheephead on the high; rockfish and lingcod on the sand edge',
    hazards: ['Open-coast swell', 'Shared dive/fish traffic', 'Depth on Kevin\'s outer toe'],
    notes: 'Treat Halfway and Kevin\'s as one complex — same contour family.',
    bestWhen: 'Dawn/morning incoming; light wind'
  },
  resortpoint: {
    structure: 'Resort Point Wall — high-relief PV wall and kelp cap ~35–70 ft',
    approach: 'Sounder the wall toe; vertical jig or live bait on the drop-off; favor the lee face when swell wraps',
    speciesNotes: 'Calico and sheephead on the wall face; rockfish deeper; occasional white seabass on the kelp cap',
    hazards: ['Swell on the wall', 'MPA check nearby', 'Steep drop — watch scope if anchoring'],
    notes: 'Natural pair with Merry\'s / Halfway on a PV loop.',
    bestWhen: 'Dawn either tide; small swell'
  },
  hawthorne: {
    structure: 'Hawthorne Reef (Barberpole) — high-relief offshore PV reef ~65–85 ft',
    approach: 'Deeper boat drift; heavy gear for rockfish; mark the barberpole high and work the sand edge',
    speciesNotes: 'Rockfish and lingcod primary; sheephead and calico on the upper relief',
    hazards: ['Depth / NDL', 'Open swell', 'Snags on high-relief rock'],
    notes: 'Deeper PV option when shallow kelp is blown or pressured.',
    bestWhen: 'Morning calm; either tide'
  },
  ptvicente: {
    structure: 'Pt Vicente pinnacles / Biodome kelp complex — high spots seaward of the light (SMCA nearby)',
    approach: 'Boat the lee of the point; live bait on kelp high spots — verify no-take boundaries before any take',
    speciesNotes: 'Calico and sheephead on pinnacles; rockfish deeper; white seabass seasonal on the outer kelp',
    hazards: ['SMCA / no-take adjacency — know the line', 'Point swell wrap', 'Current on the outer pinnacles'],
    notes: 'Biodome and Pt Vicente pinnacles share one planning envelope from King Harbor.',
    bestWhen: 'Light wind mornings; either tide'
  },
  portuguese: {
    structure: 'Portuguese Point / Portuguese Kelp high spots — Abalone Cove SMCA nearby',
    approach: 'Confirm MPA lines before any take; light tackle on kelp high spots; short drifts only',
    speciesNotes: 'Calico and sheephead where take is legal; white seabass seasonal on the outer fringe',
    hazards: ['No-take SMCA — do not fish inside', 'Surge on the point', 'Trail/shore dive traffic'],
    notes: 'Portuguese Kelp USC waypoint and Portuguese Point high spot are the same planning complex.',
    bestWhen: 'Dawn incoming outside the reserve; calm days'
  },
  pvr: {
    structure: 'PVR Restoration Reef modules (e.g. 2A / 5C) — restoration concrete on sand east of Portuguese',
    approach: 'Sounder individual modules; drift up-current like other CDFG fields; respect nearby MPA polygons',
    speciesNotes: 'Bass and sheephead as modules mature; rockfish on deeper toes',
    hazards: ['MPA adjacency', 'Newer modules can fish thin until fouled', 'Boat traffic along the east PV run'],
    notes: 'Restoration modules — fish like Hermosa/Redondo CDFG fields, with extra MPA caution.',
    bestWhen: 'Morning either tide; after bait moves onto the modules'
  },
  redondocanyon: {
    structure: 'Redondo Canyon West Wall — canyon rim / hard bottom west of the Redondo grounds',
    approach: 'Track the wall contour on the sounder; drift or short-soak the color change; watch depth quickly',
    speciesNotes: 'Rockfish and bass on the rim; pelagics when bait pushes along the canyon edge',
    hazards: ['Rapid depth change', 'Canyon current', 'Weekend traffic on the Redondo grounds'],
    notes: 'Deeper option near the slip when shallow modules are crowded.',
    bestWhen: 'Calm mornings; incoming tide'
  },
  thirtysixfathom: {
    structure: '36 Fathom Pinnacle — offshore high west of PV / SMB (KML chart mark)',
    approach: 'GPS to the mark, sounder the pinnacle, then controlled drift; heavy gear for rockfish when open',
    speciesNotes: 'Rockfish primary; bass on the upper; pelagics when bait is over the high',
    hazards: ['Open-ocean swell', 'Depth', 'Sparse traffic but commit weather window'],
    notes: 'King Harbor day-trip rockfish/high-spot when nearshore is green.',
    bestWhen: 'Light wind; small swell; morning'
  },
  thirtysevenfathom: {
    structure: '37 Fathom Spot — offshore hard bottom / high near the PV shelf break',
    approach: 'Mark relief, drift up-current; pair with 36 Fathom / 40 Fathom curve on one fuel plan',
    speciesNotes: 'Rockfish and bass; occasional lingcod on the sand edge',
    hazards: ['Exposure', 'Depth', 'Weather change on the return'],
    notes: 'Same planning band as other PV shelf fathom marks from the harbor.',
    bestWhen: 'Calm mornings'
  },
  fortyfathom: {
    structure: '40 Fathom Curve — contour fishing along the PV offshore curve',
    approach: 'Follow the curve on the sounder rather than camping one pin; slide to adjacent fathom highs',
    speciesNotes: 'Rockfish along the color change; bass when bait is up on the curve',
    hazards: ['Open coast', 'Contour depth discipline', 'Afternoon wind home'],
    notes: 'Contour run — often better as a slide than a single soak.',
    bestWhen: 'Morning light wind'
  },
  fortysevenfathom: {
    structure: '47 Fathom Ridge — deeper ridge west of PV',
    approach: 'Deep dropper or iron on the ridge; confirm rockfish season/closure before soaking',
    speciesNotes: 'Rockfish primary; deeper bass occasional',
    hazards: ['Depth / NDL', 'Weather window', 'CDFW rockfish rules'],
    notes: 'Commit only with a solid weather window from King Harbor.',
    bestWhen: 'Calm seas; morning'
  },
  mdreyreef: {
    structure: 'Marina del Rey CDFG artificial reef modules ~40–90 ft — sand with discrete piles',
    approach: 'North bay hop from King Harbor; sounder modules, drift up-current; watch MDR fairway traffic',
    speciesNotes: 'Calico and sand bass on modules; sheephead and rockfish as structure fouls',
    hazards: ['MDR entrance / fairway traffic', 'Dive activity', 'Afternoon westerly chop in the bay'],
    notes: 'Useful when south swell is up on PV — stay in Santa Monica Bay.',
    bestWhen: 'Morning either tide; light wind'
  },
  hermosahardbottom: {
    structure: 'Hermosa Hard Bottom — natural hard bottom / low relief west of Hermosa',
    approach: 'Probe color changes on the sounder; slower drifts than module fishing; plastics or live bait near the bottom',
    speciesNotes: 'Bass and flatfish on the hard-to-soft edge; sheephead on higher nodules',
    hazards: ['Pier influence / lines closer inshore', 'Boat traffic', 'Subtle relief — easy to fish sand'],
    notes: 'Natural companion to Hermosa CDFG modules when fish slide off the piles.',
    bestWhen: 'Morning; incoming tide'
  },
  manhattanhardbottom: {
    structure: 'Manhattan Hard Bottom — low-relief hard ground west of Manhattan Beach',
    approach: 'Sounder first — fish the first color change; short drifts; slide toward Hermosa modules if soft',
    speciesNotes: 'Sand bass and calico on the edge; occasional halibut on adjacent sand',
    hazards: ['Recreational traffic', 'Subtle marks', 'Afternoon sea breeze'],
    notes: 'Near-slip natural bottom when artificial reefs are pressured.',
    bestWhen: 'Morning light wind'
  },
  insidesouthbank: {
    structure: 'Inside South Bank Pinnacle (~26 fm) — offshore pinnacle west of SMB',
    approach: 'GPS + sounder the pinnacle; controlled drift; watch for bait and birds on the bank',
    speciesNotes: 'Rockfish and bass on the high; pelagics when bait boils',
    hazards: ['Open SMB exposure', 'Depth', 'Weather home'],
    notes: 'Longer SMB day-trip high — stack with fuel and an early departure.',
    bestWhen: 'Calm mornings; warm SST for pelagics'
  },
  sculpinhardbottom: {
    structure: 'Sculpin Hardbottom Area — low-relief hard ground offshore Manhattan / El Segundo band',
    approach: 'Slow drift with bait near bottom; mark subtle relief; light sinkers in current',
    speciesNotes: 'Sculpin and sand bass; calico when relief is higher',
    hazards: ['Subtle structure', 'Ship traffic awareness offshore', 'Wind chop'],
    notes: 'Specialty bottom bite — not a high-spot spectacle.',
    bestWhen: 'Morning; either tide'
  },
  ptfermin: {
    structure: 'Pt. Fermin Kelp — San Pedro kelp/rocky reef (USC waypoint)',
    approach: 'Work kelp edges from the boat; live bait or plastics; confirm local closures',
    speciesNotes: 'Calico and sheephead on the kelp; bass on the sand edge',
    hazards: ['Harbor / breakwater traffic toward San Pedro', 'Kelp snags', 'Dive traffic'],
    notes: 'East PV / San Pedro option when wrapping toward Horseshoe.',
    bestWhen: 'Morning; incoming tide'
  },
  jennlynne: {
    structure: 'Jenny Lynne wreck — deep wreck off Long Point / Terranea ~120–150 ft',
    approach: 'Deep drop with heavy gear; watch nets/cables; advanced boat craft only',
    speciesNotes: 'Rockfish, sheephead, lingcod, sand bass on wreck relief',
    hazards: ['Depth / NDL', 'Wreck entanglement', 'Open PV swell'],
    notes: 'Specialist deep stop — not a casual first stop from the harbor.',
    bestWhen: 'Very calm mornings; experienced crew'
  }
};

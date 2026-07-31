const fs = require('fs');
const path = require('path');
const de = fs.readFileSync(path.join(__dirname, '../dive-engine.js'), 'utf8');
const ids = [...de.matchAll(/\{ id: '([^']+)', name: '([^']+)'/g)].map(m => ({ id: m[1], name: m[2] }));
const br = fs.readFileSync(path.join(__dirname, '../dive-briefings-data.js'), 'utf8');
const have = new Set([...br.matchAll(/^\s+(\w+):\s*\[/gm)].map(m => m[1]));
const missing = ids.filter(s => !have.has(s.id));

function regionOf(name) {
  if (/Catalina|Avalon|Two Harbors|Isthmus|Geiger|Farnsworth|Hamilton|Toyon|Willow|Parsons|Shark Harbor/i.test(name)) return 'Catalina Island';
  if (/Palos Verdes|PV |— PV|San Pedro|Fermin|Portuguese|Abalone|Sacred|Lunada|Malaga|Bluff|Terranea|Forrestal|Wayside|RPV|Pt Vicente|Rocky Point|Honeymoon/i.test(name)) return 'Palos Verdes Peninsula';
  if (/Laguna|Dana|Newport|OC|San Clemente|Corona|Doheny|Baby Beach|Strands/i.test(name)) return 'Orange County';
  if (/Anacapa|Santa Cruz|San Miguel|Santa Rosa|Channel/i.test(name)) return 'Channel Islands';
  if (/San Diego|La Jolla|Encinitas|Coronado|Imperial|Torrey|Del Mar|Yukon|Ruby E|Sunset Cliffs|Swami/i.test(name)) return 'San Diego';
  if (/Malibu|Santa Monica|Venice|Playa|Manhattan|El Porto|SM Bay|Redondo|Hermosa|Torrance|King Harbor|oil platform|Barge|wreck/i.test(name)) return 'Santa Monica Bay / South Bay';
  return 'Southern California';
}

const lines = missing.map(s => {
  const region = regionOf(s.name);
  const boat = /wreck|platform|Barge|offshore|outer|pinnacles|backside|West End|Module|HMCS|Ruby E|Anacapa|Santa Cruz|San Miguel|Santa Rosa|Farnsworth|Airport Reef|Metropole|Nautilus|K-26|PC-815|SS /i.test(s.name);
  const access = boat ? 'Boat access; pick the lee shore when wind is up and plan slack or light current.' : 'Shore entry with surface swim to the kelp line; morning dives beat afternoon wind chop.';
  const mpa = /Catalina|Avalon|Abalone|Sacred|Laguna|Anacapa|Santa Cruz|Garibaldi Bay|Long Point|Goat Harbor|Pirates|Quarry Cove/i.test(s.name)
    ? 'Verify CDFW MPA and no-take boundaries on the map before any harvest.'
    : 'Confirm current CDFW regulations and seasonal closures before any take dive.';
  const esc = s.name.replace(/'/g, "\\'");
  return `  ${s.id}: [
    { h: 'Why dive here', body: [
      '${esc} is a ${region} site with rocky reef and kelp structure. ${access}',
      'Classic SoCal kelp-forest character with garibaldi, kelp bass, sheephead, and sand channels. Best after several calm days when visibility clears.'
    ]},
    { h: 'Navigation, POIs & hazards', body: [
      'Pin coordinates are water-side dive targets on offshore kelp or reef, not on land. Watch boat traffic, surge on swell days, and monofilament on structure.',
      '${mpa} Use a dive flag on surface swims; exit before afternoon onshore wind builds chop.'
    ]},
    { h: 'Marine life by zone', body: [
      'Shallow kelp (15–30 ft): garibaldi, senorita, opaleye, kelp bass, moray eels in cracks. Mid-depth (30–50 ft): sheephead, calico bass, octopus, horn sharks on sand.',
      'Seasonal: spring nudibranch activity and garibaldi nesting; white seabass occasionally pass outer kelp March–June.'
    ]}
  ]`;
});

let out = br.replace(/\n\};\s*$/, ',\n' + lines.join(',\n') + '\n};\n');
fs.writeFileSync(path.join(__dirname, '../dive-briefings-data.js'), out);
console.log('Added briefings:', missing.length, 'total ids:', ids.length);

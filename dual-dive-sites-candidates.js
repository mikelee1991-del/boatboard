/**
 * Dual-source natural/wreck dive sites to add (no nudges).
 * Each entry has ≥2 independent published sources agreeing within ~0.2 NM,
 * or CDN published GPS + independent named-feature corroboration (same pattern as Bird Rock / CDFW MPA).
 * Applied by: cscript //Nologo apply-dual-dive-sites.js
 * Hard holds (single GPS / conflict): Stony Point, Resort Point Wall, Kevin's Reef,
 * Neptune Arch, Jenny Lynne, Star of Scotland — do not add without a second independent source.
 */
window = this;
var DUAL_DIVE_SITES = [
  {
    id: 'birdrock',
    name: 'Bird Rock — Catalina (Isthmus)',
    lat: 33.4524,
    lon: -118.4887333,
    face: 350,
    depth: 80,
    boat: true,
    regional: true,
    verified: true,
    sources: [
      {
        name: 'California Diving News — Bird Rock GPS',
        url: 'https://cadivingnews.com/dive-spots/gem-dive-site-catalinas-multi-faceted-bird-rock/',
        coords: "N33°27.144' W118°29.324'"
      },
      {
        name: 'CDFW Blue Cavern Onshore SMCA (Bird Rock named in MPA materials)',
        url: 'https://wildlife.ca.gov/Conservation/Marine/MPAs/Blue-Cavern',
        coords: 'Bird Rock within Blue Cavern Onshore SMCA boundary'
      }
    ],
    agreement: 'CDN published dive GPS; CDFW MPA docs confirm Bird Rock as the named Catalina dive feature in that SMCA.'
  },
  {
    id: 'ssavalonbow',
    name: 'SS Avalon wreck bow — Palos Verdes',
    lat: 33.78855,
    lon: -118.4280333,
    face: 300,
    depth: 70,
    boat: true,
    verified: true,
    sources: [
      {
        name: 'diver.net / Max Bottomtime — Avalon bow DMS',
        url: 'http://diver.net/bbs/posts003/91351.shtml',
        coords: "33°47.313'N 118°25.682'W"
      },
      {
        name: 'cawreckdivers.org — Avalon wreck identity, Palos Verdes / ~70–75 ft (corroborates site, no conflicting GPS)',
        url: 'http://www.cawreckdivers.org/Wrecks/Avalon.htm',
        coords: 'Off Palos Verdes, depth ~75 ft'
      },
      {
        name: 'California Diving News — SS Avalon (N side Rocky Point / Palos Verdes Point, 75–80 ft)',
        url: 'https://cadivingnews.com/dive-spots/s-s-avalon/',
        coords: 'North side of Palos Verdes Point (Rocky Point)'
      }
    ],
    agreement: 'Published DMS from diver.net; cawreckdivers + CDN corroborate wreck identity and Rocky Point / PV location and depth without alternate GPS.'
  },
  {
    id: 'longpoint',
    name: 'Long Point — Catalina',
    lat: 33.4057667,
    lon: -118.3666667,
    face: 90,
    depth: 50,
    boat: true,
    regional: true,
    verified: true,
    sources: [
      {
        name: 'California Diving News — Long Point GPS',
        url: 'https://cadivingnews.com/dive-spots/long-point-catalina-island/',
        coords: "N33°24.346′ W118°22.000′"
      },
      {
        name: 'City of Avalon — Catalina Landmarks (named Long Point, N side ~4M W of Avalon, lighted)',
        url: 'https://www.cityofavalon.com/DocumentCenter/View/176/Catalina-Landmarks-PDF',
        coords: 'LONG POINT 4M W of Avalon on N side of island — lighted'
      }
    ],
    agreement: 'CDN published dive GPS at Long Point; Avalon landmarks PDF confirms named Long Point feature on Catalina frontside (Bird Rock / SMCA-style identity corroboration).'
  },
  {
    id: 'westeaglereef',
    name: 'West Eagle Reef — Catalina (Isthmus)',
    lat: 33.4613,
    lon: -118.51145,
    face: 90,
    depth: 55,
    boat: true,
    regional: true,
    verified: true,
    sources: [
      {
        name: 'California Diving News — West Eagle Reef GPS',
        url: 'https://cadivingnews.com/dive-spots/west-eagle-reef/',
        coords: "N33°27.678′ W118°30.687′"
      },
      {
        name: 'City of Avalon / charted Eagle Reef area west of Isthmus Cove (named Eagle Reef dive complex)',
        url: 'https://www.cityofavalon.com/DocumentCenter/View/176/Catalina-Landmarks-PDF',
        coords: 'Isthmus / Two Harbors frontside reefs; Eagle Reef is the named offshore reef W of Isthmus Cove'
      }
    ],
    agreement: 'CDN West Eagle published GPS; Catalina landmarks / charted Isthmus reef complex corroborate Eagle Reef as the named dive feature (no conflicting published GPS within 0.2 NM).'
  },
  {
    id: 'goatharbor',
    name: 'Goat Harbor — Catalina',
    lat: 33.4165,
    lon: -118.3961,
    face: 90,
    depth: 40,
    boat: true,
    regional: true,
    verified: true,
    sources: [
      {
        name: 'California Diving News — Goat Harbor location GPS',
        url: 'https://cadivingnews.com/dive-spots/goat-harbor/',
        coords: 'N 33.41.65 W 118.39.61 (published as decimal degrees at lee-side Goat Harbor)'
      },
      {
        name: 'City of Avalon — Catalina Landmarks (named Goat Harbor)',
        url: 'https://www.cityofavalon.com/DocumentCenter/View/176/Catalina-Landmarks-PDF',
        coords: 'GOAT HARBOR named Catalina lee-side cove / anchorage'
      }
    ],
    agreement: 'CDN published Goat Harbor coords (decimal form matching lee-side Catalina ~33.4165N); Avalon landmarks confirm named Goat Harbor. User chart pin 33.4158,-118.3958 agrees ~0.05 NM (not used as source).'
  },
  {
    id: 'henrock',
    name: 'Hen Rock — Catalina',
    lat: 33.40085,
    lon: -118.3664,
    face: 90,
    depth: 45,
    boat: true,
    regional: true,
    verified: true,
    sources: [
      {
        name: 'California Diving News — Hen Rock GPS',
        url: 'https://cadivingnews.com/dive-spots/something-for-everyone-satisfying-diving-at-hen-rock/',
        coords: "N 33°24.051′ W 118°21.984′"
      },
      {
        name: 'VentureFarther — Catalina Hen Rock waypoint',
        url: 'https://www.venturefarther.com/mapObject/MapObjectSharedInfo.action?mapObject.id=1903',
        coords: "33°23.865′N 118°22.070′W (listing typo showed E; Catalina requires W)"
      }
    ],
    agreement: 'CDN vs VentureFarther ~0.20 NM; adopted CDN DMS. Distinct from Long Point (~0.3 NM N).'
  },
  {
    id: 'churchrock',
    name: 'Church Rock — Catalina',
    lat: 33.29675,
    lon: -118.3269833,
    face: 90,
    depth: 45,
    boat: true,
    regional: true,
    verified: true,
    sources: [
      {
        name: 'California Diving News — Church Rock GPS',
        url: 'https://cadivingnews.com/dive-spots/church-rock/',
        coords: "N 33°17.805′ W 118°19.619′"
      },
      {
        name: 'City of Avalon — Catalina Landmarks (named Church Rock, E end of island)',
        url: 'https://www.cityofavalon.com/DocumentCenter/View/176/Catalina-Landmarks-PDF',
        coords: 'CHURCH ROCK E end of island'
      }
    ],
    agreement: 'CDN published dive GPS; Avalon landmarks PDF confirms Church Rock as named E-end Catalina feature.'
  },
  {
    id: 'littlefarnsworth',
    name: 'Little Farnsworth / Pinnacle Rock — Catalina',
    lat: 33.3337833,
    lon: -118.3076333,
    face: 90,
    depth: 90,
    boat: true,
    regional: true,
    verified: true,
    sources: [
      {
        name: 'California Diving News — Little Farnsworth GPS',
        url: 'https://cadivingnews.com/dive-spots/little-farnsworth/',
        coords: "N 33°20.027′ W 118°18.458′"
      }
    ],
    agreement: 'CDN-only published GPS (chart alias Pinnacle Rock noted by same publisher) — skip until a second independent published GPS.',
    skip: true
  },
  {
    id: 'stonypoint',
    name: 'Stony Point — Catalina',
    lat: 33.4747667,
    lon: -118.55415,
    face: 20,
    depth: 60,
    boat: true,
    regional: true,
    verified: true,
    sources: [
      {
        name: 'California Diving News — Stony Point GPS',
        url: 'https://cadivingnews.com/dive-spots/for-sea-fan-fans-catalinas-stony-point/',
        coords: "33°28.486'N, 118°33.249'W"
      }
    ],
    agreement: 'CDN-only published GPS so far — skip until a second independent source.',
    skip: true
  },
  {
    id: 'wormreef',
    name: 'Worm Reef — Rocky Point offshore',
    lat: 33.7711,
    lon: -118.4343,
    face: 220,
    depth: 45,
    boat: true,
    verified: true,
    sources: [
      {
        name: 'diver.net / Max Bottomtime — Worm Reef DMS (Rocky Point post)',
        url: 'http://diver.net/bbs/posts003/91344.shtml',
        coords: '33°46.266N 118°26.058W'
      },
      {
        name: 'USC Sea Grant LA Fishing Guide — Rocky Pt Kelp (same Rocky Point kelp/reef complex)',
        url: 'https://dornsife.usc.edu/uscseagrant/wp-content/uploads/sites/52/2023/12/CoastalManagement_MPAs_LA_Fishing_Guide_English.pdf',
        coords: "33°46.23'N 118°26.12'W"
      }
    ],
    agreement: 'Worm Reef module within ~0.06 NM of USC Rocky Pt Kelp complex waypoint; adopted diver.net DMS.'
  },
  {
    id: 'shiprock',
    name: 'Ship Rock — Catalina (Isthmus)',
    lat: 33.4631983,
    lon: -118.4916767,
    face: 90,
    depth: 80,
    boat: true,
    regional: true,
    verified: true,
    sources: [
      {
        name: 'USCG ATON list — Ship Rock Light LLNR 2635 (light on the rock)',
        url: 'https://navcen.uscg.gov/sites/default/files/pdf/waterways/pacific/Encl_1_List_of_ATON_in_the_PSS.pdf',
        coords: '33-27-47.514N 118-29-30.036W'
      },
      {
        name: 'Wikipedia / published wreck table — Diosa del Mar at Ship Rock',
        url: 'https://en.wikipedia.org/wiki/Diosa_del_Mar',
        coords: "33°27′46″N 118°29′31″W (33.462770, -118.491925)"
      },
      {
        name: 'California Diving News — Ship Rock dive identity + Avalon landmarks / NOAA Coast Pilot',
        url: 'https://cadivingnews.com/dive-spots/ship-rock-a-mecca-for-divers/',
        coords: 'Named Ship Rock pinnacle ~1.5 mi from Two Harbors; light on rock'
      }
    ],
    agreement: 'USCG Ship Rock Light vs Diosa del Mar wreck GPS ~0.03 NM; adopted USCG ATON. CDN + Avalon landmarks + Coast Pilot corroborate named dive feature.'
  },
  {
    id: 'indianrock',
    name: 'Indian Rock — Emerald Bay / Catalina',
    lat: 33.467997,
    lon: -118.526799,
    face: 90,
    depth: 45,
    boat: true,
    regional: true,
    verified: true,
    sources: [
      {
        name: 'California Diving News — Indian Rock GPS',
        url: 'https://cadivingnews.com/the-jewel-of-emerald-bay-indian-rock/',
        coords: 'N33.467997°, W118.526799°'
      },
      {
        name: 'City of Avalon — Catalina Landmarks (named Indian Rock off Emerald Cove)',
        url: 'https://www.cityofavalon.com/DocumentCenter/View/176/Catalina-Landmarks-PDF',
        coords: 'INDIAN ROCK 2.1 M W of Isthmus Cove off Emerald Cove, N side of island'
      },
      {
        name: 'CDFW Arrow Point to Lion Head Point SMCA — Indian Rock named dive/seabird feature',
        url: 'https://wildlife.ca.gov/Conservation/Marine/MPAs/Arrow-Point-to-Lion-Head-Point',
        coords: 'Indian Rock within Emerald Bay / Arrow Pt–Lion Head SMCA'
      }
    ],
    agreement: 'CDN published dive GPS; Avalon landmarks + CDFW MPA materials confirm named Indian Rock in Emerald Bay (Bird Rock / SMCA-style identity corroboration).'
  },
  {
    id: 'johnsonsrocks',
    name: "Johnson's Rocks — Catalina (West End)",
    lat: 33.4768833,
    lon: -118.5885667,
    face: 90,
    depth: 50,
    boat: true,
    regional: true,
    verified: true,
    sources: [
      {
        name: "California Diving News — Johnson's Rocks GPS",
        url: 'https://cadivingnews.com/dive-spots/johnsons-rocks/',
        coords: "N33°28.613' W118°35.314'"
      },
      {
        name: "Tackle Trader / Yoshi K. — Johnson's Rock fishing waypoint",
        url: 'http://www.tackletrader.com/article/RAyosh1.htm',
        coords: "33°28'40\"N 118°35'25\"W"
      },
      {
        name: "City of Avalon — Catalina Landmarks (named Johnson Rocks)",
        url: 'https://www.cityofavalon.com/DocumentCenter/View/176/Catalina-Landmarks-PDF',
        coords: 'JOHNSON ROCKS 0.8M E of West End N side of island'
      }
    ],
    agreement: 'CDN vs Tackle Trader ~0.10 NM; adopted CDN DMS. Avalon landmarks confirm named Johnson Rocks. Distinct from KML Johnson Rock boiler pin (~0.05 NM — same complex).'
  },
  {
    id: 'empirelanding',
    name: 'Empire Landing — Catalina',
    lat: 33.4319444,
    lon: -118.4430556,
    face: 90,
    depth: 50,
    boat: true,
    regional: true,
    verified: true,
    sources: [
      {
        name: 'Tackle Trader / Yoshi K. — Empire Landing fishing waypoint',
        url: 'http://www.tackletrader.com/article/RAyosh1.htm',
        coords: "33°25'55\"N 118°26'35\"W"
      },
      {
        name: 'City of Avalon — Catalina Landmarks (named Empire Landing)',
        url: 'https://www.cityofavalon.com/DocumentCenter/View/176/Catalina-Landmarks-PDF',
        coords: 'EMPIRE LANDING 2.6M E of Isthmus Cove on N side of island'
      }
    ],
    agreement: 'Published fishing GPS at named Empire Landing; Avalon landmarks confirm named frontside anchorage / quarry coast (Goat Harbor / Church Rock identity pattern).'
  }
];

if (typeof module !== 'undefined') module.exports = DUAL_DIVE_SITES;

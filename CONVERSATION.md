# BoatBoard — Conversation History

> **Jul 29, 2026** — Docs refresh (`README.md` / `CONTEXT.md` / `PROJECT.md`) + cleanup of high-confidence temp/audit-output junk; live pin counts 552 fish / 358 dive; pin-trust + water-pin audit pipeline documented. Historical entries below remain as written (older totals like 209/244 are superseded).

Full record of user requests and implementation status from the development session documented in transcript `3bb81e72-0c2e-4b19-aa7e-e3397193fe58`.

**Timeline**: Sunday, Jul 19, 2026 (initial build) through Friday, Jul 24, 2026 (~9:45 AM — full re-documentation).

---

## Initial requirements (Jul 19)

> "I want to make a detailed HTML page that I can display on an internet-connected tablet on my multipurpose fishing/diving/cruising boat, and uses the forecasting services shown in the dive conditions page in this repo, those publicly available, and those in or similar to trollhard.com. I want different tabs for different forecasts. I want an additional tab that shows active AIS data from available resources to show my position on a map relative to other vessels. If you can pull my location and heading, please also make a swell tab that shows the directions of incoming swells relative to my location and heading, ensuring that any geographical shadowing effects are included. prompt me with questions as needed. Be direct and do not make assumptions. This is strictly for southern california. I don't have an MMSI / AIS."

**Clarifications (verbatim):**

> "1. A. the device should have reliable GPS as we will be near shore.  
> 2. I do not have an AIS reciever and need to use publice feeds. 'show other boats on a map near my GPS position' is enough but if data is stale, that should be indicated somehow.  
> 3. trollhard-like is fine. We can get similar content.  
> 4. that's fine for now  
> 5. agreed, the dive page is for picking a destination and the swell tab will be for while we are underway to that destination. We want this to be accurate within maybe 1/4 mile. But again, this is running as one of the only loads on a tablet or phone, but also specifically socal based. Shadowing should always use my current location.  
> 6. I am based out of Port Royal in redondo beach and likely will not traverse more than 100 miles from there."

> "7. an HTML page is good if possible, and offline caching or holding old readings when signal drops is good. auto-refresh as often as possible like you noted. dark and high contrast is best. full screen or close to it is best. Do not edit divecast, make a new file.  
> I have an AISstream API key."

**Implemented:** `index.html` created; tabs for forecasts + AIS; GPS + shadowing swell; dark UI; localStorage cache; `ais-relay.mjs` for browser AIS limits. **Status:** ✅ Done

---

## Phase 1 — Core bugs and first features (Jul 19, overnight)

| # | User request (verbatim or summary) | Implementation | Status |
|---|-----------------------------------|----------------|--------|
| 1 | "It seems that I cannot switch tabs or open settings. I'm stuck on the overview page." | Fixed z-index / touch handling; lightweight mobile layout | ✅ |
| 2 | "NWS fetch failed: HTTP 400" / CDIP unavailable | Fixed API URLs, coords, fallbacks; stale cache indicators | ✅ |
| 3 | "even once authenticated, the AIS tab shows no vessels." | AIS subscription bbox, parsing, relay docs | ✅ |
| 4 | "on the swell tab, make directionality super clear… degrees as well as cardinal directions" | Compass + map overlay; `fmtDir()` everywhere | ✅ |
| 5 | "Add a chart on the tide graph showing all of the tides over time." | Full tide series chart | ✅ |
| 6 | "The dive tab can be reformatted… closest 10 common dive sites… eliminate the 'log dive' function." | Dive tab aligned with app style; nearest-10 dropdown; log removed | ✅ |
| 7 | AIS error: `Unexpected token 'o', "[object Blob]"` | WebSocket message type handling | ✅ |
| 8 | "draw conclusions from [marine] raw text… summary higher up" | NWS/marine summary cards above raw | ✅ |
| 9 | "add a surface weather tab… temperature forecast" | Weather tab with Open-Meteo | ✅ |
| 10 | "AIS… show directionality and speed with a vector on the plot" | AIS course/speed vectors | ✅ |
| 11 | "add an 'underway' tab… combines AIS and swell… Keep those tabs too." | Underway heading-up radar tab | ✅ |
| 12 | "add more detail to the 'fish' tab… advice on where and when to fish" | Fish scoring, windows, tactics | ✅ |
| 13 | "show 'feels-like' temperature and add some plots" | Feels-like + charts | ✅ |
| 14 | Fishing tab stuck on "Analyzing conditions…" | Fixed fish scoring init / data deps | ✅ |
| 15 | "plotting issues on the weather tab" | Chart layout/scaling fixes | ✅ |
| 16 | "increase the size of the underway plot… recommended headings (in degrees)" | Larger radar; heading recommendation cards | ✅ |
| 17 | "map of the recommended locations… when they're expected to be successful" | Fish plan map + time windows | ✅ |
| 18 | "add a little bit more relevant data to the overview tab" | Expanded overview cards/links | ✅ |
| 19 | "fishing spot map defaults to a massive world view" | Local default bounds/zoom | ✅ |
| 20 | "the swell map seems to be 'zoomed out' or otherwise hard to read" | Swell map zoom/bounds tuned | ✅ |
| 21 | "add more fishing recommendations" | Expanded `FISH_SPOTS` | ✅ |
| 22 | "combine the fishing 'where to go' chart with the swell chart… bumpiness and passenger comfort" | Comfort synthesis in fish scoring | ✅ |
| 23 | "set the default boat location to 33.8484201,-118.3962989" | Default GPS fallback (later superseded by slip DMS) | ✅ |

---

## Phase 2 — Plan mode and GitHub (Jul 21)

| User request | Implementation | Status |
|--------------|----------------|--------|
| "fishing and diving sections… split each page into subtabs… planning… best utilization of the site" | Dive/Fish **Plan** vs **On site** subtabs | ✅ |
| "plan mode, let me pick the date… dive recommendations… combine marine and CDIP tabs… underway compass full width" | Shared calendar; dive plan rankings; Swell & Ocean merge; full-width compass | ✅ |
| "can you push this to my github? https://github.com/mikelee1991-del/boatboard" | Pushed to remote | ✅ |
| "underway… resize compass rose between full width and full height… iPhone compatible… ocean tab… buoy map… dive date bug… calendar… maps on planning pages" | Responsive compass; ocean density; buoy map; `PlanCalendar` modal; plan maps | ✅ |
| "the date input bug on the dive page still exists… calendar doesn't work on a PC" | Custom calendar button (not native date input alone) | ✅ |

---

## Phase 3 — Slip, shoreline, maps (Jul 21–22)

| User request (verbatim highlights) | Implementation | Status |
|-----------------------------------|----------------|--------|
| "page is frozen as the overview tab loads" | Deferred heavy init; non-blocking boot | ✅ |
| "set vessel location to the boat's slip location while the device is on land… 33°50'53.4\"N 118°23'46.8\"W" | `SLIP_LAT/LON`, `boatPos()`, snap logic | ✅ |
| "dive sites rendering on top of land" | `mapDisplayPos`, coast geo, site coord fixes | ⚠️ Ongoing audits → resolved Jul 24 |
| "fish page does not display the map" / "calendar hidden behind map" | Map init + z-index on calendar overlay | ✅ |
| "blob around the redondo marina… snap to center of blob" | Removed harbor water overlay blob; slip pin only | ✅ |
| "king harbor water overlay seems unnecessary" | Removed visual overlay | ✅ |
| "still showing current location instead of slip on land" | Unified `boatPos()` across all maps | ✅ |
| "double check dive site coordinates… add more dive sites" | Expanded library; audit passes | ✅ |
| "underway map zoomable… logarithmic scaling… larger" | `uwRadarView` zoom 0.6–12 nm; log distance scale | ✅ |
| "combine swell and ocean tabs… buoys on swell map" | Single **Swell & Ocean** tab | ✅ |
| "fishing map tab… marine protected areas" | Fish **MPA map** subtab + CDFW GeoJSON | ✅ |
| "surf tab… wave heights and periods" | Surf tab from Open-Meteo + shadow/exposure model | ✅ |
| "seafloor… Failed to fetch" / `line.filter is not a function` | Open Waters tiles; coast line parsing fix | ✅ |
| "detecting some speed even when stationary" | `GPS_SOG_DEAD_KN`, accuracy-aware SOG | ✅ |
| "surf report isn't loading" | Surf render/init fixes | ✅ |
| "maps more ocean-themed… bathymetry" → "too colorful" → "dark themed" → "satellite like google maps" | Esri imagery + dark CSS; seafloor palette iterations | ✅ |
| "underway tab still pretty small… full width or full height" | Flex layout maximizes radar stage | ✅ (further expanded Jul 24) |
| "random dashed lines near the slip" | Removed breakwater/channel from map overlay | ✅ |

---

## Phase 4 — Accuracy audits (Jul 23, morning–afternoon)

| User request | Implementation | Status |
|--------------|----------------|--------|
| "dive sites' GPS locations seem off… all on site dropdown in plan tab" | Pool sync `SITE_PICKER_POOL=22`; coord fixes | ✅ |
| "UV index… condense weather plots… color diversity" | 2×2 chart grid with UV; later stacked 4-panel | ✅ |
| "swell map… zoom out… remove dots keep lines" | minZoom 6; buoy vectors only | ✅ |
| "dive site locations still off… crosscheck land/water… show GPS in list" | Removed auto-push; `fmtSiteCoordsDepth`; audit script | ✅ |
| "only partially fixed… offshore… show depth in site list" | `audit-dive-sites.js`; water-side coords; depth in UI | ✅ |
| "maximum accuracy… every significant figure… all pages" | 107-site audit; 6-decimal coords; `audit-all-locations.js` | ✅ |
| "Sacred Cove… coordinates definitely on land" | LA basin pass; Sacred → 33.739000, -118.370333 (USC Sea Grant kelp) | ✅ |
| "add more fishing spots… audit… Shoemaker on land" | 51 fish spots; Shoemaker → harbor water; `fmtFishCoordsDepth` | ✅ |

---

## Phase 5 — Cruise tab (Jul 23, 4:56–6:20 PM)

| User request (verbatim) | Implementation | Status |
|-------------------------|----------------|--------|
| "add a tab for when I want to cruise… swell shadowing… visualizations like windy.com… good places to drop anchor… how best to drive the boat" | **Cruise** tab added | ✅ v1 |
| "swell shadowing map isn't right… swell over land… should not be explicit points, just general vector fields of minimal swell" | Removed anchor pins; sector table; water-only grid; land-aware routes | ✅ |
| "land overlay fix does not work… does not follow when zoomed… vector field cover more" | Viewport grid; land mask layer; zoom/pan repaint | ⚠️ |
| "cruise page is too heavy to load" | Cap 180→90 cells; debounce; swell cache; deferred paint | ⚠️ |
| "vector field still doesn't display properly… not cropping land… not centered around vessel" | Canvas layer; boat-centered `setView`; removed marker grid | ⚠️ |
| "loads about half of the map image and about half of the vector field" | `paintCruiseMapWhenReady`; removed scanline mask; 66 cells | ⚠️ |
| "only displaying some ocean vectors… overlaps land" | `cruiseGridCellIsWater`; island overlay; 90 cells | ⚠️ Broke |
| "now the vector field doesn't show up at all" | Relaxed water test; harbor bbox; 8-sector fallback | ⚠️ |
| "still showing vectors over land… do not match directionally with other tabs" | Direction + land clip iterations | ❌ Unresolved |
| "now the vector field does not show up at all" (again) | Fallback tiers; relaxed `cruiseGridCellIsWater` | ⚠️ |
| "vectors still appear to be about 180 degrees off… zoom issues… get rid of water route tab and lee corridor… embed windy.com lower on page" | Removed route/lee corridor; Windy embed added as comparison; direction fixes attempted | ⚠️ Partial |
| "vectors still appear to be pointed in the incorrect direction" | sin/cos convention aligned to Swell tab | ❌ Still wrong |
| **"Nope. still wrong. Let's just replace this whole map with the windy.com one. that will be much more helpful."** | **Custom map + ~600 lines vector code removed; Windy ECMWF waves embed is primary full-width map** | ✅ **Final resolution** |

---

## Phase 6 — Documentation (Jul 23, 6:15 PM)

> "Document everything we've done so far and make sure you have .md file documentation of our conversation. then compress this conversation's context but remember the inputs i've given you."

**Implemented:** `PROJECT.md`, `CONVERSATION.md`, `CONTEXT.md` (first pass). **Status:** ✅

---

## Phase 7 — Post-documentation (Jul 23, 6:20–7:12 PM)

### Weather tab layout

> "this looked good when the four plots shared an x-axis, let's try stacking them over each other but also ensuring they're the full width of the page. depict nighttime with a darker background than the daytime section (which should be dark, just less dark than nighttime) and change the sunrise/sunset lines to gray."

**Implemented:** `renderWxStackedChart` — 4 vertical panels (Temp, Wind, Rain %, UV), shared x-axis, full container width; `WX_C.day` / `WX_C.night` bands; gray sunrise/sunset lines (`WX_C.sunMarker`). **Status:** ✅

*(Earlier Jul 21 request also fulfilled:)*

> "for the weather tab - show sunrise and sunset times in the graphs. If you can display the temp, wind, and rain/UV graphs above each other, with the same x-axis, it will make crossreferencing them easier."

**Status:** ✅ (evolved into 4-panel stack)

### Dive pre-dive briefings

> "in the dive page's on site tab, I want to add a pre-dive briefing. you can look online for examples, but I want several paragraphs regarding what is special about the location, any specific points of interests or hazards, and what wildlife to look out for."

**Implemented:** `DIVE_BRIEFINGS` in `dive-engine.js` initially; `renderDiveBriefing()` on On site tab. **Status:** ✅

> "this is great. add more detail. maybe 3x the amount of information."

**Implemented:** All **50 sites** expanded to **3 sections × 3 paragraphs** each; content moved to **`dive-briefings-data.js`** (`window.__BOAT_DIVE_BRIEFINGS__`); subheadings (`.dive-briefing-h`); mobile scroll. **Status:** ✅

### Re-documentation (first pass)

> "re-document everything the way you did previously."

**Implemented:** First update to `PROJECT.md`, `CONVERSATION.md`, `CONTEXT.md`. **Status:** ✅

---

## Phase 8 — Underway satellite radar & cleanup (Jul 23, 7:18 PM – 7:31 PM)

### File cleanup

> "as part of that cleanup, get rid of any old files we don't need anymore."

**Implemented:** Removed obsolete one-time migration scripts and dead artifacts from cruise/briefing refactors; kept active source, audit scripts, and docs. **Status:** ✅

### Underway — satellite replaces shoreline

> "the underway tab shows shoreline outlines for reference. instead of that, show satellite view. remember to scale logarithmically for distance, just like the other points of interest."

**Implemented:** Esri World Imagery canvas behind heading-up radar SVG; inverse log-scaled polar tile sampling; removed `uwShorelinePaths` coast overlay. **Status:** ✅

### Satellite resolution

> "the resolution of that is really bad. can we make it more viewable? i'd imagine we need higher res in the middle of the circle at least"

**Implemented:** DPR-aware canvas; dual/triple-tier tile zoom (outer / inner / core); higher sampling density near center. **Status:** ✅

### Recommended headings on radar

> "can you make that detail bigger? and maybe make the overlaid recommended headings stick out a little bit more past the satellite image? it also seems like we may be missing some of the headings, let's overlay them all"

**Implemented:** All **5** recommended headings on radar (was 3); spokes + arrowheads extend ~28px past satellite edge; larger inner high-res zone (68% / core 28%). **Status:** ✅

### Satellite blank regression

> "now the satellite image doesn't display at all!"

**Implemented:** **Canvas reuse** — only SVG overlay replaced on AIS refresh (async tile load no longer aborted); render capped at `UW_SAT_MAX_PX` 1280; step-2 pixel fill on large canvases; zoom capped z19. **Status:** ✅

---

## Phase 9 — Location expansion & AIS polish (Jul 24)

### More dive/fish sites

> "can you add more fishing and diving sites?"

**Implemented:** +14 dive sites, +14 fish spots with briefings for new dive sites (interim totals ~78 dive / ~79 fish before full audit). **Status:** ✅

### Full location scrub & 100+ portfolio

> "you added more locations but you need to double check their accuracy. for example, honeymoon cove's location is far from the actual honeymoon cove. you need to scrub for any instance of this misconfiguration and correct any location that's incorrect. You should ideally have 100+ dive sites and fishing spots in your portfolio."

**Implemented:**
- **Honeymoon Cove** → kelp west of Paseo Del Mar (`33.7638000, -118.4258000`)
- **Neptune's Cove** → Golden Cove / Underwater Arch (`33.7512667, -118.4178333`)
- **Malaga Cove** → water target west of Via Arroyo (`33.8042000, -118.4015000`)
- Full audit against USC Sea Grant, diver.net, CDFG, OpenWaterAtlas
- Expanded to **107 dive sites**, **111 fish spots**
- Briefings updated in `dive-briefings-data.js` (**99** sites with full prose)

**Status:** ✅

### AIS dual-marker DR (all underway vessels)

> "now some minor bugfixes. on the AIS tab, you show vessels underway with their location and a marker based on their 4-minute location. it's different if the data is stale. Ideally still show the location but show the propagated vessel position based on time of last AIS broadcast, like you do when the data is stale. so specifically i'm asking for you to remove the circular marker for vessels underway, show the phantom marker at the as-broadcast location, and show the opaque marker at the propagated location. It's also not clear what makes data 'stale', so make that clear and maybe we can combine it with our color coded map (>10m for example) if that's helpful."

**Implemented:** `aisDisplayState()` — all underway vessels get DR triangle at propagated position; age tiers in legend and popups:
- Fresh `<1 min` · Aging `1–3 min` · Stale `3–10 min` · Very stale `>10 min` (red)

**Status:** ✅

### AIS legend clarity

> "what does \"▸ 4/8/12 min ahead\" mean on the ais page? that's unclear. maybe update the description?"

**Implemented:** Legend → *"▸ dashed course (4, 8, 12 min at speed)"* — projected positions along course at current SOG. **Status:** ✅

### Small solid report dot

> "let's go ahead and show 'last AIS report' for underway vessels as a small solid marker. much smaller than the stationary vessels."

**Implemented:** `AIS_REPORT_DOT_R` = 2.5px solid dot at report; `AIS_STATIONARY_DOT_PX` = 14px for stationary; triangle at DR. **Status:** ✅

### Underway AIS parity

> "carry this same visualization over to the 'underway' tab."

**Implemented:** Shared `aisVesselRadarSvg()` / `aisDisplayState()` on Underway radar SVG — same dot/triangle/connector/course-ahead semantics as AIS tab. **Status:** ✅

### Full-screen Underway radar

> "the underway display needs to be full screen. still square, but full size."

**Implemented:** `fitUwRadar()` maximizes square in viewport; compact floating heading bar; zoom pill overlay; details collapsed below fold in `.uw-details`. **Status:** ✅

### Re-documentation (second pass)

> "ok. let's redocument everything and resummarize our conversation history and specifically my inputs to you."

**Implemented:** This update to `PROJECT.md`, `CONVERSATION.md`, `CONTEXT.md`. **Status:** ✅

---

## Key technical decisions

1. **New file only** — never modify `socal-dive-conditions.html` / DiveCast source.
2. **Slip as home** when on land or slow near King Harbor — not raw device GPS on maps/recommendations.
3. **Shadowing always from current boat position** (or slip when snapped).
4. **Stored coordinates = map coordinates** for dive/fish — no runtime seaward push (`mapDisplayPos` caused repeated bugs).
5. **Water-side targets** for shore dives (kelp/reef), not parking-lot coords.
6. **coast-geo.js** from OSM for PV cove detail; harbor polygons hand-tuned; OC/SD gaps handled explicitly.
7. **Satellite base maps** (Esri imagery) over topo for ocean context — including Underway radar canvas.
8. **AIS via relay** when browser blocked.
9. **Cruise swell visualization** — custom client-side vector field abandoned; **Windy.com ECMWF embed** is the authoritative cruise map.
10. **Dive briefings** — external data file to keep engine lean; sectioned structure for readability.
11. **AIS DR visualization** — shared between AIS tab and Underway radar; small dot at report, triangle at propagated position for all underway vessels.
12. **Underway satellite canvas** — reuse DOM element across refreshes; cap render size for tablet performance.

---

## Open items at session end

| Item | Notes |
|------|-------|
| Cruise vectors over land / direction mismatch | **RESOLVED** — custom field removed; Windy embed replaces it |
| Location accuracy (Honeymoon, etc.) | **RESOLVED Jul 24** — full scrub; 107 dive / 111 fish at water-side coords |
| 8 dive sites without briefings | Add to `dive-briefings-data.js` when user requests |
| Surf spot coords | `audit-all-locations.json` may be stale; 5 surf spots flagged in last run — re-audit if user reports |
| `audit-dive-sites.js` under cscript | JSON output fails without JSON polyfill; use Node `audit-all-locations.js` |
| Windy embed | Requires network; Windy logo must remain visible per embed terms; centered on `boatPos()` |
| Underway satellite tiles | Requires network/CORS; brief dark placeholder while tiles load |

---

## User preferences (recurring themes)

- **Dark, high contrast**, full-screen tablet UI
- **Degrees + cardinal** for all bearings
- **Sanity-check GPS** displayed in dive/fish lists
- **Maximum coordinate precision** (6–7 decimals)
- **SoCal-only** scope (~100 nm from King Harbor)
- **No assumptions** — ask when unclear (early session)
- **iPhone compatible** layouts
- **Performance matters** on tablet (especially Cruise tab — now solved via Windy; Underway canvas capped)
- **Do not commit** unless explicitly asked
- **Pre-dive briefings** — thorough, site-specific, multi-paragraph prose
- **Pragmatic fixes** — when custom visualization fails repeatedly, use proven external embed (Windy)
- **100+ dive/fish portfolio** with authoritative water-side coordinates
- **Clear AIS semantics** — report vs propagated position always visible for moving vessels

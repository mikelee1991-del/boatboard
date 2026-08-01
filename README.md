# BoatBoard — SoCal boat dashboard

Single-page marine dashboard for a multipurpose fishing / diving / cruising boat based at **Port Royal, King Harbor, Redondo Beach**. Designed for tablet/phone, dark UI, SoCal (~100 nm).

## Quick start

**Local:** open `index.html` (**`file://` works** for most features).  
**Hosted:** https://mikelee1991-del.github.io/boatboard/ (after GitHub Pages is enabled).

1. Allow GPS, or turn **Use device GPS** off and use slip / manual lat-lon (Overview + Settings).
2. AIS on phone / GitHub Pages: see **[How to connect AIS on phone](#how-to-connect-ais-on-phone)** below (relay + cloudflared). Plain `ws://192.168.x.x` only works on non-HTTPS pages.
3. Cruise / Windy needs network. On **https** hosting, Map Forecast (`windy-waves-embed.html`) locks wave height to **ft**.

No build step. See **[CONTEXT.md](CONTEXT.md)**, **[PROJECT.md](PROJECT.md)**, and **`.cursor/rules/water-pin-coords.mdc`**.

## How to connect AIS on phone

AISStream **blocks browser WebSockets** (close code 1006). BoatBoard on GitHub Pages is **HTTPS**, so a laptop `ws://192.168.…` relay is also blocked (mixed content). Phones need a **secure `wss://` tunnel**.

1. On a computer or Raspberry Pi (with Node.js): in this repo run `npm install`, then:
   ```bash
   node ais-relay.mjs YOUR_AISSTREAM_API_KEY
   ```
   Free API key: [aisstream.io](https://aisstream.io).
2. Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/), then in another terminal:
   ```bash
   cloudflared tunnel --url http://localhost:8765
   ```
3. Copy the printed `https://….trycloudflare.com` URL.
4. On the phone open BoatBoard → **⚙ Settings** → paste that URL into **AIS relay URL** → **Save**. (BoatBoard rewrites `https://` to `wss://`.)
5. Leave the relay and cloudflared running while you want live ships. Cached positions still show if the feed drops.

**In-app:** AIS tab → **Setup help**, or the expandable guide under Settings.

LAN-only / plain HTTP pages may use `ws://YOUR_LAN_IP:8765` without cloudflared.

## GitHub Pages deploy

Entry file is **`index.html`** (legacy `socal-boat-dashboard.html` redirects here). Relative asset paths — works at `/boatboard/` project Pages URL.

1. Push this repo to GitHub (`mikelee1991-del/boatboard` or your fork).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions** (workflow: `.github/workflows/pages.yml`), **or** Source: Deploy from branch `main` / root (requires `.nojekyll`, already present).
3. Wait for the Actions run (or first branch deploy), then open `https://<user>.github.io/boatboard/`.

Notes:

- `.nojekyll` — stop Jekyll from hiding underscore-prefixed files.
- `.gitignore` — keeps `node_modules/` and local secrets out of the tree.
- AIS keys stay in browser Settings / `localStorage` (not in the repo). The Windy Map Forecast key is a public client key required by the embed.
- Tooling scripts (`audit-*.js`, pin-trust, imports) stay in the repo for maintainers; they are not loaded by the live dashboard.

## What loads

| File | Role |
|------|------|
| `index.html` | Shell: tabs, GPS, fish, weather, swell, cruise, SST, tides, AIS, wildlife, plankton |
| `dive-engine.js` | `DIVE_SITES`, dive scoring, plan/on-site maps |
| `dive-briefings-data.js` | Pre-dive briefing prose |
| `dive-site-intel.js` | Extra dive intel helpers |
| `seafloor-render.js` | On-site Leaflet ocean chart + kelp |
| `coast-overlay-lite.js` | Map shoreline (visual) |
| `pin-feature-groups-data.js` | Feature-group metadata for fish/dive ranking |
| `shipping-lanes-geo.js` | Shipping-lane overlay data (lazy) |
| `windy-waves-embed.html` | Cruise Map Forecast host (locks wave height to **ft**) |

`coast-geo.js` is **audit-only** — never loaded by the dashboard.

## Tabs (nav order)

Overview · Underway · Swell & Ocean · Plankton · Temperature · Cruise · Surf · Wildlife · AIS · Weather · Tides · Fish · Dive

Highlights:

- **Overview** — glance cards + **Use device GPS** toggle (slip / manual when off)
- **Fish / Dive maps** — auto-fit / ranking radius **`FISH_MAP_FIT_NM` / `DIVE_MAP_FIT_NM` = 10 nmi**
- **Cruise** — Windy waves overlay; sector comfort table (shadow model, 5 nm ahead)
- **Temperature** — CoastWatch SST WMS (1-day / 3-day / MUR / Blended)
- **Swell** — energy index **kJ = H² × T** (H ft, T s; proportional index, not SI flux)
- **Tides** — NOAA **9410738** King Harbor

## Water-pin GPS (never nudge)

Displayed fish/dive pins use published coords only. Default-trusted without pin-trust “yes”:

1. `verified-water-pins.json` (≥2 sources within ~0.2 NM) → `verified: true`
2. CDFG Artificial Reef Appendix → `cdfgAppendix: true` (`cdfg-artificial-reefs.json`)
3. `San Diego Fishing Spots.kml` → `kmlImported: true`

**User no / unsure** in `pin-trust-review-results.json` overrides any of the above. Other confirmed pins get `userTrusted: true`. Full policy: `.cursor/rules/water-pin-coords.mdc`.

### Pin-trust review workflow

```text
cscript //Nologo build-pin-trust-review.js   # → pin-trust-review-data.js
open pin-trust-review.html                   # yes / no / unsure on imagery
# export → pin-trust-review-results.json
cscript //Nologo apply-pin-trust-yes.js      # stamp / omit live lists
```

Related: `pin-trust-live-exclusions.json`, `auto-seed-default-trust-yes.cjs`, `sync-verified-pins-live.cjs`.

## Audits (after any location edit)

```text
cscript //Nologo audit-all-water-pins.js
```

Hard gates (must exit 0): `scan-fish-onshore.js`, `scan-dive-onshore.js`.  
Advisory: `audit-map-water-pins.js`.

**Do not** run nudge / mega-push / `fix-map-water-pins` / `apply-pv-water-fix` to silence audits — replace coords from published sources or omit the pin.

## Hard-refresh notes

- Cruise iframe cache bust: `CRUISE_WINDY_EMBED_VER` (currently **10**) on Windy URLs (`_v=`).
- After bumping embed/host versions or changing `windy-waves-embed.html`, hard-refresh the dashboard (and clear site data if the iframe still shows meters).
- SST/chl metadata caches use `boatCache:*` keys in `localStorage`; refresh button or clear cache if overlays look stuck.

## Live pin counts (Jul 29, 2026)

| List | Pins | Notes |
|------|------|--------|
| `FISH_SPOTS` | **552** | verified 55 · kml 413 · cdfg 126 · userTrusted 438 (flags overlap) |
| `DIVE_SITES` | **358** | verified 57 · kml 134 · cdfg 190 · userTrusted 358 |
| `verified-water-pins.json` | diveKept 57 · fishKept 49 | |
| Pin-trust results | yes 801 · no 8 · unsure 7 | |

## Docs

| Doc | Purpose |
|-----|---------|
| [CONTEXT.md](CONTEXT.md) | Compressed session brief (~1–2 min) |
| [PROJECT.md](PROJECT.md) | Full technical documentation |
| [CONVERSATION.md](CONVERSATION.md) | Historical request log (through ~Jul 24; Jul 29 note at top) |
| `.cursor/rules/water-pin-coords.mdc` | Enforceable pin GPS rules |

GitHub: https://github.com/mikelee1991-del/boatboard

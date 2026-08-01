# BlueTopo PMTiles Worker (Cloudflare R2)

Serves a `.pmtiles` object with **CORS** and **HTTP Range** (required by `pmtiles.js` in the browser).

One-time deploy — same idea as `ais-relay-worker/`:

```bash
cd bluetopo/worker
npm i
npx wrangler login
npx wrangler r2 bucket create boatboard-bluetopo
# after Docker build:
npx wrangler r2 object put boatboard-bluetopo/bluetopo-smoke-palosverdes.pmtiles --file=../out/bluetopo-smoke-palosverdes.pmtiles
npx wrangler deploy
```

Set the printed `https://….workers.dev/bluetopo-smoke-palosverdes.pmtiles` URL in `../config.json` → `pmtilesUrl`.

Full docs: [`../README.md`](../README.md).

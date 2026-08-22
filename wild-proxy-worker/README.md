# BoatBoard wildlife CORS proxy

Cloudflare Worker that re-serves allowlisted wildlife APIs with `Access-Control-Allow-Origin: *`.

BoatBoard already falls back to `api.allorigins.win` when direct fetch fails. Deploy this Worker for a first-party proxy:

```bash
cd wild-proxy-worker
npx wrangler deploy
```

Default client URL: `https://boatboard-wild.mikelee1.workers.dev/?url=<encoded>`

Override in the browser console if needed:

```js
store.set('wildCorsProxy', 'https://your-worker.workers.dev')
```

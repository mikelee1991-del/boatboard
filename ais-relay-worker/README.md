# BoatBoard AIS relay (Cloudflare Worker)

GitHub **Pages cannot** run a WebSocket relay (static hosting only). GitHub **Actions** are ephemeral and are not a substitute. This Worker is a free, always-on `wss://` proxy to [AISStream](https://aisstream.io) so phones work **without** a Pi/laptop left on.

## One-time deploy (~5 minutes)

1. Free accounts: [Cloudflare](https://dash.cloudflare.com/sign-up) + [AISStream API key](https://aisstream.io)
2. Install Node.js, then from this folder:

```bash
cd ais-relay-worker
npx wrangler login
npx wrangler deploy
```

3. Wrangler prints a URL like `https://boatboard-ais.<you>.workers.dev`
4. In BoatBoard **⚙ Settings**:
   - **AISStream API key** — paste your key (kept in phone localStorage only)
   - **AIS relay URL** — leave blank if using this repo’s baked default `wss://boatboard-ais.aisrelay.workers.dev`, or paste your Worker URL to override

BoatBoard rewrites `https://` → `wss://` automatically.

### Optional: key only on the Worker

If you prefer not to store the key on the phone:

```bash
npx wrangler secret put AISSTREAM_API_KEY
```

Then the phone only needs the relay URL (subscription still works without a client key).

**Never commit API keys** to the repo.

## After deploy

- Leave it — Cloudflare keeps the Worker available on the free tier.
- No cloudflared, no home PC, no Raspberry Pi required for normal use.
- Optional: set `AIS_HOSTED_RELAY_DEFAULT` in `index.html` to your `wss://….workers.dev` URL so every device inherits it after you ship a Pages update (still don’t commit secrets).

## Local / LAN alternative

Power users can still run `../ais-relay.mjs` on a laptop (see root README). That path needs the machine online (or a temporary cloudflared tunnel).

## How it works

```
Phone (HTTPS BoatBoard)
  └─ wss://boatboard-ais.*.workers.dev   ← this Worker
        └─ wss://stream.aisstream.io     ← AISStream (server-side; browsers blocked)
```

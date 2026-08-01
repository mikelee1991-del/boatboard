/**
 * BoatBoard AIS relay — Cloudflare Worker
 *
 * AISStream blocks browser WebSockets. GitHub Pages is static (no server),
 * so this Worker provides a permanent wss:// endpoint on workers.dev.
 *
 * Auth: client sends APIKey in the subscription JSON (recommended),
 * OR set secret AISSTREAM_API_KEY on the Worker (optional convenience).
 * Never commit API keys to git.
 *
 * Deploy (one-time, free tier):
 *   cd ais-relay-worker
 *   npx wrangler login
 *   npx wrangler deploy
 * Optional server-side key:
 *   npx wrangler secret put AISSTREAM_API_KEY
 *
 * Then paste https://boatboard-ais.<account>.workers.dev into BoatBoard
 * Settings → AIS relay URL (BoatBoard rewrites https → wss).
 */

const UPSTREAM = 'https://stream.aisstream.io/v0/stream';

function jsonError(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

function injectKey(raw, envKey) {
  const sub = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
  const clientKey = sub.APIKey || sub.Apikey || sub.apiKey || '';
  const key = envKey || clientKey;
  if (!key) {
    throw new Error('Missing AISStream API key — paste it in BoatBoard Settings, or set Worker secret AISSTREAM_API_KEY');
  }
  sub.APIKey = key;
  sub.Apikey = key;
  return JSON.stringify(sub);
}

async function openUpstream() {
  const resp = await fetch(UPSTREAM, { headers: { Upgrade: 'websocket' } });
  const ws = resp.webSocket;
  if (!ws) throw new Error('AISStream rejected WebSocket upgrade');
  ws.accept({ allowHalfOpen: true });
  return ws;
}

function pipePair(client, upstream, env) {
  let pendingSub = null;
  let closed = false;

  const closeBoth = (code = 1000, reason = '') => {
    if (closed) return;
    closed = true;
    try { client.close(code, reason); } catch (_) {}
    try { upstream.close(code, reason); } catch (_) {}
  };

  upstream.addEventListener('message', (ev) => {
    if (closed || client.readyState !== 1) return;
    try {
      client.send(ev.data);
    } catch (_) {
      closeBoth(1011, 'forward failed');
    }
  });

  upstream.addEventListener('close', (ev) => {
    closeBoth(ev.code || 1000, ev.reason || 'upstream closed');
  });
  upstream.addEventListener('error', () => closeBoth(1011, 'upstream error'));

  client.addEventListener('message', (ev) => {
    try {
      pendingSub = injectKey(ev.data, env.AISSTREAM_API_KEY || '');
      if (upstream.readyState === 1) upstream.send(pendingSub);
    } catch (e) {
      try { client.send(JSON.stringify({ error: e.message || String(e) })); } catch (_) {}
      closeBoth(1008, 'bad subscription');
    }
  });

  client.addEventListener('close', (ev) => {
    closeBoth(ev.code || 1000, ev.reason || 'client closed');
  });
  client.addEventListener('error', () => closeBoth(1011, 'client error'));
}

export default {
  async fetch(request, env) {
    const upgrade = request.headers.get('Upgrade') || '';
    if (upgrade.toLowerCase() !== 'websocket') {
      return new Response(
        [
          'BoatBoard AIS relay (Cloudflare Worker)',
          '',
          'Connect with WebSocket from BoatBoard Settings → AIS relay URL.',
          'Use this origin as https://… or wss://…',
          '',
          'GitHub Pages cannot host this relay (static files only).',
          'Deploy docs: ais-relay-worker/ in the BoatBoard repo.',
          ''
        ].join('\n'),
        {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    try {
      const pair = new WebSocketPair();
      const [clientSock, serverSock] = Object.values(pair);
      serverSock.accept({ allowHalfOpen: true });

      const upstream = await openUpstream();
      pipePair(serverSock, upstream, env);

      return new Response(null, { status: 101, webSocket: clientSock });
    } catch (e) {
      return jsonError(e.message || 'relay failed', 502);
    }
  }
};

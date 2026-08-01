/**
 * BoatBoard AIS relay — Cloudflare Worker
 *
 * AISStream blocks browser WebSockets and requires a subscription within 3s of
 * *its* upstream WebSocket opening. We therefore:
 *   1) accept the phone/browser socket first
 *   2) wait for the client's subscription JSON (with API key)
 *   3) *then* open AISStream and send that subscription immediately
 *
 * Opening upstream before the client is ready races on slow mobile networks:
 * laptop may beat the 3s window; phones often do not — client stays "subscribed"
 * to the Worker while upstream is already dead → zero vessels.
 *
 * Deploy:
 *   cd ais-relay-worker && npx wrangler deploy
 * Optional: npx wrangler secret put AISSTREAM_API_KEY
 */

const UPSTREAM = 'https://stream.aisstream.io/v0/stream';

function jsonError(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

async function dataToText(data) {
  if (data == null) return '';
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data);
  if (typeof Blob !== 'undefined' && data instanceof Blob) return data.text();
  return String(data);
}

function injectKey(rawText, envKey) {
  const sub = JSON.parse(rawText);
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

/**
 * Accept client first; open AISStream only after first subscription arrives,
 * then send it immediately (must be within AISStream's 3s window).
 */
function handleClientSocket(client, env) {
  client.accept({ allowHalfOpen: true });

  let upstream = null;
  let closed = false;
  let started = false;

  const closeBoth = (code = 1000, reason = '') => {
    if (closed) return;
    closed = true;
    try { client.close(code, reason.slice(0, 120)); } catch (_) {}
    try { if (upstream) upstream.close(code, reason.slice(0, 120)); } catch (_) {}
  };

  const forwardText = (sock, text) => {
    if (closed || !sock || sock.readyState !== 1) return;
    try { sock.send(text); } catch (_) { closeBoth(1011, 'forward failed'); }
  };

  client.addEventListener('message', (ev) => {
    (async () => {
      try {
        const rawText = await dataToText(ev.data);
        if (!rawText) return;
        const subText = injectKey(rawText, env.AISSTREAM_API_KEY || '');

        if (!started) {
          started = true;
          upstream = await openUpstream();
          if (closed) {
            try { upstream.close(); } catch (_) {}
            return;
          }

          upstream.addEventListener('message', (uev) => {
            (async () => {
              try {
                forwardText(client, await dataToText(uev.data));
              } catch (_) {
                closeBoth(1011, 'upstream decode failed');
              }
            })();
          });
          upstream.addEventListener('close', (uev) => {
            closeBoth(uev.code || 1000, uev.reason || 'upstream closed');
          });
          upstream.addEventListener('error', () => closeBoth(1011, 'upstream error'));

          /* Send subscription immediately after upstream open — beats AISStream 3s rule */
          forwardText(upstream, subText);
          return;
        }

        /* Later messages = subscription updates */
        if (upstream && upstream.readyState === 1) forwardText(upstream, subText);
      } catch (e) {
        try { client.send(JSON.stringify({ error: e.message || String(e) })); } catch (_) {}
        closeBoth(1008, 'bad subscription');
      }
    })();
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
          'Upstream AISStream opens only after your first subscription (mobile-safe).',
          'Deploy: cd ais-relay-worker && npx wrangler deploy',
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
      handleClientSocket(serverSock, env);
      return new Response(null, { status: 101, webSocket: clientSock });
    } catch (e) {
      return jsonError(e.message || 'relay failed', 502);
    }
  }
};

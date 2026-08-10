#!/usr/bin/env node
/**
 * BoatBoard AIS relay — optional local Node proxy (laptop / Pi / Fly.io).
 *
 * Preferred for phones without keeping a PC on: deploy ais-relay-worker/
 * (Cloudflare Worker) once — see that folder's README.
 *
 * Matches the Worker: accept the client first, open AISStream only after the
 * first subscription arrives, then send it immediately (AISStream 3s rule).
 *
 * Local LAN / plain HTTP:
 *   node ais-relay.mjs YOUR_AISSTREAM_API_KEY
 *   → Settings → ws://YOUR_LAN_IP:8765
 *
 * Pass-through (client sends key): omit argv key / leave AISSTREAM_API_KEY unset.
 *
 * Env: PORT=8765 AISSTREAM_API_KEY=… (optional if clients send APIKey)
 */
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT || 8765);
const API_KEY = process.env.AISSTREAM_API_KEY || process.argv[2] || '';
const UPSTREAM = 'wss://stream.aisstream.io/v0/stream';

if (!API_KEY) {
  console.log('[relay] No server API key — clients must send APIKey in the subscription JSON');
}

const server = http.createServer((_req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*'
  });
  res.end('BoatBoard AIS relay OK\nPrefer Cloudflare Worker (ais-relay-worker/) for phones.\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (client, req) => {
  const from = req.socket.remoteAddress || '?';
  console.log('[relay] client connected from', from);
  let upstream = null;
  let closed = false;
  let started = false;

  function injectKey(raw){
    const sub = JSON.parse(raw.toString());
    const clientKey = sub.APIKey || sub.Apikey || sub.apiKey || '';
    const key = API_KEY || clientKey;
    if (!key) throw new Error('Missing AISStream API key (server env or client subscription)');
    sub.APIKey = key;
    sub.Apikey = key;
    return JSON.stringify(sub);
  }

  function closeBoth(code = 1000, reason = '') {
    if (closed) return;
    closed = true;
    try { client.close(code, reason.slice(0, 120)); } catch (_) {}
    try { upstream?.close(code, reason.slice(0, 120)); } catch (_) {}
  }

  function openUpstreamAndSend(subText) {
    if (closed) return;
    upstream = new WebSocket(UPSTREAM);
    upstream.on('open', () => {
      console.log('[relay] upstream open — sending subscription');
      if (!closed && upstream.readyState === WebSocket.OPEN) {
        try { upstream.send(subText); } catch (e) {
          console.error('[relay] send failed', e.message);
          closeBoth(1011, 'forward failed');
        }
      }
    });
    upstream.on('message', (data) => {
      if (client.readyState !== WebSocket.OPEN) return;
      const text = typeof data === 'string' ? data : data.toString('utf8');
      try { client.send(text); } catch (_) {}
    });
    upstream.on('close', (code, reasonBuf) => {
      const reason = reasonBuf ? reasonBuf.toString() : 'upstream closed';
      console.log('[relay] upstream closed', code, reason);
      closeBoth(code || 1000, reason);
    });
    upstream.on('error', (e) => {
      console.error('[relay] upstream:', e.message);
      closeBoth(1011, 'upstream error');
    });
  }

  client.on('message', (raw) => {
    try {
      const subText = injectKey(raw);
      if (!started) {
        started = true;
        openUpstreamAndSend(subText);
        return;
      }
      if (upstream?.readyState === WebSocket.OPEN) upstream.send(subText);
    } catch (e) {
      try { client.send(JSON.stringify({ error: e.message })); } catch (_) {}
      closeBoth(1008, /missing.*api key|api key/i.test(e.message || '') ? 'missing-key' : 'bad subscription');
    }
  });

  client.on('close', () => {
    console.log('[relay] client disconnected');
    closeBoth(1000, 'client closed');
  });

  client.on('error', (e) => console.error('[relay] client:', e.message));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`BoatBoard AIS relay listening on ws://0.0.0.0:${PORT}`);
  console.log('Phones / GitHub Pages: deploy ais-relay-worker/ (Cloudflare) instead of leaving this process online.');
});

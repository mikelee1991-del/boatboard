#!/usr/bin/env node
/**
 * BoatBoard AIS relay — optional local Node proxy (laptop / Pi / Fly.io).
 *
 * Preferred for phones without keeping a PC on: deploy ais-relay-worker/
 * (Cloudflare Worker) once — see that folder's README.
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
  let pendingSub = null;
  let closed = false;
  let upRetry = null;

  function injectKey(raw){
    const sub = JSON.parse(raw.toString());
    const clientKey = sub.APIKey || sub.Apikey || sub.apiKey || '';
    const key = API_KEY || clientKey;
    if (!key) throw new Error('Missing AISStream API key (server env or client subscription)');
    sub.APIKey = key;
    sub.Apikey = key;
    return JSON.stringify(sub);
  }

  function connectUpstream(){
    if (closed) return;
    if (upstream) {
      try { upstream.onclose = upstream.onerror = upstream.onmessage = null; upstream.close(); } catch (_) {}
      upstream = null;
    }
    upstream = new WebSocket(UPSTREAM);
    upstream.on('open', () => {
      console.log('[relay] upstream open');
      if (pendingSub && upstream.readyState === WebSocket.OPEN) upstream.send(pendingSub);
    });
    upstream.on('message', (data) => {
      if (client.readyState !== WebSocket.OPEN) return;
      const text = typeof data === 'string' ? data : data.toString('utf8');
      try { client.send(text); } catch (_) {}
    });
    upstream.on('close', (code) => {
      console.log('[relay] upstream closed', code, '— retry 4s');
      if (closed) return;
      clearTimeout(upRetry);
      upRetry = setTimeout(connectUpstream, 4000);
    });
    upstream.on('error', (e) => console.error('[relay] upstream:', e.message));
  }

  connectUpstream();

  client.on('message', (raw) => {
    try {
      pendingSub = injectKey(raw);
      if (upstream?.readyState === WebSocket.OPEN) upstream.send(pendingSub);
    } catch (e) {
      try { client.send(JSON.stringify({ error: e.message })); } catch (_) {}
    }
  });

  client.on('close', () => {
    closed = true;
    clearTimeout(upRetry);
    console.log('[relay] client disconnected');
    try { upstream?.close(); } catch (_) {}
  });

  client.on('error', (e) => console.error('[relay] client:', e.message));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`BoatBoard AIS relay listening on ws://0.0.0.0:${PORT}`);
  console.log('Phones / GitHub Pages: deploy ais-relay-worker/ (Cloudflare) instead of leaving this process online.');
});

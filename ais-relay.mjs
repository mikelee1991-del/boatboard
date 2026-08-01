#!/usr/bin/env node
/**
 * BoatBoard AIS relay — run on a laptop/Raspberry Pi.
 * AISStream blocks direct browser WebSockets (close 1006). This proxy holds the
 * API key server-side and forwards AIS to your phone/tablet.
 *
 * Setup (once):
 *   npm install
 *
 * Run (LAN / plain HTTP pages only):
 *   node ais-relay.mjs YOUR_AISSTREAM_API_KEY
 *   → Settings → AIS relay URL: ws://YOUR_LAN_IP:8765
 *
 * GitHub Pages / HTTPS mobile (required — browsers block ws:// mixed content):
 *   1. node ais-relay.mjs YOUR_AISSTREAM_API_KEY
 *   2. cloudflared tunnel --url http://localhost:8765
 *   3. Paste the printed https://….trycloudflare.com URL as wss://….trycloudflare.com
 *      (BoatBoard also accepts the https:// form and rewrites it to wss://)
 *
 * Env: PORT=8765 AISSTREAM_API_KEY=…
 */
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT || 8765);
const API_KEY = process.env.AISSTREAM_API_KEY || process.argv[2];
const UPSTREAM = 'wss://stream.aisstream.io/v0/stream';

if (!API_KEY) {
  console.error('Usage: node ais-relay.mjs YOUR_AISSTREAM_API_KEY');
  process.exit(1);
}

const server = http.createServer((_req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*'
  });
  res.end('BoatBoard AIS relay OK\nUse wss:// via cloudflared for HTTPS / mobile.\n');
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
    sub.APIKey = API_KEY;
    sub.Apikey = API_KEY;
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
  console.log('HTTPS / phone: cloudflared tunnel --url http://localhost:' + PORT);
  console.log('Then set Settings → AIS relay to the wss:// (or https://) tunnel URL');
});

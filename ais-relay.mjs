#!/usr/bin/env node
/**
 * BoatBoard AIS relay — run on a laptop/Raspberry Pi on the boat network.
 * AISStream blocks direct browser WebSocket; this proxy forwards AIS to your tablet.
 *
 * Setup (once):
 *   npm install ws
 *
 * Run:
 *   node ais-relay.mjs YOUR_AISSTREAM_API_KEY
 *
 * Tablet Settings → AIS relay URL: ws://YOUR_LAPTOP_IP:8765
 */
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT || 8765);
const API_KEY = process.env.AISSTREAM_API_KEY || process.argv[2];

if (!API_KEY) {
  console.error('Usage: node ais-relay.mjs YOUR_AISSTREAM_API_KEY');
  process.exit(1);
}

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('BoatBoard AIS relay OK\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (client) => {
  console.log('[relay] tablet connected');
  let upstream = null;
  let pendingSub = null;

  function injectKey(raw){
    const sub = JSON.parse(raw.toString());
    sub.APIKey = API_KEY;
    sub.Apikey = API_KEY;
    return JSON.stringify(sub);
  }

  function connectUpstream(){
    upstream = new WebSocket('wss://stream.aisstream.io/v0/stream');
    upstream.on('open', () => {
      console.log('[relay] upstream open');
      if (pendingSub && upstream.readyState === WebSocket.OPEN) upstream.send(pendingSub);
    });
    upstream.on('message', (data) => {
      if (client.readyState !== WebSocket.OPEN) return;
      const text = typeof data === 'string' ? data : data.toString('utf8');
      client.send(text);
    });
    upstream.on('close', () => {
      console.log('[relay] upstream closed — retry 5s');
      setTimeout(connectUpstream, 5000);
    });
    upstream.on('error', (e) => console.error('[relay] upstream:', e.message));
  }

  connectUpstream();

  client.on('message', (raw) => {
    try {
      pendingSub = injectKey(raw);
      if (upstream?.readyState === WebSocket.OPEN) upstream.send(pendingSub);
    } catch (e) {
      client.send(JSON.stringify({ error: e.message }));
    }
  });

  client.on('close', () => {
    console.log('[relay] tablet disconnected');
    try { upstream?.close(); } catch (_) {}
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`BoatBoard AIS relay: ws://0.0.0.0:${PORT}`);
});

/**
 * BoatBoard wildlife CORS proxy — Cloudflare Worker
 *
 * whaledata.org (and some other sighting APIs) omit Access-Control-Allow-Origin,
 * so browsers block direct fetch. This Worker allowlists GET URLs and re-serves
 * JSON with CORS *.
 *
 * Deploy:
 *   cd wild-proxy-worker && npx wrangler deploy
 * Expected host: https://boatboard-wild.mikelee1.workers.dev/?url=<encoded>
 */

const ALLOW_HOSTS = new Set([
  'api.whaledata.org',
  'api.inaturalist.org'
]);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function jsonError(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'GET') {
      return jsonError('GET only', 405);
    }
    const u = new URL(request.url);
    const target = u.searchParams.get('url');
    if (!target) {
      return new Response(
        'BoatBoard wildlife CORS proxy\n\nGET /?url=<encoded https URL>\nAllowlist: api.whaledata.org, api.inaturalist.org\n',
        { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS } }
      );
    }
    let dest;
    try {
      dest = new URL(target);
    } catch (e) {
      return jsonError('Invalid url', 400);
    }
    if (dest.protocol !== 'https:' || !ALLOW_HOSTS.has(dest.hostname)) {
      return jsonError('Host not allowlisted', 403);
    }
    try {
      const upstream = await fetch(dest.toString(), {
        headers: { Accept: 'application/json' }
      });
      const body = await upstream.arrayBuffer();
      const headers = new Headers(CORS);
      headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
      headers.set('Cache-Control', 'public, max-age=120');
      return new Response(body, { status: upstream.status, headers });
    } catch (e) {
      return jsonError('Upstream failed: ' + (e && e.message ? e.message : String(e)), 502);
    }
  }
};

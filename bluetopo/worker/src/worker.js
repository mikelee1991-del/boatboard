/**
 * Serve a BlueTopo .pmtiles object from Cloudflare R2 with CORS + Range.
 * Same one-time deploy pattern as ais-relay-worker (wrangler login → deploy).
 *
 * Bind an R2 bucket as BUCKET and put bluetopo-*.pmtiles at the object key
 * configured below (or pass ?key=...).
 */
const DEFAULT_KEY = 'bluetopo-smoke-palosverdes.pmtiles';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Range, Content-Length, Content-Type, ETag',
  'Access-Control-Max-Age': '86400'
};

function withCors(headers = {}) {
  return new Headers({ ...CORS, ...headers });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: withCors() });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: withCors() });
    }

    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({
        ok: true,
        service: 'boatboard-bluetopo-tiles',
        defaultKey: DEFAULT_KEY,
        usage: 'GET /bluetopo.pmtiles (or /?key=object-key.pmtiles)'
      }), {
        headers: withCors({ 'Content-Type': 'application/json' })
      });
    }

    let key = DEFAULT_KEY;
    if (url.pathname.endsWith('.pmtiles')) {
      key = url.pathname.replace(/^\/+/, '');
    } else if (url.searchParams.get('key')) {
      key = url.searchParams.get('key');
    }

    if (!env.BUCKET) {
      return new Response(JSON.stringify({
        error: 'R2 bucket binding BUCKET missing — set in wrangler.toml'
      }), { status: 500, headers: withCors({ 'Content-Type': 'application/json' }) });
    }

    const obj = await env.BUCKET.get(key, {
      range: request.headers,
      onlyIf: request.headers
    });

    if (!obj) {
      return new Response('Not found: ' + key, { status: 404, headers: withCors() });
    }

    const headers = withCors({
      'Content-Type': 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400, immutable'
    });
    if (obj.httpEtag) headers.set('ETag', obj.httpEtag);
    if (obj.range) {
      const { offset, length } = obj.range;
      const size = obj.size;
      headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${size}`);
      headers.set('Content-Length', String(length));
      return new Response(obj.body, { status: 206, headers });
    }
    if (obj.size != null) headers.set('Content-Length', String(obj.size));
    if (request.method === 'HEAD') {
      return new Response(null, { status: 200, headers });
    }
    return new Response(obj.body, { status: 200, headers });
  }
};

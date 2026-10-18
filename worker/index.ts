interface AssetsFetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}
interface Env {
  ASSETS: AssetsFetcher;
}

const APP_ROUTES: RegExp[] = [
  /^\/$/,
  /^\/biography\/?$/,
  /^\/articles\/?$/,
  /^\/articles\/[^/]+\/?$/,
  /^\/gallery\/?$/,
  /^\/videos\/?$/,
  /^\/contact\/?$/,
  /^\/admin(\/.*)?$/,
];

function withSecurityHeaders(res: Response): Response {
  const out = new Response(res.body, res);
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  out.headers.set('X-Frame-Options', 'DENY');
  return out;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const assetRes = await env.ASSETS.fetch(request);
    if (assetRes.status !== 404) return assetRes;

    const wantsHtml = (request.headers.get('accept') ?? '').includes('text/html');
    const looksLikeFile = /\.[a-z0-9]{2,8}$/i.test(url.pathname);
    if (!wantsHtml || looksLikeFile || (request.method !== 'GET' && request.method !== 'HEAD')) {
      return withSecurityHeaders(new Response('Not found', { status: 404 }));
    }

    const shell = await env.ASSETS.fetch(
      new Request(new URL('/', url).toString(), { headers: { accept: 'text/html' } }),
    );
    const known = APP_ROUTES.some((re) => re.test(url.pathname));
    const headers = new Headers(shell.headers);
    headers.delete('etag');
    headers.delete('last-modified');
    headers.delete('content-length');
    headers.set('Cache-Control', 'no-store');
    return withSecurityHeaders(new Response(shell.body, { status: known ? 200 : 404, headers }));
  },
};

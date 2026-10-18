/**
 * Cloudflare Worker in front of the static build (./dist).
 *
 * - Real files (JS, CSS, images, index.html) are served directly by Workers Static Assets
 *   and never reach this code.
 * - Anything else lands here. Known application routes get index.html with HTTP 200 so direct
 *   navigation to /biography, /articles/..., /admin/... works. Unknown routes get index.html with
 *   HTTP 404 (the React app shows the 404 page) so search engines see a real 404 status.
 * - No secrets are used or needed here. Supabase is called from the browser with the public
 *   publishable key and protected by Row Level Security.
 */

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

    // 1) Try a real static asset first.
    const assetRes = await env.ASSETS.fetch(request);
    if (assetRes.status !== 404) return assetRes;

    // 2) Only HTML navigations get the app shell; missing files (.js, .png, ...) stay 404.
    const wantsHtml = (request.headers.get('accept') ?? '').includes('text/html');
    const looksLikeFile = /\.[a-z0-9]{2,8}$/i.test(url.pathname);
    if (!wantsHtml || looksLikeFile || (request.method !== 'GET' && request.method !== 'HEAD')) {
      return withSecurityHeaders(new Response('Not found', { status: 404 }));
    }

    const shell = await env.ASSETS.fetch(new Request(new URL('/', url).toString(), { headers: request.headers }));
    const known = APP_ROUTES.some((re) => re.test(url.pathname));
    const res = new Response(shell.body, shell);
    res.headers.set('Cache-Control', 'no-cache');
    return withSecurityHeaders(new Response(res.body, { status: known ? 200 : 404, headers: res.headers }));
  },
};

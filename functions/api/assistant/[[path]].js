// Cloudflare Pages Function: forwards the site's same-origin /api/assistant/{chat,reset,health} to the WSA
// Assistant backend on the owner's PC, reached through a Tailscale Funnel address.
//
// Encrypted variables in the Pages project (production only, never in the repository):
//   ASSISTANT_ORIGIN   https://<the PC's Funnel address>
//   WSA_PROXY_KEY      the same secret the backend has; the backend refuses every request without it
//   CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET   optional, only if the origin is later moved behind Cloudflare Access
// Without ASSISTANT_ORIGIN and WSA_PROXY_KEY (for example on preview deployments) it answers "offline", so the
// widget shows its offline state. Anything that isn't the backend's own JSON also becomes "offline".

const PATHS = { chat: 'POST', reset: 'POST', health: 'GET' };
const MAX_BODY = 8192;

function json(body, status = 200, extra = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
    });
}

const OFFLINE = { status: 'offline', error: { code: 'model_unavailable', message: "The assistant's mission control is offline right now. Please try again later." }, retry_after: 60 };

export async function onRequest({ request, env, params }) {
    const path = (params.path || []).join('/');
    const method = PATHS[path];
    if (!method) return json({ status: 'error', error: { code: 'not_found', message: 'Not found.' } }, 404);
    if (request.method !== method) return json({ status: 'error', error: { code: 'method_not_allowed', message: 'Method not allowed.' } }, 405);
    if (!env.ASSISTANT_ORIGIN || !env.WSA_PROXY_KEY) {
        return path === 'health' ? json({ status: 'offline', ready: false }) : json(OFFLINE, 503, { 'Retry-After': '60' });
    }

    let body;
    if (method === 'POST') {
        if (Number(request.headers.get('content-length') || 0) > MAX_BODY) {
            return json({ status: 'error', error: { code: 'request_too_large', message: `Requests are limited to ${MAX_BODY} bytes.` } }, 413);
        }
        body = await request.arrayBuffer();
        if (body.byteLength > MAX_BODY) {
            return json({ status: 'error', error: { code: 'request_too_large', message: `Requests are limited to ${MAX_BODY} bytes.` } }, 413);
        }
    }

    const headers = {
        'Content-Type': request.headers.get('content-type') || 'application/json',
        'Origin': new URL(request.url).origin,                       // the backend's allowlist holds the site's origin
        'X-WSA-Proxy-Key': env.WSA_PROXY_KEY,
        'X-WSA-Client-IP': request.headers.get('CF-Connecting-IP') || '',
    };
    if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
        headers['CF-Access-Client-Id'] = env.CF_ACCESS_CLIENT_ID;
        headers['CF-Access-Client-Secret'] = env.CF_ACCESS_CLIENT_SECRET;
    }

    try {
        const upstream = await fetch(env.ASSISTANT_ORIGIN.replace(/\/$/, '') + '/api/assistant/' + path, {
            method, headers, body, signal: AbortSignal.timeout(70000),
        });
        const out = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
        const retry = upstream.headers.get('Retry-After');
        if (retry) out['Retry-After'] = retry;
        // Anything that is not the backend's own JSON (tunnel down, Access login page, 5xx HTML) becomes "offline"
        if (!(upstream.headers.get('content-type') || '').includes('application/json') && upstream.status !== 204) {
            return path === 'health' ? json({ status: 'offline', ready: false }) : json(OFFLINE, 503, { 'Retry-After': '60' });
        }
        return new Response(upstream.body, { status: upstream.status, headers: out });
    } catch (e) {
        return path === 'health' ? json({ status: 'offline', ready: false }) : json(OFFLINE, 503, { 'Retry-After': '60' });
    }
}

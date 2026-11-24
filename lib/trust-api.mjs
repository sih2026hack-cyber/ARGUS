// Routes for Provenance & Ownership and Identity & Accountability.
//   Anyone (and the extension):
//     POST /api/provenance/match     { phash, sha256? }  → registered images that look like this one
//     GET  /api/provenance/item?id=  → a record with what it was made from and what was made from it
//     POST /api/provenance/register  { phash, sha256?, title, creator, creator_account?, license, source_url?, parent_id? }
//     GET  /api/identity/lookup?platform=&handle=&name=  → credentials and look-alike warnings for an author
//     POST /api/identity/verify      { credential }      → is this credential genuine, current and unrevoked?
//     GET  /api/identity/issuer      → this server's public key, to check signatures yourself
//   Admin only (header x-argus-admin: <admin key>):
//     GET  /api/admin/credentials, POST /api/admin/issue, POST /api/admin/revoke { id }, GET /api/admin/registry
import crypto from 'node:crypto';
import { RegistryError } from './provenance-registry.mjs';
import { IdentityError } from './identity.mjs';

const send = (res, value, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
class ApiError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

async function readJson(req) {
  let value = '';
  for await (const chunk of req) { value += chunk; if (value.length > 32000) throw new ApiError('Request too large.', 413); }
  try { return JSON.parse(value || '{}'); } catch { throw new ApiError('Invalid JSON.'); }
}
function limiter(perMinute) {
  const hits = new Map();
  return req => {
    const ip = req.socket?.remoteAddress || 'unknown', now = Date.now();
    const recent = (hits.get(ip) || []).filter(t => now - t < 60_000);
    recent.push(now); hits.set(ip, recent);
    if (hits.size > 5000) hits.delete(hits.keys().next().value);
    return recent.length > perMinute;
  };
}

/** registry: lib/provenance-registry.mjs; identity: lib/identity.mjs; signer: lib/signing.mjs; adminKey: string. */
export function createTrustApi({ registry, identity, signer, adminKey, perMinute = 60 }) {
  const limited = limiter(perMinute);
  const admin = req => adminKey && same(req.headers['x-argus-admin'] || '', adminKey);

  return async function handle(req, res, url) {
    const route = url.pathname;
    if (!/^\/api\/(?:provenance|identity|admin)\//.test(route)) return false;
    try {
      if (limited(req)) throw new ApiError('Too many requests — wait a minute and try again.', 429);
      const get = req.method === 'GET', post = req.method === 'POST';
      // Provenance
      if (route === '/api/provenance/match' && post) return send(res, registry.match(await readJson(req))), true;
      if (route === '/api/provenance/item' && get) return send(res, registry.lineage(url.searchParams.get('id'))), true;
      if (route === '/api/provenance/register' && post) return send(res, registry.register(await readJson(req)), 201), true;
      // Identity
      if (route === '/api/identity/lookup' && get) return send(res, identity.lookup(url.searchParams.get('platform'), url.searchParams.get('handle'), url.searchParams.get('name') || '')), true;
      if (route === '/api/identity/verify' && post) return send(res, identity.verify((await readJson(req)).credential)), true;
      if (route === '/api/identity/issuer' && get) return send(res, { id: signer.id, verificationMethod: signer.method, publicKeyJwk: signer.publicJwk }), true;
      // Admin
      if (route.startsWith('/api/admin/')) {
        if (!admin(req)) throw new ApiError('Admin key required.', 401);
        if (route === '/api/admin/credentials' && get) return send(res, { credentials: identity.list() }), true;
        if (route === '/api/admin/issue' && post) return send(res, identity.issue(await readJson(req)), 201), true;
        if (route === '/api/admin/revoke' && post) return send(res, identity.revoke((await readJson(req)).id)), true;
        if (route === '/api/admin/registry' && get) return send(res, { items: registry.recent(100) }), true;
      }
      return send(res, { error: 'Not found' }, 404), true;
    } catch (error) {
      const known = error instanceof ApiError || error instanceof RegistryError || error instanceof IdentityError;
      if (!known) console.error(error);
      return send(res, { error: known ? error.message : 'The request could not be processed.' }, known ? error.status : 500), true;
    }
  };
}

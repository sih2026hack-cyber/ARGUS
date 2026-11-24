// Digital Identity & Accountability: credentials for people, organisations and AI agents.
//
// An ARGUS admin issues a credential to an online account (platform + handle) after checking it
// out of band, e.g. the university confirms its official YouTube channel. The credential follows
// the W3C Verifiable Credentials data model (v2) and is signed by this server (lib/signing.mjs):
//   person        "this account is run by <name>"
//   organization  "this account is the official account of <name>"
//   agent         "this account is an AI agent operated on behalf of <organisation>, allowed to <permissions>"
// A person or agent can also be marked as an authorised representative of an organisation.
//
// The browser extension looks up the author of the post you are viewing and shows what holds:
// a verified credential, or a warning when an account uses the NAME of a verified organisation
// or person without being that verified account (possible impersonation). No credential is never
// treated as guilt: most honest accounts have none.
//
// Boundaries, stated in the UI: a credential shows that ARGUS checked who controls the account
// when it was issued. It does not prove who is typing at any moment, and it can be revoked.
import crypto from 'node:crypto';

export const TYPES = ['person', 'organization', 'agent'];
export const PLATFORMS = ['youtube', 'reddit', 'instagram', 'x', 'linkedin', 'web'];
const PERMISSIONS = ['post', 'reply_comments', 'send_messages', 'moderate', 'publish_content'];
export class IdentityError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const nameKey = s => String(s || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '');

/** platform:handle in one spelling, so "@Argus" and "argus" on YouTube are the same account. */
export function accountKey(platform, handle) {
  const p = String(platform || '').toLowerCase().trim();
  let h = String(handle || '').trim().toLowerCase().replace(/^https?:\/\/[^/]+\//, '').replace(/^\/+|\/+$/g, '');
  if (p === 'reddit') h = h.replace(/^u\//, '');
  h = h.replace(/^@/, '');
  if (!PLATFORMS.includes(p) || !/^[\w.-]{1,80}$/.test(h)) return null;
  return `${p}:${p === 'youtube' ? '@' : ''}${h}`;
}

/** signer: lib/signing.mjs. store: { load() → { credentials, revoked }, save(state) }. */
export function createIdentity({ signer, store = {} } = {}) {
  const state = store.load?.() || { credentials: [], revoked: [] };
  const save = () => { try { store.save?.(state); } catch { /* kept in memory */ } };
  const revoked = new Set(state.revoked);

  function status(vc) {
    const sig = signer.verify(vc);
    const expired = vc.validUntil && Date.parse(vc.validUntil) < Date.now();
    const isRevoked = revoked.has(vc.id);
    return {
      valid: sig.valid && !expired && !isRevoked,
      reason: !sig.valid ? sig.reason : isRevoked ? 'This credential was revoked.' : expired ? 'This credential has expired.' : 'Signature checks out; not expired or revoked.',
    };
  }
  const summary = vc => {
    const s = vc.credentialSubject;
    return { id: vc.id, account: s.account, type: s.type, name: s.name, role: s.role || null, on_behalf_of: s.onBehalfOf || null, permissions: s.permissions || [], valid_until: vc.validUntil, issued: vc.validFrom, ...status(vc) };
  };

  function issue(input = {}) {
    const account = accountKey(input.platform, input.handle);
    if (!account) throw new IdentityError(`Give the account as a platform (${PLATFORMS.join(', ')}) and its handle.`);
    const type = TYPES.includes(input.type) ? input.type : null;
    if (!type) throw new IdentityError(`Type must be one of: ${TYPES.join(', ')}.`);
    const name = text(input.name, 100);
    if (!name) throw new IdentityError('Give the name this account represents.');
    const onBehalfOf = text(input.on_behalf_of, 100) || null;
    if (type === 'agent' && !onBehalfOf) throw new IdentityError('An AI agent credential must say which organisation operates it.');
    const permissions = (Array.isArray(input.permissions) ? input.permissions : []).filter(p => PERMISSIONS.includes(p));
    const days = Math.min(730, Math.max(1, Number(input.valid_days) || 365));
    const now = new Date();
    const vc = signer.sign({
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      id: `urn:uuid:${crypto.randomUUID()}`,
      type: ['VerifiableCredential', type === 'agent' ? 'ArgusAgentCredential' : 'ArgusAccountCredential'],
      issuer: signer.id,
      validFrom: now.toISOString(),
      validUntil: new Date(now.getTime() + days * 86400_000).toISOString(),
      credentialSubject: {
        id: `urn:argus:account:${account}`, account, type, name,
        role: text(input.role, 80) || undefined, onBehalfOf: onBehalfOf || undefined,
        permissions: type === 'agent' || permissions.length ? permissions : undefined,
        evidence: text(input.evidence, 200) || undefined, // how the admin checked it, e.g. "confirmed by email from @university.edu"
      },
    });
    state.credentials.push(vc); save();
    return { credential: vc, summary: summary(vc) };
  }

  function revoke(id) {
    if (!state.credentials.some(vc => vc.id === id)) throw new IdentityError('No such credential.', 404);
    revoked.add(id); state.revoked = [...revoked]; save();
    return { id, revoked: true };
  }

  // A valid credential for this account right now, or null (used by the content registry).
  function valid(account) {
    const vc = state.credentials.filter(c => c.credentialSubject.account === account).reverse().find(c => status(c).valid);
    return vc ? summary(vc) : null;
  }

  /**
   * What the extension shows about an author.
   * displayName: the name the account shows on the page; used only to spot a look-alike of a
   * verified name. Returns { account, credentials, impersonation }.
   */
  function lookup(platform, handle, displayName = '') {
    const account = accountKey(platform, handle);
    if (!account) throw new IdentityError('Expected a platform and a handle.');
    const credentials = state.credentials.filter(c => c.credentialSubject.account === account).map(summary).reverse();
    let impersonation = null;
    const shown = nameKey(displayName);
    if (shown.length >= 4 && !credentials.some(c => c.valid)) {
      const twin = state.credentials.map(summary).find(c => c.valid && c.account !== account && (c.type !== 'agent') && nameKey(c.name) === shown);
      if (twin) impersonation = { name: twin.name, verified_account: twin.account, message: `This account shows the name "${twin.name}", but the ARGUS-verified account for ${twin.name} is ${twin.account}. It may not be who it seems.` };
    }
    return { account, credentials, impersonation };
  }

  // Anyone can paste a credential to check it.
  const verify = vc => {
    if (!vc || typeof vc !== 'object' || !vc.credentialSubject) throw new IdentityError('Paste a credential (JSON).');
    return { ...status(vc), issuer: vc.issuer === signer.id ? 'This ARGUS server' : 'Another issuer (not checked here)' };
  };

  return { issue, revoke, valid, lookup, verify, list: () => state.credentials.map(summary).reverse() };
}

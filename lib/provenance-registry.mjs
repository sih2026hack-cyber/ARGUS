// Digital Provenance & Ownership: a registry of creators' claims on their images.
//
// A creator registers an image and gets a Content ID plus a record signed by this ARGUS server:
// who claims it, when, the reuse permissions they set, and (for an edit or remix) which registered
// image it was made from, so a chain of original and derivative work can be followed.
//
// Images are compared by a perceptual hash (extension/phash.js, computed in the browser): a 64-bit
// fingerprint of the picture's light and dark structure. Unlike a file hash it survives resizing,
// recompression and small edits, so a screenshot or re-upload still matches. A SHA-256 of the
// exact file is kept too, for "this is the very same file".
//
// What a match means, said plainly to the user: a similar fingerprint is evidence the images are
// related, not proof of theft or of legal ownership. Every claim on an image is shown, oldest
// first, and claims from an account with a valid ARGUS identity credential are marked as such.
import crypto from 'node:crypto';

export const LICENSES = {
  'all-rights-reserved': 'All rights reserved: ask the creator before reusing.',
  'credit-required': 'Free to share with credit to the creator.',
  'cc-by': 'Creative Commons BY: reuse and adapt with credit.',
  'cc-by-nc': 'Creative Commons BY-NC: reuse with credit, not for commercial use.',
  'no-derivatives': 'Share unchanged with credit; no edits or remixes.',
};
const HASH = /^[0-9a-f]{16}$/, SHA = /^[0-9a-f]{64}$/, ACCOUNT = /^[a-z_]{2,20}:[\w.@-]{1,80}$/i, CONTENT_ID = /^ARGUS-[A-Z2-7]{12}$/;
const SAME_MAX = 4, RELATED_MAX = 12; // Hamming distance out of 64 bits

export class RegistryError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
function distance(a, b) {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`), n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}
const base32 = buf => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '', out = ''; for (const b of buf) bits += b.toString(2).padStart(8, '0'); for (let i = 0; i + 5 <= bits.length; i += 5) out += A[parseInt(bits.slice(i, i + 5), 2)]; return out; };

/**
 * signer: from lib/signing.mjs. identity: { valid(account) → credential summary | null } (optional).
 * store: { load() → records[], save(records) }.
 */
export function createRegistry({ signer, identity = null, store = {}, limit = 5000 } = {}) {
  const records = store.load?.() || [];
  const save = () => { try { store.save?.(records.slice(-limit)); } catch { /* kept in memory */ } };
  const byId = id => records.find(r => r.content_id === id) || null;

  // What a viewer sees about a record: its claim, whether the signature holds, and whether the
  // creator account currently holds a valid ARGUS credential.
  function view(record) {
    const check = signer.verify(record);
    const credential = record.creator_account && identity ? identity.valid(record.creator_account) : null;
    return {
      content_id: record.content_id, title: record.title, creator: record.creator, creator_account: record.creator_account || null,
      creator_verified: Boolean(credential), credential: credential || null,
      license: record.license, license_text: LICENSES[record.license], source_url: record.source_url || null,
      parent_id: record.parent_id || null, registered_at: record.registered_at,
      signature: check.valid ? 'valid' : 'invalid', signature_note: check.reason,
    };
  }

  function register(input = {}) {
    const phash = String(input.phash || '').toLowerCase();
    if (!HASH.test(phash)) throw new RegistryError('Expected the image fingerprint (phash, 16 hex characters).');
    const sha256 = input.sha256 ? String(input.sha256).toLowerCase() : null;
    if (sha256 && !SHA.test(sha256)) throw new RegistryError('sha256 must be 64 hex characters.');
    const title = text(input.title, 120), creator = text(input.creator, 80);
    if (!title || !creator) throw new RegistryError('Give the work a title and say who created it.');
    const license = LICENSES[input.license] ? input.license : null;
    if (!license) throw new RegistryError(`Pick a reuse permission: ${Object.keys(LICENSES).join(', ')}.`);
    const account = input.creator_account ? text(input.creator_account, 100).toLowerCase() : null;
    if (account && !ACCOUNT.test(account)) throw new RegistryError('Creator account looks like platform:handle, e.g. youtube:@argus.');
    let source = null;
    if (input.source_url) {
      try { const u = new URL(String(input.source_url)); if (u.protocol !== 'https:' && u.protocol !== 'http:') throw 0; source = u.href.slice(0, 500); }
      catch { throw new RegistryError('Source must be a web address.'); }
    }
    const parent = input.parent_id ? String(input.parent_id).toUpperCase() : null;
    if (parent && (!CONTENT_ID.test(parent) || !byId(parent))) throw new RegistryError('The original (parent) Content ID is not registered.');
    if (parent && byId(parent).license === 'no-derivatives') throw new RegistryError('The original was registered with no edits or remixes allowed, so a derivative of it cannot be registered.');
    // The same person registering the same image twice gets their existing record back.
    const dup = records.find(r => r.phash === phash && r.creator.toLowerCase() === creator.toLowerCase());
    if (dup) return { ...view(dup), duplicate: true };

    const registered_at = new Date().toISOString();
    const content_id = 'ARGUS-' + base32(crypto.createHash('sha256').update(`${phash}|${sha256 || ''}|${creator}|${registered_at}`).digest()).slice(0, 12);
    const record = signer.sign({
      type: 'ArgusContentRegistration', issuer: signer.id, content_id, phash, sha256, title, creator, creator_account: account,
      license, source_url: source, parent_id: parent, registered_at,
    });
    records.push(record); save();
    return { ...view(record), record };
  }

  // Registered images that look like this one, closest first. Earliest claim first among equals.
  function match({ phash, sha256 } = {}) {
    phash = String(phash || '').toLowerCase();
    if (!HASH.test(phash)) throw new RegistryError('Expected the image fingerprint (phash, 16 hex characters).');
    sha256 = sha256 ? String(sha256).toLowerCase() : null;
    const found = records.map(r => ({ r, d: distance(phash, r.phash), exact: Boolean(sha256 && r.sha256 === sha256) }))
      .filter(x => x.exact || x.d <= RELATED_MAX)
      .sort((a, b) => (b.exact - a.exact) || (a.d - b.d) || a.r.registered_at.localeCompare(b.r.registered_at))
      .slice(0, 5);
    return {
      matches: found.map(({ r, d, exact }) => ({
        ...view(r), distance: d, similarity: Math.round((1 - d / 64) * 100),
        relation: exact ? 'exact_file' : d <= SAME_MAX ? 'same_image' : 'possibly_edited',
        relation_text: exact ? 'The exact same file.' : d <= SAME_MAX ? 'Looks like the same image (possibly resized or recompressed).' : 'Looks related: possibly a crop, edit or screenshot of it.',
      })),
      note: 'A similar fingerprint shows the images are probably related. It is not proof of who owns the image or that reuse was unauthorised.',
    };
  }

  // A record, with the chain of works it was made from and the works made from it.
  function lineage(id) {
    const record = byId(String(id || '').toUpperCase());
    if (!record) throw new RegistryError('No such Content ID.', 404);
    const ancestors = []; let p = record.parent_id;
    while (p && ancestors.length < 20) { const r = byId(p); if (!r) break; ancestors.push(view(r)); p = r.parent_id; }
    return { item: view(record), record, made_from: ancestors, derivatives: records.filter(r => r.parent_id === record.content_id).map(view) };
  }

  return { register, match, lineage, recent: (n = 50) => records.slice(-n).reverse().map(view), size: () => records.length };
}

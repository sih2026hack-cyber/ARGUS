// The ARGUS server's signing key (Ed25519). It signs content registrations (Provenance) and
// identity credentials (Identity), so anyone holding the public key can check that a record came
// from this ARGUS server and was not changed afterwards.
//
// The key is made on first run and kept in data/runtime/signing-key.json, or set ARGUS_SIGNING_KEY
// (a PKCS#8 PEM) to pin it. The public key is published at GET /api/identity/issuer.
//
// Records are signed over their canonical JSON (keys sorted, no whitespace, `proof` left out), in
// the spirit of W3C Data Integrity's JCS + EdDSA. It is a simplified proof, not a certified suite.
import crypto from 'node:crypto';

/** Canonical JSON: object keys sorted at every level, so the same record always signs the same. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

/**
 * pem: a PKCS#8 private key PEM, or null to load/create one through load()/save().
 * Returns { id, publicJwk, sign(record) → record with proof, verify(record) → { valid, reason } }.
 */
export function createSigner({ pem = null, load = () => null, save = () => {} } = {}) {
  let privateKey;
  const stored = pem || load()?.private_pem;
  if (stored) privateKey = crypto.createPrivateKey(stored);
  else {
    ({ privateKey } = crypto.generateKeyPairSync('ed25519'));
    save({ private_pem: privateKey.export({ type: 'pkcs8', format: 'pem' }), created_at: new Date().toISOString() });
  }
  const publicKey = crypto.createPublicKey(privateKey);
  const publicJwk = publicKey.export({ format: 'jwk' });
  const id = `urn:argus:issuer:${crypto.createHash('sha256').update(publicJwk.x).digest('hex').slice(0, 16)}`;
  const method = `${id}#key-1`;

  function sign(record) {
    const { proof, ...body } = record;
    const created = new Date().toISOString();
    const signature = crypto.sign(null, Buffer.from(canonical({ ...body, _proofCreated: created })), privateKey).toString('base64url');
    return { ...body, proof: { type: 'Ed25519Signature', cryptosuite: 'argus-jcs-ed25519', created, verificationMethod: method, proofPurpose: 'assertionMethod', proofValue: signature } };
  }

  function verify(record) {
    const { proof, ...body } = record || {};
    if (!proof?.proofValue || !proof.created) return { valid: false, reason: 'No signature.' };
    if (proof.verificationMethod !== method) return { valid: false, reason: 'Signed by a different issuer.' };
    try {
      const ok = crypto.verify(null, Buffer.from(canonical({ ...body, _proofCreated: proof.created })), publicKey, Buffer.from(proof.proofValue, 'base64url'));
      return ok ? { valid: true, reason: 'Signature checks out.' } : { valid: false, reason: 'The record was changed after it was signed.' };
    } catch { return { valid: false, reason: 'The signature could not be read.' }; }
  }

  return { id, method, publicJwk, sign, verify };
}

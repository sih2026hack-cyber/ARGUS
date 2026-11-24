// Provenance & Ownership, Identity & Accountability, the reviewer queue and the pages, end to end
// against the real server (fake model APIs, nothing paid is called), plus the signing rules.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSigner, canonical } from '../lib/signing.mjs';
import { createIdentity, accountKey } from '../lib/identity.mjs';
import { createRegistry } from '../lib/provenance-registry.mjs';

// ---- Signing ----
assert.equal(canonical({ b: 1, a: [{ d: 2, c: 3 }], u: undefined }), '{"a":[{"c":3,"d":2}],"b":1}');
let saved = null;
const signer = createSigner({ load: () => saved, save: v => { saved = v; } });
const signed = signer.sign({ type: 'Test', value: 1 });
assert.equal(signer.verify(signed).valid, true);
assert.equal(signer.verify({ ...signed, value: 2 }).valid, false, 'a changed record fails');
assert.equal(createSigner({ load: () => saved }).verify(signed).valid, true, 'the stored key is reused after a restart');
assert.equal(createSigner().verify(signed).valid, false, 'another key does not verify it');

// ---- Identity ----
assert.equal(accountKey('youtube', 'https://www.youtube.com/@AnnaUniv'), 'youtube:@annauniv');
assert.equal(accountKey('reddit', 'u/Some_User'), 'reddit:some_user');
assert.equal(accountKey('myspace', 'x'), null);
const identity = createIdentity({ signer });
assert.throws(() => identity.issue({ type: 'agent', platform: 'youtube', handle: '@bot', name: 'Helper' }), /organisation/);
const org = identity.issue({ type: 'organization', platform: 'youtube', handle: '@AnnaUniv', name: 'Anna University', evidence: 'email from annauniv.edu' });
assert.deepEqual(org.credential.type, ['VerifiableCredential', 'ArgusAccountCredential']);
assert.equal(org.credential['@context'][0], 'https://www.w3.org/ns/credentials/v2');
assert.equal(identity.lookup('youtube', '@annauniv').credentials[0].valid, true);
// A different account showing the verified name: flagged. Same name on the real account: not.
const fake = identity.lookup('youtube', '@anna-univ-official', 'Anna  University');
assert.match(fake.impersonation.message, /youtube:@annauniv/);
assert.equal(identity.lookup('youtube', '@random', 'Cooking With Priya').impersonation, null);
const agent = identity.issue({ type: 'agent', platform: 'instagram', handle: 'annauniv.help', name: 'Admissions helper', on_behalf_of: 'Anna University', permissions: ['reply_comments', 'hack_things'] });
assert.deepEqual(agent.summary.permissions, ['reply_comments'], 'unknown permissions are dropped');
assert.equal(identity.verify(org.credential).valid, true);
const tampered = structuredClone(org.credential); tampered.credentialSubject.name = 'Someone Else';
assert.equal(identity.verify(tampered).valid, false);
identity.revoke(org.summary.id);
assert.equal(identity.lookup('youtube', '@annauniv').credentials[0].valid, false);
assert.equal(identity.verify(org.credential).reason, 'This credential was revoked.');

// ---- Provenance ----
const id2 = createIdentity({ signer });
id2.issue({ type: 'person', platform: 'instagram', handle: 'priya.clicks', name: 'Priya' });
const registry = createRegistry({ signer, identity: id2 });
const original = registry.register({ phash: 'f0f0f0f0f0f0f0f0', sha256: 'a'.repeat(64), title: 'Marina sunset', creator: 'Priya', creator_account: 'instagram:priya.clicks', license: 'credit-required' });
assert.match(original.content_id, /^ARGUS-[A-Z2-7]{12}$/);
assert.equal(original.creator_verified, true);
assert.equal(original.signature, 'valid');
assert.equal(registry.register({ phash: 'f0f0f0f0f0f0f0f0', title: 'Again', creator: 'priya', license: 'cc-by' }).duplicate, true);
assert.throws(() => registry.register({ phash: 'xyz', title: 't', creator: 'c', license: 'cc-by' }), /fingerprint/);
assert.throws(() => registry.register({ phash: '0000000000000001', title: 't', creator: 'c', license: 'mine-forever' }), /reuse permission/);
// Exact file, same image recompressed (2 bits differ), an edit (8 bits), and something unrelated.
assert.equal(registry.match({ phash: '0f0f0f0f0f0f0f0f', sha256: 'a'.repeat(64) }).matches[0].relation, 'exact_file');
assert.equal(registry.match({ phash: 'f0f0f0f0f0f0f0f3' }).matches[0].relation, 'same_image');
const edited = registry.match({ phash: 'f0f0f0f0f0f0ffff' });
assert.equal(edited.matches[0].relation, 'possibly_edited'); assert.equal(edited.matches[0].similarity, 88);
assert.match(edited.note, /not proof/);
assert.equal(registry.match({ phash: '0f0f0f0f0f0f0f0f' }).matches.length, 0);
// Lineage: a remix made from the original.
const remix = registry.register({ phash: '1234123412341234', title: 'Marina sunset, colour graded', creator: 'Arun', license: 'cc-by', parent_id: original.content_id });
const tree = registry.lineage(original.content_id);
assert.equal(tree.derivatives[0].content_id, remix.content_id);
assert.equal(registry.lineage(remix.content_id).made_from[0].content_id, original.content_id);
// Crops and mirror images: a registration keeps crop fingerprints (outside the signature), and
// a check sends its mirror-image fingerprint.
const cropRec = registry.register({ phash: '00ff00ff00ff00ff', crops: ['123456789abcdef0', 'nonsense', '0fedcba987654321'], title: 'Beach', creator: 'Lin', license: 'cc-by' });
assert.equal(cropRec.signature, 'valid', 'crop fingerprints do not affect the signature');
assert.equal(cropRec.record.crops, undefined, 'crop fingerprints are not part of the signed record');
assert.equal(registry.match({ phash: '123456789abcdef3' }).matches[0].relation, 'cropped');
assert.equal(registry.match({ phash: 'ffffffffffffffff', mirror: '00ff00ff00ff00fe' }).matches[0].relation, 'mirrored');
assert.equal(registry.match({ phash: 'ffffffffffffffff', mirror: '0fedcba987654320' }).matches[0].relation, 'mirrored_crop');
assert.equal(registry.match({ phash: '123456789abc0001' }).matches.length, 0, 'crops need a closer match (within 10 bits) than whole images');
// An older registration without crop fingerprints gets them when it is registered again.
const old = registry.register({ phash: 'aaaaaaaaaaaaaaaa', title: 'Old', creator: 'Ravi', license: 'cc-by' });
assert.equal(registry.match({ phash: 'bbbbbbbbbbbbbbbb' }).matches.length, 0);
const again = registry.register({ phash: 'aaaaaaaaaaaaaaaa', crops: ['bbbbbbbbbbbbbbbb'], title: 'Old', creator: 'Ravi', license: 'cc-by' });
assert.equal(again.duplicate, true); assert.equal(again.crop_prints_added, true);
assert.equal(registry.match({ phash: 'bbbbbbbbbbbbbbbb' }).matches[0].content_id, old.content_id);
assert.equal(registry.lineage(old.content_id).item.signature, 'valid', 'adding crop fingerprints keeps the signature valid');
const locked = registry.register({ phash: '9999999999999999', title: 'Locked', creator: 'Mei', license: 'no-derivatives' });
assert.throws(() => registry.register({ phash: '8888888888888888', title: 'Edit', creator: 'X', license: 'cc-by', parent_id: locked.content_id }), /no edits/);

// ---- The real server ----
const fakeModels = http.createServer(async (req, res) => { for await (const _ of req) { /* drain */ } res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ meaning: 'unclear', sure: false, score: 0.3, category: 'other', reason: 'Not sure.', coarse: false, target: 'none' }) } }] })); });
await new Promise(r => fakeModels.listen(8791, '127.0.0.1', r));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-trust-test-'));
const ADMIN = 'test-admin-key', EXT = 'test-extension-key';
const child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: {
  ...process.env, PORT: '8790', ARGUS_DATA_DIR: temp, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', NEBIUS_API_KEY: '', MODEL_API_KEY: '',
  MINIMAX_API_KEY: 'fake', MINIMAX_BASE_URL: 'http://127.0.0.1:8791/minimax', ARGUS_ADMIN_SECRET: ADMIN, ARGUS_EXTENSION_KEY: EXT,
} });
const base = 'http://localhost:8790';
const json = (route, body, headers = {}) => fetch(base + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
try {
  await new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error('Test server did not start')), 10000); child.once('exit', c => reject(new Error('Test server exited ' + c))); child.stdout.once('data', () => { clearTimeout(t); resolve(); }); });

  // Pages and the shared fingerprint script.
  for (const page of ['/register', '/register.js', '/admin', '/admin.js', '/moderator', '/moderator.js', '/pages.css', '/phash.js']) assert.equal((await fetch(base + page)).status, 200, page);

  // Admin routes need the key.
  assert.equal((await json('/api/admin/credentials')).status, 401);
  const admin = { 'x-argus-admin': ADMIN, 'x-moderator-admin': ADMIN };
  const issued = await json('/api/admin/issue', { type: 'organization', platform: 'youtube', handle: '@AnnaUniv', name: 'Anna University' }, admin).then(r => r.json());
  assert.equal(issued.summary.account, 'youtube:@annauniv');

  // The extension may look up identities and match images, with its key; it may not use admin routes.
  const ext = { Origin: 'chrome-extension://abcdefghijklmnop', 'x-extension-key': EXT };
  const who = await json('/api/identity/lookup?platform=youtube&handle=%40annauniv', null, ext).then(r => r.json());
  assert.equal(who.credentials[0].valid, true);
  const imposter = await json(`/api/identity/lookup?platform=youtube&handle=%40annauniv.official&name=${encodeURIComponent('Anna University')}`, null, ext).then(r => r.json());
  assert.ok(imposter.impersonation);
  assert.equal((await json('/api/admin/credentials', null, { ...ext, ...admin })).status, 403, 'no admin routes from the extension');
  assert.equal((await json('/api/identity/lookup?platform=youtube&handle=x', null, { Origin: ext.Origin })).status, 401, 'extension key required');

  // Register on the page, then the extension's Lens check finds it.
  const reg = await json('/api/provenance/register', { phash: 'abcdefabcdefabcd', title: 'Temple at dawn', creator: 'Mei', license: 'all-rights-reserved' }).then(r => r.json());
  assert.match(reg.content_id, /^ARGUS-/);
  const found = await json('/api/provenance/match', { phash: 'abcdefabcdefabcf' }, ext).then(r => r.json());
  assert.equal(found.matches[0].content_id, reg.content_id);
  assert.equal((await json(`/api/provenance/item?id=${reg.content_id}`, null, ext).then(r => r.json())).item.signature, 'valid');
  assert.equal((await json('/api/identity/issuer').then(r => r.json())).publicKeyJwk.kty, 'OKP');

  // Reviewer queue: an "unsure" comment from the extension waits for a person, then is approved.
  const checked = await json('/api/ext/check', { text: 'nee romba weird', site: 'youtube' }, ext).then(r => r.json());
  assert.equal(checked.verdict, 'unsure');
  const { queue } = await json('/api/plugin/queue', null, admin).then(r => r.json());
  assert.equal(queue[0].id, checked.id); assert.equal(queue[0].site, 'youtube');
  assert.equal((await json('/api/plugin/resolve', { id: checked.id, decision: 'approve' }, admin).then(r => r.json())).status, 'approved');
  assert.deepEqual(await json(`/api/ext/status?id=${checked.id}`, null, ext).then(r => r.json()), { status: 'approved' });

  // Everything survives a restart (stored in the data folder).
  assert.ok(fs.existsSync(path.join(temp, 'identity.json')) && fs.existsSync(path.join(temp, 'content-registry.json')) && fs.existsSync(path.join(temp, 'signing-key.json')));
  console.log('Provenance, Identity, reviewer queue and page checks passed; no real APIs contacted.');
} finally {
  child.kill(); await new Promise(r => child.exitCode !== null ? r() : child.once('exit', r));
  fakeModels.close(); fs.rmSync(temp, { recursive: true, force: true });
}

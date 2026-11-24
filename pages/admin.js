// /admin: the human-review queue (ai-moderator-plugin), identity credentials, the content registry.
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const day = s => String(s || '').slice(0, 10);
let key = '';
try { key = sessionStorage.getItem('argus-admin') || ''; } catch { /* private window: ask each time */ }

async function api(path, body) {
  const res = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'x-argus-admin': key, 'x-moderator-admin': key, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });
  return data;
}

// ---- Sign in ----
async function open() {
  try { await api('/api/admin/credentials'); }
  catch (e) { $('keyError').innerHTML = key ? `<div class="note bad">${esc(e.status === 401 ? 'That admin key is not right.' : e.message)}</div>` : ''; return; }
  try { sessionStorage.setItem('argus-admin', key); } catch { /* fine */ }
  $('login').hidden = true; $('app').hidden = false;
  loadQueue(); loadCreds(); loadWorks();
}
$('keyForm').onsubmit = e => { e.preventDefault(); key = $('key').value.trim(); open(); };
$('logout').onclick = () => { try { sessionStorage.removeItem('argus-admin'); } catch { /* fine */ } location.reload(); };
document.querySelectorAll('#tabs [data-tab]').forEach(b => b.onclick = () => {
  document.querySelectorAll('#tabs [data-tab]').forEach(x => x.classList.toggle('on', x === b));
  for (const id of ['review', 'identity', 'registry']) $(id).hidden = id !== b.dataset.tab;
});

// ---- Review queue ----
const VERDICT = { unsure: ['warn', 'Unsure'], severe: ['bad', 'Severe'], rude: ['warn', 'Rude'] };
async function loadQueue() {
  let q;
  try { q = (await api('/api/plugin/queue')).queue; }
  catch (e) { $('queue').innerHTML = `<div class="note bad">${esc(e.message)}</div>`; return; }
  $('count').textContent = q.length ? `(${q.length})` : '';
  $('queue').innerHTML = q.length ? q.map(x => {
    const [tone, label] = VERDICT[x.verdict] || ['', x.verdict];
    return `<div class="item" data-id="${esc(x.id)}">
      <div class="top"><span><span class="pill ${tone}">${esc(label)}</span> ${x.relevance === 'off_topic' ? '<span class="pill warn">off-topic</span> ' : ''}${x.site ? `<span class="muted">on ${esc(x.site)}</span>` : ''}</span>
        <span class="muted">${x.status === 'waiting' ? `expires ${esc(new Date(x.expires_at).toLocaleTimeString())}` : 'sent automatically'}</span></div>
      <div class="quote">${esc(x.text)}</div>
      ${x.meaning ? `<div class="muted">Reads as: ${esc(x.meaning)}</div>` : ''}
      <div class="muted">AI: ${esc(x.reason)}${x.score != null ? ` (score ${Number(x.score).toFixed(2)})` : ''}</div>
      ${x.context ? `<div class="muted">Post context: ${esc(x.context.topic)}: ${esc(x.context.summary)} (${esc(x.context.sensitivity)} sensitivity)</div>` : ''}
      <div class="row">${x.verdict !== 'severe' ? '<button class="small good" data-act="approve">Approve: post it</button>' : ''}<button class="small bad" data-act="uphold">Keep it back</button></div>
    </div>`;
  }).join('') : '<div class="empty">Nothing waiting. Comments the AI is unsure about appear here.</div>';
}
$('queue').onclick = async e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const id = b.closest('.item').dataset.id;
  b.disabled = true;
  try { await api('/api/plugin/resolve', { id, decision: b.dataset.act }); } catch (err) { alert(err.message); }
  loadQueue();
};
$('refresh').onclick = loadQueue;
setInterval(() => { if (!$('app').hidden && !$('review').hidden) loadQueue(); }, 15000);

// ---- Identity ----
const TYPE = { organization: 'Organisation', person: 'Person', agent: 'AI agent' };
function credHtml(c) {
  return `<div class="item"><div class="top"><b>${esc(c.name)}</b><span class="pill ${c.valid ? 'ok' : 'bad'}">${c.valid ? 'valid' : esc(c.reason)}</span></div>
    <div class="mono">${esc(c.account)}</div>
    <div class="muted">${esc(TYPE[c.type] || c.type)}${c.on_behalf_of ? ` · for ${esc(c.on_behalf_of)}` : ''}${c.role ? ` · ${esc(c.role)}` : ''}${c.permissions?.length ? ` · may ${esc(c.permissions.join(', '))}` : ''} · until ${esc(day(c.valid_until))}</div>
    ${c.valid ? `<div class="row"><button class="small bad" data-revoke="${esc(c.id)}">Revoke</button></div>` : ''}</div>`;
}
async function loadCreds() {
  try { const { credentials } = await api('/api/admin/credentials'); $('creds').innerHTML = credentials.length ? credentials.map(credHtml).join('') : '<div class="empty">None issued yet.</div>'; }
  catch (e) { $('creds').innerHTML = `<div class="note bad">${esc(e.message)}</div>`; }
}
$('creds').onclick = async e => {
  const id = e.target.dataset?.revoke; if (!id || !confirm('Revoke this credential? Its badge disappears everywhere.')) return;
  try { await api('/api/admin/revoke', { id }); } catch (err) { alert(err.message); }
  loadCreds();
};
function typeChanged() {
  const t = $('type').value;
  $('perms').hidden = t !== 'agent';
  $('orgFields').hidden = t === 'organization';
  $('behalfHint').textContent = t === 'agent' ? '(the organisation that runs it, required)' : '(organisation, optional for a person)';
}
$('type').onchange = typeChanged; typeChanged();
$('issue').onsubmit = async e => {
  e.preventDefault();
  const t = $('type').value;
  try {
    const r = await api('/api/admin/issue', {
      type: t, platform: $('platform').value, handle: $('handle').value, name: $('name').value,
      on_behalf_of: t === 'organization' ? undefined : $('behalf').value, role: t === 'organization' ? undefined : $('role').value,
      permissions: t === 'agent' ? [...document.querySelectorAll('#perms input:checked')].map(i => i.value) : undefined,
      evidence: $('evidence').value, valid_days: Number($('days').value),
    });
    $('issued').innerHTML = `<div class="note ok">Issued and signed for <span class="mono">${esc(r.summary.account)}</span>. The extension now shows a badge on this account.</div>
      <details style="margin-top:8px"><summary class="muted">Credential (W3C VC JSON)</summary><pre class="mono">${esc(JSON.stringify(r.credential, null, 2))}</pre></details>`;
    loadCreds();
  } catch (err) { $('issued').innerHTML = `<div class="note bad">${esc(err.message)}</div>`; }
};
$('verify').onclick = async () => {
  let credential;
  try { credential = JSON.parse($('vc').value); } catch { $('verified').innerHTML = '<div class="note bad">That isn\'t valid JSON.</div>'; return; }
  try { const r = await api('/api/identity/verify', { credential }); $('verified').innerHTML = `<div class="note ${r.valid ? 'ok' : 'bad'}"><b>${r.valid ? 'Valid.' : 'Not valid.'}</b> ${esc(r.reason)} Issuer: ${esc(r.issuer)}.</div>`; }
  catch (err) { $('verified').innerHTML = `<div class="note bad">${esc(err.message)}</div>`; }
};

// ---- Registry ----
async function loadWorks() {
  try {
    const { items } = await api('/api/admin/registry');
    $('works').innerHTML = items.length ? items.map(m => `<div class="item"><div class="top"><b>${esc(m.title)}</b><span class="mono">${esc(m.content_id)}</span></div>
      <div>by ${esc(m.creator)} ${m.creator_verified ? '<span class="pill ok">✓ verified creator</span>' : ''} <span class="muted">· ${esc(day(m.registered_at))}</span></div>
      <div class="muted">${esc(m.license_text)}${m.parent_id ? ` · made from <span class="mono">${esc(m.parent_id)}</span>` : ''} · signature ${esc(m.signature)}</div></div>`).join('') : '<div class="empty">Nothing registered yet. Creators register work at /register.</div>';
  } catch (e) { $('works').innerHTML = `<div class="note bad">${esc(e.message)}</div>`; }
}

if (key) open();

// /register: fingerprint an image in the browser, show registered work it matches, register it.
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let fp = null;

async function api(path, body) {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function recordHtml(m, extra = '') {
  return `<div class="item"><div class="top"><b>${esc(m.title)}</b><span class="mono">${esc(m.content_id)}</span></div>
    <div>by ${esc(m.creator)} ${m.creator_verified ? '<span class="pill ok">✓ verified creator</span>' : ''} <span class="muted">· registered ${esc(String(m.registered_at).slice(0, 10))}</span></div>
    <div class="muted">${esc(m.license_text)}${m.parent_id ? ` · made from <span class="mono">${esc(m.parent_id)}</span>` : ''}</div>
    <div class="muted">Signature: ${m.signature === 'valid' ? '<span class="pill ok">valid</span>' : `<span class="pill bad">${esc(m.signature_note)}</span>`}</div>${extra}</div>`;
}

async function choose(file) {
  if (!file || !file.type.startsWith('image/')) return;
  $('preview').src = URL.createObjectURL(file); $('preview').hidden = false; $('dropText').hidden = true;
  $('fp').textContent = 'Fingerprinting…'; $('matches').innerHTML = ''; $('result').innerHTML = ''; $('go').disabled = true;
  try {
    fp = await self.argusFingerprint(file);
    $('fp').innerHTML = `Fingerprint <span class="mono">${fp.phash}</span> · ${fp.width}×${fp.height}`;
    const found = await api('/api/provenance/match', { phash: fp.phash, sha256: fp.sha256 });
    $('matches').innerHTML = found.matches.length
      ? `<div class="note warn"><b>Registered work looks like this.</b> ${esc(found.note)}</div><div class="list" style="margin-top:10px">${found.matches.map(m => recordHtml(m, `<div class="muted">${esc(m.relation_text)} ${m.similarity}% similar.</div>`)).join('')}</div>`
      : '<div class="note ok">No registered work looks like this image.</div>';
    $('go').disabled = false;
  } catch (e) { $('fp').textContent = ''; $('matches').innerHTML = `<div class="note bad">${esc(e.message)}</div>`; }
}

$('drop').onclick = () => $('file').click();
$('drop').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click(); } };
$('file').onchange = () => choose($('file').files[0]);
$('drop').ondragover = e => { e.preventDefault(); $('drop').classList.add('over'); };
$('drop').ondragleave = () => $('drop').classList.remove('over');
$('drop').ondrop = e => { e.preventDefault(); $('drop').classList.remove('over'); choose(e.dataTransfer.files[0]); };

$('form').onsubmit = async e => {
  e.preventDefault();
  if (!fp) return;
  $('go').disabled = true;
  try {
    const r = await api('/api/provenance/register', {
      phash: fp.phash, sha256: fp.sha256, title: $('title').value, creator: $('creator').value,
      creator_account: $('account').value.trim() || undefined, license: $('license').value,
      source_url: $('source').value.trim() || undefined, parent_id: $('parent').value.trim() || undefined,
    });
    $('result').innerHTML = `<div class="note ok"><b>${r.duplicate ? 'You already registered this image.' : 'Registered.'}</b> Your Content ID is <span class="mono">${esc(r.content_id)}</span>.</div><div style="margin-top:10px">${recordHtml(r)}</div>
      ${r.record ? `<details style="margin-top:10px"><summary class="muted">Signed record (JSON)</summary><pre class="mono">${esc(JSON.stringify(r.record, null, 2))}</pre></details>` : ''}`;
  } catch (err) { $('result').innerHTML = `<div class="note bad">${esc(err.message)}</div>`; }
  $('go').disabled = false;
};

// Opened from the extension's right-click "Register this image as my work": the fingerprint was
// made in the extension and arrives in the #fragment (never sent to the server in the address).
async function fromExtension() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('error')) { $('matches').innerHTML = `<div class="note bad">${esc(h.get('error'))}</div>`; return; }
  if (!/^[0-9a-f]{16}$/.test(h.get('phash') || '')) return;
  fp = { phash: h.get('phash'), sha256: /^[0-9a-f]{64}$/.test(h.get('sha256') || '') ? h.get('sha256') : undefined };
  const src = h.get('src');
  if (src && /^https:\/\//.test(src)) { $('preview').src = src; $('preview').hidden = false; $('dropText').hidden = true; }
  else $('dropText').innerHTML = '<b>Image from the extension</b><br>Fingerprinted in your browser.';
  if (/^https?:\/\//.test(h.get('page') || '')) $('source').value = h.get('page');
  $('fp').innerHTML = `Fingerprint <span class="mono">${fp.phash}</span>${h.get('size') ? ` · ${esc(h.get('size'))}` : ''} · from the ARGUS extension`;
  try {
    const found = await api('/api/provenance/match', { phash: fp.phash, sha256: fp.sha256 });
    $('matches').innerHTML = found.matches.length
      ? `<div class="note warn"><b>Registered work looks like this.</b> ${esc(found.note)}</div><div class="list" style="margin-top:10px">${found.matches.map(m => recordHtml(m, `<div class="muted">${esc(m.relation_text)} ${m.similarity}% similar.</div>`)).join('')}</div>`
      : '<div class="note ok">No registered work looks like this image.</div>';
  } catch (e) { $('matches').innerHTML = `<div class="note bad">${esc(e.message)}</div>`; }
  $('go').disabled = false;
  history.replaceState(null, '', location.pathname);
}
fromExtension();

$('lookup').onsubmit = async e => {
  e.preventDefault();
  try {
    const r = await api(`/api/provenance/item?id=${encodeURIComponent($('cid').value.trim())}`);
    $('lineage').innerHTML = `<div class="list" style="margin-top:12px">${recordHtml(r.item)}
      ${r.made_from.length ? `<h2 style="margin-top:8px">Made from</h2>${r.made_from.map(m => recordHtml(m)).join('')}` : ''}
      ${r.derivatives.length ? `<h2 style="margin-top:8px">Registered works made from it</h2>${r.derivatives.map(m => recordHtml(m)).join('')}` : ''}</div>`;
  } catch (err) { $('lineage').innerHTML = `<div class="note bad" style="margin-top:12px">${esc(err.message)}</div>`; }
};

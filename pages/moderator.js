// /moderator: the comment moderator on sample posts, with Context Memory and human review.
// Uses the same route as the browser extension (/api/ext/check), so it behaves exactly the same.
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const POSTS = [
  { id: 'demo-trickshot', icon: '🏀', title: 'INSANE half-court trick shot!! (took 40 tries)', text: 'Me and my friends finally hit the half court bank shot into a trash can. Basketball trick shots every week.' },
  { id: 'demo-buscrash', icon: '📰', title: '3 killed in highway bus accident near Chennai', text: 'A private bus collided with a lorry early this morning. Three passengers died and 12 were injured. Police are investigating.' },
  { id: 'demo-firstsong', icon: '🎤', title: 'My first time singing on stage, so nervous!', text: 'Invited to sing at our college fest. Please be kind, I practised for months.' },
  { id: 'demo-biryani', icon: '🍲', title: 'Chennai-style chicken biryani in 30 minutes', text: 'Quick pressure cooker recipe with seeraga samba rice. Full ingredient list in the description.' },
  { id: 'custom', icon: '✏️', title: 'Your own post', text: 'Write a title and description below.' },
  { id: 'none', icon: '∅', title: 'No post', text: 'Judge the words alone, with no context.' },
];
const EXAMPLES = ["That's sick!", 'lol finally', 'how many tries did this take??', "you're an idiot", 'nee oru loosu', 'semma song 🔥', "I'll kill you for spoiling the ending", 'this recipe is trash and so are you'];

let selected = POSTS[0];
$('posts').innerHTML = POSTS.map(p => `<button type="button" class="post" data-id="${p.id}" aria-pressed="${p === selected}"><b>${p.icon} ${esc(p.title)}</b><span>${esc(p.text)}</span></button>`).join('');
$('posts').onclick = e => {
  const b = e.target.closest('.post'); if (!b) return;
  selected = POSTS.find(p => p.id === b.dataset.id);
  document.querySelectorAll('.post').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  $('custom').hidden = selected.id !== 'custom';
  $('result').innerHTML = '';
};
$('chips').innerHTML = EXAMPLES.map(t => `<button type="button">${esc(t)}</button>`).join('');
$('chips').onclick = e => { if (e.target.tagName === 'BUTTON') { $('comment').value = e.target.textContent; $('comment').focus(); } };

// A custom post gets an ID from its text, so editing it counts as a new version.
async function postFor() {
  if (selected.id === 'none') return null;
  if (selected.id !== 'custom') return { id: selected.id, title: selected.title, text: selected.text };
  const title = $('ctitle').value.trim(), text = $('ctext').value.trim();
  if (!title && !text) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(title));
  return { id: 'custom-' + [...new Uint8Array(digest)].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join(''), title, text };
}

async function api(path, body) {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function stats() {
  try {
    const h = await api('/api/health'), c = h.post_context || {};
    $('stats').innerHTML = `<span><b>${c.stored ?? 0}</b>posts remembered</span><span><b>${c.summarised ?? 0}</b>summaries made</span><span><b>${c.reused ?? 0}</b>times reused</span><span><b>${esc(h.moderator_model?.provider || '?')}</b>model in use</span>`;
  } catch { $('stats').textContent = ''; }
}

const TITLES = { clean: 'Posted', rude: 'Not posted yet', severe: "This can't be posted", unsure: 'Waiting for a person', unavailable: "Couldn't check" };
function render(r, text) {
  const ctx = r.context ? `<p class="muted" style="margin:10px 0 0">Judged with this post's context: <b>${esc(r.context.topic)}</b>, ${esc(r.context.summary)} <span class="pill ${r.context.sensitivity === 'high' ? 'bad' : r.context.sensitivity === 'medium' ? 'warn' : 'ok'}">${esc(r.context.sensitivity)} sensitivity</span> ${r.context.reused ? '<span class="pill">reused from memory</span>' : '<span class="pill">summarised just now</span>'}</p>` : '';
  const score = r.score != null ? `<div class="muted" style="margin-top:10px">Harm score ${Number(r.score).toFixed(2)} <span class="hint">(clean below 0.40, severe from 0.85)</span></div><div class="meter"><i style="width:${Math.round(r.score * 100)}%"></i></div>` : '';
  const rewrite = r.suggestion ? `<div class="rewrite"><b>A better way to say it:</b> ${esc(r.suggestion)}<div class="row"><button class="small" id="use">Use this</button></div></div>` : '';
  const posted = r.verdict === 'clean' ? `<div class="quote">${esc(text)}</div>` : '';
  $('result').innerHTML = `<div style="margin-top:16px"><span class="verdict v-${esc(r.verdict)}">${esc(TITLES[r.verdict] || r.verdict)}</span> ${r.label ? `<span class="pill bad">${esc(r.label)}</span>` : ''}
    <p>${esc(r.reason)}</p>${posted}${rewrite}${score}${ctx}
    ${r.verdict === 'unsure' && r.id ? '<p class="note info" id="wait">A moderator can approve or keep this back on <a href="/admin" target="_blank">/admin</a> → Review queue. This page updates when they decide.</p>' : ''}
    ${r.verdict === 'severe' ? '<p class="muted">Sent to moderators for the record. Edit it to say what you mean without the harm.</p>' : ''}</div>`;
  if (r.suggestion) $('use').onclick = () => { $('comment').value = r.suggestion; $('form').requestSubmit(); };
  if (r.verdict === 'unsure' && r.id) waitFor(r.id);
}

let waiting = 0;
async function waitFor(id) {
  const mine = ++waiting;
  for (let i = 0; i < 120 && mine === waiting; i++) {
    await new Promise(r => setTimeout(r, 4000));
    let s; try { s = await api(`/api/ext/status?id=${encodeURIComponent(id)}`); } catch { continue; }
    if (mine !== waiting || !$('wait')) return;
    if (s.status === 'approved') { $('wait').className = 'note ok'; $('wait').textContent = 'A moderator approved it. Posted.'; return; }
    if (s.status === 'rejected') { $('wait').className = 'note bad'; $('wait').textContent = 'A moderator kept it back. It was not posted.'; return; }
    if (s.status === 'expired') { $('wait').className = 'note warn'; $('wait').textContent = 'No moderator decided in time, so it stays unposted.'; return; }
  }
}

$('form').onsubmit = async e => {
  e.preventDefault();
  const text = $('comment').value.trim(); if (!text) return;
  const post = await postFor();
  if (selected.id === 'custom' && !post) { $('result').innerHTML = '<div class="note warn">Write the post\'s title or text first.</div>'; return; }
  waiting++;
  $('go').disabled = true;
  $('result').innerHTML = `<p class="muted" style="margin-top:16px">Checking${post ? ' in the context of this post' : ''}…</p>`;
  try { render(await api('/api/ext/check', { text, site: 'web', replyingTo: post?.title, post }), text); }
  catch (err) { $('result').innerHTML = `<div class="note bad">${esc(err.message)}</div>`; }
  $('go').disabled = false;
  stats();
};

// Opened from the extension's right-click "Check … with the ARGUS moderator": the text arrives in the
// #fragment, which is never sent to the server in the address. Judged with no post context.
const fromExt = new URLSearchParams(location.hash.slice(1)).get('text');
if (fromExt) {
  $('comment').value = fromExt.slice(0, 2000);
  document.querySelector('.post[data-id="none"]').click();
  history.replaceState(null, '', location.pathname);
  $('form').requestSubmit();
}
stats();

// Toolbar panel: the hub for every ARGUS engine. Opens the server's pages (comment check, Lens,
// register work, review and credentials), verifies an account right here, flips automatic image
// checks, and shows whether the ARGUS server is reachable.
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

chrome.storage.sync.get(['server', 'apiBase', 'apiKey', 'auto']).then(async ({ server, apiBase, apiKey, auto }) => {
  const base = (server || apiBase || 'http://localhost:8787').replace(/\/$/, '');
  $('auto').checked = auto === true;
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { chrome.tabs.create({ url: base + b.dataset.open }); window.close(); });
  $('health').onclick = () => { chrome.tabs.create({ url: base + '/api/health' }); window.close(); };
  try {
    const res = await fetch(base + '/api/ext/status?id=ping', { headers: apiKey ? { 'x-extension-key': apiKey } : {} });
    $('status').textContent = res.ok ? `Connected · ${base.replace(/^https?:\/\//, '')}` : `Server answered HTTP ${res.status}`;
    $('status').className = res.ok ? 'ok' : 'bad';
    $('status').title = res.ok ? base : 'Check the address or extension key in Settings.';
  } catch {
    $('status').textContent = "Can't reach server"; $('status').className = 'bad';
    $('status').title = `Can't reach ARGUS at ${base}. Is it running?`;
  }
});

// Pre-fill the account of the page you're on, when it's a YouTube channel, Instagram profile or Reddit user.
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  try {
    const u = new URL(tab?.url || '');
    const yt = /youtube\.com$/.test(u.hostname) && u.pathname.match(/^\/(@[\w.-]+)/);
    const ig = /instagram\.com$/.test(u.hostname) && u.pathname.match(/^\/([\w.]+)\/?$/);
    const rd = /reddit\.com$/.test(u.hostname) && u.pathname.match(/^\/u(?:ser)?\/([\w-]+)/);
    if (yt) { $('platform').value = 'youtube'; $('handle').value = yt[1]; }
    else if (ig && !['explore', 'reels', 'direct', 'accounts'].includes(ig[1])) { $('platform').value = 'instagram'; $('handle').value = ig[1]; }
    else if (rd) { $('platform').value = 'reddit'; $('handle').value = rd[1]; }
  } catch { /* not a web page */ }
});

const PERMS = { post: 'post', reply_comments: 'reply to comments', send_messages: 'send messages', moderate: 'moderate', publish_content: 'publish content' };
$('lookup').onsubmit = async e => {
  e.preventDefault();
  $('who').innerHTML = '<div class="note none">Checking…</div>';
  let r;
  try { r = await chrome.runtime.sendMessage({ type: 'identity', platform: $('platform').value, handle: $('handle').value.trim() }); }
  catch (err) { r = { error: err.message }; }
  if (!r || r.error) { $('who').innerHTML = `<div class="note warn">${esc(r?.error || 'No answer from the server.')}</div>`; return; }
  const vc = r.credentials?.find(c => c.valid);
  if (vc) {
    const what = vc.type === 'organization' ? `Official account of ${vc.name}`
      : vc.type === 'agent' ? `AI agent run by ${vc.on_behalf_of}${vc.permissions?.length ? `, may ${vc.permissions.map(p => PERMS[p] || p).join(', ')}` : ''}`
      : `${vc.name}${vc.role && vc.on_behalf_of ? `, ${vc.role} at ${vc.on_behalf_of}` : vc.on_behalf_of ? `, for ${vc.on_behalf_of}` : ''}`;
    $('who').innerHTML = `<div class="note ok"><b>✓ ARGUS verified.</b> ${esc(what)}. Valid until ${esc(String(vc.valid_until).slice(0, 10))}.</div>`;
  } else if (r.credentials?.length) {
    $('who').innerHTML = `<div class="note warn"><b>⚠ Credential not valid.</b> ${esc(r.credentials[0].reason)}</div>`;
  } else {
    $('who').innerHTML = `<div class="note none">No ARGUS credential for <b>${esc(r.account)}</b>. That's normal for most accounts; it doesn't mean anything is wrong.</div>`;
  }
};

// Switch Argus off (or back on) for the site in the current tab. Takes effect at once.
chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
  let host = '';
  try { const u = new URL(tab?.url || ''); if (/^https?:$/.test(u.protocol)) host = u.hostname; } catch { /* not a web page */ }
  if (!host) { $('here').disabled = true; $('host').textContent = 'web pages'; return; }
  $('host').textContent = host.replace(/^www\./, '');
  const { offSites = [] } = await chrome.storage.sync.get('offSites');
  $('here').checked = !offSites.includes(host);
  $('here').onchange = async () => {
    const { offSites: now = [] } = await chrome.storage.sync.get('offSites');
    const next = $('here').checked ? now.filter(h => h !== host) : [...new Set([...now, host])];
    await chrome.storage.sync.set({ offSites: next });
  };
});

$('settings').onclick = () => { chrome.runtime.openOptionsPage(); window.close(); };
$('auto').onchange = () => chrome.storage.sync.set({ auto: $('auto').checked });

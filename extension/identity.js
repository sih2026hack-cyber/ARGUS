// ARGUS Identity on the page: who posted what you're looking at, and whether ARGUS can vouch for it.
//
// On a YouTube video or channel, a Reddit post, or an Instagram post or profile, this finds the
// author's handle and shown name, asks the ARGUS server (via background.js) for credentials, and
// puts a small badge beside the name:
//   ✓ verified person / official account of an organisation / authorised AI agent of an organisation
//   ⚠ uses the name of a verified account without being it (possible impersonation)
// Accounts without a credential get no badge: most honest accounts have none.
(() => {
  if (window.__argusIdentity) return;
  window.__argusIdentity = true;
  const host = location.hostname;
  const PLATFORM = /youtube\.com$/.test(host) ? 'youtube' : /reddit\.com$/.test(host) ? 'reddit' : /instagram\.com$/.test(host) ? 'instagram' : null;
  if (!PLATFORM) return;

  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  // The author of the main thing on this page: { handle, name, anchor } or null.
  function author() {
    const path = location.pathname;
    if (PLATFORM === 'youtube') {
      if (path === '/watch' || path.startsWith('/shorts/')) {
        const link = document.querySelector('ytd-watch-metadata ytd-channel-name a, #owner ytd-channel-name a, ytd-reel-player-overlay-renderer a[href^="/@"]');
        const handle = (link?.getAttribute('href') || '').match(/\/(@[\w.-]+)/)?.[1];
        return handle ? { handle, name: text(link), anchor: link } : null;
      }
      const own = path.match(/^\/(@[\w.-]+)/)?.[1];
      if (own) { const h = document.querySelector('#page-header h1, ytd-channel-name#channel-name'); return { handle: own, name: text(h), anchor: h }; }
      return null;
    }
    if (PLATFORM === 'reddit') {
      const post = document.querySelector('shreddit-post');
      const handle = post?.getAttribute('author');
      if (!handle) return null;
      const link = document.querySelector(`a[href*="/user/${CSS.escape(handle)}"]`);
      return { handle, name: handle, anchor: link || post };
    }
    if (PLATFORM === 'instagram') {
      if (/^\/(?:p|reel|reels)\//.test(path)) {
        const link = document.querySelector('article header a[href^="/"][role="link"], main header a[href^="/"][role="link"]');
        const handle = (link?.getAttribute('href') || '').match(/^\/([\w.]+)\/?$/)?.[1];
        return handle ? { handle, name: text(link), anchor: link } : null;
      }
      const own = path.match(/^\/([\w.]+)\/?$/)?.[1];
      if (own && !['explore', 'direct', 'accounts', 'reels', 'stories'].includes(own)) {
        const h = document.querySelector('header h2, header h1'); const shown = document.querySelector('header section span[dir="auto"]');
        return { handle: own, name: text(shown) || text(h), anchor: h };
      }
    }
    return null;
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const PERMS = { post: 'post', reply_comments: 'reply to comments', send_messages: 'send messages', moderate: 'moderate', publish_content: 'publish content' };
  function badgeFor(result) {
    const vc = result.credentials?.find(c => c.valid);
    if (vc) {
      const what = vc.type === 'organization' ? `Official account of ${vc.name}`
        : vc.type === 'agent' ? `AI agent operated by ${vc.on_behalf_of}${vc.permissions?.length ? `, allowed to ${vc.permissions.map(p => PERMS[p] || p).join(', ')}` : ''}`
        : `${vc.name}${vc.role && vc.on_behalf_of ? `, ${vc.role} at ${vc.on_behalf_of}` : vc.on_behalf_of ? `, representing ${vc.on_behalf_of}` : ''}`;
      return { tone: 'ok', icon: vc.type === 'agent' ? '🤖' : '✓', short: vc.type === 'agent' ? 'Verified AI agent' : 'ARGUS verified', long: `${what}. Credential valid until ${String(vc.valid_until).slice(0, 10)}. ARGUS checked who controls this account when the credential was issued; it can't see who is typing right now.` };
    }
    if (result.impersonation) return { tone: 'warn', icon: '⚠', short: 'Not the verified account', long: result.impersonation.message };
    const old = result.credentials?.[0];
    if (old) return { tone: 'warn', icon: '⚠', short: 'Credential not valid', long: `This account had an ARGUS credential, but: ${old.reason}` };
    return null;
  }

  let shown = null; // { key, el }
  async function run() {
    const a = author();
    const key = a ? `${a.handle}|${a.name}` : null;
    if (shown && (shown.key !== key || !shown.el.isConnected)) { shown.el.remove(); shown = null; }
    if (!a || shown) return;
    let result;
    try { result = await chrome.runtime.sendMessage({ type: 'identity', platform: PLATFORM, handle: a.handle, name: a.name }); } catch { return; }
    if (!result || result.error) return;
    const badge = badgeFor(result);
    if (!badge || author()?.handle !== a.handle) return;
    const el = document.createElement('span');
    const shadow = el.attachShadow({ mode: 'closed' });
    const [fg, bg] = badge.tone === 'ok' ? ['#067647', '#dcfce7'] : ['#92400e', '#fef3c7'];
    shadow.innerHTML = `<style>
      b{display:inline-flex;align-items:center;gap:4px;margin-left:8px;padding:2px 9px;border-radius:999px;font:600 12px/1.6 'Segoe UI',system-ui,sans-serif;color:${fg};background:${bg};cursor:help;white-space:nowrap;position:relative}
      i{display:none;position:absolute;z-index:2147483647;top:calc(100% + 6px);left:0;width:280px;white-space:normal;font:400 12.5px/1.45 'Segoe UI',system-ui,sans-serif;font-style:normal;color:#14161c;background:#fff;border-radius:10px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
      b:hover i,b:focus i{display:block}
    </style><b tabindex="0">${badge.icon} ${esc(badge.short)}<i>${esc(badge.long)}</i></b>`;
    el.title = '';
    (a.anchor?.parentElement || document.body).insertBefore(el, a.anchor?.nextSibling || null);
    shown = { key, el };
  }

  // These sites change pages without reloading: look again when the address or the page changes.
  let last = '', timer = null;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(run, 600); };
  setInterval(() => { if (location.href !== last) { last = location.href; schedule(); } else if (!shown) schedule(); }, 1500);
  schedule();
})();

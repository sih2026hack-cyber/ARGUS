// Makes the ARGUS demo pages behave like the sites they stand in for: messages and comments
// appear when "sent". The ARGUS extension checks them first, exactly as on the real sites.
// Nothing here leaves this computer.
(() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const textOf = el => (el.tagName === 'TEXTAREA' ? el.value : el.innerText).trim();
  const clear = el => { if (el.tagName === 'TEXTAREA') el.value = ''; else el.textContent = ''; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const time = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // WhatsApp-style chat: Enter or the send arrow sends.
  const chat = document.querySelector('[data-chat]');
  if (chat) {
    const box = chat.querySelector('[contenteditable]'), list = document.querySelector('[data-messages]'), send = chat.querySelector('[data-send]');
    const go = () => { const t = textOf(box); if (!t) return; list.insertAdjacentHTML('beforeend', `<div class="msg out"><span>${esc(t)}</span><small>${time()} ✓✓</small></div>`); clear(box); list.scrollTop = list.scrollHeight; };
    send.addEventListener('click', go);
    box.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } });
  }

  // Comment boxes (YouTube, Instagram, X): the button posts; on Instagram Enter posts too.
  document.querySelectorAll('[data-comment-form]').forEach(form => {
    const box = form.querySelector('textarea, [contenteditable]'), list = document.querySelector(form.dataset.commentForm), me = form.dataset.me || 'you';
    const go = e => { e?.preventDefault(); const t = textOf(box); if (!t) return; list.insertAdjacentHTML('afterbegin', `<div class="comment"><b>${esc(me)}</b> <span>${esc(t)}</span><small> · just now</small></div>`); clear(box); };
    form.querySelector('[data-post]').addEventListener('click', go);
    form.addEventListener('submit', go);
    if (form.dataset.enter === 'send') box.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) go(e); });
  });
})();

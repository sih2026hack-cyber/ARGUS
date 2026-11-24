// The demo video page: three videos, chosen with ?v=, so ARGUS's Context Memory sees a
// different post for each (the same comment reads differently under each one).
(() => {
  const VIDEOS = {
    'demo-trickshot': { title: 'INSANE half-court trick shot!! (took 40 tries)', desc: 'Me and my friends finally hit the half court bank shot into a trash can. Basketball trick shots every week 🏀', channel: ['Hoops Daily', '@hoopsdaily'], grad: 'linear-gradient(135deg,#ff8c42,#ffd166 40%,#118ab2)', subs: '1.4M subscribers', comments: [['@hoopfan', 'no way this took only 40 tries 😂'], ['@coachravi', 'the arc on that shot is perfect']] },
    'demo-buscrash': { title: '3 killed in highway bus accident near Chennai', desc: 'A private bus collided with a lorry early this morning. Three passengers died and 12 were injured. Police are investigating.', channel: ['Chennai News Live', '@chennainewslive'], grad: 'linear-gradient(135deg,#1b263b,#415a77 50%,#778da9)', subs: '2.1M subscribers', comments: [['@chennai_local', 'Prayers for the families 🙏'], ['@roadsafety', 'That stretch needs speed cameras.']] },
    'demo-firstsong': { title: 'My first time singing on stage, so nervous!', desc: 'Invited to sing at our college fest. Please be kind, I practised for months 🎤', channel: ['Northfield University', '@northfielduniversity'], grad: 'linear-gradient(135deg,#7b2ff7,#f107a3)', subs: '48K subscribers', comments: [['@bestie', 'SO proud of you!!'], ['@music_club', 'Great stage presence']] },
    // A look-alike: same name as the university, a different handle. ARGUS warns about it once the real channel is verified.
    'demo-admissions': { title: 'ADMISSIONS 2027 OPEN: pay the fee today to confirm your seat', desc: 'Last date tonight. Pay the registration fee at the link in our bio to confirm admission.', channel: ['Northfield University', '@northfield.admissions'], grad: 'linear-gradient(135deg,#0b3d91,#1e88e5)', subs: '2K subscribers', comments: [['@parent_2027', 'Is this the official channel?'], ['@aspirant', 'paid already, waiting for confirmation']] },
  };
  const id = new URLSearchParams(location.search).get('v');
  if (!VIDEOS[id]) { location.replace('/demo/youtube?v=demo-trickshot'); return; }
  const v = VIDEOS[id], $ = s => document.querySelector(s);
  document.title = `${v.title} · ARGUS demo`;
  $('#title').textContent = v.title;
  $('#description-inline-expander').textContent = v.desc;
  $('#subs').textContent = v.subs;
  $('#channel').textContent = v.channel[0]; $('#channel').setAttribute('href', '/' + v.channel[1]);
  const player = $('.player');
  player.style.background = v.grad; $('#thumb').remove();
  player.insertAdjacentHTML('beforeend', `<div style="position:absolute;inset:0;display:grid;place-items:center;font:700 64px/1 system-ui;color:#ffffffcc;text-shadow:0 4px 30px #0008">▶</div>`);
  $('#count').textContent = `${v.comments.length + 1_200} Comments`;
  $('#comments').innerHTML = v.comments.map(([who, t]) => `<div class="comment"><b>${who}</b> <span>${t}</span><small> · 2 hours ago</small></div>`).join('');
})();

// "Your page": the user's own page built from panels of the other pages.
// The panels are the real, live cards: while Your page is open each chosen card is moved in from its own page
// (a placeholder keeps its spot) and moved back the moment another page is opened, so every button, chart and map in it still works.
// The page is clean by default; "Arrange" shows the handles to drag, resize and remove panels.
(function mineMod() {
  const { $, $$, st, esc } = SW;
  const PAGES = [['map', 'Radar'], ['forecast', 'Forecast'], ['lookup', 'Look Up'], ['history', 'History'], ['models', 'Models'], ['sounding', 'Sounding'], ['alerts', 'Alerts'], ['fire', 'Fire'], ['nature', 'Nature'], ['drive', 'Drive'], ['tides', 'Tides'], ['marine', 'Marine'], ['briefing', 'Discussions'], ['fun', 'Extremes']];
  const pageName = v => (PAGES.find(p => p[0] === v) || [v, v])[1];
  const MAPNODES = ['#map', '#timeline', '#legend'];
  const ICON = {
    grip: '<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>',
    wide: '<svg viewBox="0 0 24 24"><path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4"/></svg>',
    half: '<svg viewBox="0 0 24 24"><path d="M10 12H3M10 12l-3-3M10 12l-3 3M14 12h7M14 12l3-3M14 12l3 3"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    page: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="3.5" width="7.5" height="4.5" rx="1.5"/><rect x="13" y="10" width="7.5" height="10.5" rx="1.5"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5"/></svg>'
  };
  let lent = [];           // [{p, el, ph} or {p, map}] cards now on Your page
  let gen = 0, pickV = null, watchT = null, arranging = false, dragEl = null;
  if (!Array.isArray(st.mine)) st.mine = [];

  // ---------- finding a page's panels ----------
  // names for panels whose heading is missing or changes every day
  const NAMES = { hiCalCard: 'Calendar', hiStory: 'The day’s story', drBar: 'Trip planner', fiDanger: 'Fire danger now', fiMapCard: 'Fire map', naHero: 'Nature right now', fcDayCard: 'The day you picked' };
  const UNNAMED = { alerts: 'Newest alert', briefing: 'Forecast discussion', drive: 'Drive map', fun: 'Extremes', sounding: 'Sounding', tides: 'The tide now' };
  function title(c) {
    if (NAMES[c.id]) return NAMES[c.id];
    const h = c.querySelector('h2');
    if (h) { const x = h.cloneNode(true); $$('button, select, input, .spacer, .tipq, .dim, small', x).forEach(e => e.remove()); const t = x.textContent.replace(/\s+/g, ' ').trim(); if (t) return t; }
    if (c.querySelector('.hero')) return 'Right now';
    const sec = c.closest('.view'), v = sec ? sec.id.slice(2) : '';
    if (UNNAMED[v]) return UNNAMED[v];
    const t = c.innerText.replace(/\s+/g, ' ').trim(); return t.slice(0, 40) + (t.length > 40 ? '…' : '');
  }
  function keyOf(c, list) {
    if (c.id) return '#' + c.id;
    const h = c.querySelector('h2');
    if (h) return 'h:' + title(c).replace(/[0-9]+/g, '#').toLowerCase();
    return 'n:' + list.filter(x => !x.id && !x.querySelector('h2')).indexOf(c);
  }
  function cards(v) {
    const sec = $('#v-' + v); if (!sec) return [];
    const list = $$('.card', sec).filter(c => !c.parentElement.closest('.card') && !c.closest('.modal'));
    return list.map(c => ({ el: c, key: keyOf(c, list), name: title(c), hidden: c.classList.contains('hidden') }));
  }
  function find(p) {
    if (p.v === 'map') return $('#map') && $('#map').closest('#v-map') ? 'map' : null;
    const c = cards(p.v).find(x => x.key === p.key); return c ? c.el : null;
  }
  const panelOf = p => $$('#mnGrid .mn-p').find(el => el._p === p);

  // ---------- lending the cards out and back ----------
  function returnOne(o) {
    if (o.map) { o.map.forEach(([el, ph]) => { if (ph.parentNode) ph.parentNode.replaceChild(el, ph); }); SW.map.shown(); return; }
    if (o.ph.parentNode) o.ph.parentNode.replaceChild(o.el, o.ph); else o.el.remove(); // its page drew a new copy meanwhile
  }
  function giveBack() {
    clearInterval(watchT); watchT = null;
    lent.forEach(returnOne); lent = [];
    $$('#mnGrid .mn-body').forEach(b => b.innerHTML = '');
    setTimeout(() => SW.fitCharts(), 60); // back at home size
  }
  function borrow(p) {
    const pe = panelOf(p), body = pe && $('.mn-body', pe); if (!body) return false;
    if (lent.some(o => o.p === p)) return true;
    const f = find(p); if (!f) return false;
    body.innerHTML = '';
    if (f === 'map') {
      const pairs = MAPNODES.map(s => $(s)).filter(Boolean).map(el => { const ph = document.createComment('map'); el.parentNode.replaceChild(ph, el); body.appendChild(el); return [el, ph]; });
      body.classList.add('mn-mapbox'); lent.push({ p, map: pairs }); setTimeout(SW.map.shown, 50);
    } else {
      const ph = document.createComment('lent to Your page'); f.parentNode.replaceChild(ph, f); body.appendChild(f); lent.push({ p, el: f, ph });
    }
    pe.classList.add('ready');
    return true;
  }
  // A page can redraw itself after its first answer arrives; keep each panel pointing at the newest card for a while.
  function watch(g) {
    let n = 0; clearInterval(watchT);
    watchT = setInterval(function rewatch() {
      if (g !== gen || !$('#v-mine').classList.contains('on')) { clearInterval(watchT); return; }
      lent = lent.filter(o => { if (o.map || o.ph.isConnected) return true; o.el.remove(); return false; });
      st.mine.forEach(p => {
        if (borrow(p) || n < 15) return;
        const pe = panelOf(p), b = pe && $('.mn-body', pe);
        if (b && !b.querySelector('.mn-miss')) { b.innerHTML = '<div class="card mn-miss"><h2>' + esc(p.name || pageName(p.v)) + '</h2><div class="state">Not on the ' + esc(pageName(p.v)) + ' page right now. Some panels only show for some places or some weather.</div></div>'; pe.classList.add('ready'); }
      });
      SW.fitCharts($('#mnGrid'));
      if (++n > 30) clearInterval(watchT);
    }, 1000);
  }

  // ---------- drawing the page ----------
  function hello() {
    const h = new Date().getHours();
    return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
  }
  function panelHTML(p) {
    return '<div class="mn-p' + (p.wide ? ' wide' : '') + '">' +
      '<div class="mn-tools"><span class="mn-grip" title="Drag to move">' + ICON.grip + '</span><span class="mn-from"><b>' + esc(pageName(p.v)) + '</b> ' + esc(p.name || '') + '</span>' +
      '<button class="mn-up" title="Move earlier">' + ICON.up + '</button><button class="mn-dn" title="Move later">' + ICON.down + '</button>' +
      '<button class="mn-w" title="' + (p.wide ? 'Half width' : 'Full width') + '">' + (p.wide ? ICON.half : ICON.wide) + '</button><button class="mn-x" title="Take it off Your page">' + ICON.x + '</button></div>' +
      '<div class="mn-body"><div class="card mn-wait"><div class="mn-sk w40"></div><div class="mn-sk"></div><div class="mn-sk w70"></div><div class="mn-sk w55"></div></div></div><div class="mn-shield"></div></div>';
  }
  function frame() {
    const sec = $('#v-mine'), l = SW.loc();
    sec.classList.toggle('arranging', arranging);
    sec.innerHTML = '<div class="mn-head"><div class="mn-hi"><div class="mn-hello">' + hello() + '</div><div class="mn-sub">' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + (l ? '<span class="mn-dot"></span>' + esc(l.name) : '') + '</div></div><span class="spacer"></span>' +
      (st.mine.length ? '<button class="btn ghost' + (arranging ? ' on' : '') + '" id="mnArrange">' + (arranging ? 'Done arranging' : 'Arrange') + '</button>' : '') + '<button class="btn" id="mnAdd">+ Add panels</button></div>' +
      '<div id="mnPick" class="card hidden"></div>' +
      (st.mine.length ? '' : '<div class="mn-empty"><div class="mn-empty-ico">' + ICON.page + '</div><h2>Make this page yours</h2><p>Pick the panels you check most, from any page in Skywatch, and see them all here together. Arrange them any way you like.</p><div class="mn-empty-btns"><button class="btn" id="mnStart">Start with a few favorites</button><button class="btn ghost" id="mnAdd2">Choose my own</button></div></div>') +
      '<div id="mnGrid">' + st.mine.map(panelHTML).join('') + '</div>';
    $$('#mnGrid .mn-p').forEach((el, i) => { el._p = st.mine[i]; el.style.animationDelay = Math.min(i, 8) * 45 + 'ms'; wire(el); });
    $('#mnAdd').onclick = () => { const box = $('#mnPick'); if (!box.classList.contains('hidden')) { box.classList.add('hidden'); return; } pick(pickV || 'forecast'); };
    if ($('#mnAdd2')) $('#mnAdd2').onclick = () => pick('forecast');
    if ($('#mnStart')) $('#mnStart').onclick = favorites;
    if ($('#mnArrange')) $('#mnArrange').onclick = () => setArrange(!arranging);
  }
  function setArrange(on) {
    arranging = on; const sec = $('#v-mine');
    sec.classList.toggle('arranging', on);
    $$('#mnGrid .mn-p').forEach(el => el.draggable = on);
    const b = $('#mnArrange'); if (b) { b.textContent = on ? 'Done arranging' : 'Arrange'; b.classList.toggle('on', on); }
  }
  const save = () => SW.save();
  // smooth moves: remember where every panel was, change the layout, then slide each one from its old spot
  function flip(change) {
    const els = $$('#mnGrid .mn-p'), before = new Map(els.map(e => [e, e.getBoundingClientRect()]));
    change();
    $$('#mnGrid .mn-p').forEach(function slide(e) {
      const a = before.get(e); if (!a) return;
      const b = e.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
      if (!dx && !dy) return;
      e.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
    setTimeout(() => SW.fitCharts($('#mnGrid')), 280);
  }
  function orderFromDom() { st.mine = $$('#mnGrid .mn-p').map(e => e._p); save(); }
  function wire(el) {
    const p = el._p;
    el.draggable = arranging;
    $('.mn-w', el).onclick = () => flip(() => { p.wide = !p.wide; el.classList.toggle('wide', p.wide); const b = $('.mn-w', el); b.innerHTML = p.wide ? ICON.half : ICON.wide; b.title = p.wide ? 'Half width' : 'Full width'; save(); });
    $('.mn-up', el).onclick = () => { const pr = el.previousElementSibling; if (pr) flip(() => { el.parentNode.insertBefore(el, pr); orderFromDom(); }); };
    $('.mn-dn', el).onclick = () => { const nx = el.nextElementSibling; if (nx) flip(() => { el.parentNode.insertBefore(nx, el); orderFromDom(); }); };
    $('.mn-x', el).onclick = () => {
      const o = lent.find(x => x.p === p); if (o) { returnOne(o); lent = lent.filter(x => x !== o); }
      el.classList.add('gone');
      setTimeout(() => { flip(() => { el.remove(); orderFromDom(); }); if (!st.mine.length) { setArrange(false); frame(); } if (!$('#mnPick').classList.contains('hidden')) pick(pickV); }, 180);
    };
    el.ondragstart = e => { if (!arranging) { e.preventDefault(); return; } dragEl = el; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'panel'); } catch (er) { } setTimeout(() => el.classList.add('drag'), 0); };
    el.ondragend = () => { el.classList.remove('drag'); if (dragEl) orderFromDom(); dragEl = null; setTimeout(() => SW.fitCharts($('#mnGrid')), 60); };
    // the panels make room while one is dragged over them
    el.ondragover = e => {
      if (!dragEl || dragEl === el) return; e.preventDefault();
      const r = el.getBoundingClientRect(), after = (e.clientY - r.top) / r.height > 0.5 || (r.height > 0 && (e.clientX - r.left) / r.width > 0.5 && Math.abs(e.clientY - (r.top + r.height / 2)) < r.height / 4);
      const ref = after ? el.nextElementSibling : el;
      if (ref === dragEl || (after ? dragEl.previousElementSibling === el : dragEl.nextElementSibling === el)) return;
      flip(() => el.parentNode.insertBefore(dragEl, ref));
    };
    el.ondrop = e => e.preventDefault();
  }

  // ---------- adding panels ----------
  async function pick(v) {
    pickV = v; const box = $('#mnPick'); box.classList.remove('hidden');
    box.innerHTML = '<div class="mn-pick-head"><h2>Add panels</h2><span class="dim small">Choose a page, then add any of its panels. They stay live, just like on their own page.</span><span class="spacer"></span><button class="btn ghost" id="mnPickX">Done</button></div>' +
      '<div class="mn-pages">' + PAGES.map(p => '<button class="mn-pg' + (p[0] === v ? ' on' : '') + '" data-v="' + p[0] + '">' + p[1] + '</button>').join('') + '</div>' +
      '<div id="mnList"><div class="mn-opt mn-wait"><div class="mn-sk w55"></div></div><div class="mn-opt mn-wait"><div class="mn-sk w40"></div></div><div class="mn-opt mn-wait"><div class="mn-sk w70"></div></div></div>';
    $('#mnPickX').onclick = () => box.classList.add('hidden');
    $$('.mn-pg', box).forEach(b => b.onclick = () => pick(b.dataset.v));
    let list;
    if (v === 'map') list = [{ key: 'map', name: 'Radar and satellite map' }];
    else {
      await SW.loadView(v); await new Promise(r => setTimeout(r, 1200));
      if (pickV !== v) return;
      const have = st.mine.filter(p => p.v === v).map(p => ({ key: p.key, name: p.name }));
      list = cards(v).filter(c => !c.hidden).map(c => ({ key: c.key, name: c.name }));
      have.forEach(h => { if (!list.some(x => x.key === h.key)) list.push(h); }); // the ones already lent out
    }
    if (pickV !== v) return;
    const row = c => { const on = st.mine.some(p => p.v === v && p.key === c.key); return '<div class="mn-opt' + (on ? ' on' : '') + '"><span class="mn-opt-name">' + esc(c.name) + '</span><button class="btn' + (on ? ' ghost' : '') + '" data-k="' + esc(c.key) + '"' + (on ? ' disabled' : '') + '>' + (on ? '✓ Added' : '+ Add') + '</button></div>'; };
    $('#mnList').innerHTML = list.length ? list.map(row).join('') : '<div class="state">This page has nothing to add for this place yet.</div>';
    $$('#mnList button[data-k]').forEach(b => b.onclick = () => { const c = list.find(x => x.key === b.dataset.k); add({ v, key: c.key, name: c.name, wide: v === 'map' }); b.disabled = true; b.textContent = '✓ Added'; b.classList.add('ghost'); b.parentNode.classList.add('on'); });
  }
  function add(p) {
    if (st.mine.some(x => x.v === p.v && x.key === p.key)) return;
    st.mine.push(p); save();
    if (st.mine.length === 1) { const keep = pickV; frame(); pick(keep); } // the first one replaces the welcome
    else if ($('#mnArrange') == null) $('#mnAdd').insertAdjacentHTML('beforebegin', '<button class="btn ghost" id="mnArrange">Arrange</button>');
    if ($('#mnArrange')) $('#mnArrange').onclick = () => setArrange(!arranging);
    let el = panelOf(p);
    if (!el) { $('#mnGrid').insertAdjacentHTML('beforeend', panelHTML(p)); el = $('#mnGrid').lastElementChild; el._p = p; wire(el); }
    el.classList.add('fresh'); setTimeout(() => el.classList.remove('fresh'), 1600);
    SW.loadView(p.v).then(() => { borrow(p); watch(gen); });
  }
  function favorites() {
    st.mine = [{ v: 'forecast', key: 'n:0', name: 'Right now' }, { v: 'forecast', key: 'h:#-day outlook', name: '10-day outlook' }, { v: 'map', key: 'map', name: 'Radar and satellite map', wide: true }, { v: 'history', key: '#hiCalCard', name: 'Calendar' }, { v: 'nature', key: '#naUV', name: 'Sun strength (UV)' }];
    save(); load();
  }

  async function load() {
    const g = ++gen;
    giveBack(); frame(); setArrange(arranging);
    const views = Array.from(new Set(st.mine.map(p => p.v))).filter(v => v !== 'map');
    await Promise.all(views.map(v => SW.loadView(v)));
    if (g !== gen || !$('#v-mine').classList.contains('on')) return;
    st.mine.forEach(borrow);
    setTimeout(() => SW.fitCharts($('#mnGrid')), 60);
    watch(g);
  }
  // A day clicked in the 10-day outlook opens that day's forecast in a sheet over Your page
  // (on the Forecast page it opens under the outlook; here the outlook may be anywhere).
  let sheet = null;
  function closeSheet() {
    if (!sheet) return;
    const { wrap, card, ph, i } = sheet; sheet = null;
    if (ph.parentNode) ph.parentNode.replaceChild(card, ph);
    if (!card.classList.contains('hidden') && SW.fcDay) SW.fcDay(i); // the forecast closes its day the usual way
    card.classList.add('hidden'); $$('.fc-out .day').forEach(e => e.classList.remove('on'));
    wrap.classList.add('out'); setTimeout(() => wrap.remove(), 200);
  }
  document.addEventListener('click', function daySheet(e) {
    const d = e.target.closest && e.target.closest('#v-mine .fc-out .day[data-i]'); if (!d) return;
    setTimeout(function openSheet() {
      const card = $('#fcDayCard'); if (!card) return;
      if (card.classList.contains('hidden')) { closeSheet(); return; }
      if (sheet) { sheet.i = +d.dataset.i; setTimeout(() => SW.fitCharts(sheet.wrap), 60); return; } // already showing; the forecast filled in the new day
      const wrap = document.createElement('div'); wrap.className = 'mn-sheet';
      wrap.innerHTML = '<div class="mn-sheet-in"><button class="mn-sheet-x" title="Close">' + ICON.x + '</button></div>';
      const ph = document.createComment('day sheet'); card.parentNode.replaceChild(ph, card);
      $('.mn-sheet-in', wrap).appendChild(card); document.body.appendChild(wrap);
      sheet = { wrap, card, ph, i: +d.dataset.i };
      wrap.onclick = ev => { if (ev.target === wrap || ev.target.closest('.mn-sheet-x')) closeSheet(); };
      setTimeout(() => SW.fitCharts(wrap), 60);
    }, 0);
  });
  document.addEventListener('keydown', function sheetKey(e) { if (e.key === 'Escape') closeSheet(); });
  const giveBackAll = giveBack;
  giveBack = function giveBackWithSheet() { closeSheet(); giveBackAll(); };
  SW.mine = { load, giveBack: () => giveBack() };
})();

// "Your page": the user's own page built from panels of the other pages.
// The panels are the real, live cards: while Your page is open each chosen card is moved in from its own page
// (a placeholder keeps its spot) and moved back the moment another page is opened, so every button, chart and map in it still works.
(function mineMod() {
  const { $, $$, st, esc } = SW;
  const PAGES = [['map', 'Radar'], ['forecast', 'Forecast'], ['lookup', 'Look Up'], ['history', 'History'], ['models', 'Models'], ['sounding', 'Sounding'], ['alerts', 'Alerts'], ['fire', 'Fire'], ['nature', 'Nature'], ['drive', 'Drive'], ['tides', 'Tides'], ['marine', 'Marine'], ['briefing', 'Discussions'], ['fun', 'Extremes']];
  const pageName = v => (PAGES.find(p => p[0] === v) || [v, v])[1];
  const MAPNODES = ['#map', '#timeline', '#legend'];
  let lent = [];           // [{el, ph, i}] cards now on Your page
  let gen = 0, pickV = null, watchT = null;
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

  // ---------- lending the cards out and back ----------
  function giveBack() {
    clearInterval(watchT); watchT = null;
    for (const o of lent) {
      if (o.map) { o.map.forEach(([el, ph]) => { if (ph.parentNode) ph.parentNode.replaceChild(el, ph); }); SW.map.shown(); continue; }
      if (o.ph.parentNode) o.ph.parentNode.replaceChild(o.el, o.ph); else o.el.remove(); // its page drew a new copy meanwhile
    }
    lent = [];
    $$('#mnGrid .mn-body').forEach(b => b.innerHTML = '');
    setTimeout(() => SW.fitCharts(), 60); // back at home size
  }
  function borrow(i) {
    const p = st.mine[i], body = $('#mnGrid .mn-p[data-i="' + i + '"] .mn-body'); if (!p || !body) return false;
    if (lent.some(o => o.i === i)) return true;
    const f = find(p); if (!f) return false;
    if (f === 'map') {
      body.innerHTML = '';
      const pairs = MAPNODES.map(s => $(s)).filter(Boolean).map(el => { const ph = document.createComment('map'); el.parentNode.replaceChild(ph, el); body.appendChild(el); return [el, ph]; });
      body.classList.add('mn-mapbox'); lent.push({ i, map: pairs }); setTimeout(SW.map.shown, 50); return true;
    }
    const ph = document.createComment('lent to Your page'); f.parentNode.replaceChild(ph, f); body.innerHTML = ''; body.appendChild(f); lent.push({ el: f, ph, i });
    return true;
  }
  // A page can redraw itself after its first answer arrives; keep each panel pointing at the newest card for a while.
  function watch(g) {
    let n = 0; clearInterval(watchT);
    watchT = setInterval(function rewatch() {
      if (g !== gen || !$('#v-mine').classList.contains('on')) { clearInterval(watchT); return; }
      lent = lent.filter(o => { if (o.map || o.ph.isConnected) return true; o.el.remove(); return false; });
      let missing = 0;
      st.mine.forEach((p, i) => { if (!borrow(i)) { missing++; if (n > 14) { const b = $('#mnGrid .mn-p[data-i="' + i + '"] .mn-body'); if (b && !b.children.length) b.innerHTML = '<div class="state">This panel is not on the ' + esc(pageName(p.v)) + ' page right now (it may only show for some places or some weather).</div>'; } } });
      SW.fitCharts($('#mnGrid'));
      if (++n > 30) clearInterval(watchT);
    }, 1000);
  }

  // ---------- drawing the page ----------
  function frame() {
    const sec = $('#v-mine');
    sec.innerHTML = '<div class="mn-head"><h1>Your page</h1><span class="dim small">Panels from any page, in the order you like. Drag a panel by its top bar to move it.</span><span class="spacer"></span><button class="btn" id="mnAdd">+ Add a panel</button></div>' +
      '<div id="mnPick" class="card hidden"></div>' +
      (st.mine.length ? '' : '<div class="card mn-empty"><h2>Nothing here yet</h2><p>Pick the panels you look at most, from any page, and they all show up here together.</p><p style="margin-top:12px"><button class="btn" id="mnStart">Start me with a few favorites</button> <button class="btn ghost" id="mnAdd2">Choose my own</button></p></div>') +
      '<div id="mnGrid">' + st.mine.map((p, i) => '<div class="mn-p' + (p.wide ? ' wide' : '') + '" data-i="' + i + '"><div class="mn-bar" title="Drag to move"><span class="mn-grip">⠿</span><span class="mn-from">' + esc(pageName(p.v)) + ' · ' + esc(p.name || '') + '</span><span class="spacer"></span>' +
        '<button class="mn-w" title="' + (p.wide ? 'Make it half width' : 'Make it full width') + '">' + (p.wide ? 'Half width' : 'Full width') + '</button><button class="mn-up" title="Move up">↑</button><button class="mn-dn" title="Move down">↓</button><button class="mn-x" title="Take it off Your page">✕</button></div>' +
        '<div class="mn-body"><div class="state"><span class="spin"></span>Loading from the ' + esc(pageName(p.v)) + ' page…</div></div></div>').join('') + '</div>';
    $('#mnAdd').onclick = () => pick(pickV || 'forecast');
    if ($('#mnAdd2')) $('#mnAdd2').onclick = () => pick('forecast');
    if ($('#mnStart')) $('#mnStart').onclick = favorites;
    $$('#mnGrid .mn-p').forEach(wire);
  }
  function save() { SW.save(); }
  function move(from, to) {
    if (to < 0 || to >= st.mine.length || from === to) return;
    const [p] = st.mine.splice(from, 1); st.mine.splice(to, 0, p); save(); relayout();
  }
  // reorder without reloading: give the cards back, redraw the frame, lend them again
  function relayout() { giveBack(); frame(); st.mine.forEach((p, i) => borrow(i)); watch(gen); }
  let dragI = null;
  function wire(el) {
    const i = +el.dataset.i, bar = $('.mn-bar', el);
    $('.mn-w', el).onclick = () => { st.mine[i].wide = !st.mine[i].wide; save(); relayout(); };
    $('.mn-up', el).onclick = () => move(i, i - 1);
    $('.mn-dn', el).onclick = () => move(i, i + 1);
    $('.mn-x', el).onclick = () => { st.mine.splice(i, 1); save(); relayout(); if (!$('#mnPick').classList.contains('hidden')) pick(pickV); };
    bar.onmousedown = e => { if (!e.target.closest('button')) el.draggable = true; };
    el.ondragstart = e => { dragI = i; el.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch (er) { } };
    el.ondragend = () => { el.draggable = false; el.classList.remove('drag'); $$('#mnGrid .mn-p').forEach(x => x.classList.remove('over')); dragI = null; };
    el.ondragover = e => { if (dragI == null) return; e.preventDefault(); $$('#mnGrid .mn-p').forEach(x => x.classList.toggle('over', x === el && dragI !== i)); };
    el.ondrop = e => { e.preventDefault(); if (dragI != null) move(dragI, i); };
  }

  // ---------- adding panels ----------
  async function pick(v) {
    pickV = v; const box = $('#mnPick'); box.classList.remove('hidden');
    box.innerHTML = '<h2>Add a panel<span class="spacer"></span><button class="btn ghost" id="mnPickX" style="padding:2px 10px">Done</button></h2><div class="row" style="gap:8px;margin-bottom:10px"><label>From the page</label><select id="mnPage">' + PAGES.map(p => '<option value="' + p[0] + '"' + (p[0] === v ? ' selected' : '') + '>' + p[1] + '</option>').join('') + '</select></div><div id="mnList"><div class="state"><span class="spin"></span>Opening that page…</div></div>';
    $('#mnPickX').onclick = () => box.classList.add('hidden');
    $('#mnPage').onchange = e => pick(e.target.value);
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
    $('#mnList').innerHTML = list.length ? list.map(c => { const on = st.mine.some(p => p.v === v && p.key === c.key); return '<div class="mn-opt"><span>' + esc(c.name) + '</span><button class="btn' + (on ? ' ghost' : '') + '" data-k="' + esc(c.key) + '"' + (on ? ' disabled' : '') + '>' + (on ? 'On your page' : 'Add') + '</button></div>'; }).join('') : '<div class="state">This page has nothing to add for this place yet.</div>';
    $$('#mnList button[data-k]').forEach(b => b.onclick = () => { const c = list.find(x => x.key === b.dataset.k); add({ v, key: c.key, name: c.name, wide: v === 'map' }); b.disabled = true; b.textContent = 'On your page'; b.classList.add('ghost'); });
  }
  function add(p) {
    if (st.mine.some(x => x.v === p.v && x.key === p.key)) return;
    st.mine.push(p); save();
    const keep = !$('#mnPick').classList.contains('hidden') ? pickV : null;
    giveBack(); frame(); if (keep) pick(keep);
    st.mine.forEach((q, i) => borrow(i)); watch(gen);
  }
  async function favorites() {
    st.mine = [{ v: 'forecast', key: 'n:0', name: 'Right now' }, { v: 'map', key: 'map', name: 'Radar and satellite map', wide: true }, { v: 'forecast', key: 'h:#-day outlook', name: '10-day outlook', wide: true }, { v: 'history', key: '#hiCalCard', name: 'This month' }, { v: 'nature', key: '#naUV', name: 'Sun and UV' }];
    save(); load();
  }

  async function load() {
    const g = ++gen;
    giveBack(); frame();
    const views = Array.from(new Set(st.mine.map(p => p.v))).filter(v => v !== 'map');
    await Promise.all(views.map(v => SW.loadView(v)));
    if (g !== gen || !$('#v-mine').classList.contains('on')) return;
    st.mine.forEach((p, i) => borrow(i));
    setTimeout(() => SW.fitCharts($('#mnGrid')), 60);
    watch(g);
  }
  SW.mine = { load, giveBack };
})();

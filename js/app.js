// Skywatch shell: places, navigation, units, refresh, first-run, sources page.
(function appMod() {
  const { $, $$, st, api, esc } = SW;
  let view = 'map';
  const fresh = {}; // view -> key of what it last loaded
  const mods = { forecast: SW.forecast, models: SW.models, sounding: SW.sounding, alerts: SW.alerts, briefing: SW.briefing, marine: SW.marine, lookup: SW.lookup, history: SW.history, fire: SW.fire, tides: SW.tides, fun: SW.fun, nature: SW.nature, drive: SW.drive, mine: SW.mine };

  // draws a page into its own (possibly hidden) section, unless it is already drawn for this place; Your page uses it too
  SW.loadView = function loadView(v) {
    if (v === 'map' || v === 'about' || v === 'mine' || !mods[v]) return Promise.resolve();
    const l = SW.loc(), key = l ? l.lat + ',' + l.lon + st.units : '';
    if (fresh[v] === key && v !== 'alerts') return Promise.resolve();
    fresh[v] = key;
    return Promise.resolve(mods[v].load()).catch(e => console.error(v, e));
  };
  SW.show = function show(v) {
    if (view === 'mine' && v !== 'mine') SW.mine.giveBack(); // its panels go home before their own page opens
    view = v;
    $$('#rail button').forEach(b => b.classList.toggle('on', b.dataset.view === v || (v === 'tides' && b.dataset.view === 'marine')));
    $$('main .view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
    if (v === 'map') { SW.map.shown(); return Promise.resolve(); }
    if (v === 'about') { about(); return Promise.resolve(); }
    if (v === 'mine') return Promise.resolve(SW.mine.load()).catch(e => console.error(v, e));
    return SW.loadView(v);
  };
  $$('#rail button').forEach(b => b.onclick = () => SW.show(b.dataset.view === 'marine' ? (st.oceanTab || 'tides') : b.dataset.view));
  document.addEventListener('click', function oceanTabs(e) { const b = e.target.closest && e.target.closest('.oc-tabs button'); if (!b) return; st.oceanTab = b.dataset.t; SW.save(); SW.show(b.dataset.t); });

  // ---------- places ----------
  function chips() {
    $('#locChips').innerHTML = st.locs.map((l, i) => '<div class="chip' + (i === st.cur ? ' on' : '') + '" data-i="' + i + '">' + esc(l.name) + (st.locs.length > 1 ? '<x title="Remove">✕</x>' : '') + '</div>').join('');
    $$('#locChips .chip').forEach(function wire(c) {
      c.onclick = e => {
        const i = +c.dataset.i;
        if (e.target.tagName === 'X') { st.locs.splice(i, 1); if (st.cur >= st.locs.length) st.cur = st.locs.length - 1; else if (i < st.cur) st.cur--; else if (i !== st.cur) { SW.save(); chips(); return; } }
        else { if (i === st.cur) return; st.cur = i; }
        SW.save(); chips(); changed();
      };
    });
  }
  function changed() { for (const k in fresh) delete fresh[k]; SW.emit('loc'); SW.show(view); now(); rainSaid = {}; rainWatch(); }
  function addPlace(r) {
    const loc = { name: r.name, region: [r.admin1, r.country_code].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude };
    const at = st.locs.findIndex(l => Math.abs(l.lat - loc.lat) < 0.01 && Math.abs(l.lon - loc.lon) < 0.01);
    if (at >= 0) st.cur = at; else { st.locs.push(loc); if (st.locs.length > 6) st.locs.shift(); st.cur = st.locs.length - 1; }
    SW.save(); chips(); changed();
  }
  function search(input, box, done) {
    let t, gen = 0, res = [];
    const pick = r => { input.value = ''; box.innerHTML = ''; box.classList.add('hidden'); addPlace(r); if (done) done(); };
    input.oninput = function onType() {
      clearTimeout(t); const q = input.value.trim(), g = ++gen;
      if (q.length < 2) { box.innerHTML = ''; return; }
      t = setTimeout(async function go() {
        try {
          const j = await api.json('https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&name=' + encodeURIComponent(q), 3600);
          if (g !== gen) return;
          res = j.results || [];
          box.classList.remove('hidden');
          box.innerHTML = res.length ? res.map((r, i) => '<div data-i="' + i + '">' + esc(r.name) + '<small>' + esc([r.admin1, r.country].filter(Boolean).join(', ')) + '</small></div>').join('') : '<div class="dim">No place found by that name.</div>';
          $$('div[data-i]', box).forEach(d => d.onmousedown = () => pick(res[+d.dataset.i]));
        } catch (e) { box.classList.remove('hidden'); box.innerHTML = '<div class="dim">Search is not answering. Check the internet connection.</div>'; }
      }, 250);
    };
    input.onkeydown = e => { if (e.key === 'Enter' && res[0]) pick(res[0]); if (e.key === 'Escape') { input.value = ''; box.innerHTML = ''; } };
    input.onblur = () => setTimeout(() => { if (!box.classList.contains('inline')) box.classList.add('hidden'); }, 200);
  }

  // ---------- header ----------
  async function now() {
    const l = SW.loc(), el = $('#nowLine'); if (!l) { el.textContent = ''; return; }
    try {
      const j = await api.json(SW.omUrl('https://api.open-meteo.com/v1/forecast', l, '&current=temperature_2m,weather_code,is_day,wind_speed_10m' + SW.U.om()), 600), c = j.current, w = SW.wx(c.weather_code, !c.is_day);
      el.innerHTML = w.icon + ' <b style="color:var(--text)">' + SW.n(c.temperature_2m) + SW.U.t() + '</b> ' + w.text + ' · wind ' + SW.n(c.wind_speed_10m) + ' ' + SW.U.w() + ' · updated ' + SW.fmt(Date.now() / 1000, null, 'time');
    } catch (e) { el.textContent = navigator.onLine ? 'Weather service is busy. Retrying shortly.' : 'No internet: showing the last data received'; }
  }
  function unitBtn() { $('#unitBtn').textContent = st.units === 'us' ? '°F · mph' : '°C · km/h'; }
  $('#unitBtn').onclick = () => { st.units = st.units === 'us' ? 'si' : 'us'; SW.save(); unitBtn(); for (const k in fresh) delete fresh[k]; SW.emit('units'); SW.show(view); now(); };
  $('#refreshBtn').onclick = () => { api.clear(); for (const k in fresh) delete fresh[k]; SW.map.refresh(); SW.show(view); now(); SW.toast('Refreshed everything.'); };

  function about() {
    const feeds = api.log(), rows = [
      ['US radar composite and loops', 'NEXRAD via the Iowa Environmental Mesonet'], ['MRMS, echo tops, precipitation type, single-site radar', 'NOAA / National Weather Service'], ['Worldwide radar', 'RainViewer'],
      ['Satellite', 'NOAA GOES and Himawari via NASA GIBS'], ['Forecast models, ensembles, soundings, marine, air quality', 'Open-Meteo (GFS, HRRR, NAM, NBM, ECMWF, ICON, GEM, UKMO, JMA, ARPEGE, GraphCast)'],
      ['Warnings, text forecasts, discussions, observations', 'National Weather Service'], ['Storm outlooks', 'NOAA Storm Prediction Center'], ['Tropical systems', 'NOAA National Hurricane Center'],
      ['Airport observations', 'NOAA Aviation Weather Center'], ['Local plants and animals, and their photos', 'The iNaturalist community (each photo credited where shown)'], ['Pollen estimate', 'Skywatch\'s own, from local plant seasons and the weather; real pollen counts from the Copernicus air model where it reaches'], ['Driving routes', 'OSRM, using map data © OpenStreetMap contributors'], ['California chain controls, closures and highway cameras', 'Caltrans'], ['Wildfires and fire-watch cameras', 'NIFC, NASA and ALERTCalifornia'], ['Tides', 'NOAA CO-OPS'], ['Base maps', 'Esri, with OpenStreetMap contributors']
    ];
    $('#v-about').innerHTML = '<div class="head"><h1>Where the data comes from</h1></div><div class="grid"><div class="card"><table class="src"><tr><th>What</th><th>Source</th></tr>' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>' +
      '<p class="dim small">Everything here is free public data, for personal use. Skywatch is not an official source of warnings: in dangerous weather, follow the National Weather Service and local officials.</p></div>' +
      '<div class="card"><h2>Cloud photo credits</h2><div class="dim small" style="margin-bottom:8px">The photos in the cloud guide come from Wikimedia Commons and are used under the license shown. Click a name to open the original.</div><table class="src"><tr><th>Cloud</th><th>Photographer</th><th>License</th></tr>' + Object.keys(window.SW_CLOUD_PHOTOS || {}).map(k => window.SW_CLOUD_PHOTOS[k].map(p => '<tr><td>' + k + '</td><td><a target="_blank" href="' + esc(p.page) + '">' + esc(p.artist) + '</a></td><td>' + esc(p.license) + '</td></tr>').join('')).join('') + '</table></div>' +
      '<div class="card"><h2>Feed health this session</h2><table class="src"><tr><th>Server</th><th>Answered</th><th>Failed</th><th>Last problem</th></tr>' + Object.keys(feeds).sort().map(h => '<tr><td>' + esc(h) + '</td><td>' + feeds[h].ok + '</td><td style="color:' + (feeds[h].fail ? 'var(--warn)' : 'inherit') + '">' + feeds[h].fail + '</td><td class="dim">' + esc(feeds[h].last) + '</td></tr>').join('') + '</table></div></div>';
  }

  // ---------- rain heads-up: checks the next half hour, every few minutes ----------
  let rainSaid = {};
  async function rainWatch() {
    const l = SW.loc(), pill = $('#rainPill'); if (!l) return;
    try {
      const j = await api.json(SW.omUrl('https://api.open-meteo.com/v1/forecast', l, '&minutely_15=precipitation,snowfall&past_minutely_15=1&forecast_minutely_15=6'), 170), m = j.minutely_15, t = Date.now() / 1000;
      let i = 0; while (i < m.time.length - 1 && m.time[i + 1] <= t) i++;
      const wet = k => m.precipitation[k] != null && m.precipitation[k] >= 0.1;
      let msg = '', kind = '', body = '';
      if (!wet(i)) {
        const k = [i + 1, i + 2].find(wet);
        if (k != null) {
          const mins = Math.max(5, Math.round((m.time[k] - t) / 300) * 5), snow = m.snowfall[k] > 0, amt = m.precipitation[k], how = amt < 0.5 ? 'Light ' : amt < 2 ? '' : 'Heavy ';
          kind = 'start'; msg = (snow ? '❄️ ' : '☔ ') + (how + (snow ? 'snow' : 'rain')).replace(/^./, c => c.toUpperCase()) + ' in about ' + mins + ' min'; body = 'Expected to reach ' + l.name + ' around ' + SW.fmt(m.time[k], j.timezone, 'time') + '.';
        }
      } else if (![i + 1, i + 2, i + 3].some(wet) && m.time[i + 3]) { kind = 'stop'; msg = '🌤️ Rain easing by ' + SW.fmt(m.time[i + 1], j.timezone, 'time'); body = 'The rain at ' + l.name + ' should let up within about 15 minutes.'; }
      pill.textContent = msg; pill.classList.toggle('hidden', !msg);
      if (msg && st.notifyRain !== false && !(rainSaid[kind] > t - 3600)) { rainSaid[kind] = t; try { new Notification(msg.replace(/^\S+ /, ''), { body, icon: 'icon.png' }); } catch (e) { } }
    } catch (e) { pill.classList.add('hidden'); }
  }
  SW.rainWatch = rainWatch;

  // ---------- notification settings (the bell) ----------
  async function notifyMenu() {
    const box = $('#notifyMenu'), sh = window.swShell ? await window.swShell.get() : null;
    const row = (id, on, text, sub2) => '<label class="chk" style="align-items:flex-start;padding:7px 0"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + ' style="margin-top:3px"><span>' + text + '<br><span class="dim small">' + sub2 + '</span></span></label>';
    box.innerHTML = '<div class="sub" style="margin:2px 0 4px">Notifications</div>' +
      row('ntRain', st.notifyRain !== false, 'Rain or snow in the next 30 minutes', 'A heads-up before it starts, and when it is about to stop.') +
      row('ntAlert', st.notify !== false, 'New warnings for my place', 'Official Weather Service warnings, watches and advisories.') +
      (sh ? row('ntBg', sh.background, 'Keep watching when I close the window', 'Skywatch stays in the tray by the clock so notifications keep coming. Right-click its icon to quit.') + row('ntStart', sh.startup, 'Start Skywatch when I sign in', 'Opens quietly in the tray.') : '');
    if (SW.web) { // a web page has to ask before it may show notifications, and can only do it while it is open
      const P = window.Notification ? Notification.permission : 'denied'; if (P === 'default') Notification.requestPermission().then(notifyMenu);
      box.innerHTML += '<div class="dim small" style="padding:6px 0 2px;line-height:1.45">' + (P === 'granted' ? 'Notifications come through while this page is open in a tab.' : P === 'denied' ? 'This browser is blocking notifications for Skywatch. Allow them in the site settings (the icon left of the address) to get these.' : 'Choose Allow when the browser asks.') + '</div>';
    }
    const save = async () => {
      st.notifyRain = $('#ntRain').checked; st.notify = $('#ntAlert').checked; SW.save();
      if (sh) { const bg = $('#ntBg').checked, su = $('#ntStart').checked; if (su && !bg) $('#ntBg').checked = true; await window.swShell.set({ background: $('#ntBg').checked, startup: su }); }
    };
    $$('input', box).forEach(i => i.onchange = save);
  }
  $('#notifyBtn').onclick = e => { e.stopPropagation(); const box = $('#notifyMenu'); if (box.classList.contains('hidden')) { notifyMenu(); box.classList.remove('hidden'); } else box.classList.add('hidden'); };
  $('#notifyMenu').onclick = e => e.stopPropagation();
  document.addEventListener('click', () => $('#notifyMenu').classList.add('hidden'));

  // ---------- start ----------
  function start() {
    unitBtn(); chips();
    search($('#locSearch'), $('#locResults'));
    SW.map.init();
    if (!SW.loc()) { $('#welcome').classList.remove('hidden'); search($('#welSearch'), $('#welResults'), () => $('#welcome').classList.add('hidden')); setTimeout(() => $('#welSearch').focus(), 100); }
    else { now(); SW.alerts.poll(); rainWatch(); }
    setInterval(function every3min() { SW.map.tick(); if (SW.loc()) { SW.alerts.poll(); now(); rainWatch(); } }, 180000);
    setInterval(function every20min() { for (const k in fresh) delete fresh[k]; if (view !== 'map' && view !== 'about') SW.show(view); }, 1200000);
    window.addEventListener('online', () => $('#refreshBtn').click());
  }
  window.addEventListener('error', e => console.error('Uncaught: ' + e.message));
  window.addEventListener('unhandledrejection', e => console.error('Unhandled: ' + (e.reason && e.reason.message || e.reason)));

  // ---------- self-test hooks (npm run selftest) ----------
  SW.selftestViews = function selftestViews() {
    if (!SW.loc()) { st.locs = [{ name: 'Santa Rosa', region: 'California, US', lat: 38.4405, lon: -122.7141 }]; st.cur = 0; chips(); $('#welcome').classList.add('hidden'); SW.emit('loc'); }
    return ['map', 'forecast', 'lookup', 'history', 'models', 'sounding', 'alerts', 'fire', 'nature', 'drive', 'tides', 'marine', 'briefing', 'fun', 'about', 'mine'];
  };
  SW.selftest = async function selftest(v) {
    await SW.show(v);
    if (v === 'mine') { await new Promise(r => setTimeout(r, 1500)); if ($('#mnStart')) $('#mnStart').click(); await new Promise(r => setTimeout(r, 9000)); const el = $('#v-mine'); return { chars: el.innerText.length, errors: $$('.state.err', el).map(e => e.innerText.slice(0, 120)), waiting: $$('.spin', el).length, panels: $$('#mnGrid .mn-p').length, filled: $$('#mnGrid .mn-body').filter(b => b.querySelector('.card, #map')).length, mapW: $('#mnGrid #map') ? $('#mnGrid #map').clientWidth : 0 }; }
    if (v === 'map') await SW.map.ready(); else await new Promise(r => setTimeout(r, v === 'fire' || v === 'fun' || v === 'history' || v === 'nature' || v === 'drive' ? 6000 : 1500));
    const el = $('#v-' + v);
    if (v === 'lookup' && $('#luNightBtn')) { $('#luNightBtn').click(); $('#luClouds').scrollIntoView(); }
    if (v === 'fire') { const im = $$('#fiCams img'); return { chars: el.innerText.length, errors: $$('.state.err', el).map(e => e.innerText.slice(0, 120)), waiting: $$('.spin', el).length, cams: im.length, camsLoaded: im.filter(i => i.naturalWidth > 100).length, fires: $$('#fiList .al').length }; }
    return { chars: el.innerText.length, errors: $$('.state.err', el).map(e => e.innerText.slice(0, 120)), waiting: $$('.spin', el).length };
  };
  // cycles every radar product, satellite, overlay and the model map; counts tiles that arrive
  SW.selftestDeep = async function selftestDeep() {
    const out = {}, cnt = { ok: 0, bad: 0 }, wait = ms => new Promise(r => setTimeout(r, ms));
    L.TileLayer.addInitHook(function countTiles() { this.on('tileload', () => cnt.ok++); this.on('tileerror', () => cnt.bad++); });
    await SW.show('map');
    const set = async (id, val, ms) => { const e = $(id); if (e.type === 'checkbox') { e.checked = val; } else e.value = val; e.dispatchEvent(new Event('change')); cnt.ok = cnt.bad = 0; await wait(ms || 5000); return { ok: cnt.ok, bad: cnt.bad, frames: +$('#tlSlider').max + 1 }; };
    for (const o of $$('#radarSel option')) if (o.value !== 'none') out['radar ' + o.value] = await set('#radarSel', o.value);
    await set('#radarSel', 'none', 500);
    for (const o of $$('#satSel option')) if (o.value !== 'none') out['sat ' + o.value] = await set('#satSel', o.value);
    await set('#radarSel', 'iem', 3000);
    $('#tlPlay').click(); cnt.ok = cnt.bad = 0; await wait(9000); out.loop = { ok: cnt.ok, bad: cnt.bad, frames: +$('#tlSlider').max + 1 }; $('#tlPlay').click();
    for (const o of $$('#spcSel option')) if (o.value !== 'none') { await set('#spcSel', o.value, 2500); out['spc ' + o.value] = 'toast: ' + ($('#toast').classList.contains('hidden') ? '(none)' : $('#toast').textContent); }
    await set('#spcSel', 'none', 300);
    await set('#ovMetar', true, 5000); out.metar = $$('.stn').length + ' stations';
    await set('#ovSites', true, 1500); out.sites = $$('.rsite').length + ' radar sites';
    await set('#ovMetar', false, 300); await set('#ovSites', false, 300);
    for (const m of ['ncep_hrrr_conus']) for (const v of ['temperature_2m']) { $('#mfModel').value = m; $('#mfVar').value = v; $('#mfLoad').click(); await wait(7000); out['field ' + m + ' ' + v] = $('#mfCtl').classList.contains('hidden') ? 'NOT LOADED: ' + $('#toast').textContent : $('#mfLabel').innerText.replace(/\n/g, ' | ') + ' ; legend ' + $('#legend').innerText.replace(/\n/g, ' '); }
    $('#unitBtn').click(); await wait(4000); out.unitsMetric = $('#nowLine').innerText; $('#unitBtn').click(); await wait(2500);
    return out;
  };
  start();
})();

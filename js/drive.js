// Skywatch drive: the weather along a road trip. Colors the route by what the road will be like when you get to each part,
// suggests a better time to leave, and (in California) adds chain controls, closures and highway cameras.
(function driveMod() {
  const { $, $$, api, U, n, esc, st } = SW;
  const COL = ['#3ddc97', '#ffe44a', '#ffb020', '#ff5a5a'], NAME = ['Good going', 'Take care', 'Slow down', 'Hazardous'];
  const FIELDS = 'temperature_2m,precipitation,snowfall,snow_depth,weather_code,visibility,wind_gusts_10m,cloud_cover,is_day';
  let dmap = null, lay = {}, gen = 0, R = null, when = 0, camT = null;
  const rad = Math.PI / 180;
  const bearing = (a, b, c, d) => (Math.atan2(Math.sin((d - b) * rad) * Math.cos(c * rad), Math.cos(a * rad) * Math.sin(c * rad) - Math.sin(a * rad) * Math.cos(c * rad) * Math.cos((d - b) * rad)) / rad + 360) % 360;
  const dist = v => n(U.cD(v), v < 16 ? 1 : 0) + ' ' + U.d(), dur = s => { const m = Math.round(s / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60 ? (m % 60) + ' min' : ''); };
  const temp = c => n(U.cT(c)) + '°';

  // what one hour of weather does to a road
  function hazard(h, i, o) {
    const T = h.temperature_2m[i], p = h.precipitation[i] || 0, sn = h.snowfall[i] || 0, code = h.weather_code[i], vis = h.visibility[i], g = h.wind_gusts_10m[i] || 0, why = [];
    let lv = 0, wet2 = 0, wet6 = 0; for (let q = Math.max(0, i - 6); q < i; q++) { wet6 += h.precipitation[q] || 0; if (q >= i - 2) wet2 += h.precipitation[q] || 0; }
    const add = (l, t) => { why.push([l, t]); if (l > lv) lv = l; };
    if (code >= 95) add(3, 'Thunderstorm: bursts of heavy rain, sudden gusts and lightning');
    if (code === 56 || code === 57 || code === 66 || code === 67) add(3, 'Freezing rain: the road glazes with ice you cannot see');
    if (sn >= 1) add(3, 'Heavy snow, about ' + n(U.us() ? sn / 2.54 : sn, 1) + (U.us() ? ' in' : ' cm') + ' an hour'); else if (sn > 0) add(2, 'Snow falling'); else if ((h.snow_depth[i] || 0) > 0.02 && T <= 1) add(2, 'Snow on the ground and below freezing');
    if (sn === 0 && T != null && T <= 0.5 && (p > 0 || wet6 > 0.2)) add(2, 'Wet road at freezing: icy patches, bridges and shady corners first');
    if (sn === 0 && code < 95) { if (p >= 7.5) add(3, 'Very heavy rain: standing water and almost no view through the spray'); else if (p >= 2.5) add(2, 'Heavy rain: spray and less grip'); else if (p >= 0.2) add(1, 'Rain: wet road'); else if (wet2 > 0.3) add(1, 'Road still wet from earlier rain'); }
    if (vis != null) { if (vis < 200) add(3, 'Dense fog: you can see less than ' + (U.us() ? '700 feet' : '200 m')); else if (vis < 1000) add(2, 'Fog: you can see about ' + (U.us() ? n(vis / 1609, 1) + ' mile' : n(vis, 0) + ' m')); else if (vis < 4000 && (code === 45 || code === 48)) add(1, 'Patchy fog'); }
    if (g >= 90) add(3, 'Damaging gusts near ' + n(U.cW(g)) + ' ' + U.w() + ': branches and wires down'); else if (g >= 65) add(2, 'Strong gusts to ' + n(U.cW(g)) + ' ' + U.w() + ': hard on tall vehicles and trailers'); else if (g >= 50) add(1, 'Gusty, up to ' + n(U.cW(g)) + ' ' + U.w());
    if (o && h.is_day[i] && h.cloud_cover[i] < 40) { const s = SWastro.sunPos(o.t, o.lat, o.lon); let d = Math.abs(s.az - o.head) % 360; if (d > 180) d = 360 - d; if (s.alt > 0 && s.alt < 12 && d < 30) add(1, 'Low sun straight ahead: glare'); }
    why.sort((a, b) => b[0] - a[0]);
    return { lv, why: why.map(x => x[1]), T, dark: !h.is_day[i] };
  }
  const hourAt = (h, t) => { let i = Math.round((t - h.time[0]) / 3600); return Math.max(0, Math.min(h.time.length - 1, i)); };

  // ---------- page ----------
  async function load() {
    const root = $('#v-drive'), loc = SW.loc(); if (!loc) return; ++gen; R = null; when = 0;
    if (dmap) { dmap.remove(); dmap = null; lay = {}; }
    const rec = (st.driveRecent || []).filter(r => SW.dist(loc.lat, loc.lon, r.lat, r.lon) > 2);
    root.innerHTML = '<div class="head"><h1>Drive</h1><span class="dim">how the weather will treat the road</span></div><div class="grid">' +
      '<div class="card" id="drBar"><div class="dr-form"><span class="dim">From</span><b>' + esc(loc.name) + '</b><span class="dim">to</span><div style="position:relative"><input id="drTo" type="text" placeholder="Where are you driving? Type a town…" autocomplete="off" spellcheck="false"><div id="drToBox" class="menu hidden"></div></div>' +
      '<span class="dim">leaving</span><select id="drWhen" style="width:auto"></select><button class="btn ghost hidden" id="drClear">Clear</button></div>' +
      (rec.length ? '<div class="dr-rec"><span class="dim small">Recent:</span>' + rec.map((r, i) => '<span class="chip" data-i="' + i + '">' + esc(r.name) + '</span>').join('') + '</div>' : '') + '</div>' +
      '<div class="fi-split"><div class="card" style="padding:0;overflow:hidden;position:relative"><div id="driveMap"></div><div class="fi-layers panel"><label class="chk"><input type="checkbox" id="drL_radar" checked> Rain radar now</label><label class="chk"><input type="checkbox" id="drL_alerts" checked> Weather warnings</label></div>' +
      '<div class="dr-key panel">' + COL.map((c, i) => '<span><i style="background:' + c + '"></i>' + NAME[i] + '</span>').join('') + '</div></div>' +
      '<div class="card" id="drSide"><div class="state"><span class="spin"></span>Checking the roads near you…</div></div></div>' +
      '<div id="drMore"></div></div>' +
      '<div id="drBig" class="modal hidden"><div class="card" style="width:min(1100px,94vw);padding:14px"><img id="drBigImg" alt="" style="width:100%;border-radius:8px;display:block"><div id="drBigCap" style="margin-top:8px;text-align:left"></div></div></div>';
    $('#drBig').onclick = () => $('#drBig').classList.add('hidden');
    dmap = L.map('driveMap', { zoomControl: true, minZoom: 3, maxZoom: 15 }).setView([loc.lat, loc.lon], 9);
    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 16, attribution: 'Esri · routing by OSRM, © OpenStreetMap contributors · Open-Meteo · NWS · Caltrans' }).addTo(dmap);
    const rp = dmap.createPane('droads'); rp.style.zIndex = 300; rp.style.pointerEvents = 'none'; rp.style.opacity = 0.75;
    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { pane: 'droads', maxNativeZoom: 16 }).addTo(dmap);
    const lp = dmap.createPane('dlabels'); lp.style.zIndex = 450; lp.style.pointerEvents = 'none';
    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { pane: 'dlabels', maxNativeZoom: 16 }).addTo(dmap);
    const wp = dmap.createPane('dradar'); wp.style.zIndex = 250; wp.style.pointerEvents = 'none';
    L.marker([loc.lat, loc.lon], { icon: L.divIcon({ className: '', html: '<div class="home-dot"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }), interactive: false }).addTo(dmap);
    $$('#v-drive .fi-layers input').forEach(i => i.onchange = overlays);
    $$('#v-drive .dr-rec .chip').forEach(c => c.onclick = () => go(rec[+c.dataset.i]));
    $('#drClear').onclick = () => { st.driveTo = null; SW.save(); load(); };
    search(); whenOptions(); overlays();
    clearInterval(camT); camT = setInterval(function drCamTick() { if ($('#v-drive').classList.contains('on')) $$('#drCams img').forEach(im => { im.src = im.dataset.src + '?t=' + Math.floor(Date.now() / 120000); }); }, 120000);
    if (!SW.alertsAll && SW.getAlerts) SW.getAlerts().then(overlays, () => { });
    const to = st.driveTo; if (to && SW.dist(loc.lat, loc.lon, to.lat, to.lon) > 2) await go(to); else await home(loc);
  }
  const swap = (k, layer) => { if (!dmap) return; if (lay[k]) dmap.removeLayer(lay[k]); lay[k] = layer || null; if (layer) layer.addTo(dmap); };
  const ROADY = /Winter|Snow|Ice|Blizzard|Freez|Frost|Wind|Flood|Fog|Dust|Tornado|Thunderstorm|Hurricane|Tropical|Fire|Smoke|Avalanche|Squall/;
  function overlays() {
    if (!dmap) return; const on = k => { const e = $('#drL_' + k); return e && e.checked; };
    swap('radar', on('radar') ? L.tileLayer('https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png?t=' + Math.floor(Date.now() / 300000), { pane: 'dradar', opacity: 0.6, maxNativeZoom: 10 }) : null);
    const feats = on('alerts') ? (SW.alertsAll || []).filter(f => f.geometry && ROADY.test(f.properties.event)) : [];
    swap('alerts', feats.length ? L.geoJSON(feats, { style: f => ({ color: /Warning/.test(f.properties.event) ? '#ff5a5a' : '#ffb020', weight: 1.5, fillOpacity: 0.08 }), onEachFeature: (f, l) => l.bindPopup('<b>' + esc(f.properties.event) + '</b><br>' + esc((f.properties.headline || '').slice(0, 200)) + '<br><a href="#" onclick="SW.openAlert(\'' + f.properties.id + '\');return false">Read it</a>') }) : null);
    if (lay.route) lay.route.eachLayer(l => l.bringToFront && l.bringToFront());
  }
  function whenOptions() {
    const s = $('#drWhen'), now = Math.floor(Date.now() / 3600000) * 3600; let h = '<option value="0">Now</option>';
    for (let k = 1; k <= 47; k++) { const t = now + k * 3600; h += '<option value="' + t + '">' + SW.fmt(t, null, 'day') + ' ' + SW.fmt(t, null, 'hour') + '</option>'; }
    s.innerHTML = h; s.value = when || 0; s.onchange = () => { when = +s.value; if (R) show(); };
  }
  function search() {
    const input = $('#drTo'), box = $('#drToBox'); let t = null, sg = 0, res = [];
    const pick = r => { box.classList.add('hidden'); go({ name: r.name, region: [r.admin1, r.country_code].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude }); };
    input.oninput = function drType() {
      clearTimeout(t); const q = input.value.trim(), g = ++sg; if (q.length < 2) { box.innerHTML = ''; return; }
      t = setTimeout(async function drFind() {
        try { const j = await api.json('https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&name=' + encodeURIComponent(q), 3600); if (g !== sg) return; res = j.results || []; box.classList.remove('hidden'); box.innerHTML = res.length ? res.map((r, i) => '<div data-i="' + i + '">' + esc(r.name) + '<small>' + esc([r.admin1, r.country].filter(Boolean).join(', ')) + '</small></div>').join('') : '<div class="dim">No place found by that name.</div>'; $$('div[data-i]', box).forEach(d => d.onmousedown = () => pick(res[+d.dataset.i])); }
        catch (e) { box.classList.remove('hidden'); box.innerHTML = '<div class="dim">Search is not answering.</div>'; }
      }, 250);
    };
    input.onkeydown = e => { if (e.key === 'Enter' && res[0]) pick(res[0]); };
    input.onblur = () => setTimeout(() => box.classList.add('hidden'), 200);
  }

  // ---------- no trip chosen: the roads around home ----------
  async function home(loc) {
    const side = $('#drSide'), g = gen;
    try {
      const j = await api.json('https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat.toFixed(3) + '&longitude=' + loc.lon.toFixed(3) + '&hourly=' + FIELDS + '&forecast_days=3&timeformat=unixtime', 900); if (g !== gen) return;
      const h = j.hourly, i0 = hourAt(h, Date.now() / 1000), cur = hazard(h, i0);
      let cells = '', worst = i0; const hz = []; for (let k = 0; k < 24; k++) { const z = hazard(h, i0 + k); hz.push(z); if (z.lv > hz[worst - i0].lv) worst = i0 + k; cells += '<i style="background:' + COL[z.lv] + '" data-tip="' + esc(SW.fmt(h.time[i0 + k], null, 'hour') + ': ' + (z.why[0] || 'Dry road, good view')) + '"></i>'; }
      const wz = hz[worst - i0];
      side.innerHTML = '<h2>Roads around ' + esc(loc.name) + '</h2><div class="dr-verdict" style="--c:' + COL[cur.lv] + '"><b>' + NAME[cur.lv] + '</b><span>right now · ' + temp(cur.T) + '</span></div>' +
        '<ul class="dr-why">' + (cur.why.length ? cur.why.map(x => '<li>' + x + '</li>').join('') : '<li>Dry road and a clear view.</li>') + (cur.dark ? '<li class="dim">It is dark out.</li>' : '') + '</ul>' +
        '<h2 style="margin-top:16px">The next 24 hours</h2><div class="dr-strip" id="drHomeStrip">' + cells + '</div><div class="dr-strip-x"><span>now</span><span>+12 h</span><span>+24 h</span></div>' +
        '<p style="line-height:1.5">' + (wz.lv > cur.lv ? 'Roads get worse around <b>' + SW.fmt(h.time[worst], null, 'full') + '</b>: ' + wz.why[0].toLowerCase() + '.' : cur.lv === 0 ? 'Nothing in the forecast should trouble a local drive today.' : 'Conditions hold about like this or improve.') + '</p>' +
        '<p class="dim small" style="line-height:1.5">Type where you are going above, and Skywatch will color the whole route by the weather you will meet on each part of it, at the time you get there.</p>';
    } catch (e) { SW.fail(side, e, () => home(loc)); }
  }

  // ---------- a trip ----------
  async function route(a, b) {
    const path = '/route/v1/driving/' + a.lon.toFixed(5) + ',' + a.lat.toFixed(5) + ';' + b.lon.toFixed(5) + ',' + b.lat.toFixed(5) + '?overview=full&geometries=geojson&steps=true';
    let j; try { j = await api.json('https://router.project-osrm.org' + path, 86400); } catch (e) { j = await api.json('https://routing.openstreetmap.de/routed-car' + path, 86400); }
    if (!j.routes || !j.routes[0]) throw new Error('No road route found between these two places');
    return j.routes[0];
  }
  async function go(to) {
    const loc = SW.loc(), g = ++gen, side = $('#drSide'); if (!loc || !side) return;
    st.driveTo = to; st.driveRecent = [to].concat((st.driveRecent || []).filter(r => r.name !== to.name)).slice(0, 5); SW.save();
    $('#drTo').value = to.name + (to.region ? ', ' + to.region : ''); $('#drClear').classList.remove('hidden'); $('#drMore').innerHTML = '';
    SW.loading(side, 'Finding the road to ' + esc(to.name) + '…');
    try {
      const r = await route(loc, to); if (g !== gen) return;
      const co = r.geometry.coordinates, cum = [0]; for (let i = 1; i < co.length; i++) cum.push(cum[i - 1] + SW.dist(co[i - 1][1], co[i - 1][0], co[i][1], co[i][0]));
      const total = cum[cum.length - 1] || 1, N = Math.max(6, Math.min(40, Math.ceil(total / 12))), steps = []; let sd = 0;
      r.legs[0].steps.forEach(s => { steps.push({ at: sd / r.distance * total, name: [s.ref, s.name].filter(Boolean).join(' · ') }); sd += s.distance; });
      const at = function pointAt(km) { let i = 1; while (i < cum.length - 1 && cum[i] < km) i++; const f = cum[i] === cum[i - 1] ? 0 : (km - cum[i - 1]) / (cum[i] - cum[i - 1]); return [co[i - 1][1] + (co[i][1] - co[i - 1][1]) * f, co[i - 1][0] + (co[i][0] - co[i - 1][0]) * f]; };
      const S = []; for (let k = 0; k < N; k++) { const km = total * (k + 0.5) / N, p = at(km), q = at(Math.min(total, km + 1.5)); let road = ''; steps.forEach(s => { if (s.at <= km && s.name) road = s.name; }); S.push({ km, lat: p[0], lon: p[1], head: bearing(p[0], p[1], q[0], q[1]), off: r.duration * km / total, road }); }
      SW.loading(side, 'Reading the forecast along ' + n(U.cD(total)) + ' ' + U.d() + ' of road…');
      let wx = await api.json('https://api.open-meteo.com/v1/forecast?latitude=' + S.map(s => s.lat.toFixed(3)).join(',') + '&longitude=' + S.map(s => s.lon.toFixed(3)).join(',') + '&hourly=' + FIELDS + '&forecast_days=4&timeformat=unixtime', 900);
      if (g !== gen) return; if (!Array.isArray(wx)) wx = [wx];
      const thin = []; for (let i = 0; i < co.length; i++) if (!thin.length || cum[i] - thin[thin.length - 1][2] >= 0.6 || i === co.length - 1) thin.push([co[i][1], co[i][0], cum[i]]);
      R = { to, loc, co, cum, total, S, wx, dur: r.duration, thin, N };
      dmap.fitBounds(L.latLngBounds(co.map(c => [c[1], c[0]])).pad(0.12));
      show(); extras(g);
    } catch (e) { SW.fail(side, e, () => go(to)); }
  }
  function evalAt(dep) { // the hazard at every sample for a given leaving time
    return R.S.map((s, k) => { const t = dep + s.off, h = R.wx[k].hourly; return Object.assign(hazard(h, hourAt(h, t), { t, lat: s.lat, lon: s.lon, head: s.head }), { t }); });
  }
  const score = hz => hz.reduce((a, z) => a + z.lv * z.lv, 0);
  function show() {
    const now = Date.now() / 1000, dep = when || now, hz = evalAt(dep), S = R.S, worst = Math.max(...hz.map(z => z.lv)), bad = hz.filter(z => z.lv >= 2).length / hz.length;
    // the colored road
    const g = L.layerGroup(); L.polyline(R.co.map(c => [c[1], c[0]]), { color: '#000', weight: 9, opacity: 0.55, interactive: false }).addTo(g);
    S.forEach(function seg(s, k) {
      const a = R.total * k / R.N, b = R.total * (k + 1) / R.N, pts = []; let nx = -1; for (let i = 0; i < R.co.length; i++) { if (R.cum[i] >= a - 0.01 && R.cum[i] <= b + 0.01) pts.push([R.co[i][1], R.co[i][0]]); else if (R.cum[i] > b && nx < 0) nx = i; }
      if (nx >= 0) pts.push([R.co[nx][1], R.co[nx][0]]); // reach the start of the next piece so there is no gap
      if (pts.length < 2) pts.push([s.lat, s.lon], [s.lat, s.lon]);
      L.polyline(pts, { color: COL[hz[k].lv], weight: 5.5, opacity: 1 }).bindTooltip('<b>' + SW.fmt(hz[k].t, null, 'time') + '</b> · ' + dist(s.km) + ' in' + (s.road ? ' · ' + esc(s.road) : '') + '<br>' + (hz[k].why[0] || 'Dry road, good view') + ' · ' + temp(hz[k].T), { sticky: true }).addTo(g);
    });
    L.circleMarker([R.to.lat, R.to.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#ff5a8a', fillOpacity: 1 }).bindTooltip(esc(R.to.name)).addTo(g);
    swap('route', g); ['chains', 'closed', 'cams'].forEach(k => lay[k] && lay[k].eachLayer(l => l.bringToFront && l.bringToFront()));
    // stretches with the same story, joined up
    const runs = []; hz.forEach(function join(z, k) { const key = z.lv + '|' + (z.why[0] || '').replace(/[\d.]+/g, '#'), last = runs[runs.length - 1]; if (last && last.key === key) { last.b = k; last.T.push(z.T); } else runs.push({ key, a: k, b: k, z, T: [z.T] }); });
    const edge = k => R.total * k / R.N;
    // other leaving times
    const base = Math.floor(now / 3600) * 3600, opts = []; for (let k = 0; k <= 36; k++) { const t = k ? base + k * 3600 : now, z = evalAt(t); opts.push({ t, k, sc: score(z), lv: Math.max(...z.map(x => x.lv)) }); }
    const mine = score(hz), day = opts.slice(0, 25), best = day.slice().sort((x, y) => x.sc - y.sc || x.k - y.k)[0], better = best.sc < mine * 0.6 && mine >= 4;
    const verdict = worst === 0 ? 'An easy drive. Dry roads and a clear view the whole way.' : worst === 1 ? 'A fine drive, with a few things to keep in mind.' : worst === 2 ? (bad > 0.4 ? 'A slow drive. Allow extra time.' : 'Mostly fine, with a stretch that needs care.') : 'A rough drive. If you can wait, do.';
    $('#drSide').innerHTML = '<h2>' + esc(R.loc.name) + ' to ' + esc(R.to.name) + '</h2><div class="dr-verdict" style="--c:' + COL[worst] + '"><b>' + NAME[worst] + '</b><span>' + dist(R.total) + ' · about ' + dur(R.dur) + ' · arrive ' + SW.fmt(dep + R.dur, null, 'time') + '</span></div>' +
      '<p style="line-height:1.5;margin:10px 0">' + verdict + (better ? ' <b style="color:#3ddc97">Leaving ' + (best.k ? 'at ' + SW.fmt(best.t, null, 'hour') + ' ' + (SW.fmt(best.t, null, 'day') === SW.fmt(now, null, 'day') ? 'today' : SW.fmt(best.t, null, 'day')) : 'now') + ' looks ' + (best.sc === 0 ? 'clear the whole way' : 'a good deal easier') + '.</b>' : '') + '</p>' +
      '<div id="drRuns">' + runs.map((r, i) => '<div class="al dr-run" data-i="' + i + '" style="border-left-color:' + COL[r.z.lv] + '"><b>' + SW.fmt(hz[r.a].t, null, 'time') + ' · ' + (r.a === 0 ? 'start' : dist(edge(r.a))) + ' to ' + (r.b === R.N - 1 ? 'the end' : dist(edge(r.b + 1))) + '</b><span>' + esc(S[r.a].road || '') + '</span><br><span>' + (r.z.why.length ? r.z.why.join('. ') : 'Dry road, good view') + ' · ' + (Math.round(U.cT(Math.min(...r.T))) === Math.round(U.cT(Math.max(...r.T))) ? temp(r.T[0]) : temp(Math.min(...r.T)) + ' to ' + temp(Math.max(...r.T))) + (r.z.dark ? ' · dark' : '') + '</span></div>').join('') + '</div>' +
      '<h2 style="margin-top:16px">If you left at a different time</h2><div class="dr-strip pick" id="drStrip">' + opts.map(o => '<i class="' + ((when ? Math.abs(o.t - when) < 1800 : o.k === 0) ? 'on' : '') + '" data-t="' + (o.k ? o.t : 0) + '" style="background:' + COL[o.lv] + '" data-tip="Leave ' + (o.k ? SW.fmt(o.t, null, 'day') + ' ' + SW.fmt(o.t, null, 'hour') : 'now') + ': ' + NAME[o.lv].toLowerCase() + '"></i>').join('') + '</div><div class="dr-strip-x"><span>now</span><span>+12 h</span><span>+24 h</span><span>+36 h</span></div>' +
      '<p class="dim small" style="line-height:1.5;margin-bottom:0">Each part of the road is colored by the forecast for the time you would get there. The drive time is for ordinary traffic and does not allow for slowing down in bad weather.</p>';
    $$('#drRuns .dr-run').forEach(e => e.onclick = () => { const r = runs[+e.dataset.i]; dmap.fitBounds(L.latLngBounds(S.slice(r.a, r.b + 1).map(s => [s.lat, s.lon])).pad(0.6), { maxZoom: 11 }); });
    $$('#drStrip i').forEach(e => e.onclick = () => { when = +e.dataset.t; $('#drWhen').value = when; if (!$('#drWhen').value) { whenOptions(); } show(); });
  }

  // ---------- warnings, chain controls, closures and cameras along the way ----------
  const inRing = (p, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > p[1]) !== (ring[j][1] > p[1]) && p[0] < (ring[j][0] - ring[i][0]) * (p[1] - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c; return c; };
  const inGeo = (p, g) => g.type === 'Polygon' ? inRing(p, g.coordinates[0]) : g.type === 'MultiPolygon' ? g.coordinates.some(c => inRing(p, c[0])) : false;
  function nearRoute(la, lo) { let d = 1e9, km = 0; for (const p of R.thin) { const x = (lo - p[1]) * Math.cos(la * rad) * 111.3, y = (la - p[0]) * 111.3, q = x * x + y * y; if (q < d) { d = q; km = p[2]; } } return { d: Math.sqrt(d), km }; }
  const CT = { 1: [38.7, 42.1, -124.5, -122.3], 2: [39.7, 42.1, -123.7, -119.9], 3: [38.0, 40.2, -122.9, -119.8], 4: [36.9, 38.9, -123.6, -121.2], 5: [34.3, 37.3, -122.4, -119.4], 6: [34.8, 37.8, -120.9, -117.6], 7: [33.7, 34.9, -119.5, -117.6], 8: [33.4, 35.9, -117.8, -114.1], 9: [35.0, 38.8, -119.7, -115.6], 10: [36.7, 38.9, -121.6, -119.2], 11: [32.5, 33.6, -117.7, -114.4], 12: [33.4, 33.95, -118.15, -117.4] };
  const ctUrl = (d, k, K) => 'https://cwwp2.dot.ca.gov/data/d' + d + '/' + k + '/' + K + 'StatusD' + String(d).padStart(2, '0') + '.json';
  async function extras(g) {
    const box = $('#drMore'), dep = when || Date.now() / 1000; let html = '';
    const al = (SW.alertsAll || []).filter(f => f.geometry && ROADY.test(f.properties.event) && R.S.some(s => inGeo([s.lon, s.lat], f.geometry)));
    const seen = new Set(), alu = al.filter(f => { const k = f.properties.event; if (seen.has(k)) return false; seen.add(k); return true; });
    if (alu.length) html += '<div class="card" id="drAlerts"><h2>Weather warnings on your route</h2>' + alu.slice(0, 8).map(f => '<div class="al" style="border-left-color:' + (/Warning/.test(f.properties.event) ? '#ff5a5a' : '#ffb020') + '" onclick="SW.openAlert(\'' + f.properties.id + '\')"><b>' + esc(f.properties.event) + '</b><span>' + esc((f.properties.headline || f.properties.areaDesc || '').slice(0, 160)) + '</span></div>').join('') + '</div>';
    box.innerHTML = html;
    const ds = Object.keys(CT).filter(d => R.S.some(s => s.lat >= CT[d][0] && s.lat <= CT[d][1] && s.lon >= CT[d][2] && s.lon <= CT[d][3])); if (!ds.length) return;
    box.insertAdjacentHTML('beforeend', '<div class="card" id="drCal"><div class="state"><span class="spin"></span>Asking Caltrans about chain controls, closures and cameras…</div></div>');
    const grab = (k, K) => Promise.all(ds.filter(d => k !== 'cc' || !['4', '5', '12'].includes(d)).map(d => api.json(ctUrl(d, k, K), k === 'cctv' ? 3600 : 600).then(j => (j.data || []).map(x => x[K]), () => [])));
    const [cc, lcs, tv] = (await Promise.all([grab('cc', 'cc'), grab('lcs', 'lcs'), grab('cctv', 'cctv')])).map(a => [].concat(...a)); if (g !== gen || !$('#drCal')) return;
    const chains = cc.filter(c => c.statusData && c.statusData.status && c.statusData.status !== 'R-0').map(c => Object.assign(nearRoute(+c.location.latitude, +c.location.longitude), { c })).filter(x => x.d < 6).sort((a, b) => a.km - b.km);
    const arr = dep + R.dur, shut = lcs.filter(function open(x) { const c = x.closure, t = c.closureTimestamp; return /Full|One-Way/.test(c.typeOfClosure) && /Mainline|Conventional|Tunnel|Bridge/.test(c.facility) && +t.closureStartEpoch <= arr && (t.isClosureEndIndefinite === 'true' || +t.closureEndEpoch >= dep) && !(c.code1098 && c.code1098.isCode1098 === 'true'); })
      .map(x => Object.assign(nearRoute(+x.location.begin.beginLatitude, +x.location.begin.beginLongitude), { x })).filter(z => z.d < 0.5).sort((a, b) => a.km - b.km);
    const ids = new Set(), shutU = shut.filter(z => { const k = z.x.closure.closureID; if (ids.has(k)) return false; ids.add(k); return true; }).slice(0, 12);
    const camsAll = tv.filter(c => c.inService === 'true' && c.imageData && c.imageData.static && c.imageData.static.currentImageURL).map(c => Object.assign(nearRoute(+c.location.latitude, +c.location.longitude), { c })).filter(z => z.d < 0.45).sort((a, b) => a.km - b.km);
    const cams = []; camsAll.forEach(z => { if (!cams.length || z.km - cams[cams.length - 1].km >= Math.max(3, R.total / 9)) cams.push(z); });
    const mk = (z, color, html2) => L.circleMarker([z.la, z.lo], { radius: 6, color: '#000', weight: 1, fillColor: color, fillOpacity: 1 }).bindPopup(html2);
    swap('chains', L.layerGroup(chains.map(z => mk({ la: +z.c.location.latitude, lo: +z.c.location.longitude }, '#c77dff', '<b>Chain control ' + esc(z.c.statusData.status) + '</b><br>' + esc(z.c.location.route + ' at ' + z.c.location.locationName) + '<br>' + esc(z.c.statusData.statusDescription || '')))));
    swap('closed', L.layerGroup(shutU.map(z => mk({ la: +z.x.location.begin.beginLatitude, lo: +z.x.location.begin.beginLongitude }, '#ff5a5a', '<b>' + esc(z.x.closure.typeOfClosure === 'Full' ? 'Road closed' : 'One-way traffic control') + '</b><br>' + esc(z.x.location.begin.beginRoute + ' near ' + z.x.location.begin.beginNearbyPlace)))));
    const until = t => t.isClosureEndIndefinite === 'true' ? 'until further notice' : 'until ' + SW.fmt(+t.closureEndEpoch, null, 'full');
    $('#drCal').outerHTML = '<div class="grid g2"><div class="card" id="drChains"><h2>Chain controls</h2>' + (chains.length ? chains.map(z => '<div class="al" style="border-left-color:#c77dff"><b>' + esc(z.c.location.route + ' · ' + z.c.location.locationName) + ' · ' + esc(z.c.statusData.status) + '</b><span>' + dist(z.km) + ' into the drive</span><br><span>' + esc(z.c.statusData.statusDescription || '') + '</span></div>').join('') : '<div class="state" style="padding:14px">No chain controls on this route right now.</div>') + '</div>' +
      '<div class="card" id="drShut"><h2>Closures and one-way controls</h2>' + (shutU.length ? '<div style="max-height:300px;overflow:auto">' + shutU.map(z => { const c = z.x.closure, b = z.x.location.begin; return '<div class="al" style="border-left-color:' + (c.typeOfClosure === 'Full' ? '#ff5a5a' : '#ffb020') + '"><b>' + esc(b.beginRoute + ' ' + (z.x.location.travelFlowDirection || '') + ' near ' + b.beginNearbyPlace) + '</b><span>' + dist(z.km) + ' in</span><br><span>' + esc((c.typeOfClosure === 'Full' ? 'Closed' : 'One lane, taking turns') + ' for ' + (c.typeOfWork || 'road work').toLowerCase() + ', ' + until(c.closureTimestamp) + (c.estimatedDelay && c.estimatedDelay !== 'Not Reported' ? ' · delay about ' + c.estimatedDelay + ' min' : '')) + '</span></div>'; }).join('') + '</div>' : '<div class="state" style="padding:14px">Caltrans lists no full closures on this route for your drive time.</div>') + '</div></div>' +
      (cams.length ? '<div class="card" id="drCamCard"><h2>See the road<span class="spacer"></span><span class="small dim" style="text-transform:none;letter-spacing:0">Caltrans highway cameras along your route, in driving order · click to enlarge</span></h2><div class="cams" id="drCams">' + cams.slice(0, 8).map((z, i) => '<figure class="cam" data-i="' + i + '"><img alt="" loading="lazy" data-src="' + esc(z.c.imageData.static.currentImageURL) + '" src="' + esc(z.c.imageData.static.currentImageURL) + '"><figcaption><b>' + esc(z.c.location.locationName.replace(/^TV\d+\s*--\s*/, '')) + '</b><span>' + dist(z.km) + ' into the drive · ' + esc(z.c.location.nearbyPlace || '') + '</span></figcaption></figure>').join('') + '</div></div>' : '');
    $$('#drCams .cam').forEach(function wire(e) { const z = cams[+e.dataset.i], im = e.querySelector('img'); im.onerror = () => e.classList.add('off'); e.onclick = () => { $('#drBigImg').src = im.src; $('#drBigCap').innerHTML = '<b>' + esc(z.c.location.locationName) + '</b> <span class="dim">· Caltrans · click anywhere to close</span>'; $('#drBig').classList.remove('hidden'); }; });
    swap('cams', L.layerGroup(cams.slice(0, 8).map(z => mk({ la: +z.c.location.latitude, lo: +z.c.location.longitude }, '#3fc6ff', '<b>' + esc(z.c.location.locationName) + '</b><br><img src="' + esc(z.c.imageData.static.currentImageURL) + '" style="width:260px;border-radius:6px;margin-top:6px">'))));
  }

  SW.drive = { load, go };
  SW.menuTest = async function menuTest() { // self-test: are the search lists really on top of the maps?
    const wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
    const probe = async (inp, box) => { inp.focus(); inp.value = 'San'; inp.dispatchEvent(new Event('input')); await wait(2500); const rows = $$('div[data-i]', box); let top = 0; rows.forEach(d => { const r = d.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (e && box.contains(e)) top++; }); const r0 = rows[0] && rows[0].getBoundingClientRect(), e0 = r0 && document.elementFromPoint(r0.left + r0.width / 2, r0.top + r0.height / 2); return { rows: rows.length, onTop: top, cls: box.className, rect: r0 && [Math.round(r0.left), Math.round(r0.top), Math.round(r0.width), Math.round(r0.height)], hit: e0 && (e0.tagName + '#' + e0.id + '.' + e0.className) }; };
    st.driveTo = null; await SW.show('fire'); await SW.show('drive'); await wait(3000); out.drive = await probe($('#drTo'), $('#drToBox'));
    await SW.show('map'); await wait(1500); out.header = await probe($('#locSearch'), $('#locSearch').parentElement.querySelector('.menu'));
    return out;
  };
  SW.driveTest = async function driveTest() { // self-test: plan a trip over the mountains and report what came back
    const wait = ms => new Promise(r => setTimeout(r, ms)); await SW.show('drive'); await wait(2500);
    await go({ name: 'Truckee', region: 'California, US', lat: 39.328, lon: -120.183 }); await wait(9000);
    return { samples: R && R.S.length, km: R && Math.round(R.total), runs: $$('#drRuns .dr-run').length, strip: $$('#drStrip i').length, verdict: ($('#drSide .dr-verdict') || {}).innerText, cams: $$('#drCams img').length, camsLoaded: $$('#drCams img').filter(i => i.naturalWidth > 50).length, chains: !!$('#drChains'), shut: $$('#drShut .al').length, errors: $$('#v-drive .state.err').map(e => e.innerText.slice(0, 120)) };
  };
})();

// Skywatch tides: predictions, live water level, next high and low, the week's extremes.
(function tidesMod() {
  const { $, api, U, n, esc } = SW;
  let stations = null, stationId = null, forLoc = '';
  const ymd = d => d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0');
  const ts = s => Date.parse(s.replace(' ', 'T') + 'Z') / 1000;
  const dur = s => { const m = Math.max(0, Math.round(s / 60)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; };

  async function load() {
    const root = $('#v-tides'), loc = SW.loc(); if (!loc) return;
    root.innerHTML = '<div class="head"><h1>Ocean</h1><div class="seg oc-tabs"><button data-t="tides" class="on">Tides</button><button data-t="marine">Waves &amp; swell</button></div><span class="dim">' + esc(loc.name) + '</span><div class="spacer"></div><select id="tdStn" style="max-width:420px"></select></div><div class="grid" id="tdBody"></div>';
    const body = $('#tdBody'); SW.loading(body, 'Finding the nearest tide stations…');
    try {
      if (!stations) stations = (await api.json('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions', 86400 * 7)).stations.map(s => ({ id: s.id, name: s.name, state: s.state, lat: s.lat, lon: s.lng }));
    } catch (e) { SW.fail(body, e, load); return; }
    stations.forEach(s => s.d = SW.dist(loc.lat, loc.lon, s.lat, s.lon));
    const near = stations.slice().sort((a, b) => a.d - b.d).slice(0, 8);
    if (!near.length || near[0].d > 250) { body.innerHTML = '<div class="card"><div class="state">There is no NOAA tide station within 150 miles of this place. Tides are only predicted for the US coast and territories.</div></div>'; $('#tdStn').classList.add('hidden'); return; }
    const key = loc.lat + ',' + loc.lon; if (forLoc !== key || !near.find(s => s.id === stationId)) { stationId = near[0].id; forLoc = key; }
    $('#tdStn').innerHTML = near.map(s => '<option value="' + s.id + '">' + esc(s.name) + (s.state ? ', ' + s.state : '') + ' · ' + n(U.cD(s.d)) + ' ' + U.d() + '</option>').join('');
    $('#tdStn').value = stationId; $('#tdStn').onchange = e => { stationId = e.target.value; show(near.find(s => s.id === stationId)); };
    await show(near.find(s => s.id === stationId));
  }

  async function show(stn) {
    const body = $('#tdBody'); SW.loading(body, 'Reading the tide tables…');
    const now = Date.now() / 1000, start = new Date((now - 86400) * 1000), un = U.us() ? 'english' : 'metric';
    const base = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?datum=MLLW&time_zone=gmt&format=json&units=' + un + '&station=' + stn.id;
    let hl, cur, obs, wt;
    try {
      [hl, cur, obs, wt] = await Promise.all([
        api.json(base + '&product=predictions&interval=hilo&begin_date=' + ymd(start) + '&range=216', 3600),
        api.json(base + '&product=predictions&interval=30&begin_date=' + ymd(start) + '&range=216', 3600).catch(() => null),
        api.json(base + '&product=water_level&date=recent', 600).catch(() => null),
        api.json(base + '&product=water_temperature&date=latest', 1800).catch(() => null)
      ]);
      if (!hl.predictions) throw new Error((hl.error && hl.error.message) || 'no predictions for this station');
    } catch (e) { SW.fail(body, e, () => show(stn)); return; }
    const H = hl.predictions.map(p => ({ t: ts(p.t), v: +p.v, hi: p.type === 'H' }));
    let xs = [], ys = [];
    if (cur && cur.predictions) { xs = cur.predictions.map(p => ts(p.t)); ys = cur.predictions.map(p => +p.v); }
    else for (let k = 0; k < H.length - 1; k++) for (let t = H[k].t; t < H[k + 1].t; t += 900) { xs.push(t); ys.push(H[k].v + (H[k + 1].v - H[k].v) * (1 - Math.cos(Math.PI * (t - H[k].t) / (H[k + 1].t - H[k].t))) / 2); }
    const i0 = xs.findIndex(t => t >= now), level = i0 > 0 ? ys[i0 - 1] + (ys[i0] - ys[i0 - 1]) * (now - xs[i0 - 1]) / (xs[i0] - xs[i0 - 1]) : ys[0];
    const next = H.filter(h => h.t > now), nx = next[0], rising = nx && nx.hi, nHi = next.find(h => h.hi), nLo = next.find(h => !h.hi);
    const week = next.filter(h => h.t < now + 7 * 86400), lowest = week.filter(h => !h.hi).sort((a, b) => a.v - b.v)[0], highest = week.filter(h => h.hi).sort((a, b) => b.v - a.v)[0];
    const today = H.filter(h => Math.abs(h.t - now) < 43200), range = today.length ? Math.max(...today.map(h => h.v)) - Math.min(...today.map(h => h.v)) : null;
    const m = SWastro.moon(now), ph = m.age, nearSyz = Math.min(ph, Math.abs(ph - 0.5), 1 - ph), spring = nearSyz < 0.09, neap = Math.min(Math.abs(ph - 0.25), Math.abs(ph - 0.75)) < 0.07;
    // live gauge readings, matched to the half-hour grid
    let oy = null, live = null, surge = null;
    if (obs && obs.data && obs.data.length) {
      const od = obs.data.filter(d => d.v !== '').map(d => ({ t: ts(d.t), v: +d.v })); let j = 0;
      oy = xs.map(function pick(t) { if (t > od[od.length - 1].t + 900 || t < od[0].t - 900) return null; while (j < od.length - 1 && od[j + 1].t <= t) j++; return od[j].v; });
      live = od[od.length - 1]; if (now - live.t < 3600) surge = live.v - level; else live = null;
    }
    const wtemp = wt && wt.data && wt.data[0] && wt.data[0].v !== '' ? +wt.data[0].v : null, hu = U.h(), f = v => n(v, 1) + ' ' + hu;
    body.innerHTML =
      '<div class="card"><div class="hero"><div class="ico">' + (rising ? '🌊' : '🏖️') + '</div><div><div class="big" style="font-size:54px">' + f(level) + '</div><div>The tide is <b>' + (rising ? 'coming in' : 'going out') + '</b>' + (nx ? ' · ' + (nx.hi ? 'high' : 'low') + ' tide in ' + dur(nx.t - now) : '') + '</div><div class="dim small">Predicted height right now at ' + esc(stn.name) + '</div></div>' +
      '<div class="kv" style="grid-template-columns:repeat(4,auto)">' +
      '<div><span>Next high</span><b>' + (nHi ? SW.fmt(nHi.t, null, 'time') + ' · ' + f(nHi.v) : '—') + '</b></div><div><span>Next low</span><b>' + (nLo ? SW.fmt(nLo.t, null, 'time') + ' · ' + f(nLo.v) : '—') + '</b></div>' +
      '<div><span>Today\'s swing</span><b>' + (range == null ? '—' : f(range)) + '</b></div><div><span>Tide strength</span><b>' + (spring ? 'Spring (big)' : neap ? 'Neap (small)' : 'In between') + '</b></div>' +
      '<div><span>Measured level</span><b>' + (live ? f(live.v) : 'No gauge here') + '</b></div><div><span>Above prediction</span><b>' + (surge == null ? '—' : (surge >= 0 ? '+' : '') + f(surge)) + '</b></div>' +
      '<div><span>Water temperature</span><b>' + (wtemp == null ? '—' : n(wtemp) + (U.us() ? '°F' : '°C')) + '</b></div><div><span>Moon</span><b>' + SWastro.phaseName(ph) + '</b></div>' +
      '</div></div></div>' +
      '<div class="card" id="tdChartCard"><h2>The next week</h2><div class="chart tall" id="tdChart"></div></div>' +
      '<div class="grid g2"><div class="card" id="tdBest"><h2>Worth knowing this week</h2><div class="idx">' +
      (lowest ? '<div><span>Lowest low (best tide-pooling)</span><b>' + SW.fmt(lowest.t, null, 'full') + ' · ' + f(lowest.v) + '</b></div>' : '') +
      (highest ? '<div><span>Highest high</span><b>' + SW.fmt(highest.t, null, 'full') + ' · ' + f(highest.v) + '</b></div>' : '') +
      '<div><span>Why</span><b style="font-weight:400;text-align:right;max-width:70%">' + (spring ? 'The sun and moon are lined up, so they pull together: higher highs and lower lows.' : neap ? 'The sun and moon are pulling at right angles, so the tides are gentle.' : 'The moon is between its phases, so tides are middling.') + '</b></div></div>' +
      '<p class="dim small" style="line-height:1.5">Heights are measured above "mean lower low water", the average of each day\'s lowest tide. A negative number means the sea is lower than a typical low tide. Wind and storms can push the real water above or below the prediction.</p></div>' +
      '<div class="card" id="tdTableCard"><h2>High and low tides</h2><div id="tdTable" style="max-height:340px;overflow:auto"></div></div></div>';
    const series = [{ label: 'Predicted', color: '#3fc6ff', fill: '#3fc6ff22', dec: 1 }], data = [xs, ys];
    if (oy) { series.push({ label: 'Measured by the gauge', color: '#ffd24a', width: 2, dec: 1 }); data.push(oy); }
    SW.chart($('#tdChart'), { unit: hu, data, series });
    let last = '', rows = '';
    next.slice(0, 30).forEach(function row(h) { const d = SW.fmt(h.t, null, 'date'); rows += '<tr><td>' + (d !== last ? d : '') + '</td><td>' + SW.fmt(h.t, null, 'time') + '</td><td style="color:' + (h.hi ? 'var(--accent)' : 'var(--dim)') + '">' + (h.hi ? 'High' : 'Low') + '</td><td>' + f(h.v) + '</td></tr>'; last = d; });
    $('#tdTable').innerHTML = '<table><tr><th>Day</th><th>Time</th><th>Tide</th><th>Height</th></tr>' + rows + '</table>';
  }
  SW.tides = { load };
})();

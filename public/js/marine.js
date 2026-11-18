// Skywatch marine: waves, swell, sea temperature and NOAA tide predictions.
(function marineMod() {
  const { $, api, U, n, esc } = SW;
  let stations = null;
  const ymd = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');

  async function load() {
    const root = $('#v-marine'), loc = SW.loc(); if (!loc) return;
    root.innerHTML = '<div class="head"><h1>Ocean</h1><div class="seg oc-tabs"><button data-t="tides">Tides</button><button data-t="marine" class="on">Waves &amp; swell</button></div><span class="dim">' + esc(loc.name) + '</span></div><div class="grid"><div class="grid g2"><div class="card"><h2>Wave height</h2><div class="chart" id="mrWave"></div></div><div class="card"><h2>Swell period &amp; sea temperature</h2><div class="chart" id="mrPer"></div></div></div>' +
      '</div>';
    await waves(loc);
  }
  async function waves(loc) {
    const a = $('#mrWave'), b = $('#mrPer'); SW.loading(a); SW.loading(b);
    try {
      const j = await api.json(SW.omUrl('https://marine-api.open-meteo.com/v1/marine', loc, '&hourly=wave_height,swell_wave_height,wind_wave_height,swell_wave_period,wave_period,sea_surface_temperature&forecast_days=7&cell_selection=sea' + (U.us() ? '&length_unit=imperial&temperature_unit=fahrenheit' : '')), 1800), h = j.hourly;
      if (!h.wave_height.some(x => x != null)) throw new Error('inland');
      SW.chart(a, { tz: j.timezone, unit: U.h(), data: [h.time, h.wave_height, h.swell_wave_height, h.wind_wave_height], series: [{ label: 'Total waves', color: '#3fc6ff', fill: '#3fc6ff22', width: 2.5 }, { label: 'Swell', color: '#3ddc97' }, { label: 'Wind chop', color: '#ffb020', width: 1.3 }] });
      SW.chart(b, { tz: j.timezone, unit: 'seconds', y2: { unit: U.t() }, data: [h.time, h.swell_wave_period, h.wave_period, h.sea_surface_temperature], series: [{ label: 'Swell period', color: '#3ddc97' }, { label: 'Wave period', color: '#3fc6ff', width: 1.3 }, { label: 'Sea temperature', color: '#ff8a4a', scale: 'y2' }] });
    } catch (e) {
      const msg = '<div class="state">No ocean nearby, so there is no wave forecast for this place.</div>';
      if (e.message === 'inland' || /No data|ocean|sea/i.test(e.message)) { a.innerHTML = msg; b.innerHTML = msg; } else { SW.fail(a, e, () => waves(loc)); b.innerHTML = ''; }
    }
  }
  async function tides(loc) {
    const host = $('#mrTide'), tb = $('#mrHilo'); SW.loading(host);
    try {
      if (!stations) stations = (await api.json('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions', 86400 * 7)).stations.map(s => ({ id: s.id, name: s.name, state: s.state, lat: s.lat, lon: s.lng }));
      let best = null, bd = 1e9; stations.forEach(s => { const d = SW.dist(loc.lat, loc.lon, s.lat, s.lon); if (d < bd) { bd = d; best = s; } });
      if (!best || bd > 160) { host.innerHTML = '<div class="state">No NOAA tide station within 100 miles of this place.</div>'; return; }
      $('#mrTideH').innerHTML = 'Tides at ' + esc(best.name) + (best.state ? ', ' + best.state : '') + ' <span class="spacer"></span><span class="small" style="text-transform:none;letter-spacing:0">' + n(U.cD(bd)) + ' ' + U.d() + ' away · NOAA station ' + best.id + '</span>';
      const base = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&datum=MLLW&time_zone=gmt&format=json&units=' + (U.us() ? 'english' : 'metric') + '&station=' + best.id + '&begin_date=' + ymd(new Date()) + '&range=96';
      const [cur, hl] = await Promise.all([api.json(base + '&interval=30', 3600).catch(() => null), api.json(base + '&interval=hilo', 3600)]);
      const ts = s => Date.parse(s.replace(' ', 'T') + 'Z') / 1000;
      if (!hl.predictions) throw new Error((hl.error && hl.error.message) || 'no predictions');
      let xs, ys;
      if (cur && cur.predictions) { xs = cur.predictions.map(p => ts(p.t)); ys = cur.predictions.map(p => +p.v); }
      else { // smaller stations only publish highs and lows: draw the smooth curve between them
        xs = []; ys = []; const P = hl.predictions;
        for (let k = 0; k < P.length - 1; k++) { const t0 = ts(P[k].t), t1 = ts(P[k + 1].t), v0 = +P[k].v, v1 = +P[k + 1].v; for (let t = t0; t < t1; t += 900) { xs.push(t); ys.push(v0 + (v1 - v0) * (1 - Math.cos(Math.PI * (t - t0) / (t1 - t0))) / 2); } }
      }
      SW.chart(host, { unit: U.h(), data: [xs, ys], series: [{ label: 'Tide height', color: '#3fc6ff', fill: '#3fc6ff22', dec: 1 }] });
      tb.innerHTML = '<table><tr><th>When</th><th>Tide</th><th>Height</th></tr>' + (hl.predictions || []).filter(p => ts(p.t) > Date.now() / 1000 - 3600).slice(0, 12).map(p => '<tr><td>' + SW.fmt(ts(p.t), null, 'full') + '</td><td style="color:' + (p.type === 'H' ? 'var(--accent)' : 'var(--dim)') + '">' + (p.type === 'H' ? 'High' : 'Low') + '</td><td>' + n(+p.v, 1) + ' ' + U.h() + '</td></tr>').join('') + '</table>';
    } catch (e) { SW.fail(host, e, () => tides(loc)); }
  }
  SW.marine = { load };
})();

// Skywatch history: a calendar of what the weather actually did, and how well it was forecast.
(function historyMod() {
  const { $, $$, api, U, n, esc } = SW;
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const pad = v => String(v).padStart(2, '0'), iso = (y, m, d) => y + '-' + pad(m + 1) + '-' + pad(d);
  let Y = null, M = null, sel = null, days = {}, stn = null, stnFor = '', tzName = null, gen = 0;
  const todayIso = () => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: tzName || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); return p; };
  const dT = f => U.us() ? f : (f - 32) * 5 / 9, dP = i => U.us() ? i : i * 25.4, pd = () => U.us() ? 2 : 1;

  async function load() {
    const root = $('#v-history'), loc = SW.loc(); if (!loc) return;
    const now = new Date(); if (Y == null) { Y = now.getFullYear(); M = now.getMonth(); }
    let yrs = ''; for (let y = now.getFullYear(); y >= 1940; y--) yrs += '<option>' + y + '</option>';
    root.innerHTML = '<div class="head"><h1>What actually happened</h1><span class="dim">' + esc(loc.name) + '</span><div class="spacer"></div>' +
      '<button class="btn ghost" id="hiPrev">◀</button><select id="hiMon" style="width:auto">' + MON.map((m, i) => '<option value="' + i + '">' + m + '</option>').join('') + '</select><select id="hiYear" style="width:auto">' + yrs + '</select><button class="btn ghost" id="hiNext">▶</button><button class="btn ghost" id="hiToday">Today</button></div>' +
      '<div class="hi-split"><div class="grid" style="align-content:start"><div class="card" id="hiCalCard"><div id="hiCal"></div></div><div class="card" id="hiMonthCard"><h2>The month in numbers</h2><div class="idx" id="hiMonth"></div></div></div><div class="grid" style="align-content:start" id="hiDay"><div class="card"><div class="state">Click any day on the calendar.</div></div></div></div>';
    const go = (y, m) => { Y = y; M = m; if (M < 0) { M = 11; Y--; } if (M > 11) { M = 0; Y++; } month(loc); };
    $('#hiPrev').onclick = () => go(Y, M - 1); $('#hiNext').onclick = () => go(Y, M + 1);
    $('#hiMon').onchange = e => go(Y, +e.target.value); $('#hiYear').onchange = e => go(+e.target.value, M);
    $('#hiToday').onclick = () => { const d = new Date(); sel = null; go(d.getFullYear(), d.getMonth()); };
    await month(loc);
  }

  async function month(loc) {
    const g = ++gen, cal = $('#hiCal'); $('#hiMon').value = M; $('#hiYear').value = Y; SW.loading(cal, 'Opening the record books…');
    const last = new Date(Y, M + 1, 0).getDate(), a = iso(Y, M, 1), b = iso(Y, M, last), q = 'latitude=' + loc.lat.toFixed(4) + '&longitude=' + loc.lon.toFixed(4) + '&timezone=auto&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max' + U.om();
    days = {};
    try {
      const fc = await api.json('https://api.open-meteo.com/v1/forecast?' + q + '&forecast_days=16&past_days=7', 1800); tzName = fc.timezone;
      const today = todayIso(), put = (j, kind) => j.daily.time.forEach(function one(d, i) { if (d < a || d > b || j.daily.temperature_2m_max[i] == null) return; if (days[d] && days[d].kind === 'actual' && kind !== 'actual') return; days[d] = { code: j.daily.weather_code[i], hi: j.daily.temperature_2m_max[i], lo: j.daily.temperature_2m_min[i], pr: j.daily.precipitation_sum[i], gust: j.daily.wind_gusts_10m_max[i], kind: d > today ? 'forecast' : d === today ? 'today' : kind }; });
      if (a <= today) { const end = b < today ? b : today; put(await api.json('https://archive-api.open-meteo.com/v1/archive?' + q + '&start_date=' + a + '&end_date=' + end, b < today ? 86400 : 3600), 'actual'); }
      fc.daily.time.forEach((d, i) => { if (!days[d] || d >= today) { const keep = days[d]; delete days[d]; put({ daily: { time: [d], weather_code: [fc.daily.weather_code[i]], temperature_2m_max: [fc.daily.temperature_2m_max[i]], temperature_2m_min: [fc.daily.temperature_2m_min[i]], precipitation_sum: [fc.daily.precipitation_sum[i]], wind_gusts_10m_max: [fc.daily.wind_gusts_10m_max[i]] } }, 'recent'); if (!days[d] && keep) days[d] = keep; } });
      if (g !== gen) return;
      await station(loc, g);
    } catch (e) { SW.fail(cal, e, () => month(loc)); return; }
    if (g !== gen) return;
    render(loc);
    const t = todayIso(); if (!sel || sel.slice(0, 7) !== a.slice(0, 7)) sel = (t >= a && t <= b) ? t : (days[b] ? b : a);
    day(loc, sel);
  }

  // real thermometer readings from the nearest US airport station (Iowa Environmental Mesonet archive)
  async function station(loc, g) {
    const key = loc.lat + ',' + loc.lon;
    try {
      if (stnFor !== key) {
        stn = null; stnFor = key;
        const p = await SW.nwsPoint(loc), st2 = p.relativeLocation && p.relativeLocation.properties.state, list = await api.json(p.observationStations, 86400);
        for (const f of list.features.slice(0, 6)) { const id = f.properties.stationIdentifier; if (/^[KP][A-Z0-9]{3}$/.test(id)) { stn = { id: id[0] === 'K' ? id.slice(1) : id, name: f.properties.name, net: (id.slice(0, 2) === 'PA' ? 'AK' : id.slice(0, 2) === 'PH' ? 'HI' : st2) + '_ASOS' }; break; } }
      }
      if (!stn) return;
      const j = await api.json('https://mesonet.agron.iastate.edu/api/1/daily.json?station=' + stn.id + '&network=' + stn.net + '&year=' + Y + '&month=' + (M + 1), 3600);
      if (g !== gen) return;
      (j.data || []).forEach(function meas(r) { const d = days[r.date]; if (d && d.kind !== 'forecast' && d.kind !== 'today' && r.max_tmpf != null && r.min_tmpf != null) d.m = { hi: dT(r.max_tmpf), lo: dT(r.min_tmpf), pr: r.precip == null ? null : dP(Math.max(0, r.precip)) }; });
    } catch (e) { /* outside the US, or the archive is quiet: the calendar still works */ }
  }
  const best = d => d.m ? { hi: d.m.hi, lo: d.m.lo, pr: d.m.pr == null ? d.pr : d.m.pr } : d;

  function render(loc) {
    const first = new Date(Y, M, 1).getDay(), last = new Date(Y, M + 1, 0).getDate(), today = todayIso();
    let h = '<div class="cal"><div class="cal-h">Sun</div><div class="cal-h">Mon</div><div class="cal-h">Tue</div><div class="cal-h">Wed</div><div class="cal-h">Thu</div><div class="cal-h">Fri</div><div class="cal-h">Sat</div>';
    for (let i = 0; i < first; i++) h += '<div class="cal-x"></div>';
    for (let d = 1; d <= last; d++) {
      const k = iso(Y, M, d), x = days[k];
      if (!x) { h += '<div class="cal-d empty"><i>' + d + '</i></div>'; continue; }
      const v = best(x), w = SW.wx(x.code);
      h += '<div class="cal-d ' + x.kind + (k === today ? ' now' : '') + (k === sel ? ' on' : '') + '" data-d="' + k + '" title="' + w.text + '"><i>' + d + '</i><em>' + w.icon + '</em><b>' + n(v.hi) + '°</b><span>' + n(v.lo) + '°</span><u>' + (v.pr > (U.us() ? 0.005 : 0.1) ? n(v.pr, pd()) + ' ' + U.p() : (x.kind === 'forecast' ? 'forecast' : '&nbsp;')) + '</u></div>';
    }
    $('#hiCal').innerHTML = h + '</div><div class="dim small" style="margin-top:10px">' + (stn ? 'Past days show the thermometer and rain gauge at ' + esc(stn.name) + ' where it has a record.' : 'Past days come from the worldwide weather record, which rebuilds each day from every available measurement.') + ' Faded days have not happened yet and show the forecast.</div>';
    $$('.cal-d[data-d]').forEach(e => e.onclick = () => { sel = e.dataset.d; $$('.cal-d').forEach(x => x.classList.toggle('on', x === e)); day(loc, sel); });
    const act = Object.keys(days).filter(k => days[k].kind !== 'forecast').map(k => Object.assign({ k }, best(days[k]))), box = $('#hiMonth');
    if (!act.length) { box.innerHTML = '<div><span>This month has not started yet.</span><b></b></div>'; return; }
    const avg = f => act.reduce((s, d) => s + f(d), 0) / act.length, top = (f, dir) => act.slice().sort((p, q) => dir * (f(q) - f(p)))[0], dl = k => MON[M].slice(0, 3) + ' ' + (+k.slice(8));
    const hot = top(d => d.hi, 1), cold = top(d => d.lo, -1), wet = top(d => d.pr || 0, 1), rainy = act.filter(d => (d.pr || 0) > (U.us() ? 0.005 : 0.1)).length;
    box.innerHTML = '<div><span>Average high / low</span><b>' + n(avg(d => d.hi)) + '° / ' + n(avg(d => d.lo)) + '°</b></div><div><span>Total rain</span><b>' + n(act.reduce((s, d) => s + (d.pr || 0), 0), pd()) + ' ' + U.p() + ' over ' + rainy + ' day' + (rainy === 1 ? '' : 's') + '</b></div>' +
      '<div><span>Warmest day</span><b>' + dl(hot.k) + ' · ' + n(hot.hi) + '°</b></div><div><span>Coldest night</span><b>' + dl(cold.k) + ' · ' + n(cold.lo) + '°</b></div>' + (wet.pr > 0 ? '<div><span>Wettest day</span><b>' + dl(wet.k) + ' · ' + n(wet.pr, pd()) + ' ' + U.p() + '</b></div>' : '') + '<div><span>Days counted</span><b>' + act.length + '</b></div>';
  }

  let dayGen = 0;
  async function day(loc, d) {
    const g = ++dayGen, box = $('#hiDay'), x = days[d]; if (!box) return;
    const date = new Date(d + 'T12:00:00'), title = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (!x) { box.innerHTML = '<div class="card"><h2>' + title + '</h2><div class="state">There is no record for this day yet.</div></div>'; return; }
    box.innerHTML = '<div class="card"><h2>' + title + '</h2><div class="state"><span class="spin"></span>Loading the day…</div></div>';
    const fut = x.kind === 'forecast', soft = fut || x.kind === 'today', LEADS = [1, 2, 3, 5, 7];
    let j = null, h = null;
    try {
      j = await api.json(SW.omUrl('https://previous-runs-api.open-meteo.com/v1/forecast', loc, '&start_date=' + d + '&end_date=' + d + '&hourly=temperature_2m,precipitation,wind_gusts_10m,relative_humidity_2m,' + LEADS.map(k => 'temperature_2m_previous_day' + k + ',precipitation_previous_day' + k).join(',') + U.om()), fut ? 1800 : 21600);
      h = j.hourly; if (!h.temperature_2m.some(v => v != null)) h = null;
    } catch (e) { }
    if (!h) try { j = await api.json(SW.omUrl('https://archive-api.open-meteo.com/v1/archive', loc, '&start_date=' + d + '&end_date=' + d + '&hourly=temperature_2m,precipitation,wind_gusts_10m,relative_humidity_2m' + U.om()), 86400); h = j.hourly; } catch (e) { }
    if (g !== dayGen) return;
    if (!h || !h.temperature_2m.some(v => v != null)) { box.innerHTML = '<div class="card"><h2>' + title + '</h2><div class="state">The hour-by-hour record for this day is not available.</div></div>'; return; }
    const tz = j.timezone, T = h.temperature_2m, ext = (arr, dir) => { let b = -1; arr.forEach((v, i) => { if (v != null && (b < 0 || dir * (v - arr[b]) > 0)) b = i; }); return b; };
    const iH = ext(T, 1), iL = ext(T, -1), iG = ext(h.wind_gusts_10m || [], 1), sum = arr => arr.reduce((s, v) => s + (v || 0), 0), rain = sum(h.precipitation), wet = U.us() ? 0.01 : 0.2;
    const v = best(x), w = SW.wx(x.code);
    const story = (fut ? 'This day has not happened yet. The forecast is ' : x.kind === 'today' ? 'Today is still under way. So far and for the rest of the day: ' : 'It was ') + w.text.toLowerCase() + '. ' + (soft ? 'Expect a high near ' : 'The high was ') + '<b>' + n(v.hi) + '°</b> around ' + SW.fmt(h.time[iH], tz, 'hour') + ' and ' + (soft ? 'a low near ' : 'the low was ') + '<b>' + n(v.lo) + '°</b> around ' + SW.fmt(h.time[iL], tz, 'hour') + '. ' +
      ((v.pr || 0) > wet / 2 ? '<b>' + n(v.pr, pd()) + ' ' + U.p() + '</b> of rain' + (soft ? ' is expected.' : ' fell.') : (soft ? 'No rain is expected.' : 'No rain fell.')) + (iG >= 0 ? ' The strongest gust ' + (soft ? 'should be' : 'was') + ' about ' + n(h.wind_gusts_10m[iG]) + ' ' + U.w() + '.' : '');

    // how the forecast did, 1 to 7 days ahead
    let rows = '', score = [];
    const aHi = T[iH], aLo = T[iL];
    LEADS.forEach(function lead(k) {
      const ft = h['temperature_2m_previous_day' + k], fp = h['precipitation_previous_day' + k]; if (!ft || ft.filter(q => q != null).length < 20) return;
      const fh = ft[ext(ft, 1)], fl = ft[ext(ft, -1)], fr = sum(fp || []), eh = fh - aHi, el = fl - aLo, worst = Math.max(Math.abs(eh), Math.abs(el)) * (U.us() ? 1 : 1.8);
      const rainOk = (fr > wet) === (rain > wet), grade = worst <= 2 && rainOk ? ['Spot on', '#3ddc97'] : worst <= 4 && rainOk ? ['Close', '#a6f0c8'] : worst <= 7 ? [rainOk ? 'A bit off' : (fr > wet ? 'Rain never came' : 'Missed the rain'), '#ffd24a'] : ['Missed', '#ff8a4a'];
      score.push(worst);
      const sg = e => (Math.abs(e) < 0.5 ? 'exact' : n(Math.abs(e)) + '° too ' + (e > 0 ? 'warm' : 'cold'));
      rows += '<tr><td>' + k + ' day' + (k > 1 ? 's' : '') + ' before</td><td>' + n(fh) + '° <span class="lo">' + sg(eh) + '</span></td><td>' + n(fl) + '° <span class="lo">' + sg(el) + '</span></td><td>' + (fr > wet / 2 ? n(fr, pd()) + ' ' + U.p() : 'dry') + '</td><td><span class="pill" style="background:' + grade[1] + '">' + grade[0] + '</span></td></tr>';
    });
    const accuracy = fut ? (rows ? '<table><tr><th>Forecast made</th><th>High</th><th>Low</th><th>Rain</th></tr>' + rows.replace(/<span class="lo">[^<]*<\/span>/g, '').replace(/<td><span class="pill"[^>]*>[^<]*<\/span><\/td>/g, '') + '</table><div class="dim small" style="margin-top:8px">How the forecast for this day has been changing as it gets closer. If the numbers keep jumping around, confidence is low.</div>' : '<div class="state">Earlier forecasts for this day are not available yet.</div>')
      : rows ? '<table><tr><th>Forecast made</th><th>High</th><th>Low</th><th>Rain</th><th>Verdict</th></tr><tr><td><b>What happened</b></td><td><b>' + n(aHi) + '°</b></td><td><b>' + n(aLo) + '°</b></td><td><b>' + (rain > wet / 2 ? n(rain, pd()) + ' ' + U.p() : 'dry') + '</b></td><td></td></tr>' + rows + '</table><div class="dim small" style="margin-top:8px">Each row is what the forecast said that many days ahead, compared with what the weather really did at this spot. Forecasts normally get better as the day gets closer.</div>'
        : '<div class="state">Saved forecasts only go back to early 2024, so there is nothing to grade for this day.</div>';
    const meas = x.m ? '<div class="dim small" style="margin-top:8px">Measured at ' + esc(stn.name) + ': high ' + n(x.m.hi) + '°, low ' + n(x.m.lo) + '°' + (x.m.pr != null ? ', rain ' + n(x.m.pr, pd()) + ' ' + U.p() : '') + '. The chart below is for your exact spot, so it can differ by a degree or two.</div>' : '';
    box.innerHTML = '<div class="card" id="hiStory"><h2>' + title + '</h2><div class="hero" style="gap:18px;flex-wrap:nowrap"><div class="ico">' + w.icon + '</div><div style="font-size:15px;line-height:1.55">' + story + meas + '</div></div>' +
      '<div class="idx" style="margin-top:12px"><div><span>Warmest hour</span><b>' + SW.fmt(h.time[iH], tz, 'hour') + ' · ' + n(T[iH]) + '°</b></div><div><span>Coldest hour</span><b>' + SW.fmt(h.time[iL], tz, 'hour') + ' · ' + n(T[iL]) + '°</b></div>' + moist(h, tz) + '</div></div>' +
      '<div class="card" id="hiHourCard"><h2>Hour by hour</h2><div class="chart" id="hiChart"></div></div>' +
      '<div class="card" id="hiAccCard"><h2>' + (fut ? 'How the forecast has changed' : 'How good was the forecast?') + '</h2>' + accuracy + '</div>';
    const series = [{ label: fut ? 'Latest forecast' : 'What happened', color: '#ffffff', width: 3 }], data = [h.time, T];
    [[1, '#3ddc97'], [3, '#ffd24a'], [7, '#ff5a8a']].forEach(function ln(p) { const ft = h['temperature_2m_previous_day' + p[0]]; if (ft && ft.some(q => q != null)) { series.push({ label: 'Forecast ' + p[0] + ' day' + (p[0] > 1 ? 's' : '') + ' before', color: p[1], width: 1.5, dash: [5, 4] }); data.push(ft); } });
    series.push({ label: 'Rain', color: '#3fc6ff', bars: true, scale: 'y2', dec: 2 }); data.push(h.precipitation);
    SW.chart($('#hiChart'), { tz, unit: U.t(), y2: { unit: U.p() }, data, series, nowLine: x.kind === 'today' });
  }
  function moist(h, tz) { // wettest and driest hour: by rain if any fell, otherwise by moisture in the air
    const R = h.relative_humidity_2m, P = h.precipitation, ext = (arr, dir) => { let b = -1; (arr || []).forEach((v, i) => { if (v != null && (b < 0 || dir * (v - arr[b]) > 0)) b = i; }); return b; };
    const r = ext(P, 1), hu = ext(R, 1), hd = ext(R, -1), at = i => SW.fmt(h.time[i], tz, 'hour'); let s = '';
    if (r >= 0 && P[r] > 0) s += '<div><span>Wettest hour</span><b>' + at(r) + ' · ' + n(P[r], pd()) + ' ' + U.p() + ' of rain</b></div>';
    else if (hu >= 0) s += '<div><span>Wettest hour</span><b>' + at(hu) + ' · ' + n(R[hu]) + '% humidity</b></div>';
    if (hd >= 0) s += '<div><span>Driest hour</span><b>' + at(hd) + ' · ' + n(R[hd]) + '% humidity</b></div>';
    return s;
  }
  SW.history = { load };
})();

// Skywatch extremes: the hottest, coldest, windiest and most pleasant places reporting right now.
(function funMod() {
  const { $, $$, api, U, n, esc } = SW;
  let cache = null, names = null;
  async function gz(url) { // these feeds are gzip files
    const r = await SW.fetch(url); if (!r.ok) throw new Error('Server answered ' + r.status);
    return await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text();
  }
  const region = new Intl.DisplayNames(['en'], { type: 'region' });
  function place(o) {
    const s = names && names[o.id]; if (!s) return o.id;
    if (!s.site || /^UNK/i.test(s.site)) { let cc = s.country; try { if (cc) cc = region.of(cc); } catch (e) { } return 'Station ' + o.id + (cc ? ', ' + cc : ''); }
    let nm = s.site.replace(/\b(Intl|International|Regional|Rgnl|Municipal|Muni|Airport|Arpt|Field|Fld|AFB|Air Base|Airfield)\b\.?/gi, '').replace(/[\s,\/-]+$/g, '').replace(/\s{2,}/g, ' ').trim() || s.site;
    let c = s.country; try { if (c) c = region.of(c); } catch (e) { }
    return nm + (s.country === 'US' && s.state ? ', ' + s.state : c ? ', ' + c : '');
  }
  const rh = (t, d) => 100 * Math.exp(17.625 * d / (243.04 + d)) / Math.exp(17.625 * t / (243.04 + t));

  async function data() {
    if (cache && Date.now() - cache.at < 15 * 60000) return cache;
    const [csv, stj] = await Promise.all([gz('https://aviationweather.gov/data/cache/metars.cache.csv.gz'), names ? null : gz('https://aviationweather.gov/data/cache/stations.cache.json.gz')]);
    if (stj) { names = {}; JSON.parse(stj).forEach(s => { if (s.icaoId) names[s.icaoId] = { site: s.site || s.icaoId, state: s.state, country: s.country }; }); }
    const lines = csv.split('\n'), head = lines.find(l => l.startsWith('raw_text')).split(','), col = k => head.indexOf(k) - 1;
    const ci = { id: col('station_id'), time: col('observation_time'), la: col('latitude'), lo: col('longitude'), t: col('temp_c'), d: col('dewpoint_c'), ws: col('wind_speed_kt'), wg: col('wind_gust_kt'), vis: col('visibility_statute_mi'), wx: col('wx_string'), sky: col('sky_cover'), slp: col('sea_level_pressure_mb'), el: col('elevation_m') };
    const now = Date.now(), obs = [];
    for (const l of lines) {
      if (l[0] !== '"') continue; const e = l.indexOf('",'); if (e < 0) continue; const f = l.slice(e + 2).split(',');
      const t = parseFloat(f[ci.t]), time = Date.parse(f[ci.time]); if (isNaN(t) || now - time > 100 * 60000 || t < -75 || t > 56) continue;
      const d = parseFloat(f[ci.d]), ws = parseFloat(f[ci.ws]) || 0, wg = parseFloat(f[ci.wg]) || 0;
      if (!isNaN(d) && d > t + 1) continue; if (ws > 110 || wg > 140) continue;
      const id = f[ci.id], s = names[id];
      obs.push({ id, la: +f[ci.la], lo: +f[ci.lo], t, d: isNaN(d) ? null : d, ws, wg, vis: parseFloat(f[ci.vis]), wx: f[ci.wx] || '', sky: f[ci.sky] || '', slp: parseFloat(f[ci.slp]), el: parseFloat(f[ci.el]), us: s ? s.country === 'US' : /^(K|PA|PH)/.test(id), state: s && s.state });
    }
    cache = { at: Date.now(), obs }; return cache;
  }

  async function load() {
    const root = $('#v-fun'), loc = SW.loc(); if (!loc) return;
    root.innerHTML = '<div class="head"><h1>Extremes right now</h1><span class="dim">the wildest and nicest weather on Earth at this moment</span></div><div id="fnBody"></div>';
    const body = $('#fnBody'); SW.loading(body, 'Polling thousands of weather stations…');
    let obs;
    try { obs = (await data()).obs; } catch (e) { SW.fail(body, e, load); return; }
    if (obs.length < 200) { body.innerHTML = '<div class="card"><div class="state">Too few stations are reporting right now. Try again in a few minutes.</div></div>'; return; }
    const T = c => n(U.cT(c)) + U.t(), W = kt => n(U.cW(kt * 1.852)) + ' ' + U.w(), us = obs.filter(o => o.us), l48 = us.filter(o => o.state && o.state !== 'AK' && o.state !== 'HI' && /^K/.test(o.id));
    const top = (arr, f, k) => arr.filter(o => f(o) != null && !isNaN(f(o))).sort((a, b) => f(b) - f(a)).slice(0, k || 5);
    const comfy = o => o.d == null || o.wx || o.vis < 6 ? null : -(Math.abs(o.t - 22) * 1.2 + Math.abs(o.d - 10) * 0.6 + Math.max(0, o.d - 15) * 1.5 + o.ws * 0.25 + (/OVC|BKN/.test(o.sky) ? 2.5 : 0));
    const dry = o => o.d == null || o.t < 5 ? null : -rh(o.t, o.d);
    const mine = obs.slice().sort((a, b) => SW.dist(loc.lat, loc.lon, a.la, a.lo) - SW.dist(loc.lat, loc.lon, b.la, b.lo))[0];
    const far = arr => arr.filter(o => SW.dist(loc.lat, loc.lon, o.la, o.lo) > 1500);
    const twin = mine && mine.d != null ? top(far(obs), o => o.d == null ? null : -(Math.abs(o.t - mine.t) + Math.abs(o.d - mine.d) * 0.7 + Math.abs(o.ws - mine.ws) * 0.2), 1)[0] : null;
    const opp = mine ? top(far(obs), o => Math.abs(o.t - mine.t), 1)[0] : null;
    const hot = top(obs, o => o.t)[0], cold = top(obs, o => -o.t)[0];
    const count = re => obs.filter(o => re.test(o.wx)).length;
    const card = (id, icon, title, arr, val, note) => '<div class="card fn" id="' + id + '"><h2>' + title + '</h2>' + (arr.length ? '<div class="fn-top" data-la="' + arr[0].la + '" data-lo="' + arr[0].lo + '"><span class="fn-ico">' + icon + '</span><div><div class="fn-val">' + val(arr[0]) + '</div><div class="fn-name">' + esc(place(arr[0])) + '</div></div></div><ol>' + arr.slice(1).map(o => '<li data-la="' + o.la + '" data-lo="' + o.lo + '"><span>' + esc(place(o)) + '</span><b>' + val(o) + '</b></li>').join('') + '</ol>' : '<div class="state">No station qualifies right now.</div>') + (note ? '<div class="dim small">' + note + '</div>' : '') + '</div>';
    body.innerHTML = '<div class="card" id="fnLead" style="margin-bottom:14px"><div class="fn-lead">Right now it is <b style="color:#ff8a4a">' + T(hot.t) + '</b> in ' + esc(place(hot)) + ' and <b style="color:#3fc6ff">' + T(cold.t) + '</b> in ' + esc(place(cold)) + ': a spread of <b>' + n(U.us() ? (hot.t - cold.t) * 1.8 : hot.t - cold.t) + ' degrees</b> across the planet.' +
      (mine ? ' Near you (' + esc(place(mine)) + ') it is ' + T(mine.t) + '.' : '') + '</div><div class="fn-chips"><span>⛈️ ' + count(/TS/) + ' places with thunder</span><span>🌧️ ' + count(/RA|DZ/) + ' with rain</span><span>🌨️ ' + count(/SN/) + ' with snow</span><span>🌫️ ' + count(/FG/) + ' in fog</span><span>📡 ' + obs.length.toLocaleString() + ' stations reporting</span></div></div>' +
      '<div class="grid g3">' +
      card('fnHot', '🔥', 'Hottest place on Earth', top(obs, o => o.t), o => T(o.t)) +
      card('fnCold', '🥶', 'Coldest place on Earth', top(obs, o => -o.t), o => T(o.t)) +
      card('fnNice', '😌', 'Most comfortable place on Earth', top(obs, comfy), o => T(o.t), 'Close to 72°F (22°C), dry air, light wind, no rain or fog.') +
      card('fnHotUS', '🌵', 'Hottest in the United States', top(us, o => o.t), o => T(o.t)) +
      card('fnColdUS', '🧊', 'Coldest in the United States', top(us, o => -o.t), o => T(o.t), 'Includes Alaska and Hawaii.') +
      card('fnCold48', '❄️', 'Coldest in the lower 48', top(l48, o => -o.t), o => T(o.t)) +
      card('fnNiceUS', '🏖️', 'Most comfortable in the United States', top(us, comfy), o => T(o.t)) +
      card('fnWind', '💨', 'Windiest place', top(obs, o => Math.max(o.ws, o.wg)), o => W(Math.max(o.ws, o.wg)), 'Strongest wind or gust reported.') +
      card('fnMug', '💦', 'Muggiest place', top(obs, o => o.d), o => T(o.d) + ' dew point', 'The stickiest, most humid air.') +
      card('fnDry', '🏜️', 'Driest air', top(obs, dry), o => n(rh(o.t, o.d)) + '% humidity') +
      card('fnHigh', '🏔️', 'Highest station reporting', top(obs, o => o.el), o => n(U.cH(o.el)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ' + U.h() + ' · ' + T(o.t)) +
      (twin ? card('fnTwin', '👯', 'Your weather twin', [twin], o => T(o.t), 'A faraway place having almost exactly your weather right now.') : '') +
      (opp ? card('fnOpp', '🙃', 'Your weather opposite', [opp], o => T(o.t), 'The place whose temperature is furthest from yours right now.') : '') +
      '<div class="card fn" id="fnRec"><h2>For comparison: all-time records</h2><ol class="rec"><li><span>Hottest ever measured</span><b>' + T(56.7) + '</b><em>Death Valley, California · 1913</em></li><li><span>Coldest ever measured</span><b>' + T(-89.2) + '</b><em>Vostok Station, Antarctica · 1983</em></li><li><span>Coldest in the United States</span><b>' + T(-62.2) + '</b><em>Prospect Creek, Alaska · 1971</em></li><li><span>Strongest gust outside a tornado</span><b>' + W(220) + '</b><em>Barrow Island, Australia · 1996</em></li><li><span>Most rain in one day</span><b>' + n(U.cP(1825), U.us() ? 1 : 0) + ' ' + U.p() + '</b><em>Réunion Island · 1966</em></li></ol></div>' +
      '</div><div class="dim small" style="margin-top:12px">Counted from airport and official weather stations that reported in the last 100 minutes. Places without a station are not included, so a remote desert or ice cap may be hotter or colder than anything listed. Click any place to see it on the map.</div>';
    $$('[data-la]', body).forEach(e => e.onclick = () => { SW.show('map'); SW.map.goto(+e.dataset.la, +e.dataset.lo); });
  }
  SW.fun = { load };
  void api;
})();

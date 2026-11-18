// Skywatch forecast: current conditions, 10 days, hourly charts, NWS text, air quality.
(function forecastMod() {
  const { $, api, U, n, esc } = SW;
  let span = 72, data = null;

  function moon(ts) {
    const p = (((ts - 947182440) / 2551442.8) % 1 + 1) % 1; // since new moon 2000-01-06 18:14 UTC
    const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
    const i = Math.round(p * 8) % 8;
    return { name: names[i], icon: '🌑🌒🌓🌔🌕🌖🌗🌘'.match(/./gu)[i], lit: Math.round((1 - Math.cos(p * 2 * Math.PI)) / 2 * 100) };
  }

  async function load() {
    const root = $('#v-forecast'), loc = SW.loc(); if (!loc) return;
    root.innerHTML = '<div class="head"><h1>' + esc(loc.name) + '</h1><span class="dim">' + esc(loc.region || '') + '</span><div class="spacer"></div><div class="seg" id="fcSpan"><button data-h="48">2 days</button><button data-h="72" >3 days</button><button data-h="168">7 days</button><button data-h="240">10 days</button></div></div>' +
      '<div class="grid" id="fcBody"></div>';
    const body = $('#fcBody', root); SW.loading(body, 'Getting the forecast…');
    SW.$$('#fcSpan button', root).forEach(b => { b.classList.toggle('on', +b.dataset.h === span); b.onclick = () => { span = +b.dataset.h; SW.$$('#fcSpan button', root).forEach(x => x.classList.toggle('on', x === b)); charts(); }; });
    try {
      data = await api.json(SW.omUrl('https://api.open-meteo.com/v1/forecast', loc,
        '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,dew_point_2m,visibility,is_day,uv_index' +
        '&hourly=relative_humidity_2m,temperature_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,snowfall,cloud_cover,pressure_msl,wind_speed_10m,wind_gusts_10m,weather_code,cape' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max,sunrise,sunset,uv_index_max&forecast_days=10' + U.om()), 600);
    } catch (e) { SW.fail(body, e, load); return; }
    const d = data, c = d.current, tz = d.timezone, w = SW.wx(c.weather_code, !c.is_day), dl = d.daily, m = moon(c.time);
    const vis = c.visibility == null ? null : U.cD(c.visibility / 1000);
    body.innerHTML =
      '<div class="card"><div class="hero"><div class="ico">' + w.icon + '</div><div><div class="big">' + n(c.temperature_2m) + '°</div><div>' + w.text + ' · feels like ' + n(c.apparent_temperature) + '°</div><div class="dim small" id="fcObs">Model analysis for ' + SW.fmt(c.time, tz, 'fullz') + '</div></div>' +
      '<div class="kv">' +
      kv('Wind', SW.compass(c.wind_direction_10m) + ' ' + n(c.wind_speed_10m) + ' ' + U.w()) + kv('Gusts', n(c.wind_gusts_10m) + ' ' + U.w()) + kv('Humidity', n(c.relative_humidity_2m) + '%') + kv('Dew point', n(c.dew_point_2m) + '°') +
      kv('Pressure', n(c.pressure_msl, 1) + ' hPa') + kv('Cloud', n(c.cloud_cover) + '%') + kv('Visibility', vis == null ? '—' : n(Math.min(vis, 99), vis < 10 ? 1 : 0) + ' ' + U.d()) + kv('UV index', n(c.uv_index, 1)) +
      kv('Sunrise', SW.fmt(dl.sunrise[0], tz, 'time')) + kv('Sunset', SW.fmt(dl.sunset[0], tz, 'time')) + kv('Moon', m.icon + ' ' + m.lit + '%') + kv('Air quality', '<span id="fcAqi">…</span>') +
      '</div></div></div>' +
      next24() +
      '<div class="card"><h2>10-day outlook</h2><div class="days">' + dl.time.map(function day(t, i) {
        const x = SW.wx(dl.weather_code[i]);
        return '<div class="day" title="' + x.text + '"><div class="dim small">' + (i ? SW.fmt(t + 43200, tz, 'day') : 'Today') + '</div><div class="i">' + x.icon + '</div><div class="hi">' + n(dl.temperature_2m_max[i]) + '°</div><div class="lo">' + n(dl.temperature_2m_min[i]) + '°</div><div class="p">' + (dl.precipitation_probability_max[i] >= 15 ? '💧' + dl.precipitation_probability_max[i] + '%' : '') + '</div><div class="dim small">' + (dl.precipitation_sum[i] > 0 ? n(dl.precipitation_sum[i], U.us() ? 2 : 1) + ' ' + U.p() : '&nbsp;') + '</div></div>';
      }).join('') + '</div></div>' +
      '<div class="grid g2">' +
      '<div class="card"><h2>Temperature</h2><div class="chart" id="chT"></div></div>' +
      '<div class="card"><h2>Rain &amp; snow</h2><div class="chart" id="chP"></div></div>' +
      '<div class="card"><h2>Wind</h2><div class="chart" id="chW"></div></div>' +
      '<div class="card"><h2>Pressure &amp; cloud</h2><div class="chart" id="chC"></div></div>' +
      '</div>' +
      '<div class="card"><h2>National Weather Service forecast</h2><div id="fcNws"><div class="state"><span class="spin"></span>Loading…</div></div></div>';
    charts(); nws(loc); aqi(loc);
  }
  function next24() { // the standout hours of the coming day
    const h = data.hourly, tz = data.timezone, now = Date.now() / 1000; let a = h.time.findIndex(t => t >= now - 1800); if (a < 0) a = 0; const b = Math.min(h.time.length, a + 24);
    const pick = (k, dir) => { let m = a; for (let i = a; i < b; i++) if (h[k][i] != null && dir * (h[k][i] - h[k][m]) > 0) m = i; return m; };
    const day = t => SW.fmt(t, tz, 'day') === SW.fmt(now, tz, 'day') ? '' : ' ' + SW.fmt(t, tz, 'day'), at = i => SW.fmt(h.time[i], tz, 'hour') + day(h.time[i]);
    const w = pick('temperature_2m', 1), c = pick('temperature_2m', -1), g = pick('wind_gusts_10m', 1), p = pick('precipitation_probability', 1), dry = h.precipitation_probability[p] < 25;
    const r = pick('precipitation', 1), rains = h.precipitation[r] > 0, hu = pick('relative_humidity_2m', 1), hd = pick('relative_humidity_2m', -1);
    return '<div class="card" id="fc24"><h2>The next 24 hours</h2><div class="kv" style="grid-template-columns:repeat(3,auto)">' +
      '<div><span>Warmest hour</span><b>' + at(w) + ' · ' + n(h.temperature_2m[w]) + '°</b></div><div><span>Coldest hour</span><b>' + at(c) + ' · ' + n(h.temperature_2m[c]) + '°</b></div>' +
      '<div><span>Wettest hour</span><b>' + (rains ? at(r) + ' · ' + n(h.precipitation[r], U.us() ? 2 : 1) + ' ' + U.p() + ' of rain' : at(hu) + ' · ' + n(h.relative_humidity_2m[hu]) + '% humidity') + '</b></div><div><span>Driest hour</span><b>' + at(hd) + ' · ' + n(h.relative_humidity_2m[hd]) + '% humidity</b></div>' +
      '<div><span>Windiest hour</span><b>' + at(g) + ' · gusts ' + n(h.wind_gusts_10m[g]) + ' ' + U.w() + '</b></div><div><span>Best chance of rain</span><b>' + (dry ? 'Staying dry' : at(p) + ' · ' + n(h.precipitation_probability[p]) + '%') + '</b></div></div></div>';
  }
  const kv = (k, v) => '<div><span>' + k + '</span><b>' + v + '</b></div>';

  function charts() {
    if (!data || !$('#chT')) return;
    const h = data.hourly, tz = data.timezone, now = Date.now() / 1000;
    let a = h.time.findIndex(t => t >= now - 3600); if (a < 0) a = 0;
    const b = Math.min(h.time.length, a + span), s = k => h[k].slice(a, b), x = h.time.slice(a, b);
    SW.chart($('#chT'), { tz, unit: U.t(), data: [x, s('temperature_2m'), s('apparent_temperature'), s('dew_point_2m')], series: [{ label: 'Temperature', color: '#ff8a4a', width: 2.5 }, { label: 'Feels like', color: '#ffd24a', width: 1.2, dash: [5, 4] }, { label: 'Dew point', color: '#3ddc97', width: 1.5 }] });
    SW.chart($('#chP'), { tz, unit: U.p() + ' per hour', y2: { unit: 'chance %', range: [0, 100] }, data: [x, s('precipitation'), s('snowfall'), s('precipitation_probability')], series: [{ label: 'Rain', color: '#3fc6ff', bars: true, dec: 2 }, { label: 'Snow', color: '#c9a7ff', bars: true, dec: 2 }, { label: 'Chance', color: '#8b9ab3', width: 1.5, scale: 'y2', dec: 0 }] });
    SW.chart($('#chW'), { tz, unit: U.w(), data: [x, s('wind_speed_10m'), s('wind_gusts_10m')], series: [{ label: 'Wind', color: '#3fc6ff', fill: '#3fc6ff22' }, { label: 'Gusts', color: '#ff5a8a', width: 1.5 }] });
    SW.chart($('#chC'), { tz, unit: 'hPa', y2: { unit: 'cloud %', range: [0, 100] }, data: [x, s('pressure_msl'), s('cloud_cover')], series: [{ label: 'Pressure', color: '#ffd24a' }, { label: 'Cloud cover', color: '#8b9ab3', fill: '#8b9ab322', width: 1, scale: 'y2', dec: 0 }] });
  }

  async function nws(loc) {
    const box = $('#fcNws');
    try {
      const p = await SW.nwsPoint(loc);
      const f = await api.json(p.forecast + (U.us() ? '' : '?units=si'), 900);
      box.innerHTML = '<div class="periods">' + f.properties.periods.slice(0, 14).map(q => '<div class="period"><b>' + esc(q.name) + '<div class="dim small" style="font-weight:400">' + q.temperature + '°' + q.temperatureUnit + (q.probabilityOfPrecipitation && q.probabilityOfPrecipitation.value ? ' · 💧' + q.probabilityOfPrecipitation.value + '%' : '') + '</div></b><div>' + esc(q.detailedForecast) + '</div></div>').join('') + '</div>';
      // nearest real observation
      const s = await api.json(p.observationStations, 86400);
      const stn = s.features[0];
      if (stn) {
        const o = (await api.json(stn.id + '/observations/latest', 300)).properties;
        if (o && o.temperature && o.temperature.value != null && $('#fcObs')) $('#fcObs').innerHTML = 'Measured at ' + esc(stn.properties.name) + (function away(c) { if (!c) return ''; const r = Math.PI / 180, a = Math.sin((c[1] - loc.lat) * r / 2) ** 2 + Math.cos(loc.lat * r) * Math.cos(c[1] * r) * Math.sin((c[0] - loc.lon) * r / 2) ** 2, km = 12742 * Math.asin(Math.sqrt(a)); return km < 8 ? '' : ' (' + (U.us() ? Math.round(km / 1.609) + ' mi' : Math.round(km) + ' km') + ' away)'; })(stn.geometry && stn.geometry.coordinates) + ': <b style="color:var(--text)">' + n(U.cT(o.temperature.value)) + U.t() + '</b>' + (o.textDescription ? ', ' + esc(o.textDescription.toLowerCase()) : '') + ' · ' + SW.fmt(Date.parse(o.timestamp) / 1000, data.timezone, 'time');
      }
    } catch (e) {
      box.innerHTML = '<div class="state">The National Weather Service text forecast covers the United States only' + (/404|Not Found|Unable/i.test(e.message) ? '.' : ' (' + esc(e.message) + ').') + '</div>';
    }
  }
  async function aqi(loc) {
    try {
      const j = await api.json(SW.omUrl('https://air-quality-api.open-meteo.com/v1/air-quality', loc, '&current=us_aqi,pm2_5,ozone'), 1800), v = j.current.us_aqi;
      const lv = v <= 50 ? ['Good', '#3ddc97'] : v <= 100 ? ['Moderate', '#ffe44a'] : v <= 150 ? ['Unhealthy for some', '#ffb020'] : v <= 200 ? ['Unhealthy', '#ff5a5a'] : ['Very unhealthy', '#c070ff'];
      if ($('#fcAqi')) $('#fcAqi').innerHTML = '<span style="color:' + lv[1] + '">' + n(v) + ' ' + lv[0] + '</span>';
    } catch (e) { if ($('#fcAqi')) $('#fcAqi').textContent = '—'; }
  }
  SW.forecast = { load };
})();

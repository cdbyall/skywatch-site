// Skywatch core: settings, data fetching with cache, units, formatting, charts.
(function core() {
  const SW = window.SW = {};
  const $ = SW.$ = (s, r) => (r || document).querySelector(s);
  SW.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  SW.el = function el(tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (html != null) e.innerHTML = html;
    return e;
  };
  SW.esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- settings ----------
  const KEY = 'skywatch.v1';
  const def = { locs: [], cur: 0, units: 'us', map: { base: 'dark', radar: 'iem', sat: 'none', spc: 'none', alerts: true, metar: false, sites: false, trop: true, radarOp: 80, satOp: 85 }, seenAlerts: [] };
  let st;
  try { st = Object.assign({}, def, JSON.parse(localStorage.getItem(KEY) || '{}')); st.map = Object.assign({}, def.map, st.map); } catch (e) { st = JSON.parse(JSON.stringify(def)); }
  SW.st = st;
  SW.save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { } };
  SW.loc = () => st.locs[st.cur] || st.locs[0] || null;

  // ---------- events ----------
  const subs = {};
  SW.on = (ev, fn) => (subs[ev] = subs[ev] || []).push(fn);
  SW.emit = (ev, a) => (subs[ev] || []).forEach(fn => { try { fn(a); } catch (e) { console.error(ev, e); } });

  // ---------- fetching ----------
  const cache = new Map(), flying = new Map(), feedLog = {};
  function note(url, ok, msg) {
    let host; try { host = new URL(url).host; } catch (e) { host = url; }
    const f = feedLog[host] = feedLog[host] || { ok: 0, fail: 0, last: '' };
    if (ok) f.ok++; else { f.fail++; f.last = msg; }
  }
  // On the website, two sources (aviationweather.gov and the hurricane center) refuse requests from a web page.
  // GitHub fetches those for us every 15 minutes (see .github/workflows/feeds.yml) and the page reads GitHub's copy.
  const WEB = location.protocol !== 'file:' && !window.swShell, ghHost = /^([\w-]+)\.github\.io$/.exec(location.hostname);
  const MIRROR = 'https://raw.githubusercontent.com/' + (ghHost ? ghHost[1] + '/' + (location.pathname.split('/')[1] || 'skywatch-site') : 'cdbyall/skywatch-site') + '/data/';
  const MIR = [[/^https:\/\/www\.nhc\.noaa\.gov\/CurrentStorms\.json/, 'CurrentStorms.json'], [/metars\.cache\.csv\.gz/, 'metars.cache.csv.gz'], [/stations\.cache\.json\.gz/, 'stations.cache.json.gz']];
  const stamp = () => Math.floor(Date.now() / 300000), mirrorLog = {};
  SW.web = WEB; SW.relayed = () => Object.assign({}, mirrorLog);
  let csvP = null, csvAt = 0;
  async function stationBox(url) { // the map's station overlay, cut out of the mirrored worldwide file
    if (!csvP || Date.now() - csvAt > 600000) { csvAt = Date.now(); csvP = fetch(MIRROR + 'metars.cache.csv.gz?t=' + stamp()).then(r => new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text()); csvP.catch(() => { csvP = null; }); }
    const txt = await csvP, bb = new URL(url).searchParams.get('bbox').split(',').map(Number), out = [], num = v => v === '' || v == null ? null : +v;
    for (const l of txt.split('\n')) {
      if (l[0] !== '"') continue; const e = l.indexOf('",'); if (e < 0) continue; const f = l.slice(e + 2).split(','), la = +f[2], lo = +f[3];
      if (f[4] === '' || la < bb[0] || la > bb[2] || lo < bb[1] || lo > bb[3]) continue;
      out.push({ icaoId: f[0], lat: la, lon: lo, temp: +f[4], dewp: num(f[5]), wdir: num(f[6]), wspd: num(f[7]), wgst: num(f[8]), visib: f[9], fltCat: f[29] || '', rawOb: l.slice(1, e), name: '' });
    }
    return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
  }
  SW.fetch = function swFetch(url, opts) {
    if (WEB) {
      if (url.indexOf('https://aviationweather.gov/api/data/metar') === 0) { mirrorLog.stations = (mirrorLog.stations || 0) + 1; return stationBox(url); }
      for (const m of MIR) if (m[0].test(url)) { mirrorLog[m[1]] = (mirrorLog[m[1]] || 0) + 1; return fetch(MIRROR + m[1] + '?t=' + stamp(), opts); }
    }
    return fetch(url, opts);
  };
  async function raw(url, kind, ttl, tries) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.t < ttl * 1000) return hit.v;
    if (flying.has(url)) return flying.get(url);
    const p = (async function fetchOnce() {
      let lastErr;
      for (let i = 0; i < (tries || 3); i++) {
        try {
          const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 25000);
          const r = await SW.fetch(url, { signal: ctl.signal, headers: kind === 'json' ? { Accept: 'application/geo+json, application/json' } : {} });
          clearTimeout(to);
          if (!r.ok) {
            let reason = '';
            try { const j = await r.json(); reason = j.reason || j.detail || j.title || ''; } catch (e) { }
            const er = new Error(reason || 'Server answered ' + r.status); er.final = r.status === 429 || r.status === 404 || r.status === 400; throw er;
          }
          const v = kind === 'json' ? await r.json() : await r.text();
          cache.set(url, { t: Date.now(), v });
          if (cache.size > 300) cache.delete(cache.keys().next().value);
          note(url, true);
          return v;
        } catch (e) { lastErr = e.name === 'AbortError' ? new Error('Timed out') : e; if (e.final) break; if (e instanceof SyntaxError) lastErr = new Error('The server sent a garbled answer'); await new Promise(r => setTimeout(r, 700 + i * 2300)); }
      }
      note(url, false, String(lastErr.message || lastErr));
      if (hit) return hit.v; // stale data beats no data
      throw lastErr;
    })();
    flying.set(url, p);
    try { return await p; } finally { flying.delete(url); }
  }
  SW.api = {
    json: (url, ttl) => raw(url, 'json', ttl == null ? 300 : ttl),
    text: (url, ttl) => raw(url, 'text', ttl == null ? 300 : ttl),
    clear: () => cache.clear(),
    log: () => feedLog
  };

  // ---------- units ----------
  const us = () => st.units === 'us';
  SW.U = {
    us,
    om: () => us() ? '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch' : '',
    t: () => us() ? '°F' : '°C', w: () => us() ? 'mph' : 'km/h', p: () => us() ? 'in' : 'mm', d: () => us() ? 'mi' : 'km', h: () => us() ? 'ft' : 'm',
    cT: c => c == null ? null : us() ? c * 9 / 5 + 32 : c,
    cW: k => k == null ? null : us() ? k * 0.621371 : k,          // km/h in
    cP: mm => mm == null ? null : us() ? mm / 25.4 : mm,
    cH: m => m == null ? null : us() ? m * 3.28084 : m,
    cD: km => km == null ? null : us() ? km * 0.621371 : km
  };

  // ---------- formatting ----------
  const dtf = {};
  SW.fmt = function fmt(ts, tz, kind) {
    const k = (tz || 'local') + kind;
    if (!dtf[k]) {
      const o = {
        time: { hour: 'numeric', minute: '2-digit' },
        hour: { hour: 'numeric' },
        day: { weekday: 'short' },
        date: { weekday: 'short', month: 'short', day: 'numeric' },
        full: { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
        fullz: { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }
      }[kind];
      try { dtf[k] = new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: tz || undefined }, o)); }
      catch (e) { dtf[k] = new Intl.DateTimeFormat('en-US', o); }
    }
    return dtf[k].format(new Date(ts * 1000));
  };
  SW.n = (v, d) => v == null || isNaN(v) ? '—' : Number(v).toFixed(d || 0);
  SW.compass = d => d == null ? '' : ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(d / 22.5) % 16];
  SW.dist = function dist(a, b, c, d) { // km
    const R = 6371, p = Math.PI / 180, x = Math.sin((c - a) * p / 2), y = Math.sin((d - b) * p / 2);
    return 2 * R * Math.asin(Math.sqrt(x * x + Math.cos(a * p) * Math.cos(c * p) * y * y));
  };
  const WX = {
    0: ['Clear', '☀️', '🌙'], 1: ['Mostly clear', '🌤️', '🌙'], 2: ['Partly cloudy', '⛅', '☁️'], 3: ['Overcast', '☁️', '☁️'],
    45: ['Fog', '🌫️'], 48: ['Freezing fog', '🌫️'], 51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
    56: ['Freezing drizzle', '🌧️'], 57: ['Freezing drizzle', '🌧️'], 61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
    66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'], 71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'], 77: ['Snow grains', '🌨️'],
    80: ['Light showers', '🌦️'], 81: ['Showers', '🌧️'], 82: ['Heavy showers', '⛈️'], 85: ['Snow showers', '🌨️'], 86: ['Heavy snow showers', '❄️'],
    95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm, hail', '⛈️'], 99: ['Severe thunderstorm, hail', '⛈️']
  };
  SW.wx = (code, night) => { const w = WX[code] || ['—', '·']; return { text: w[0], icon: night && w[2] ? w[2] : w[1] }; };

  SW.loading = (el, msg) => { el.innerHTML = '<div class="state"><span class="spin"></span>' + (msg || 'Loading…') + '</div>'; };
  SW.fail = function fail(el, e, retry) {
    el.innerHTML = '<div class="state err">Couldn’t load this right now (' + SW.esc(e && e.message || e) + '). <button class="btn ghost">Try again</button></div>';
    const b = $('button', el); if (b && retry) b.onclick = retry;
  };
  let toastT;
  SW.toast = function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 3500); };

  // ---------- charts (uPlot) ----------
  const charts = new Set();
  const ro = new ResizeObserver(function onResize(es) { for (const e of es) { const u = e.target._u; if (u) u.setSize({ width: e.target.clientWidth, height: e.target.clientHeight - (e.target._lg || 0) }); } });
  // series: [{label,color,width,fill,bars,dash,scale,show}], data: [x, y1, y2...] (x in unix seconds)
  SW.chart = function chart(host, o) {
    if (host._u) { host._u.destroy(); charts.delete(host._u); }
    host.innerHTML = '';
    const tz = o.tz, grid = { stroke: '#22304a', width: 1 }, tick = { stroke: '#22304a' };
    const axes = [{
      stroke: '#8b9ab3', grid, ticks: tick, space: 90,
      values: (u, vals) => { let last = ''; return vals.map(v => { const d = SW.fmt(v, tz, 'day'), h = SW.fmt(v, tz, 'hour'); const s = d !== last ? d + ' ' + h : h; last = d; return s; }); }
    }, { stroke: '#8b9ab3', grid, ticks: tick, size: 46, label: o.unit || '', labelSize: 16, font: '11px Segoe UI', labelFont: '11px Segoe UI' }];
    const scales = { x: { time: true }, y: o.yRange ? { range: o.yRange } : {} };
    if (o.y2) { axes.push({ scale: 'y2', side: 1, stroke: '#8b9ab3', grid: { show: false }, ticks: tick, size: 40, label: o.y2.unit || '', labelSize: 16, labelFont: '11px Segoe UI' }); scales.y2 = o.y2.range ? { range: o.y2.range } : {}; }
    const series = [{ value: (u, v) => v == null ? '' : SW.fmt(v, tz, 'full') }].concat(o.series.map(function mk(s) {
      const d = { label: s.label, stroke: s.color, width: s.width == null ? 2 : s.width, scale: s.scale || 'y', spanGaps: true, points: { show: false }, show: s.show !== false, value: (u, v) => v == null ? '—' : (+v.toFixed(s.dec == null ? 1 : s.dec)) };
      if (s.fill) d.fill = s.fill;
      if (s.dash) d.dash = s.dash;
      if (s.bars) { d.paths = uPlot.paths.bars({ size: [0.7, 40] }); d.fill = s.fill || s.color; d.width = 0; }
      return d;
    }));
    const legendH = o.legend === false ? 0 : (o.series.length > 3 ? 56 : 28);
    host._lg = legendH;
    const u = new uPlot({
      width: Math.max(200, host.clientWidth), height: Math.max(120, host.clientHeight - legendH),
      series, axes, scales, legend: { show: o.legend !== false, live: true },
      cursor: { drag: { x: true, y: false }, points: { size: 6 } },
      hooks: o.nowLine === false ? {} : {
        draw: [function nowLine(u) {
          const x = u.valToPos(Date.now() / 1000, 'x', true); if (x < u.bbox.left || x > u.bbox.left + u.bbox.width) return;
          const c = u.ctx; c.save(); c.strokeStyle = '#ffffff55'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(x, u.bbox.top); c.lineTo(x, u.bbox.top + u.bbox.height); c.stroke(); c.restore();
        }]
      }
    }, o.data, host);
    host._u = u; charts.add(u); ro.observe(host);
    return u;
  };

  // generic point->Open-Meteo url
  SW.omUrl = function omUrl(base, loc, q) {
    return base + '?latitude=' + loc.lat.toFixed(4) + '&longitude=' + loc.lon.toFixed(4) + '&timeformat=unixtime&timezone=auto' + q;
  };
  // NWS point metadata (office, grid, zone). US only; rejects elsewhere.
  SW.nwsPoint = loc => SW.api.json('https://api.weather.gov/points/' + loc.lat.toFixed(4) + ',' + loc.lon.toFixed(4), 86400).then(j => j.properties);
})();

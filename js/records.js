// Skywatch records: record highs, lows and rain for the place, from a real long-running weather station near it
// (NOAA co-op stations through the ACIS archive), with a reconstruction for the exact spot (1940 on) beside it.
// Measured numbers and estimates are always labeled as such.
(function recordsMod() {
  const { api, U, n, esc } = SW;
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const cache = new Map();
  const km = (loc, ll) => { const r = Math.PI / 180, q = Math.sin((ll[1] - loc.lat) * r / 2) ** 2 + Math.cos(loc.lat * r) * Math.cos(ll[1] * r) * Math.sin((ll[0] - loc.lon) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(q)); };
  const ymd = d => d.toISOString().slice(0, 10);
  const acis = (kind, p, ttl) => api.json('https://data.rcc-acis.org/' + kind + '?params=' + encodeURIComponent(JSON.stringify(p)), ttl);

  // rows: [date 'YYYY-MM-DD', high °F, low °F, rain inches (null when unknown), rain is a single day (true) or a multi-day total]
  async function spot(loc) {
    const end = new Date(Date.now() - 6 * 864e5);
    const j = await api.json('https://archive-api.open-meteo.com/v1/archive?latitude=' + loc.lat.toFixed(4) + '&longitude=' + loc.lon.toFixed(4) + '&start_date=1940-01-01&end_date=' + ymd(end) + '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto', 7 * 86400);
    const d = j.daily, rows = [];
    for (let i = 0; i < d.time.length; i++) { const hi = d.temperature_2m_max[i], lo = d.temperature_2m_min[i]; if (hi == null || lo == null) continue; rows.push([d.time[i], hi * 9 / 5 + 32, lo * 9 / 5 + 32, d.precipitation_sum[i] == null ? null : d.precipitation_sum[i] / 25.4, true]); }
    return { rows, elev: j.elevation, name: 'Your exact spot', since: rows.length ? +rows[0][0].slice(0, 4) : null, est: true };
  }

  async function station(loc, elevM) {
    const m = await acis('StnMeta', { bbox: [loc.lon - 0.45, loc.lat - 0.35, loc.lon + 0.45, loc.lat + 0.35].map(v => v.toFixed(3)).join(','), elems: 'maxt,mint', meta: 'name,sids,ll,valid_daterange,elev' }, 7 * 86400);
    const recent = ymd(new Date(Date.now() - 400 * 864e5)), old = ymd(new Date(Date.now() - 30 * 365.25 * 864e5));
    const c = (m.meta || []).filter(s => s.ll && s.valid_daterange && s.valid_daterange[0] && s.valid_daterange[0].length && s.valid_daterange[0][1] >= recent && s.valid_daterange[0][0] <= old && (elevM == null || s.elev == null || Math.abs(s.elev * 0.3048 - elevM) < 300))
      .map(s => Object.assign({ km: km(loc, s.ll) }, s)).filter(s => s.km <= 40).sort((a, b) => a.km - b.km)[0];
    if (!c) return null;
    const d = await acis('StnData', { sid: c.sids[0], sdate: 'por', edate: 'por', elems: 'maxt,mint,pcpn' }, 86400), rows = [], D = d.data || [];
    // Quality checks, so a typo or a gap never becomes a record: a reading right after missing days holds the extremes of
    // several days, a day with high = low is a blank page filled with zeros, and a single day far from both neighbors is a slip.
    const tv = i => { const r = D[i]; if (!r) return null; const hi = parseFloat(r[1]), lo = parseFloat(r[2]); return isFinite(hi) && isFinite(lo) && hi !== lo ? [hi, lo] : null; };
    for (let i = 0; i < D.length; i++) {
      const r = D[i], p = r[3], pr = p === 'T' ? 0 : /^[\d.]+A?$/.test(p) ? parseFloat(p) : null, single = pr != null && !/A$/.test(p);
      let t = tv(i); const a = tv(i - 1), b = tv(i + 1);
      if (t && (t[0] > 135 || t[1] < -70 || t[1] > t[0] || !a)) t = null;
      if (t && a && b && ((Math.abs(t[0] - a[0]) > 30 && Math.abs(t[0] - b[0]) > 30) || (Math.abs(t[1] - a[1]) > 30 && Math.abs(t[1] - b[1]) > 30))) t = null;
      // rain counts only on days the thermometer was read too: blank pages and lumped totals hide on the other days
      if (t) rows.push([r[0], t[0], t[1], pr, single]);
    }
    // a temperature far outside what this station sees in that month (over 4.5 spreads) is a slip of the pen,
    // e.g. the zeros this station has been logging lately; a real 0° in Minnesota stays because its spread allows it
    const st = {}; for (const r of rows) { const m = r[0].slice(5, 7), s = st[m] || (st[m] = [0, 0, 0, 0, 0]); s[0]++; s[1] += r[1]; s[2] += r[1] * r[1]; s[3] += r[2]; s[4] += r[2] * r[2]; }
    const z = (r, k) => { const s = st[r[0].slice(5, 7)], mu = s[k] / s[0], sd = Math.sqrt(Math.max(1, s[k + 1] / s[0] - mu * mu)); return Math.abs(r[k === 1 ? 1 : 2] - mu) / sd; };
    for (let i = rows.length - 1; i >= 0; i--) if (z(rows[i], 1) > 4.5 || z(rows[i], 3) > 4.5) rows.splice(i, 1);
    const nice = c.name.replace(/\b\w+/g, w => /^[NSEW]{1,3}$/.test(w) ? w : w[0] + w.slice(1).toLowerCase());
    const first = rows.find(r => r[1] != null);
    return { rows, name: nice, km: c.km, since: first ? +first[0].slice(0, 4) : null, est: false };
  }

  async function load(loc) {
    const key = loc.lat.toFixed(3) + ',' + loc.lon.toFixed(3);
    if (!cache.has(key)) {
      const p = (async function both() {
        const el = await api.json('https://api.open-meteo.com/v1/elevation?latitude=' + loc.lat.toFixed(4) + '&longitude=' + loc.lon.toFixed(4), 30 * 86400).then(j => j.elevation[0]).catch(() => null);
        const st = await station(loc, el).catch(() => null);
        // measured records when a real station is near; the reconstruction only stands in where there is none
        if (st && st.rows.filter(r => r[1] != null).length > 3650) return [index(st)];
        const s = await spot(loc); return [index(s)];
      })();
      cache.set(key, p); p.catch(() => cache.delete(key));
    }
    return cache.get(key);
  }

  // per-source summaries: by calendar day, by month, all time
  function index(src) {
    const day = {}, mon = {}, yr = {}, all = { hi: null, lo: null, wet: null };
    const up = (o, k, v, date, dir) => { if (v == null) return; if (!o[k] || dir * (v - o[k].v) >= 0) o[k] = { v, date }; };
    for (const r of src.rows) {
      const [date, hi, lo, pr, single] = r, md = date.slice(5), y = +date.slice(0, 4), mo = +date.slice(5, 7) - 1;
      const D = day[md] || (day[md] = {}); up(D, 'hi', hi, date, 1); up(D, 'lo', lo, date, -1); if (single) up(D, 'wet', pr, date, 1);
      const M = mon[mo] || (mon[mo] = { tot: {} }); up(M, 'hi', hi, date, 1); up(M, 'lo', lo, date, -1); if (single) up(M, 'wet', pr, date, 1);
      const t = M.tot[y] || (M.tot[y] = { p: 0, n: 0, days: 0 }); t.days++; if (pr != null) { t.p += pr; t.n++; }
      const Y = yr[y] || (yr[y] = { p: 0, n: 0 }); if (pr != null) { Y.p += pr; Y.n++; }
      up(all, 'hi', hi, date, 1); up(all, 'lo', lo, date, -1); if (single) up(all, 'wet', pr, date, 1);
    }
    // whole months and years only, so a month with missing pages is never called the driest
    for (const k in mon) { const M = mon[k], dim = mo => new Date(2001, +k + 1, 0).getDate(); let wet = null, dry = null;
      for (const y in M.tot) { const t = M.tot[y]; if (t.n < dim() * 0.9) continue; if (!wet || t.p >= wet.v) wet = { v: t.p, y }; if (!dry || t.p <= dry.v) dry = { v: t.p, y }; }
      M.wetMon = wet; M.dryMon = dry; }
    let wetY = null, dryY = null; const thisY = new Date().getFullYear();
    for (const y in yr) { if (+y === thisY || yr[y].n < 347) continue; if (!wetY || yr[y].p >= wetY.v) wetY = { v: yr[y].p, y }; if (!dryY || yr[y].p <= dryY.v) dryY = { v: yr[y].p, y }; }
    all.wetY = wetY; all.dryY = dryY;
    return Object.assign({}, src, { day, mon, all, rowsRef: src.rows });
  }

  // the 1991-2020 normal for a date: average over the 30 years and the 7 days around it
  function normal(src, md) {
    const t0 = Date.UTC(2001, +md.slice(0, 2) - 1, Math.min(+md.slice(3), 28));
    let h = 0, l = 0, c = 0;
    for (const r of src.rowsRef) { const y = +r[0].slice(0, 4); if (r[1] == null || y < 1991 || y > 2020) continue; const t = Date.UTC(2001, +r[0].slice(5, 7) - 1, +r[0].slice(8)); let dd = Math.abs(t - t0) / 864e5; dd = Math.min(dd, 365 - dd); if (dd > 3) continue; h += r[1]; l += r[2]; c++; }
    return c > 50 ? { hi: h / c, lo: l / c } : null;
  }

  const T = f => f == null ? '—' : n(U.us() ? f : (f - 32) * 5 / 9) + '°';
  const P = i => i == null ? '—' : n(U.us() ? i : i * 25.4, U.us() ? 2 : 1) + ' ' + U.p();
  const yrOf = o => o ? ' <span class="dim">(' + o.date.slice(0, 4) + ')</span>' : '';
  const dateOf = o => o ? ' <span class="dim">(' + MON[+o.date.slice(5, 7) - 1].slice(0, 3) + ' ' + (+o.date.slice(8)) + ', ' + o.date.slice(0, 4) + ')</span>' : '';

  // the History page card: records for the chosen day, its month and all time, one column per source
  function card(srcs, iso) {
    if (!srcs.length) return '<div class="state">No long weather record was found for this place.</div>';
    const md = iso.slice(5), mo = +iso.slice(5, 7) - 1, label = MON[mo] + ' ' + (+iso.slice(8));
    const head = '<tr><th></th>' + srcs.map(s => '<th>' + esc(s.name) + '<div class="dim small" style="font-weight:400;text-transform:none;letter-spacing:0">' + (s.est ? 'estimate, since ' + s.since : 'measured since ' + s.since + (s.km != null ? ', ' + (U.us() ? n(s.km / 1.609) + ' mi' : n(s.km) + ' km') + ' away' : '')) + '</div></th>').join('') + '</tr>';
    const row = (k, f) => '<tr><td>' + k + '</td>' + srcs.map(s => '<td>' + f(s) + '</td>').join('') + '</tr>';
    const sec = t => '<tr><td colspan="' + (srcs.length + 1) + '" class="rec-sec">' + t + '</td></tr>';
    const nm = s => s.nCache && s.nCache[md] !== undefined ? s.nCache[md] : ((s.nCache = s.nCache || {})[md] = normal(s, md));
    return '<table class="rec">' + head +
      sec('On ' + label) +
      row('Normal high / low', s => { const v = nm(s); return v ? T(v.hi) + ' / ' + T(v.lo) : '—'; }) +
      row('Record high', s => T(s.day[md] && s.day[md].hi && s.day[md].hi.v) + yrOf(s.day[md] && s.day[md].hi)) +
      row('Record low', s => T(s.day[md] && s.day[md].lo && s.day[md].lo.v) + yrOf(s.day[md] && s.day[md].lo)) +
      row('Most rain', s => P(s.day[md] && s.day[md].wet && s.day[md].wet.v) + yrOf(s.day[md] && s.day[md].wet)) +
      sec('Any ' + MON[mo]) +
      row('Hottest', s => T(s.mon[mo] && s.mon[mo].hi.v) + dateOf(s.mon[mo] && s.mon[mo].hi)) +
      row('Coldest', s => T(s.mon[mo] && s.mon[mo].lo.v) + dateOf(s.mon[mo] && s.mon[mo].lo)) +
      row('Wettest day', s => P(s.mon[mo] && s.mon[mo].wet && s.mon[mo].wet.v) + dateOf(s.mon[mo] && s.mon[mo].wet)) +
      row('Wettest ' + MON[mo], s => s.mon[mo] && s.mon[mo].wetMon ? P(s.mon[mo].wetMon.v) + ' <span class="dim">(' + s.mon[mo].wetMon.y + ')</span>' : '—') +
      row('Driest ' + MON[mo], s => s.mon[mo] && s.mon[mo].dryMon ? P(s.mon[mo].dryMon.v) + ' <span class="dim">(' + s.mon[mo].dryMon.y + ')</span>' : '—') +
      sec('All time') +
      row('Hottest', s => T(s.all.hi && s.all.hi.v) + dateOf(s.all.hi)) +
      row('Coldest', s => T(s.all.lo && s.all.lo.v) + dateOf(s.all.lo)) +
      row('Wettest day', s => P(s.all.wet && s.all.wet.v) + dateOf(s.all.wet)) +
      row('Wettest year', s => s.all.wetY ? P(s.all.wetY.v) + ' <span class="dim">(' + s.all.wetY.y + ')</span>' : '—') +
      row('Driest year', s => s.all.dryY ? P(s.all.dryY.v) + ' <span class="dim">(' + s.all.dryY.y + ')</span>' : '—') +
      '</table><div class="dim small" style="margin-top:8px;line-height:1.5">' +
      (srcs.some(s => !s.est) ? 'These are real thermometer and rain gauge readings from an official NOAA weather station, checked for gaps and typos.' : 'There is no long-running weather station close by, so these come from a computer reconstruction of the weather at your spot. It can be several degrees off on any one day, so treat them as a rough guide, not real records.') + '</div>';
  }

  SW.records = { load, card, normal };
})();

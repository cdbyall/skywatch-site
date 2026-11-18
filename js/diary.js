// Skywatch diary: the app keeps its own record of each day's real readings (high, low, strongest gust, and when) from the
// nearest suitable weather station, so the History page can show measured days instead of estimates. The Weather Service
// keeps about a week of a station's readings, so each visit fills in the days missed since the last one.
// A station counts as suitable only if it is close (about 9 miles) and at about the same height as the place.
(function diaryMod() {
  const { api } = SW, H = { Accept: 'application/geo+json' };
  const KEY = l => 'sw-diary-' + l.lat.toFixed(3) + ',' + l.lon.toFixed(3);
  const read = l => { try { return JSON.parse(localStorage.getItem(KEY(l)) || 'null'); } catch (e) { return null; } };
  const write = (l, d) => { try { localStorage.setItem(KEY(l), JSON.stringify(d)); } catch (e) { } };
  const km = (l, c) => { const r = Math.PI / 180, q = Math.sin((c[1] - l.lat) * r / 2) ** 2 + Math.cos(l.lat * r) * Math.cos(c[1] * r) * Math.sin((c[0] - l.lon) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(q)); };
  const busy = new Map();

  // the nearest station that reads like the place: within 15 km and 150 m of height, and reporting lately
  async function pick(l) {
    const p = await SW.nwsPoint(l), state = p.relativeLocation && p.relativeLocation.properties.state; if (!state) return null;
    const el = await api.json('https://api.open-meteo.com/v1/elevation?latitude=' + l.lat.toFixed(4) + '&longitude=' + l.lon.toFixed(4), 30 * 86400).then(j => j.elevation[0]).catch(() => null);
    const near = [], seen = new Set(), add = f => { const id = f.properties.stationIdentifier; if (seen.has(id) || !f.geometry) return; seen.add(id); const d = km(l, f.geometry.coordinates), e = f.properties.elevation && f.properties.elevation.value; if (d <= 15 && (el == null || e == null || Math.abs(e - el) <= 150)) near.push({ id, name: f.properties.name, km: d, elev: e, tz: f.properties.timeZone }); };
    try { (await api.json(p.observationStations, 86400)).features.forEach(add); } catch (e) { }
    let url = 'https://api.weather.gov/stations?state=' + state + '&limit=500';
    for (let k = 0; k < 20 && url; k++) { const j = await api.json(url, 7 * 86400); (j.features || []).forEach(add); if (!(j.features || []).length) break; url = j.pagination && j.pagination.next; }
    near.sort((a, b) => a.km - b.km);
    for (const s of near.slice(0, 5)) { // must be reporting: a station that went quiet is no use
      try { const o = await api.json('https://api.weather.gov/stations/' + s.id + '/observations/latest', 600); const t = Date.parse(o.properties.timestamp); if (Date.now() - t < 6 * 3600e3 && o.properties.temperature && o.properties.temperature.value != null) return s; } catch (e) { }
    }
    return null;
  }

  // fold readings into days (the station's own time zone): high and low with their times, strongest gust, hours covered
  function fold(d, feats, tz) {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false });
    for (const f of feats) {
      const q = f.properties, t = q.temperature && q.temperature.value; if (t == null || q.temperature.qualityControl === 'X') continue;
      const ts = Date.parse(q.timestamp), parts = fmt.formatToParts(new Date(ts)), g = k => parts.find(x => x.type === k).value, day = g('year') + '-' + g('month') + '-' + g('day'), hr = +g('hour') % 24;
      const D = d.days[day] || (d.days[day] = { hi: null, lo: null, hiAt: 0, loAt: 0, gust: null, hrs: 0, hm: 0 });
      const F = t * 9 / 5 + 32; if (D.hi == null || F > D.hi) { D.hi = F; D.hiAt = ts / 1000; } if (D.lo == null || F < D.lo) { D.lo = F; D.loAt = ts / 1000; }
      const gu = q.windGust && q.windGust.value; if (gu != null && (D.gust == null || gu * 0.621371 > D.gust)) D.gust = gu * 0.621371; // km/h to mph
      if (!(D.hm & (1 << hr))) { D.hm |= 1 << hr; D.hrs++; }
    }
  }

  // bring the diary up to date for a place; safe to call often
  async function update(l) {
    const k = KEY(l); if (busy.has(k)) return busy.get(k);
    const job = (async function run() {
      let d = read(l);
      if (!d || !d.stn || Date.now() - (d.pickedAt || 0) > 30 * 864e5) { const s = await pick(l); if (!s) { if (d) { d.pickedAt = Date.now(); write(l, d); } return d; } if (!d || !d.stn || d.stn.id !== s.id) d = { stn: s, days: {}, upto: 0 }; d.stn = s; d.pickedAt = Date.now(); }
      if (Date.now() - (d.fetchedAt || 0) < 50 * 60e3) return d;
      // the whole week the Weather Service still holds, folded fresh; for each day keep whichever copy covers more hours
      const from = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 19) + 'Z';
      let url = 'https://api.weather.gov/stations/' + d.stn.id + '/observations?start=' + from + '&limit=500', feats = [];
      for (let k2 = 0; k2 < 12 && url; k2++) { const r = await SW.fetch(url, { headers: H }); if (!r.ok) break; const j = await r.json(); feats = feats.concat(j.features || []); if (!(j.features || []).length) break; url = j.pagination && j.pagination.next; }
      const fresh = { days: {} }; fold(fresh, feats, d.stn.tz);
      for (const t in fresh.days) if (!d.days[t] || fresh.days[t].hrs >= d.days[t].hrs) d.days[t] = fresh.days[t];
      const last = feats.reduce((m, f) => Math.max(m, Date.parse(f.properties.timestamp)), 0); if (last) d.upto = Math.max(d.upto || 0, last);
      d.fetchedAt = Date.now(); write(l, d); return d;
    })();
    busy.set(k, job); job.finally(() => busy.delete(k)).catch(() => { });
    return job;
  }

  // a day counts as measured when the station reported in at least 20 of its 24 hours
  const full = D => D && D.hrs >= 20 && D.hi != null;
  SW.diary = { update, read, full };
  // keep it filling in while the app is open: on start and every hour
  function tick() { const l = SW.loc(); if (l) update(l).catch(() => { }); }
  setTimeout(tick, 4000); setInterval(tick, 3600e3);
  if (SW.on) SW.on('loc', tick);
})();

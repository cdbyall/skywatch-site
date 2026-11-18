// Skywatch sounding: Skew-T log-P and hodograph from model pressure-level data.
(function soundingMod() {
  const { $, api, U, n, esc } = SW;
  const LV = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200, 150, 100];
  const MODELS = [['gfs_seamless', 'GFS'], ['ncep_hrrr_conus', 'HRRR (US)'], ['ecmwf_ifs025', 'ECMWF'], ['icon_seamless', 'ICON'], ['gem_seamless', 'GEM']];
  let model = 'gfs_seamless', d = null, hour = 0;

  // thermodynamics (T in C, p in hPa)
  const es = T => 6.112 * Math.exp(17.67 * T / (T + 243.5));
  const wsat = (T, p) => 0.622 * es(T) / Math.max(1, p - es(T));
  const Rd = 287.04, cp = 1005.7, Lv = 2.501e6, K = Rd / cp;
  function moistStep(T, p, dp) { // T in C at p -> T at p+dp along a moist adiabat
    const Tk = T + 273.15, w = wsat(T, p);
    const g = (Rd * Tk + Lv * w) / (p * (cp + Lv * Lv * w * 0.622 / (Rd * Tk * Tk)));
    return T + g * dp;
  }
  function moistTo(T, p0, p1) { const s = p1 < p0 ? -5 : 5; let p = p0; while ((s < 0 && p > p1) || (s > 0 && p < p1)) { const st = Math.abs(p1 - p) < 5 ? p1 - p : s; T = moistStep(T, p, st); p += st; } return T; }
  const dryTo = (T, p0, p1) => (T + 273.15) * Math.pow(p1 / p0, K) - 273.15;
  function lcl(T, Td, p) { const Tk = T + 273.15, Tdk = Td + 273.15, Tl = 1 / (1 / (Tdk - 56) + Math.log(Tk / Tdk) / 800) + 56; return { T: Tl - 273.15, p: p * Math.pow(Tl / Tk, 1 / K) }; }

  async function load() {
    const root = $('#v-sounding'), loc = SW.loc(); if (!loc) return;
    root.innerHTML = '<div class="head"><h1>Sounding</h1><span class="dim">' + esc(loc.name) + ' · the air from the ground up to about 10 miles</span><div class="spacer"></div><select id="sdModel">' + MODELS.map(m => '<option value="' + m[0] + '">' + m[1] + '</option>').join('') + '</select></div>' +
      '<div class="snd"><div class="card"><div class="row" style="margin-bottom:8px"><input type="range" id="sdHour" min="0" max="71" value="0"><b id="sdTime" style="white-space:nowrap;min-width:190px;text-align:right"></b></div><canvas id="skewt"></canvas></div>' +
      '<div class="grid" style="align-content:start"><div class="card"><h2>Wind with height (hodograph)</h2><canvas id="hodo"></canvas></div><div class="card"><h2>Key numbers</h2><div class="idx" id="sdIdx"></div></div>' +
      '<div class="card small dim">Red line: temperature. Green line: dew point (moisture). When they touch, there is cloud. Dashed white: the path a rising bubble of surface air would take; where it is warmer than the red line, storms can grow. Temperatures here are always in °C and winds in knots, the way forecasters read them.</div></div></div>';
    $('#sdModel').value = model;
    $('#sdModel').onchange = e => { model = e.target.value; load(); };
    $('#sdHour').oninput = e => { hour = +e.target.value; draw(); };
    const cv = $('#skewt'), c = cv.getContext('2d'); cv.width = 900; cv.height = 900; c.fillStyle = '#8b9ab3'; c.font = '20px Segoe UI'; c.fillText('Loading upper-air data…', 40, 60);
    try {
      const vars = ['temperature_2m', 'dew_point_2m', 'surface_pressure', 'cape', 'convective_inhibition', 'lifted_index', 'freezing_level_height', 'wind_speed_10m', 'wind_direction_10m'];
      LV.forEach(p => vars.push('temperature_' + p + 'hPa', 'dew_point_' + p + 'hPa', 'wind_speed_' + p + 'hPa', 'wind_direction_' + p + 'hPa', 'geopotential_height_' + p + 'hPa'));
      d = await api.json(SW.omUrl('https://api.open-meteo.com/v1/forecast', loc, '&hourly=' + vars.join(',') + '&forecast_days=3&wind_speed_unit=kn&models=' + model), 1800);
      if (!d.hourly.temperature_500hPa || !d.hourly.temperature_500hPa.some(x => x != null)) throw new Error('this model has no upper-air data here; try GFS');
      const now = Date.now() / 1000; hour = Math.max(0, d.hourly.time.findIndex(t => t >= now - 1800));
      $('#sdHour').max = d.hourly.time.length - 1; $('#sdHour').value = hour; draw();
    } catch (e) { c.clearRect(0, 0, 900, 900); c.fillStyle = '#ffb020'; c.fillText('Couldn’t load: ' + e.message, 40, 60); }
  }

  function profile() {
    const h = d.hourly, i = hour, sp = h.surface_pressure[i] || 1013, out = [];
    out.push({ p: sp, T: h.temperature_2m[i], Td: h.dew_point_2m[i], ws: h.wind_speed_10m[i], wd: h.wind_direction_10m[i], z: d.elevation || 0 });
    LV.forEach(function lv(p) {
      const T = h['temperature_' + p + 'hPa'][i]; if (p >= sp - 2 || T == null) return;
      out.push({ p, T, Td: h['dew_point_' + p + 'hPa'][i], ws: h['wind_speed_' + p + 'hPa'][i], wd: h['wind_direction_' + p + 'hPa'][i], z: h['geopotential_height_' + p + 'hPa'][i] });
    });
    return out.filter(l => l.T != null);
  }

  function draw() {
    if (!d) return;
    const pr = profile(), h = d.hourly, i = hour;
    $('#sdTime').textContent = SW.fmt(h.time[i], d.timezone, 'full');
    const cv = $('#skewt'), c = cv.getContext('2d'), W = 900, H = 900, L = 60, Rr = 110, T0 = 40, B = 50, PW = W - L - Rr, PH = H - T0 - B;
    const PB = 1050, PT = 100, TL = -40, TR = 50, SK = 0.9;
    const Y = p => T0 + PH * Math.log(p / PT) / Math.log(PB / PT);
    const X = (T, p) => L + PW * (T - TL) / (TR - TL) + SK * (H - B - Y(p));
    c.clearRect(0, 0, W, H); c.fillStyle = '#0c1220'; c.fillRect(L, T0, PW, PH);
    c.save(); c.beginPath(); c.rect(L, T0, PW, PH); c.clip();
    c.lineWidth = 1;
    for (let T = -120; T <= 50; T += 10) { c.strokeStyle = T === 0 ? '#4aa3ff' : '#22304a'; c.beginPath(); c.moveTo(X(T, PB), Y(PB)); c.lineTo(X(T, PT), Y(PT)); c.stroke(); }
    c.strokeStyle = '#5a3a2a'; // dry adiabats
    for (let th = -30; th <= 170; th += 20) { c.beginPath(); for (let p = PB; p >= PT; p -= 25) { const T = dryTo(th, 1000, p), x = X(T, p), y = Y(p); p === PB ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); }
    c.strokeStyle = '#234a3a'; // moist adiabats
    for (let t0 = -10; t0 <= 34; t0 += 6) { let T = t0; c.beginPath(); c.moveTo(X(T, 1000), Y(1000)); for (let p = 1000; p > 200; p -= 10) { T = moistStep(T, p, -10); c.lineTo(X(T, p - 10), Y(p - 10)); } c.stroke(); }
    c.strokeStyle = '#3a3a6a'; c.setLineDash([3, 6]); // mixing ratio
    [1, 2, 4, 8, 12, 20].forEach(function mix(w) { c.beginPath(); for (let p = PB; p >= 600; p -= 50) { const e = w / 1000 * p / (0.622 + w / 1000), lnv = Math.log(e / 6.112), T = 243.5 * lnv / (17.67 - lnv); p === PB ? c.moveTo(X(T, p), Y(p)) : c.lineTo(X(T, p), Y(p)); } c.stroke(); });
    c.setLineDash([]);
    const line = (key, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); let first = true; pr.forEach(l => { if (l[key] == null) return; const x = X(l[key], l.p), y = Y(l.p); first ? c.moveTo(x, y) : c.lineTo(x, y); first = false; }); c.stroke(); };
    // parcel
    const s = pr[0]; let lc = null, capeArea = [];
    if (s && s.Td != null) {
      lc = lcl(s.T, Math.min(s.Td, s.T), s.p);
      c.strokeStyle = '#ffffffcc'; c.lineWidth = 1.6; c.setLineDash([7, 5]); c.beginPath(); c.moveTo(X(s.T, s.p), Y(s.p)); c.lineTo(X(lc.T, lc.p), Y(lc.p));
      let T = lc.T, p = lc.p; while (p > 110) { const np = Math.max(110, p - 10); T = moistStep(T, p, np - p); p = np; c.lineTo(X(T, p), Y(p)); capeArea.push([p, T]); }
      c.stroke(); c.setLineDash([]);
    }
    line('Td', '#3ddc97', 3); line('T', '#ff5a5a', 3);
    c.restore();
    // axes
    c.strokeStyle = '#25314a'; c.strokeRect(L, T0, PW, PH); c.fillStyle = '#8b9ab3'; c.font = '15px Segoe UI'; c.textAlign = 'right'; c.textBaseline = 'middle';
    [1000, 850, 700, 500, 400, 300, 250, 200, 150, 100].forEach(p => { const y = Y(p); c.fillText(p, L - 8, y); c.strokeStyle = '#22304a'; c.beginPath(); c.moveTo(L, y); c.lineTo(L + PW, y); c.stroke(); });
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (let T = TL; T <= TR; T += 10) c.fillText(T + '°', X(T, PB), H - B + 8);
    c.fillText('hPa', L - 28, T0 - 26); c.fillText('°C', L + PW + 20, H - B + 8);
    // wind barbs
    const bx = L + PW + 55; c.strokeStyle = '#e6edf7'; c.lineWidth = 1.6;
    pr.forEach(function barb(l) {
      if (l.ws == null || l.wd == null) return;
      const y = Y(l.p), a = (l.wd - 90) * Math.PI / 180, len = 34, ex = bx + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      c.beginPath(); c.arc(bx, y, 2.5, 0, 7); c.stroke();
      if (l.ws < 2.5) return;
      c.beginPath(); c.moveTo(bx, y); c.lineTo(ex, ey); c.stroke();
      let k = Math.round(l.ws / 5) * 5, pos = 0; const nx = Math.cos(a + Math.PI / 2.6), ny = Math.sin(a + Math.PI / 2.6);
      const at = f => [ex - Math.cos(a) * len * f, ey - Math.sin(a) * len * f];
      while (k >= 50) { const p1 = at(pos), p2 = at(pos + 0.16); c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p1[0] + nx * 14, p1[1] + ny * 14); c.lineTo(p2[0], p2[1]); c.closePath(); c.fillStyle = '#e6edf7'; c.fill(); k -= 50; pos += 0.2; }
      while (k >= 10) { const p1 = at(pos); c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p1[0] + nx * 14, p1[1] + ny * 14); c.stroke(); k -= 10; pos += 0.13; }
      if (k >= 5) { const p1 = at(pos || 0.13); c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p1[0] + nx * 7, p1[1] + ny * 7); c.stroke(); }
    });

    hodo(pr);
    // indices
    const at = P => pr.find(l => l.p === P), uv = l => { const a = l.wd * Math.PI / 180; return [-l.ws * Math.sin(a), -l.ws * Math.cos(a)]; };
    const zAgl = l => l.z - pr[0].z;
    let sh6 = null, top6 = null; pr.forEach(l => { if (l.ws != null && zAgl(l) <= 6500) top6 = l; });
    if (top6 && pr[0].ws != null) { const a = uv(pr[0]), b = uv(top6); sh6 = Math.hypot(b[0] - a[0], b[1] - a[1]); }
    const l7 = at(700), l5 = at(500), lr = l7 && l5 ? (l7.T - l5.T) / ((l5.z - l7.z) / 1000) : null;
    let pw = 0; for (let k = 0; k < pr.length - 1; k++) { const a = pr[k], b = pr[k + 1]; if (a.Td == null || b.Td == null) continue; pw += (wsat(a.Td, a.p) + wsat(b.Td, b.p)) / 2 * (a.p - b.p) * 100 / 9.81; }
    const fz = h.freezing_level_height[i], item = (k, v) => '<div><span>' + k + '</span><b>' + v + '</b></div>';
    $('#sdIdx').innerHTML =
      item('Storm energy (CAPE)', n(h.cape[i]) + ' J/kg') + item('Cap (CIN)', n(h.convective_inhibition[i]) + ' J/kg') +
      item('Lifted index', n(h.lifted_index[i], 1)) + item('Cloud base (LCL)', lc ? n(lc.p) + ' hPa' : '—') +
      item('Wind shear 0–6 km', sh6 == null ? '—' : n(sh6) + ' kt') + item('Lapse rate 700–500', lr == null ? '—' : n(lr, 1) + ' °C/km') +
      item('Water in the air', n(U.us() ? pw / 25.4 : pw, U.us() ? 2 : 0) + ' ' + U.p()) + item('Freezing level', fz == null ? '—' : n(U.cH(fz), 0) + ' ' + U.h());
  }

  function hodo(pr) {
    const cv = $('#hodo'), c = cv.getContext('2d'), S = 600; cv.width = cv.height = S; c.clearRect(0, 0, S, S);
    const pts = pr.filter(l => l.ws != null && l.wd != null && l.p >= 200).map(l => { const a = l.wd * Math.PI / 180; return { u: -l.ws * Math.sin(a), v: -l.ws * Math.cos(a), z: l.z - pr[0].z }; });
    const max = Math.max(40, ...pts.map(p => Math.hypot(p.u, p.v))) * 1.1, sc = (S / 2 - 20) / max, cx = S / 2, cy = S / 2;
    c.strokeStyle = '#22304a'; c.fillStyle = '#8b9ab3'; c.font = '15px Segoe UI';
    for (let r = 20; r < max; r += 20) { c.beginPath(); c.arc(cx, cy, r * sc, 0, 7); c.stroke(); c.fillText(r + ' kt', cx + 4, cy - r * sc - 4); }
    c.beginPath(); c.moveTo(20, cy); c.lineTo(S - 20, cy); c.moveTo(cx, 20); c.lineTo(cx, S - 20); c.stroke();
    const col = z => z < 1000 ? '#ff5a8a' : z < 3000 ? '#ff5a5a' : z < 6000 ? '#3ddc97' : z < 9000 ? '#ffe44a' : '#3fc6ff';
    c.lineWidth = 4; c.lineCap = 'round';
    for (let k = 0; k < pts.length - 1; k++) { const a = pts[k], b = pts[k + 1]; c.strokeStyle = col(b.z); c.beginPath(); c.moveTo(cx + a.u * sc, cy - a.v * sc); c.lineTo(cx + b.u * sc, cy - b.v * sc); c.stroke(); }
    c.lineWidth = 1; c.font = '14px Segoe UI'; let x = 16;
    [['0–1 km', '#ff5a8a'], ['1–3', '#ff5a5a'], ['3–6', '#3ddc97'], ['6–9', '#ffe44a'], ['9+', '#3fc6ff']].forEach(function key(k) { c.fillStyle = k[1]; c.fillRect(x, S - 24, 14, 14); c.fillStyle = '#8b9ab3'; c.fillText(k[0], x + 19, S - 12); x += 34 + c.measureText(k[0]).width; });
  }
  SW.sounding = { load };
  void moistTo;
})();

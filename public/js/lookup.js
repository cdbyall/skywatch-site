// Skywatch Look Up: what you would see overhead now, tonight's stargazing, and a sky chart for any hour.
(function lookupMod() {
  const { $, api, n, esc } = SW, A = SWastro;
  let sky = null, wx = null, tSel = 0, t0 = 0, showClouds = true, showLines = true, objs = [];

  const cloudWord = c => c < 12 ? 'clear' : c < 35 ? 'mostly clear' : c < 65 ? 'partly cloudy' : c < 88 ? 'mostly cloudy' : 'overcast';
  const hi = alt => alt > 60 ? 'high overhead' : alt > 30 ? 'about halfway up' : alt > 10 ? 'low' : 'just above the horizon';
  function at(key, t) { // hourly forecast value nearest a time
    const h = wx.hourly; let i = Math.round((t - h.time[0]) / 3600); i = Math.max(0, Math.min(h.time.length - 1, i)); return h[key][i];
  }

  async function load() {
    const root = $('#v-lookup'), loc = SW.loc(); if (!loc) return;
    root.innerHTML = '<div class="head"><h1>Look up</h1><span class="dim">' + esc(loc.name) + ' · what is over your head</span></div><div class="grid" id="luBody"></div>';
    const body = $('#luBody'); SW.loading(body, 'Looking up…');
    try {
      [wx, sky] = await Promise.all([
        api.json(SW.omUrl('https://api.open-meteo.com/v1/forecast', loc, '&current=cloud_cover,weather_code,is_day,precipitation,visibility&hourly=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,precipitation_probability,visibility,cape&forecast_days=3'), 600),
        sky ? Promise.resolve(sky) : fetch('data/sky.json').then(r => r.json())
      ]);
    } catch (e) { SW.fail(body, e, load); return; }
    const tz = wx.timezone, now = Date.now() / 1000, c = wx.current, la = loc.lat, lo = loc.lon;
    const sp = A.sunPos(now, la, lo), mp = A.moonPos(now, la, lo);
    const sunX = A.crossings(t => A.sunPos(t, la, lo).alt, -0.833, now, 26), moonX = A.crossings(t => A.moonPos(t, la, lo).alt, 0.125, now, 26);
    const dusk = A.crossings(t => A.sunPos(t, la, lo).alt, -18, now, 30);
    const nextOf = (list, up) => { const x = list.find(q => q.up === up); return x ? SW.fmt(x.t, tz, 'time') : null; };
    const w = SW.wx(c.weather_code, !c.is_day);

    // --- right now ---
    let nowTxt;
    const cc = c.cloud_cover, raining = c.precipitation > 0;
    if (raining) nowTxt = 'It is ' + w.text.toLowerCase() + ' right now, so you would mostly see gray cloud.';
    else if (sp.alt > 0) nowTxt = 'The sky is ' + cloudWord(cc) + '. ' + (cc < 65 ? 'The sun is ' + hi(sp.alt) + ' in the ' + A.compass(sp.az) + '.' : 'The sun is behind the clouds in the ' + A.compass(sp.az) + '.');
    else if (sp.alt > -12) nowTxt = 'It is twilight and the sky is ' + cloudWord(cc) + '. ' + (cc < 50 ? 'The brightest stars and planets are coming into view.' : 'Clouds are hiding most of it.');
    else nowTxt = 'It is night and the sky is ' + cloudWord(cc) + '. ' + (cc < 30 ? 'You would see ' + (mp.alt > 0 && mp.lit > 0.5 ? 'the bright moon and the brighter stars.' : 'a sky full of stars.') : cc < 70 ? 'You would see stars in the gaps between clouds.' : 'Clouds are hiding the stars.');
    const sunLine = sp.alt > 0 ? n(sp.alt) + '° up in the ' + A.compass(sp.az) + ' · sets ' + (nextOf(sunX, false) || '—') : 'Below the horizon · rises ' + (nextOf(sunX, true) || '—');
    const moonLine = (mp.alt > 0 ? n(mp.alt) + '° up in the ' + A.compass(mp.az) + ' · sets ' + (nextOf(moonX, false) || '—') : 'Below the horizon · rises ' + (nextOf(moonX, true) || '—'));

    // --- tonight ---
    const dStart = (sp.alt < -18 ? now : (dusk.find(x => !x.up) || { t: now }).t), dEndX = dusk.find(x => x.up && x.t > dStart), dEnd = dEndX ? dEndX.t : dStart + 8 * 3600;
    let sum = 0, cnt = 0, best = null, moonUp = 0;
    for (let t = dStart; t <= dEnd; t += 3600) {
      const cl = at('cloud_cover', t), m = A.moonPos(t, la, lo), glare = m.alt > 0 ? m.lit * 40 : 0;
      sum += cl; cnt++; if (m.alt > 0) moonUp++;
      if (!best || cl + glare < best.s) best = { s: cl + glare, t, cl };
    }
    const avg = cnt ? sum / cnt : 100, mNight = A.moonPos((dStart + dEnd) / 2, la, lo), moonBright = moonUp / Math.max(1, cnt) > 0.5 && mNight.lit > 0.6;
    const rate = avg < 15 ? (moonBright ? ['Good', '#3ddc97'] : ['Excellent', '#3ddc97']) : avg < 40 ? ['Good', '#a6f0c8'] : avg < 70 ? ['Fair', '#ffd24a'] : ['Poor', '#ff8a4a'];
    const tonightTxt = (avg < 15 ? 'Clear skies all night.' : avg < 40 ? 'Mostly clear, with a few clouds passing.' : avg < 70 ? 'Clouds will come and go, so you will need to pick your moment.' : 'Mostly cloudy. Stars will be hard to find.') +
      ' ' + (moonBright ? 'A bright ' + A.phaseName(mNight.age).toLowerCase() + ' will wash out the fainter stars.' : mNight.lit < 0.25 ? 'The moon is thin or down, so the sky will be properly dark.' : 'The moon will not get in the way much.') +
      (best && avg >= 15 && best.cl < 50 ? ' Best window: around ' + SW.fmt(best.t, tz, 'time') + ' (' + n(best.cl) + '% cloud).' : '');
    const pl = A.planets((dStart + dEnd) / 2).map(function vis(p) {
      let top = null; for (let t = dStart; t <= dEnd; t += 1800) { const q = A.altaz(p.ra, p.dec, t, la, lo); if (!top || q.alt > top.alt) top = Object.assign(q, { t }); }
      return top.alt > 8 ? '<div><span>' + p.name + '</span><b>' + SW.fmt(top.t, tz, 'time') + ' · ' + hi(top.alt) + ' in the ' + A.compass(top.az) + '</b></div>' : '';
    }).join('');

    body.innerHTML =
      '<div class="grid g2"><div class="card" id="luNow"><h2>If you looked up right now</h2><div class="lu-big">' + (raining ? w.icon : sp.alt > 0 ? (cc < 35 ? '☀️' : cc < 88 ? '⛅' : '☁️') : (cc < 35 ? (mp.alt > 0 ? '🌙' : '✨') : cc < 88 ? '☁️' : '☁️')) + '<p>' + nowTxt + '</p></div>' +
      '<div class="idx" style="margin-top:12px"><div><span>Sun</span><b>' + sunLine + '</b></div><div><span>Moon</span><b>' + A.phaseName(mp.age) + ', ' + n(mp.lit * 100) + '% lit · ' + moonLine + '</b></div>' +
      '<div><span>Low clouds</span><b>' + bar(at('cloud_cover_low', now)) + '</b></div><div><span>Middle clouds</span><b>' + bar(at('cloud_cover_mid', now)) + '</b></div><div><span>High clouds</span><b>' + bar(at('cloud_cover_high', now)) + '</b></div></div></div>' +
      '<div class="card" id="luTonight"><h2>Stargazing tonight <span class="spacer"></span><span class="pill" style="background:' + rate[1] + '">' + rate[0] + '</span></h2><p style="margin:0 0 10px;font-size:15px;line-height:1.5">' + tonightTxt + '</p>' +
      '<div class="idx"><div><span>Fully dark</span><b>' + SW.fmt(dStart, tz, 'time') + ' to ' + SW.fmt(dEnd, tz, 'time') + '</b></div><div><span>Average cloud</span><b>' + n(avg) + '%</b></div>' + (pl || '<div><span>Planets</span><b>None well placed tonight</b></div>') + '</div></div></div>' +
      SW.clouds.card({ low: at('cloud_cover_low', now), mid: at('cloud_cover_mid', now), high: at('cloud_cover_high', now), code: c.weather_code, cape: at('cape', now) || 0, day: sp.alt > 0 }) +
      '<div class="card" id="luChartCard"><h2>The sky at any hour<span class="spacer"></span><label class="chk" style="text-transform:none;letter-spacing:0"><input type="checkbox" id="luCl" checked> Clouds</label><label class="chk" style="text-transform:none;letter-spacing:0;margin-left:12px"><input type="checkbox" id="luLn" checked> Constellations</label></h2>' +
      '<div class="row" style="gap:10px;margin-bottom:10px"><button class="btn ghost" id="luNowBtn">Now</button><button class="btn ghost" id="luNightBtn">Tonight</button><input type="range" id="luT" min="0" max="288" value="0"><b id="luTime" style="white-space:nowrap;min-width:200px;text-align:right"></b></div>' +
      '<div class="lu-wrap"><canvas id="luSky"></canvas><div id="luSide"></div></div></div>' +
      '<div class="card" id="luCloudCard"><h2>Cloud cover ahead</h2><div class="chart" id="luCloud"></div></div>';

    t0 = Math.floor(now / 600) * 600; tSel = t0;
    $('#luT').oninput = e => { tSel = t0 + e.target.value * 600; draw(); };
    $('#luNowBtn').onclick = () => { t0 = Math.floor(Date.now() / 600000) * 600; tSel = t0; $('#luT').value = 0; draw(); };
    $('#luNightBtn').onclick = () => { tSel = Math.round((best ? best.t : dStart + 3600) / 600) * 600; $('#luT').value = Math.max(0, Math.round((tSel - t0) / 600)); draw(); };
    $('#luCl').onchange = e => { showClouds = e.target.checked; draw(); };
    $('#luLn').onchange = e => { showLines = e.target.checked; draw(); };
    const cv = $('#luSky');
    cv.onmousemove = function hover(e) {
      const r = cv.getBoundingClientRect(), k = cv.width / r.width, x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k; let b = null, bd = 26 * 26;
      objs.forEach(o => { const d = (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y); if (d < bd) { bd = d; b = o; } });
      cv.title = b ? b.name + ' · ' + n(b.alt) + '° up in the ' + A.compass(b.az) : '';
    };
    draw();
    const h = wx.hourly; let a = h.time.findIndex(t => t >= now - 3600); if (a < 0) a = 0; const b2 = Math.min(h.time.length, a + 48), s = k => h[k].slice(a, b2);
    SW.chart($('#luCloud'), { tz, unit: '% of sky', yRange: [0, 100], data: [h.time.slice(a, b2), s('cloud_cover'), s('cloud_cover_low'), s('cloud_cover_mid'), s('cloud_cover_high')], series: [{ label: 'Total', color: '#e6edf7', fill: '#e6edf718', width: 2.5, dec: 0 }, { label: 'Low', color: '#3fc6ff', width: 1.3, dec: 0 }, { label: 'Middle', color: '#3ddc97', width: 1.3, dec: 0 }, { label: 'High', color: '#c9a7ff', width: 1.3, dec: 0 }] });
  }
  const bar = v => '<span class="lu-bar"><i style="width:' + Math.round(v) + '%"></i></span> ' + n(v) + '%';

  function draw() {
    const cv = $('#luSky'); if (!cv || !sky) return;
    const loc = SW.loc(), la = loc.lat, lo = loc.lon, S = 1000, cx = S / 2, cy = S / 2, Rr = S / 2 - 34, c = cv.getContext('2d');
    cv.width = cv.height = S;
    const t = tSel, lst = A.lst(t, lo), sp = A.sunPos(t, la, lo), mp = A.moonPos(t, la, lo), cl = at('cloud_cover', t);
    $('#luTime').textContent = SW.fmt(t, wx.timezone, 'full');
    const P = (alt, az) => { const r = (90 - alt) / 90 * Rr, a = az * Math.PI / 180; return [cx - r * Math.sin(a), cy - r * Math.cos(a)]; };
    // sky color from how far the sun is above or below the horizon
    const k = Math.max(0, Math.min(1, (sp.alt + 14) / 20)), mix = (a, b) => Math.round(a + (b - a) * k);
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, Rr);
    g.addColorStop(0, 'rgb(' + mix(6, 60) + ',' + mix(10, 130) + ',' + mix(24, 215) + ')'); g.addColorStop(1, 'rgb(' + mix(14, 150) + ',' + mix(22, 195) + ',' + mix(46, 240) + ')');
    c.clearRect(0, 0, S, S); c.save(); c.beginPath(); c.arc(cx, cy, Rr, 0, 7); c.fillStyle = g; c.fill(); c.clip();
    objs = [];
    let lim = sp.alt > -1 ? -9 : sp.alt > -6 ? 0.5 : sp.alt > -12 ? 2.6 : sp.alt > -18 ? 4.3 : 5.3;
    if (mp.alt > 0 && lim > 0) lim -= mp.lit * 1.3;
    if (lim > 0) {
      c.strokeStyle = '#7fa8ff3d'; c.lineWidth = 1.3; // altitude rings
      [30, 60].forEach(a => { c.beginPath(); c.arc(cx, cy, (90 - a) / 90 * Rr, 0, 7); c.setLineDash([3, 9]); c.stroke(); }); c.setLineDash([]);
      if (showLines && lim > 2) {
        c.strokeStyle = '#8fb4ff55'; c.lineWidth = 1.5;
        sky.lines.forEach(con => con.forEach(function seg(line) {
          let prev = null;
          line.forEach(function pt(q) { const p = A.altaz(q[0], q[1], t, la, lo, lst); if (prev && (p.alt > -3 || prev.alt > -3)) { const a = P(prev.alt, prev.az), b = P(p.alt, p.az); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); } prev = p; });
        }));
        c.fillStyle = '#8fb4ff8c'; c.font = '17px Segoe UI'; c.textAlign = 'center';
        sky.cons.forEach(q => { const p = A.altaz(q[0], q[1], t, la, lo, lst); if (p.alt > 12) { const xy = P(p.alt, p.az); c.fillText(q[2].toUpperCase(), xy[0], xy[1]); } });
      }
      sky.stars.forEach(function star(s) {
        if (s[2] > lim) return; const p = A.altaz(s[0], s[1], t, la, lo, lst); if (p.alt < 0) return;
        const xy = P(p.alt, p.az), r = Math.max(0.9, 4.6 - s[2] * 0.85) * (lim < 3 ? 0.8 : 1);
        c.fillStyle = s[3] < 0 ? '#bcd0ff' : s[3] < 0.5 ? '#ffffff' : s[3] < 1.1 ? '#fff2cf' : '#ffc9a0';
        c.globalAlpha = Math.min(1, 0.35 + (lim - s[2]) * 0.3); c.beginPath(); c.arc(xy[0], xy[1], r, 0, 7); c.fill();
      });
      c.globalAlpha = 1; c.fillStyle = '#dfe9ff'; c.font = '16px Segoe UI'; c.textAlign = 'left';
      const used = [];
      sky.names.forEach(function nm(s) {
        const p = A.altaz(s[0], s[1], t, la, lo, lst); if (p.alt < 3) return; const xy = P(p.alt, p.az); objs.push({ x: xy[0], y: xy[1], name: s[2], alt: p.alt, az: p.az });
        if (lim <= 2.2 || used.some(u => Math.abs(u[0] - xy[0]) < 95 && Math.abs(u[1] - xy[1]) < 20)) return; // skip a label that would sit on top of another
        used.push(xy); c.fillText(s[2], xy[0] + 8, xy[1] + 5);
      });
    }
    // planets
    const side = [];
    A.planets(t).forEach(function planet(pn) {
      const p = A.altaz(pn.ra, pn.dec, t, la, lo, lst); side.push([pn.name, p]);
      if (p.alt < 0 || (sp.alt > -3 && pn.name !== 'Venus')) return;
      const xy = P(p.alt, p.az); c.fillStyle = { Mercury: '#d8d0c0', Venus: '#fff6d8', Mars: '#ff8a5c', Jupiter: '#ffe2b0', Saturn: '#f1d98a' }[pn.name];
      c.beginPath(); c.arc(xy[0], xy[1], pn.mag < -2 ? 8 : 6, 0, 7); c.fill(); c.font = 'bold 18px Segoe UI'; c.textAlign = 'left'; c.fillText(pn.name, xy[0] + 12, xy[1] + 6);
      objs.push({ x: xy[0], y: xy[1], name: pn.name + ' (planet)', alt: p.alt, az: p.az });
    });
    // sun
    if (sp.alt > -0.8) { const xy = P(Math.max(0, sp.alt), sp.az), gg = c.createRadialGradient(xy[0], xy[1], 4, xy[0], xy[1], 90); gg.addColorStop(0, '#fffbe0'); gg.addColorStop(0.25, '#ffe680cc'); gg.addColorStop(1, '#ffe68000'); c.fillStyle = gg; c.beginPath(); c.arc(xy[0], xy[1], 90, 0, 7); c.fill(); c.fillStyle = '#fffdf0'; c.beginPath(); c.arc(xy[0], xy[1], 20, 0, 7); c.fill(); objs.push({ x: xy[0], y: xy[1], name: 'The sun', alt: sp.alt, az: sp.az }); }
    // moon with its phase
    if (mp.alt > -0.5) {
      const xy = P(Math.max(0, mp.alt), mp.az), r = 22; c.save(); c.translate(xy[0], xy[1]);
      c.fillStyle = '#2a3350'; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
      const sxy = P(sp.alt, sp.az); c.rotate(Math.atan2(sxy[1] - xy[1], sxy[0] - xy[0])); // turn so the lit edge faces the sun
      c.fillStyle = '#f4f1e4'; c.beginPath();
      c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false); c.ellipse(0, 0, Math.abs(1 - 2 * mp.lit) * r, r, 0, Math.PI / 2, -Math.PI / 2, mp.lit < 0.5); c.fill();
      c.restore(); c.fillStyle = '#f4f1e4'; c.font = 'bold 18px Segoe UI'; c.textAlign = 'left'; c.fillText('Moon', xy[0] + 28, xy[1] + 6);
      objs.push({ x: xy[0], y: xy[1], name: 'The moon, ' + A.phaseName(mp.age).toLowerCase(), alt: mp.alt, az: mp.az });
    }
    // clouds: a veil as thick as the forecast cloud cover
    if (showClouds && cl > 5) {
      const seed = Math.floor(t / 3600); let q = seed * 9301 + 49297; const rnd = () => { q = (q * 9301 + 49297) % 233280; return q / 233280; };
      c.fillStyle = sp.alt > -6 ? '#ffffff' : '#aab4c8'; const nb = Math.round(cl * 0.7);
      c.filter = 'blur(38px)'; // soft-edged, so it reads as cloud and not as shapes
      for (let i = 0; i < nb; i++) { const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * Rr, w = 90 + rnd() * 170; c.globalAlpha = 0.10 + cl / 100 * 0.14; c.beginPath(); c.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, w, w * 0.6, rnd() * 3, 0, 7); c.fill(); }
      c.filter = 'none'; c.globalAlpha = 1;
    }
    c.restore();
    c.strokeStyle = '#3a4c72'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, Rr, 0, 7); c.stroke();
    c.fillStyle = '#e6edf7'; c.font = 'bold 24px Segoe UI'; c.textAlign = 'center'; c.textBaseline = 'middle';
    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(d => { const a = d[1] * Math.PI / 180; c.fillText(d[0], cx - (Rr + 18) * Math.sin(a), cy - (Rr + 18) * Math.cos(a)); });
    c.textBaseline = 'alphabetic';
    if (showClouds && cl > 5) { c.font = '19px Segoe UI'; c.textAlign = 'left'; c.fillStyle = '#aab4c8'; c.fillText('Gray haze = forecast cloud, ' + Math.round(cl) + '% of the sky', 6, S - 8); }

    const where = p => p.alt > 0 ? n(p.alt) + '° up, ' + A.compass(p.az) : 'below the horizon';
    $('#luSide').innerHTML = '<div class="idx"><div><span>Sky</span><b>' + (sp.alt > 0 ? 'Daytime' : sp.alt > -6 ? 'Bright twilight' : sp.alt > -18 ? 'Twilight' : 'Fully dark') + '</b></div><div><span>Cloud forecast</span><b>' + n(cl) + '% · ' + cloudWord(cl) + '</b></div><div><span>Sun</span><b>' + where(sp) + '</b></div><div><span>Moon</span><b>' + where(mp) + '</b></div>' +
      side.map(s => '<div><span>' + s[0] + '</span><b>' + where(s[1]) + '</b></div>').join('') + '</div><p class="dim small" style="line-height:1.5">Hold this the way you would hold a star map over your head: the center is straight up, the edge is the horizon, and east is on the left because you are looking up, not down. Point at a bright star or planet for its name.</p>';
  }
  SW.lookup = { load };
})();

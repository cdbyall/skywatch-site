// Skywatch models: every major model side by side, plus ensemble spread.
(function modelsMod() {
  const { $, api, U, n, esc } = SW;
  const MODELS = [
    ['gfs_seamless', 'GFS', '#3fc6ff'], ['ncep_hrrr_conus', 'HRRR', '#ff5a8a'], ['ncep_nam_conus', 'NAM', '#ffb020'], ['ncep_nbm_conus', 'NBM', '#ffffff'],
    ['ecmwf_ifs025', 'ECMWF', '#3ddc97'], ['ecmwf_aifs025_single', 'ECMWF AIFS', '#a6f0c8'], ['icon_seamless', 'ICON', '#c9a7ff'], ['gem_seamless', 'GEM', '#ff8a4a'],
    ['ukmo_seamless', 'UKMO', '#ffe44a'], ['jma_seamless', 'JMA', '#7c8cff'], ['meteofrance_seamless', 'ARPEGE', '#ff7ae0'], ['gfs_graphcast025', 'GraphCast', '#8fd3ff']
  ];
  const VARS = [
    ['temperature_2m', 'Temperature', () => U.t(), 1], ['dew_point_2m', 'Dew point', () => U.t(), 1],
    ['precip_acc', 'Total rain so far (adds up)', () => U.p(), 2], ['precipitation', 'Rain per hour', () => U.p(), 2],
    ['wind_speed_10m', 'Wind', () => U.w(), 0], ['wind_gusts_10m', 'Wind gusts', () => U.w(), 0],
    ['pressure_msl', 'Sea-level pressure', () => 'hPa', 1], ['cloud_cover', 'Cloud cover', () => '%', 0], ['snowfall', 'Snowfall per hour', () => U.us() ? 'in' : 'cm', 1], ['cape', 'Thunderstorm energy (CAPE)', () => 'J/kg', 0]
  ];
  const ENS = [['gfs025', 'GEFS (US, 31 runs)'], ['ecmwf_ifs025', 'ECMWF ensemble (51 runs)'], ['icon_seamless', 'ICON ensemble (40 runs)'], ['gem_global', 'Canadian ensemble (21 runs)']];
  let v = 'temperature_2m', days = 7, ens = 'gfs025';

  function acc(a) { let s = 0, seen = false; return a.map(x => { if (x == null) return seen ? s : null; seen = true; s += x; return s; }); }

  async function load() {
    const root = $('#v-models'), loc = SW.loc(); if (!loc) return;
    root.innerHTML = '<div class="head"><h1>Model comparison</h1><span class="dim">' + esc(loc.name) + '</span><div class="spacer"></div>' +
      '<select id="mdVar">' + VARS.map(x => '<option value="' + x[0] + '">' + x[1] + '</option>').join('') + '</select>' +
      '<div class="seg" id="mdDays">' + [3, 7, 10, 16].map(d => '<button data-d="' + d + '">' + d + ' days</button>').join('') + '</div></div>' +
      '<div class="grid"><div class="card"><h2>All models<span class="spacer"></span><span class="small" style="text-transform:none;letter-spacing:0">Click a name below the chart to hide it · drag to zoom · double-click to reset</span></h2><div class="chart tall" id="mdChart"></div></div>' +
      '<div class="card"><h2>Ensemble spread<span class="spacer"></span><select id="mdEns" style="width:auto">' + ENS.map(x => '<option value="' + x[0] + '">' + x[1] + '</option>').join('') + '</select></h2><div class="dim small" style="margin:-4px 0 8px">One model run many times with small changes. A tight bundle means high confidence; a wide fan means the forecast is uncertain.</div><div class="chart tall" id="mdEnsChart"></div></div>' +
      '<div class="card"><h2>Daily numbers by model</h2><div id="mdTable" style="overflow:auto"></div></div></div>';
    $('#mdVar').value = v; $('#mdEns').value = ens;
    $('#mdVar').onchange = e => { v = e.target.value; main(loc); ensemble(loc); };
    $('#mdEns').onchange = e => { ens = e.target.value; ensemble(loc); };
    SW.$$('#mdDays button').forEach(b => { b.classList.toggle('on', +b.dataset.d === days); b.onclick = () => { days = +b.dataset.d; load(); }; });
    await Promise.all([main(loc), ensemble(loc)]);
  }

  async function main(loc) {
    const host = $('#mdChart'), tb = $('#mdTable'), base = v === 'precip_acc' ? 'precipitation' : v, V = VARS.find(x => x[0] === v);
    SW.loading(host, 'Asking ' + MODELS.length + ' models…');
    let j;
    try {
      const vars = Array.from(new Set(['temperature_2m', 'precipitation', base])).join(',');
      j = await api.json(SW.omUrl('https://api.open-meteo.com/v1/forecast', loc, '&hourly=' + vars + '&forecast_days=' + days + '&models=' + MODELS.map(m => m[0]).join(',') + U.om()), 900);
    } catch (e) { SW.fail(host, e, () => main(loc)); tb.innerHTML = ''; return; }
    const h = j.hourly, tz = j.timezone, series = [], cols = [h.time], live = [];
    MODELS.forEach(function add(m) {
      let a = h[base + '_' + m[0]]; if (!a || !a.some(x => x != null)) return;
      if (v === 'precip_acc') a = acc(a);
      live.push(m); series.push({ label: m[1], color: m[2], width: m[0] === 'ncep_nbm_conus' ? 2.6 : 1.6, dec: V[3] }); cols.push(a);
    });
    if (!series.length) { host.innerHTML = '<div class="state">No model covers this place for that measurement.</div>'; return; }
    SW.chart(host, { tz, unit: V[2](), data: cols, series });

    // daily table: high / low / rain per model
    const dayKey = h.time.map(t => SW.fmt(t, tz, 'date')), dayList = Array.from(new Set(dayKey)).slice(0, 8);
    let html = '<table><tr><th>Model</th>' + dayList.map(d => '<th>' + d + '</th>').join('') + '</tr>';
    MODELS.forEach(function rowFor(m) {
      const T = h['temperature_2m_' + m[0]], P = h['precipitation_' + m[0]]; if (!T || !T.some(x => x != null)) return;
      html += '<tr><td><span style="color:' + m[2] + '">●</span> ' + m[1] + '</td>' + dayList.map(function cell(d) {
        let hi = -1e9, lo = 1e9, pr = 0, c = 0;
        dayKey.forEach((k, i) => { if (k === d && T[i] != null) { c++; hi = Math.max(hi, T[i]); lo = Math.min(lo, T[i]); pr += (P && P[i]) || 0; } });
        return c < 6 ? '<td class="dim">—</td>' : '<td>' + n(hi) + '° <span class="lo">' + n(lo) + '°</span><span class="pp">' + (pr > 0.004 ? n(pr, U.us() ? 2 : 1) + ' ' + U.p() : '&nbsp;') + '</span></td>';
      }).join('') + '</tr>';
    });
    tb.innerHTML = html + '</table><div class="dim small" style="margin-top:8px">High, low and total rain for each day. Short-range models (HRRR, NAM) only reach 2–3 days.</div>';
  }

  async function ensemble(loc) {
    const host = $('#mdEnsChart'), base = v === 'precip_acc' ? 'precipitation' : v, V = VARS.find(x => x[0] === v);
    SW.loading(host, 'Loading ensemble runs…');
    try {
      const j = await api.json(SW.omUrl('https://ensemble-api.open-meteo.com/v1/ensemble', loc, '&hourly=' + base + '&forecast_days=' + Math.min(days, 16) + '&models=' + ens + U.om()), 1800);
      const h = j.hourly, keys = Object.keys(h).filter(k => k.startsWith(base) && h[k].some(x => x != null));
      if (!keys.length) throw new Error('this ensemble does not offer that measurement');
      const mem = keys.map(k => v === 'precip_acc' ? acc(h[k]) : h[k]);
      const mean = h.time.map((_, i) => { let s = 0, c = 0; mem.forEach(a => { if (a[i] != null) { s += a[i]; c++; } }); return c ? s / c : null; });
      const lo = h.time.map((_, i) => { let m = Infinity; mem.forEach(a => { if (a[i] != null && a[i] < m) m = a[i]; }); return isFinite(m) ? m : null; });
      const hi = h.time.map((_, i) => { let m = -Infinity; mem.forEach(a => { if (a[i] != null && a[i] > m) m = a[i]; }); return isFinite(m) ? m : null; });
      const u = SW.chart(host, {
        tz: j.timezone, unit: V[2](), data: [h.time, mean, lo, hi].concat(mem),
        series: [{ label: 'Average of ' + mem.length + ' runs', color: '#ffffff', width: 2.6, dec: V[3] }, { label: 'Lowest', color: '#3fc6ff', width: 1, dash: [4, 4], dec: V[3] }, { label: 'Highest', color: '#ff8a4a', width: 1, dash: [4, 4], dec: V[3] }]
          .concat(mem.map((_, i) => ({ label: 'run ' + i, color: '#3fc6ff40', width: 1, dec: V[3] })))
      });
      // hide the per-run legend entries (too many); keep the three summary lines
      SW.$$('.u-legend .u-series', host).forEach((e, i) => { if (i > 3) e.style.display = 'none'; });
      void u;
    } catch (e) { SW.fail(host, e, () => ensemble(loc)); }
  }
  SW.models = { load };
})();

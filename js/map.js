// Skywatch map: radar, satellite, model fields, overlays, loop timeline.
(function mapMod() {
  const { $, st, api, U } = SW;
  let map, baseL = [], home, playing = false, playT = null, idx = 0, times = [];
  const sets = { radar: null, sat: null };   // {frames:[{t,mk,layer}], op}
  const ov = {};
  let sites = [], site = null;

  const ESRI = 'https://services.arcgisonline.com/ArcGIS/rest/services/', TILE = '/MapServer/tile/{z}/{y}/{x}';
  const BASES = {
    dark: ['Dark', ESRI + 'Canvas/World_Dark_Gray_Base' + TILE, ESRI + 'Canvas/World_Dark_Gray_Reference' + TILE, 'Esri, HERE, Garmin, © OpenStreetMap', 16],
    light: ['Light', ESRI + 'Canvas/World_Light_Gray_Base' + TILE, ESRI + 'Canvas/World_Light_Gray_Reference' + TILE, 'Esri, HERE, Garmin, © OpenStreetMap', 16],
    imagery: ['Satellite photo', ESRI + 'World_Imagery' + TILE, ESRI + 'Reference/World_Boundaries_and_Places' + TILE, 'Imagery © Esri, Maxar, Earthstar Geographics', 18],
    topo: ['Terrain', ESRI + 'World_Topo_Map' + TILE, null, 'Esri, USGS, NOAA, © OpenStreetMap', 18]
  };
  const RADAR = [
    ['none', 'Off'],
    ['iem', 'US NEXRAD composite'],
    ['mrms_bref', 'MRMS base reflectivity'],
    ['mrms_cref', 'MRMS composite reflectivity'],
    ['rv', 'Worldwide radar composite'],
    ['rec', 'My recordings (saved on this computer)'],
    ['etops', 'Echo tops'],
    ['ptype', 'Precipitation type'],
    ['s_sr_bref', 'Single site: reflectivity'],
    ['s_sr_bvel', 'Single site: velocity'],
    ['s_bdhc', 'Single site: rain / hail / snow type'],
    ['s_boha', 'Single site: 1-hour rainfall'],
    ['s_bdsa', 'Single site: storm-total rainfall']
  ];
  const CONUS = { mrms_bref: 'conus_bref_qcd', mrms_cref: 'conus_cref_qcd', etops: 'conus_neet_v18', ptype: 'conus_pcpn_typ' };
  const SAT = [
    ['none', 'Off'],
    ['GOES-East_ABI_GeoColor', 'GOES-East true color', 7],
    ['GOES-West_ABI_GeoColor', 'GOES-West true color', 7],
    ['GOES-East_ABI_Band13_Clean_Infrared', 'GOES-East infrared', 6],
    ['GOES-West_ABI_Band13_Clean_Infrared', 'GOES-West infrared', 6],
    ['GOES-East_ABI_Band2_Red_Visible_1km', 'GOES-East visible', 7],
    ['GOES-West_ABI_Band2_Red_Visible_1km', 'GOES-West visible', 7],
    ['GOES-East_ABI_Air_Mass', 'GOES-East air mass', 6],
    ['GOES-West_ABI_Air_Mass', 'GOES-West air mass', 6],
    ['Himawari_AHI_Band13_Clean_Infrared', 'Himawari infrared (Asia / W. Pacific)', 6],
    ['Himawari_AHI_Band3_Red_Visible_1km', 'Himawari visible (Asia / W. Pacific)', 7],
    ['rec', 'My recordings (saved on this computer)', 7]
  ];
  const SPC = [['none', 'Off'], ['day1otlk_cat', 'Today: overall risk'], ['day1otlk_torn', 'Today: tornado'], ['day1otlk_wind', 'Today: wind'], ['day1otlk_hail', 'Today: hail'], ['day2otlk_cat', 'Tomorrow: overall risk'], ['day3otlk_cat', 'Day 3: overall risk']];
  const MF_MODELS = [['best_match', 'Best available blend'], ['gfs_seamless', 'GFS (US global)'], ['ncep_hrrr_conus', 'HRRR (US 3 km)'], ['ncep_nam_conus', 'NAM (US)'], ['ncep_nbm_conus', 'NBM (US blend)'], ['ecmwf_ifs025', 'ECMWF IFS (Euro)'], ['ecmwf_aifs025_single', 'ECMWF AIFS (AI)'], ['icon_seamless', 'ICON (German)'], ['gem_seamless', 'GEM (Canadian)'], ['ukmo_seamless', 'UKMO (British)']];
  const R = {
    temp: [[-30, 130, 60, 180], [-20, 70, 70, 200], [-10, 60, 140, 230], [0, 90, 210, 230], [5, 80, 200, 140], [10, 120, 210, 80], [15, 220, 220, 60], [20, 245, 180, 50], [25, 240, 120, 40], [30, 225, 60, 40], [35, 180, 30, 60], [42, 120, 20, 90]],
    precip: [[0, 60, 200, 120, 0], [0.1, 80, 210, 130, 150], [1, 40, 170, 90], [2.5, 240, 230, 60], [5, 250, 160, 40], [10, 235, 60, 50], [20, 200, 40, 170], [40, 250, 240, 250]],
    wind: [[0, 40, 60, 110, 60], [15, 60, 140, 220], [30, 70, 210, 150], [50, 240, 220, 60], [70, 245, 130, 40], [90, 225, 50, 50], [130, 210, 60, 200]],
    cloud: [[0, 120, 130, 150, 0], [20, 120, 130, 150, 60], [60, 170, 180, 195, 170], [100, 235, 240, 245, 230]],
    pres: [[970, 150, 50, 200], [990, 60, 100, 230], [1005, 70, 200, 200], [1013, 110, 210, 110], [1020, 240, 220, 70], [1030, 245, 140, 50], [1045, 220, 60, 50]],
    cape: [[0, 80, 200, 120, 0], [100, 80, 200, 120, 130], [500, 220, 220, 60], [1000, 245, 160, 40], [2000, 235, 60, 50], [3000, 200, 40, 170], [5000, 250, 240, 250]],
    snow: [[0, 150, 200, 255, 0], [0.1, 150, 200, 255, 150], [1, 110, 160, 250], [3, 150, 110, 240], [6, 220, 110, 230], [10, 255, 240, 255]]
  };
  const MF_VARS = {
    temperature_2m: ['Temperature', R.temp, v => U.cT(v), () => U.t(), 0],
    dew_point_2m: ['Dew point', R.temp, v => U.cT(v), () => U.t(), 0],
    precipitation: ['Rain / melted snow per hour', R.precip, v => U.cP(v), () => U.p(), 2],
    snowfall: ['Snowfall per hour', R.snow, v => U.us() ? v / 2.54 : v, () => U.us() ? 'in' : 'cm', 1],
    wind_gusts_10m: ['Wind gusts', R.wind, v => U.cW(v), () => U.w(), 0],
    cloud_cover: ['Cloud cover', R.cloud, v => v, () => '%', 0],
    pressure_msl: ['Sea-level pressure', R.pres, v => v, () => 'hPa', 0],
    cape: ['Thunderstorm energy (CAPE)', R.cape, v => v, () => 'J/kg', 0]
  };

  function fill(sel, list, val) { sel.innerHTML = list.map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join(''); sel.value = val; if (sel.selectedIndex < 0) sel.selectedIndex = 0; }

  function init() {
    map = L.map('map', { zoomControl: false, worldCopyJump: true, minZoom: 2, maxZoom: 13, zoomSnap: 0.5, preferCanvas: true });
    L.control.zoom({ position: 'topleft' }).addTo(map);
    const P = (n, z, noPtr) => { const p = map.createPane(n); p.style.zIndex = z; if (noPtr) p.style.pointerEvents = 'none'; };
    P('sat', 250, 1); P('model', 300, 1); P('radar', 350, 1); P('spc', 380); P('alerts', 390); P('labels', 420, 1);
    const l = SW.loc();
    map.setView(l ? [l.lat, l.lon] : [39, -98], l ? 7.5 : 4);

    fill($('#baseSel'), Object.keys(BASES).map(k => [k, BASES[k][0]]), st.map.base);
    if (SW.web && st.map.radar === 'rec') st.map.radar = 'iem';
    fill($('#radarSel'), SW.web ? RADAR.filter(r => r[0] !== 'rec') : RADAR, st.map.radar); // recordings need the desktop app
    if (SW.web && st.map.sat === 'rec') st.map.sat = 'GOES-West_ABI_GeoColor';
    fill($('#satSel'), SW.web ? SAT.filter(r => r[0] !== 'rec') : SAT, st.map.sat);
    fill($('#spcSel'), SPC, st.map.spc);
    fill($('#mfModel'), MF_MODELS, 'best_match');
    fill($('#mfVar'), Object.keys(MF_VARS).map(k => [k, MF_VARS[k][0]]), 'temperature_2m');
    $('#radarOp').value = st.map.radarOp; $('#satOp').value = st.map.satOp;
    $('#ovAlerts').checked = st.map.alerts; $('#ovMetar').checked = st.map.metar; $('#ovSites').checked = st.map.sites; $('#ovTrop').checked = st.map.trop;

    $('#baseSel').onchange = e => { st.map.base = e.target.value; SW.save(); setBase(); };
    $('#radarSel').onchange = e => { st.map.radar = e.target.value; SW.save(); buildRadar(); };
    $('#siteSel').onchange = e => { pickSite(e.target.value); };
    $('#satSel').onchange = e => { st.map.sat = e.target.value; SW.save(); buildSat(); };
    $('#spcSel').onchange = e => { st.map.spc = e.target.value; SW.save(); loadSpc(); };
    $('#radarOp').oninput = e => { st.map.radarOp = +e.target.value; SW.save(); show(); };
    $('#satOp').oninput = e => { st.map.satOp = +e.target.value; SW.save(); show(); };
    $('#ovAlerts').onchange = e => { st.map.alerts = e.target.checked; SW.save(); loadAlerts(); };
    $('#ovMetar').onchange = e => { st.map.metar = e.target.checked; SW.save(); loadMetar(); };
    $('#ovSites').onchange = e => { st.map.sites = e.target.checked; SW.save(); drawSites(); };
    $('#ovTrop').onchange = e => { st.map.trop = e.target.checked; SW.save(); loadTrop(); };
    $('#tlPlay').onclick = () => setPlaying(!playing);
    $('#tlSlider').oninput = e => { setPlaying(false); preloadAll(); idx = +e.target.value; show(); };
    $('#tlSpeed').onchange = () => { if (playing) { setPlaying(false); setPlaying(true); } };
    $('#mfLoad').onclick = loadField; $('#mfOff').onclick = clearField;
    $('#mfHour').oninput = e => drawField(+e.target.value);
    map.on('moveend', function onMove() { if (st.map.metar) loadMetar(); });
    map.on('mousemove', fieldReadout);
    map.on('mouseout', () => $('#readout').classList.add('hidden'));

    recInit();
    setBase(); setHome();
    loadSites().then(buildRadar, buildRadar);
    buildSat(); loadAlerts(); loadSpc(); loadTrop(); loadMetar();
    SW.on('loc', function mapLoc() { setHome(true); site = null; nearestSite(); if (st.map.radar.startsWith('s_')) buildRadar(); });
    SW.on('alerts', drawAlerts);
    SW.on('units', () => { if (field) { drawField(+$('#mfHour').value); } if (st.map.metar) loadMetar(); });
  }

  function setBase() {
    baseL.forEach(x => map.removeLayer(x)); baseL = [];
    const b = BASES[st.map.base] || BASES.dark;
    baseL.push(L.tileLayer(b[1], { attribution: b[3], maxZoom: 19, maxNativeZoom: b[4] }).addTo(map));
    if (b[2]) baseL.push(L.tileLayer(b[2], { pane: 'labels', maxZoom: 19, maxNativeZoom: b[4] }).addTo(map));
  }
  function setHome(fly) {
    const l = SW.loc(); if (!l) return;
    if (home) map.removeLayer(home);
    home = L.marker([l.lat, l.lon], { icon: L.divIcon({ className: '', html: '<div class="home-dot"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }), interactive: false }).addTo(map);
    if (fly) map.setView([l.lat, l.lon], Math.max(map.getZoom(), 7));
  }

  // ---------- frame sets ----------
  function dropSet(k) { const s = sets[k]; if (s) s.frames.forEach(f => f.layer && map.removeLayer(f.layer)); sets[k] = null; }
  function useSet(k, frames) {
    dropSet(k);
    if (frames && frames.length) { frames.sort((a, b) => a.t - b.t); sets[k] = { frames }; const f = frames[frames.length - 1]; f.layer = f.mk().addTo(map); }
    const prim = sets.radar && sets.radar.frames.length > 1 ? sets.radar : (sets.radar || sets.sat);
    times = prim ? prim.frames.map(f => f.t) : [];
    idx = Math.max(0, times.length - 1);
    const sl = $('#tlSlider'); sl.max = Math.max(0, times.length - 1); sl.value = idx;
    $('#timeline').classList.toggle('hidden', !times.length);
    if (playing) preloadAll();
    show();
  }
  function preloadAll() { for (const k in sets) if (sets[k]) sets[k].frames.forEach(f => { if (!f.layer) { f.layer = f.mk(); f.layer.setOpacity(0); f.layer.addTo(map); } }); }
  function show() {
    const t = times[idx];
    for (const k in sets) {
      const s = sets[k]; if (!s) continue;
      const op = (k === 'radar' ? st.map.radarOp : st.map.satOp) / 100;
      let best = null, bd = Infinity;
      s.frames.forEach(f => { const d = Math.abs(f.t - t); if (f.layer && d < bd) { bd = d; best = f; } });
      s.frames.forEach(f => { if (f.layer) f.layer.setOpacity(f === best ? op : 0); });
    }
    $('#tlSlider').value = idx;
    const ago = t ? Math.round((Date.now() - t) / 60000) : 0;
    $('#tlTime').innerHTML = t ? SW.fmt(t / 1000, null, 'full') + ' <span class="dim">· ' + (ago <= 1 ? 'now' : ago < 180 ? ago + ' min ago' : ago < 2880 ? Math.round(ago / 60) + ' hours ago' : Math.round(ago / 1440) + ' days ago') + '</span>' : '—';
  }
  function setPlaying(p) {
    playing = p; clearInterval(playT); $('#tlPlay').textContent = p ? '❚❚' : '▶';
    if (!p || times.length < 2) { playing = false; $('#tlPlay').textContent = '▶'; return; }
    preloadAll();
    let hold = 0;
    playT = setInterval(function step() {
      if (idx === times.length - 1 && hold < 3) { hold++; return; } // pause on the newest frame
      hold = 0; idx = (idx + 1) % times.length; show();
    }, +$('#tlSpeed').value);
  }

  async function wmsFrames(ws, layer) {
    const base = 'https://opengeo.ncep.noaa.gov/geoserver/' + ws + '/ows';
    const mk = time => () => L.tileLayer.wms(base, { layers: layer, format: 'image/png', transparent: true, version: '1.3.0', time, pane: 'radar', tileSize: 512, attribution: 'NOAA/NWS' });
    let list = [];
    try {
      const xml = await api.text(base + '?service=WMS&version=1.3.0&request=GetCapabilities', 100);
      const i = xml.indexOf('<Name>' + layer + '</Name>');
      const m = i >= 0 && /<Dimension[^>]*name="time"[^>]*>([^<]+)</.exec(xml.slice(i, i + 200000));
      if (m) list = m[1].split(',').map(s => s.trim()).filter(Boolean);
    } catch (e) { }
    if (!list.length) return [{ t: Date.now(), mk: mk(undefined) }];
    const last = Date.parse(list[list.length - 1]);
    list = list.filter(s => Date.parse(s) >= last - 65 * 60000);
    const stride = Math.ceil(list.length / 12), out = [];
    for (let i = list.length - 1; i >= 0; i -= stride) out.push({ t: Date.parse(list[i]), mk: mk(list[i]) });
    return out;
  }
  let radarGen = 0;
  async function buildRadar() {
    const gen = ++radarGen, p = st.map.radar;
    $('#siteRow').classList.toggle('hidden', !p.startsWith('s_')); $('#recWinRow').classList.toggle('hidden', p !== 'rec');
    let frames = [];
    try {
      if (p === 'iem') {
        const t0 = Math.floor(Date.now() / 300000) * 300000;
        for (let k = 0; k < 12; k++) {
          const name = 'nexrad-n0q-900913' + (k ? '-m' + String(k * 5).padStart(2, '0') + 'm' : '');
          frames.push({ t: t0 - k * 300000, mk: () => L.tileLayer('https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/' + name + '/{z}/{x}/{y}.png?_=' + t0, { pane: 'radar', maxNativeZoom: 10, maxZoom: 19, attribution: 'NEXRAD via Iowa Environmental Mesonet' }) });
        }
      } else if (p === 'rv') {
        const j = await api.json('https://api.rainviewer.com/public/weather-maps.json', 120);
        frames = j.radar.past.map(f => ({ t: f.time * 1000, mk: () => L.tileLayer(j.host + f.path + '/256/{z}/{x}/{y}/2/1_1.png', { pane: 'radar', maxNativeZoom: 7, maxZoom: 19, attribution: 'RainViewer' }) }));
      } else if (p === 'rec') frames = await recFrames('radar');
      else if (CONUS[p]) frames = await wmsFrames('conus', CONUS[p]);
      else if (p.startsWith('s_')) {
        if (!site) nearestSite();
        if (site) { const ws = site.id.toLowerCase(); frames = await wmsFrames(ws, ws + '_' + p.slice(2)); }
        else SW.toast('No US radar site list yet. Try again in a moment.');
      }
    } catch (e) { SW.toast('Radar feed problem: ' + e.message); }
    if (gen !== radarGen) return;
    useSet('radar', frames);
    legend();
  }
  let satGen = 0;
  // NASA publishes, per layer, the newest picture time and how far back it goes; read that so no frame is ever blank.
  async function buildSat() {
    const gen = ++satGen, s = SAT.find(x => x[0] === st.map.sat);
    if (!s || s[0] === 'none') { useSet('sat', null); $('#satWinRow').classList.add('hidden'); return; }
    $('#satWinRow').classList.toggle('hidden', s[0] !== 'rec');
    if (s[0] === 'rec') { const fr = await recFrames('sat'); if (gen === satGen) useSet('sat', fr); return; }
    let end = Math.floor((Date.now() - 70 * 60000) / 600000) * 600000, start = end - 110 * 60000;
    try {
      const xml = await api.text('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml', 600);
      const i = xml.indexOf('<ows:Identifier>' + s[0] + '</ows:Identifier>'), blk = i < 0 ? '' : xml.slice(i, xml.indexOf('</Layer>', i));
      const vals = blk.match(/<Value>[^<]+<\/Value>/g);
      if (vals) { const p = vals[vals.length - 1].replace(/<\/?Value>/g, '').split('/'); start = Date.parse(p[0]); end = Date.parse(p[1]); }
    } catch (e) { }
    if (gen !== satGen) return;
    const frames = [];
    for (let k = 0; k < 12; k++) {
      const t = end - k * 600000; if (t < start) break;
      const iso = new Date(t).toISOString().slice(0, 19) + 'Z';
      frames.push({ t, mk: () => L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' + s[0] + '/default/' + iso + '/GoogleMapsCompatible_Level' + s[2] + '/{z}/{y}/{x}.png', { pane: 'sat', maxNativeZoom: s[2], maxZoom: 19, attribution: 'NASA GIBS / NOAA GOES' }) });
    }
    useSet('sat', frames);
  }

  // ---------- radar and satellite recordings kept on this computer ----------
  const shellApi = window.swShell && window.swShell.recInfo ? window.swShell : null;
  const REC_UI = { radar: { days: '#recDays', info: '#recInfo', clear: '#recClear', win: '#recWin', what: 'radar' }, sat: { days: '#satDays', info: '#satInfo', clear: '#satClear', win: '#satWin', what: 'satellite' } };
  const recWinSel = { radar: null, sat: null };
  const mb = b => b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' MB';
  function recShow(info) {
    const u = REC_UI[info.kind] || REC_UI.radar, el = $(u.info), f = info.frames;
    $(u.days).value = String(info.days); $(u.clear).classList.toggle('hidden', !f.length);
    if (!f.length) { el.textContent = info.days ? 'Recording. The first pictures arrive within a few minutes.' : 'Not recording.'; return; }
    const hrs = (f[f.length - 1].t - f[0].t) / 3600000;
    el.textContent = (hrs < 1.5 ? Math.round(hrs * 60) + ' min' : hrs < 48 ? Math.round(hrs) + ' hours' : Math.round(hrs / 24) + ' days') + ' saved · ' + mb(info.bytes) + (info.days ? '' : ' · paused');
  }
  async function recRefresh() { if (shellApi) { recShow(await shellApi.recInfo('radar')); recShow(await shellApi.recInfo('sat')); } }
  function recInit() {
    if (!shellApi) { $('#recBox').classList.add('hidden'); $('#satRecBox').classList.add('hidden'); return; }
    const here = () => { const l = SW.loc(); return l ? { lat: l.lat, lon: l.lon } : {}; };
    for (const k of ['radar', 'sat']) {
      const u = REC_UI[k];
      $(u.days).onchange = async e => {
        const d = +e.target.value, c = Object.assign({ kind: k }, here()); c[k === 'sat' ? 'satDays' : 'days'] = d;
        recShow(await shellApi.recSet(c));
        if (d) SW.toast('Recording ' + u.what + ' around your place. Skywatch keeps recording from the tray after you close the window.');
      };
      $(u.clear).onclick = async () => { if (!confirm('Delete every ' + u.what + ' recording saved on this computer? This cannot be undone.')) return; recShow(await shellApi.recClear(k)); if (k === 'radar' ? st.map.radar === 'rec' : st.map.sat === 'rec') (k === 'radar' ? buildRadar : buildSat)(); };
      $(u.win).onchange = e => { recWinSel[k] = +e.target.value; (k === 'radar' ? buildRadar : buildSat)(); };
    }
    // the recorder follows the chosen place
    SW.on('loc', async () => { recShow(await shellApi.recSet(Object.assign({ kind: 'radar' }, here()))); });
    shellApi.recSet(Object.assign({ kind: 'radar' }, here())).then(recShow).then(() => shellApi.recInfo('sat')).then(recShow);
  }
  async function recFrames(k) {
    if (!shellApi) return [];
    const u = REC_UI[k], info = await shellApi.recInfo(k), f = info.frames; recShow(info);
    if (!f.length) { SW.toast(info.days ? 'Nothing recorded yet. Give it a few minutes.' : 'Nothing recorded yet. Choose how long to keep under Record.'); $(u.win).innerHTML = ''; return []; }
    // offer the recording in 6-hour pieces, newest first, so a loop stays a sensible length
    const W = 6 * 3600000, wins = Array.from(new Set(f.map(x => Math.floor(x.t / W) * W))).sort((a, b) => b - a);
    if (!wins.includes(recWinSel[k])) recWinSel[k] = wins[0];
    $(u.win).innerHTML = wins.map(w => '<option value="' + w + '">' + SW.fmt(w / 1000, null, 'date') + ', ' + SW.fmt(w / 1000, null, 'hour') + ' to ' + SW.fmt((w + W) / 1000, null, 'hour') + '</option>').join('');
    $(u.win).value = recWinSel[k];
    const n = 2 ** info.z, lat = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI, lon = x => x / n * 360 - 180;
    const pane = k === 'sat' ? 'sat' : 'radar', by = k === 'sat' ? 'NASA GIBS / NOAA GOES' : 'NEXRAD via Iowa Environmental Mesonet';
    return f.filter(x => x.t >= recWinSel[k] && x.t < recWinSel[k] + W).map(x => ({
      t: x.t, mk: () => L.tileLayer(info.base + '/' + x.t + '/{z}/{x}/{y}.png', { pane, minNativeZoom: info.z, maxNativeZoom: info.z, maxZoom: 19, bounds: [[lat(x.y + 2) + 0.02, lon(x.x - 1) + 0.02], [lat(x.y - 1) - 0.02, lon(x.x + 2) - 0.02]], attribution: 'Recorded on this computer · ' + by })
    }));
  }
  SW.recTest = async function recTest() { // self-test: record the last hour, then replay it
    if (!shellApi) return 'no shell';
    const l = SW.loc(), wait = ms => new Promise(r => setTimeout(r, ms)); let info = await shellApi.recSet({ kind: 'radar', days: 1, satDays: 1, lat: l.lat, lon: l.lon });
    let sat = await shellApi.recInfo('sat');
    for (let i = 0; i < 60 && (info.frames.length < 12 || sat.frames.length < 6); i++) { await wait(3000); info = await shellApi.recInfo('radar'); sat = await shellApi.recInfo('sat'); }
    let ok = 0, bad = 0; const fails = []; L.TileLayer.addInitHook(function cnt() { this.on('tileload', () => ok++); this.on('tileerror', e => { bad++; fails.push(e.tile.src.slice(-40)); }); });
    await SW.show('map'); const s = $('#radarSel'); s.value = 'rec'; s.dispatchEvent(new Event('change')); const ss = $('#satSel'); ss.value = 'rec'; ss.dispatchEvent(new Event('change')); await wait(3500); $('#tlPlay').click(); await wait(7000); $('#tlPlay').click();
    return { frames: info.frames.length, bytes: info.bytes, satFrames: sat.frames.length, satBytes: sat.bytes, satLabel: $('#satInfo').textContent, satWindow: $('#satWin').selectedOptions[0] && $('#satWin').selectedOptions[0].textContent, loopFrames: +$('#tlSlider').max + 1, tilesLoaded: ok, tilesFailed: bad, fails: Array.from(new Set(fails)).slice(0, 12), label: $('#recInfo').textContent, window: $('#recWin').selectedOptions[0] && $('#recWin').selectedOptions[0].textContent, time: $('#tlTime').textContent };
  };

  // ---------- radar sites ----------
  async function loadSites() {
    const j = await api.json('https://api.weather.gov/radar/stations?stationType=WSR-88D,TDWR', 86400);
    sites = j.features.map(f => ({ id: f.properties.id, name: f.properties.name, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }));
    nearestSite(); drawSites();
  }
  function nearestSite() {
    const l = SW.loc(); if (!l || !sites.length) return;
    sites.forEach(s => s.d = SW.dist(l.lat, l.lon, s.lat, s.lon));
    const sorted = sites.slice().sort((a, b) => a.d - b.d);
    if (!site) site = sorted[0];
    $('#siteSel').innerHTML = sorted.map(s => '<option value="' + s.id + '">' + s.id + ' · ' + SW.esc(s.name) + ' (' + Math.round(U.cD(s.d)) + ' ' + U.d() + ')</option>').join('');
    $('#siteSel').value = site.id;
  }
  function pickSite(id) {
    const s = sites.find(x => x.id === id); if (!s) return;
    site = s; $('#siteSel').value = id; drawSites();
    if (!st.map.radar.startsWith('s_')) { st.map.radar = 's_sr_bref'; $('#radarSel').value = st.map.radar; SW.save(); }
    buildRadar();
  }
  function drawSites() {
    if (ov.sites) { map.removeLayer(ov.sites); ov.sites = null; }
    if (!st.map.sites) return;
    ov.sites = L.layerGroup(sites.map(function mkSite(s) {
      const on = site && site.id === s.id;
      return L.marker([s.lat, s.lon], { icon: L.divIcon({ className: '', html: '<div class="rsite' + (on ? ' on' : '') + '"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }), title: s.id + ' ' + s.name })
        .on('click', () => pickSite(s.id));
    })).addTo(map);
  }

  // ---------- overlays ----------
  const EV = { 'Tornado Warning': '#ff2020', 'Severe Thunderstorm Warning': '#ffa500', 'Flash Flood Warning': '#2bdc4a', 'Tornado Watch': '#ffff00', 'Severe Thunderstorm Watch': '#db7093', 'Flood Warning': '#00d060', 'Winter Storm Warning': '#ff69b4', 'Blizzard Warning': '#ff4500', 'Red Flag Warning': '#ff1493', 'High Wind Warning': '#daa520', 'Hurricane Warning': '#dc143c', 'Tropical Storm Warning': '#b22222', 'Special Marine Warning': '#ffa500', 'Winter Weather Advisory': '#7b68ee', 'Wind Advisory': '#d2b48c', 'Dense Fog Advisory': '#8090a0', 'Flood Advisory': '#00ff7f', 'Heat Advisory': '#ff7f50', 'Small Craft Advisory': '#d8bfd8' };
  const SEV = { Extreme: '#ff2bd6', Severe: '#ff5a5a', Moderate: '#ffb020', Minor: '#ffe44a' };
  SW.alertColor = p => EV[p.event] || SEV[p.severity] || '#9fb0c8';
  function loadAlerts() { if (!st.map.alerts) { drawAlerts(); return; } SW.getAlerts().then(drawAlerts, () => { }); }
  function drawAlerts() {
    if (ov.alerts) { map.removeLayer(ov.alerts); ov.alerts = null; }
    if (!st.map.alerts || !SW.alertsAll) return;
    const feats = SW.alertsAll.filter(f => f.geometry);
    ov.alerts = L.geoJSON(feats, {
      pane: 'alerts',
      style: f => { const c = SW.alertColor(f.properties); return { color: c, weight: 2, fillColor: c, fillOpacity: 0.12 }; },
      onEachFeature: function bind(f, layer) {
        const p = f.properties;
        layer.bindPopup('<b style="color:' + SW.alertColor(p) + '">' + SW.esc(p.event) + '</b><br>' + SW.esc(p.areaDesc || '').slice(0, 140) + '<br><span class="dim">Until ' + (p.ends || p.expires ? SW.fmt(Date.parse(p.ends || p.expires) / 1000, null, 'full') : '—') + '</span><br><a href="#" onclick="SW.openAlert(\'' + p.id + '\');return false">Read the full text</a>');
      }
    }).addTo(map);
  }
  async function loadSpc() {
    if (ov.spc) { map.removeLayer(ov.spc); ov.spc = null; }
    if (st.map.spc === 'none') return;
    try {
      const j = await api.json('https://www.spc.noaa.gov/products/outlook/' + st.map.spc + '.lyr.geojson', 900);
      if (!j.features || !j.features.some(f => f.geometry && f.geometry.coordinates && f.geometry.coordinates.length)) { SW.toast('No storm risk areas are outlined for that outlook.'); return; }
      ov.spc = L.geoJSON(j, {
        pane: 'spc', filter: f => f.geometry && f.geometry.coordinates && f.geometry.coordinates.length,
        style: f => ({ color: f.properties.stroke || '#fff', weight: 2, fillColor: f.properties.fill || '#fff', fillOpacity: 0.28 }),
        onEachFeature: (f, l) => l.bindPopup('<b>Storm Prediction Center</b><br>' + SW.esc(f.properties.LABEL2 || f.properties.LABEL || ''))
      }).addTo(map);
    } catch (e) { SW.toast('Storm outlook unavailable: ' + e.message); }
  }
  async function loadTrop() {
    if (ov.trop) { map.removeLayer(ov.trop); ov.trop = null; }
    if (!st.map.trop) return;
    try {
      const j = await api.json('https://www.nhc.noaa.gov/CurrentStorms.json', 900);
      ov.trop = L.layerGroup((j.activeStorms || []).map(function mkStorm(s) {
        return L.marker([s.latitudeNumeric, s.longitudeNumeric], { icon: L.divIcon({ className: 'trop', html: '🌀', iconSize: [30, 30], iconAnchor: [15, 15] }) })
          .bindPopup('<b>' + SW.esc(s.name) + '</b> (' + SW.esc(s.classification) + ')<br>Winds ' + s.intensity + ' kt · ' + s.pressure + ' mb<br>Moving ' + SW.compass(s.movementDir) + ' at ' + s.movementSpeed + ' kt' + (s.publicAdvisory ? '<br><a target="_blank" href="' + s.publicAdvisory.url + '">Public advisory</a>' : ''));
      })).addTo(map);
    } catch (e) { }
  }
  const FC = { VFR: '#3ddc97', MVFR: '#4aa3ff', IFR: '#ff5a5a', LIFR: '#ff2bd6' };
  let metarGen = 0;
  async function loadMetar() {
    const gen = ++metarGen;
    if (ov.metar) { map.removeLayer(ov.metar); ov.metar = null; }
    if (!st.map.metar) return;
    if (map.getZoom() < 6) { SW.toast('Zoom in to see station observations.'); return; }
    const b = map.getBounds();
    try {
      const j = await api.json('https://aviationweather.gov/api/data/metar?format=json&bbox=' + [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map(v => v.toFixed(2)).join(','), 300);
      if (gen !== metarGen) return;
      ov.metar = L.layerGroup(j.slice(0, 200).filter(m => m.temp != null).map(function mkStn(m) {
        const kmh = m.wspd == null || isNaN(m.wspd) ? null : m.wspd * 1.852;
        return L.marker([m.lat, m.lon], { icon: L.divIcon({ className: '', html: '<div class="stn" style="color:' + (FC[m.fltCat] || '#e6edf7') + '">' + Math.round(U.cT(m.temp)) + '°</div>', iconSize: [0, 0] }) })
          .bindPopup('<b>' + SW.esc(m.icaoId) + '</b> ' + SW.esc(m.name || '') + '<br>Temp ' + SW.n(U.cT(m.temp)) + U.t() + ' · Dew pt ' + SW.n(U.cT(m.dewp)) + U.t() + '<br>Wind ' + (m.wdir === 'VRB' ? 'variable' : SW.compass(+m.wdir)) + ' ' + SW.n(U.cW(kmh)) + (m.wgst ? ' gust ' + SW.n(U.cW(m.wgst * 1.852)) : '') + ' ' + U.w() + '<br>Visibility ' + SW.esc(m.visib) + ' mi · ' + (m.fltCat || '') + '<br><code style="font-size:11px">' + SW.esc(m.rawOb || '') + '</code>');
      })).addTo(map);
    } catch (e) { SW.toast('Station observations unavailable: ' + e.message); }
  }

  // ---------- model field ----------
  let field = null; // {nx,ny,b,hours:[t],vals:[h][i],key,tz}
  const NX = 16, NY = 10;
  const mY = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)), mLat = y => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
  async function loadField() {
    const b = map.getBounds(), key = $('#mfVar').value, model = $('#mfModel').value, btn = $('#mfLoad');
    const N = Math.min(80, b.getNorth()), S = Math.max(-80, b.getSouth()), W = b.getWest(), E = b.getEast();
    const lats = [], lons = [];
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      lats.push(mLat(mY(N) + (mY(S) - mY(N)) * j / (NY - 1)).toFixed(3));
      let lo = W + (E - W) * i / (NX - 1); lo = ((lo + 540) % 360) - 180; lons.push(lo.toFixed(3));
    }
    btn.disabled = true; btn.textContent = 'Loading…';
    try {
      const j = await api.json('https://api.open-meteo.com/v1/forecast?latitude=' + lats.join(',') + '&longitude=' + lons.join(',') + '&hourly=' + key + '&forecast_days=3&timeformat=unixtime' + (model === 'best_match' ? '' : '&models=' + model), 1800);
      const arr = Array.isArray(j) ? j : [j], hours = arr[0].hourly.time, vals = hours.map((_, h) => arr.map(p => p.hourly[key][h]));
      if (!vals.some(row => row.some(v => v != null))) throw new Error('that model has no data for this area');
      field = { b: [[S, W], [N, E]], hours, vals, key, model };
      const now = Date.now() / 1000; let h0 = hours.findIndex(t => t >= now - 1800); if (h0 < 0) h0 = 0;
      $('#mfHour').max = hours.length - 1; $('#mfHour').value = h0; $('#mfCtl').classList.remove('hidden');
      drawField(h0);
    } catch (e) { SW.toast(/limit/i.test(e.message) ? 'The model service asks for a short pause. Try again in a minute.' : 'Model map: ' + e.message); }
    btn.disabled = false; btn.textContent = 'Load for this view';
  }
  function clearField() { field = null; if (ov.field) { map.removeLayer(ov.field); ov.field = null; } $('#mfCtl').classList.add('hidden'); $('#readout').classList.add('hidden'); legend(); }
  function ramp(stops, v) {
    if (v <= stops[0][0]) return stops[0];
    for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i], f = (v - a[0]) / (b[0] - a[0]), aa = a[4] == null ? 215 : a[4], ba = b[4] == null ? 215 : b[4];
      return [0, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f, aa + (ba - aa) * f];
    }
    return stops[stops.length - 1];
  }
  function sample(row, u, v) {
    const i = Math.min(NX - 2, Math.max(0, Math.floor(u))), j = Math.min(NY - 2, Math.max(0, Math.floor(v))), fx = u - i, fy = v - j;
    const a = row[j * NX + i], b = row[j * NX + i + 1], c = row[(j + 1) * NX + i], d = row[(j + 1) * NX + i + 1];
    if (a == null || b == null || c == null || d == null) return null;
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
  }
  let fcv;
  function drawField(h) {
    if (!field) return;
    const V = MF_VARS[field.key], row = field.vals[h], Wp = NX * 16, Hp = NY * 16;
    fcv = fcv || document.createElement('canvas'); fcv.width = Wp; fcv.height = Hp;
    const c = fcv.getContext('2d'), img = c.createImageData(Wp, Hp), d = img.data;
    for (let y = 0; y < Hp; y++) for (let x = 0; x < Wp; x++) {
      const v = sample(row, x / (Wp - 1) * (NX - 1), y / (Hp - 1) * (NY - 1)), o = (y * Wp + x) * 4;
      if (v == null) continue;
      const s = ramp(V[1], v);
      d[o] = s[1]; d[o + 1] = s[2]; d[o + 2] = s[3]; d[o + 3] = s[4] == null ? 215 : s[4];
    }
    c.putImageData(img, 0, 0);
    const url = fcv.toDataURL();
    if (ov.field) ov.field.setUrl(url).setBounds(field.b); else ov.field = L.imageOverlay(url, field.b, { pane: 'model', opacity: 0.6 }).addTo(map);
    const mName = (MF_MODELS.find(m => m[0] === field.model) || [])[1];
    $('#mfLabel').innerHTML = '<b style="color:var(--text)">' + SW.fmt(field.hours[h], null, 'full') + '</b><br>' + mName + ' · coarse view of the area that was on screen';
    legend();
  }
  function fieldReadout(e) {
    const r = $('#readout');
    if (!field || !ov.field) { r.classList.add('hidden'); return; }
    const [[S, W], [N, E]] = field.b, la = e.latlng.lat, lo = e.latlng.lng;
    if (la < S || la > N || lo < W || lo > E) { r.classList.add('hidden'); return; }
    const V = MF_VARS[field.key], v = sample(field.vals[+$('#mfHour').value], (lo - W) / (E - W) * (NX - 1), (mY(la) - mY(N)) / (mY(S) - mY(N)) * (NY - 1));
    r.classList.remove('hidden'); r.innerHTML = V[0] + ': <b>' + SW.n(V[2](v), V[4]) + ' ' + V[3]() + '</b>';
  }
  function legend() {
    const lg = $('#legend'); let stops, title, conv = v => v, unit = '', dec = 0;
    if (field) { const V = MF_VARS[field.key]; stops = V[1]; title = V[0]; conv = V[2]; unit = V[3](); dec = V[4]; }
    else if (/iem|bref|cref|rv|rec/.test(st.map.radar)) { stops = [[5, 60, 200, 230], [20, 40, 190, 60], [35, 250, 230, 50], [45, 250, 150, 40], [55, 230, 40, 40], [65, 220, 60, 220], [75, 255, 255, 255]]; title = 'Radar echo strength'; unit = 'dBZ'; }
    else { lg.classList.add('hidden'); return; }
    const lo = stops[0][0], hi = stops[stops.length - 1][0];
    const g = stops.map(s => 'rgb(' + (s[1] | 0) + ',' + (s[2] | 0) + ',' + (s[3] | 0) + ') ' + ((s[0] - lo) / (hi - lo) * 100).toFixed(1) + '%').join(',');
    const pick = [0, Math.floor(stops.length / 3), Math.floor(stops.length * 2 / 3), stops.length - 1];
    lg.innerHTML = '<b>' + title + '</b> <span class="dim">' + unit + '</span><div class="bar" style="background:linear-gradient(90deg,' + g + ')"></div><div class="ticks">' + stops.filter((s, i) => stops.length <= 7 || i % 2 === 0 || i === stops.length - 1).map(s => '<span>' + (+conv(s[0]).toFixed(dec > 1 ? 1 : dec)) + '</span>').join('') + '</div>';
    lg.classList.remove('hidden'); void pick;
  }

  SW.map = {
    init,
    shown: () => map && map.invalidateSize(),
    goto: function goto(la, lo) { map.invalidateSize(); map.setView([la, lo], 8); L.popup().setLatLng([la, lo]).setContent('Here').openOn(map); },
    refresh: function refresh() { buildRadar(); buildSat(); loadAlerts(); loadSpc(); loadTrop(); if (st.map.metar) loadMetar(); },
    tick: function tick() { recRefresh(); if (!playing && st.map.radar !== 'rec') { buildRadar(); buildSat(); } },
    focus: function focus(feature) { try { const l = L.geoJSON(feature); map.fitBounds(l.getBounds().pad(0.4)); } catch (e) { } },
    ready: () => new Promise(r => setTimeout(r, 6000))
  };
})();

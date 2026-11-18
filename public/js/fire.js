// Skywatch fire: fire-weather danger for your place, active wildfires, satellite heat detections, live cameras.
(function fireMod() {
  const { $, $$, api, U, n, esc, st } = SW;
  const ESRI = 'https://services.arcgis.com/', WFIGS = 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/';
  let fmap = null, lay = {}, fires = [], cams = null, camT = null, gen = 0;
  const dT = f => U.us() ? f : (f - 32) * 5 / 9, dW = m => U.us() ? m : m * 1.609, dP = i => U.us() ? i : i * 25.4, acres = a => a == null ? 'size unknown' : U.us() ? Math.round(a).toLocaleString() + ' acres' : Math.round(a * 0.4047).toLocaleString() + ' hectares';
  void ESRI;

  // Fosberg fire weather index: how fast a fire would spread given heat, dry air and wind
  function ffwi(tF, rh, mph) {
    const m = rh < 10 ? 0.03229 + 0.281073 * rh - 0.000578 * rh * tF : rh <= 50 ? 2.22749 + 0.160107 * rh - 0.01478 * tF : 21.0606 + 0.005565 * rh * rh - 0.00035 * rh * tF - 0.483199 * rh;
    const x = Math.max(0, m) / 30, eta = 1 - 2 * x + 1.5 * x * x - 0.5 * x * x * x;
    return Math.max(0, eta * Math.sqrt(1 + mph * mph) / 0.3002);
  }
  const LEVEL = v => v < 15 ? ['Low', '#3ddc97', 'Fires are unlikely to spread quickly.'] : v < 25 ? ['Moderate', '#ffe44a', 'A fire could spread, but slowly.'] : v < 40 ? ['High', '#ffb020', 'A fire would spread easily. Be careful with anything that sparks.'] : v < 55 ? ['Very high', '#ff5a5a', 'A fire would spread fast and be hard to stop.'] : ['Extreme', '#ff2bd6', 'Any fire could grow explosively.'];

  async function load() {
    const root = $('#v-fire'), loc = SW.loc(); if (!loc) return; const g = ++gen;
    if (fmap) { fmap.remove(); fmap = null; lay = {}; }
    root.innerHTML = '<div class="head"><h1>Fire</h1><span class="dim">' + esc(loc.name) + '</span></div><div class="grid">' +
      '<div class="card" id="fiDanger"><div class="state"><span class="spin"></span>Working out the fire weather…</div></div>' +
      '<div class="fi-split"><div class="card" id="fiMapCard" style="padding:0;overflow:hidden;position:relative"><div id="fireMap"></div><div class="fi-layers panel">' +
      '<label class="chk"><input type="checkbox" id="fiL_fires" checked> Wildfires</label><label class="chk"><input type="checkbox" id="fiL_perims" checked> Burned-area outlines</label><label class="chk"><input type="checkbox" id="fiL_hot" checked> Satellite heat detections</label><label class="chk"><input type="checkbox" id="fiL_rfw" checked> Red flag warnings</label><label class="chk"><input type="checkbox" id="fiL_spc"> Fire weather outlook</label><label class="chk"><input type="checkbox" id="fiL_cams"> Cameras</label></div></div>' +
      '<div class="card" id="fiListCard"><h2>Wildfires<span class="spacer"></span><div class="seg" id="fiSort"><button data-s="near" class="on">Nearest</button><button data-s="big">Largest</button></div></h2><div id="fiList" style="overflow:auto;max-height:470px"><div class="state"><span class="spin"></span>Loading…</div></div></div></div>' +
      '<div class="card" id="fiCamCard"><h2>Fire-watch cameras near you<span class="spacer"></span><span class="small" id="fiCamNote" style="text-transform:none;letter-spacing:0"></span></h2><div id="fiCams" class="cams"><div class="state"><span class="spin"></span>Loading…</div></div></div></div>' +
      '<div id="camBig" class="modal hidden"><div class="card" style="width:min(1500px,94vw);padding:14px"><img id="camBigImg" alt="" style="width:100%;border-radius:8px;display:block"><div id="camBigCap" style="margin-top:8px;text-align:left"></div></div></div>';
    $('#camBig').onclick = () => $('#camBig').classList.add('hidden');
    fmap = L.map('fireMap', { zoomControl: true, minZoom: 3, maxZoom: 14, preferCanvas: true }).setView([loc.lat, loc.lon], 7);
    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 16, attribution: 'Esri · NIFC · NASA · NOAA · ALERTCalifornia' }).addTo(fmap);
    const lp = fmap.createPane('flabels'); lp.style.zIndex = 450; lp.style.pointerEvents = 'none';
    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { pane: 'flabels', maxNativeZoom: 16 }).addTo(fmap);
    L.marker([loc.lat, loc.lon], { icon: L.divIcon({ className: '', html: '<div class="home-dot"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }), interactive: false }).addTo(fmap);
    $$('.fi-layers input').forEach(i => i.onchange = () => { drawFires(); view(); rfw(); spc(); });
    $$('#fiSort button').forEach(b => b.onclick = () => { $$('#fiSort button').forEach(x => x.classList.toggle('on', x === b)); list(b.dataset.s); });
    fmap.on('moveend', view);
    clearInterval(camT); camT = setInterval(function camTick() { if ($('#v-fire').classList.contains('on')) refreshCams(); }, 60000);
    await Promise.all([danger(loc, g), incidents(loc, g), cameras(loc, g)]);
    view(); rfw(); spc();
  }
  const on = k => { const e = $('#fiL_' + k); return e && e.checked; };
  const swap = (k, layer) => { if (lay[k]) fmap.removeLayer(lay[k]); lay[k] = layer || null; if (layer) layer.addTo(fmap); };

  async function danger(loc, g) {
    const box = $('#fiDanger');
    try {
      const [j, aq] = await Promise.all([
        api.json(SW.omUrl('https://api.open-meteo.com/v1/forecast', loc, '&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,soil_moisture_0_to_1cm&daily=precipitation_sum&past_days=30&forecast_days=4&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch'), 1200),
        api.json(SW.omUrl('https://air-quality-api.open-meteo.com/v1/air-quality', loc, '&current=us_aqi,pm2_5'), 1800).catch(() => null)
      ]);
      if (g !== gen) return;
      const h = j.hourly, d = j.daily, now = Date.now() / 1000, tz = j.timezone;
      const i0 = Math.max(0, h.time.findIndex(t => t >= now - 1800));
      const todayIdx = d.time.findIndex(t => t > now - 86400), past = d.precipitation_sum.slice(0, Math.max(1, todayIdx + 1));
      let dry = 0; for (let k = past.length - 1; k >= 0 && (past[k] || 0) < 0.05; k--) dry++;
      const rain3 = past.slice(-3).reduce((a, b) => a + (b || 0), 0), rain30 = past.reduce((a, b) => a + (b || 0), 0), soil = h.soil_moisture_0_to_1cm[i0];
      const damp = rain3 >= 0.1 || (soil != null && soil > 0.30) ? 0.4 : dry < 5 ? 0.75 : 1;
      const idx = h.time.map((_, k) => h.temperature_2m[k] == null ? null : ffwi(h.temperature_2m[k], h.relative_humidity_2m[k], h.wind_speed_10m[k] * 0.6 + h.wind_gusts_10m[k] * 0.4) * damp);
      const cur = idx[i0] || 0, lv = LEVEL(cur); let pk = i0; for (let k = i0; k < Math.min(idx.length, i0 + 48); k++) if (idx[k] > idx[pk]) pk = k; const plv = LEVEL(idx[pk]);
      const mine = (SW.alertsAll || []).filter(() => false), local = (SW.localAlerts ? SW.localAlerts() : []).filter(f => /Red Flag|Fire Weather|Fire Warning|Extreme Fire/.test(f.properties.event)); void mine;
      const pm = aq && aq.current ? aq.current.pm2_5 : null;
      box.innerHTML = '<div class="hero"><div><div class="fi-gauge" style="--c:' + lv[1] + '"><b>' + lv[0] + '</b><span>fire weather now</span></div></div><div style="max-width:430px"><div style="font-size:16px;line-height:1.5">' + lv[2] + (damp < 0.5 ? ' Recent rain has left the grass and brush damp.' : dry >= 14 ? ' It has been ' + dry + ' days without real rain, so everything is dry.' : '') + '</div>' +
        '<div class="dim" style="margin-top:6px">Worst in the next two days: <b style="color:' + plv[1] + '">' + plv[0] + '</b> around ' + SW.fmt(h.time[pk], tz, 'full') + '</div>' +
        (local.length ? local.map(f => '<div class="fi-flag" onclick="SW.openAlert(\'' + f.properties.id + '\')">🚩 ' + esc(f.properties.event) + ' in effect: read it</div>').join('') : '<div class="dim small" style="margin-top:6px">No red flag warning or fire weather watch is in effect here.</div>') + '</div>' +
        '<div class="kv" style="grid-template-columns:repeat(4,auto)"><div><span>Humidity</span><b>' + n(h.relative_humidity_2m[i0]) + '%</b></div><div><span>Wind</span><b>' + n(dW(h.wind_speed_10m[i0])) + ' ' + U.w() + '</b></div><div><span>Gusts</span><b>' + n(dW(h.wind_gusts_10m[i0])) + ' ' + U.w() + '</b></div><div><span>Temperature</span><b>' + n(dT(h.temperature_2m[i0])) + U.t() + '</b></div>' +
        '<div><span>Days since rain</span><b>' + (dry >= past.length ? past.length + '+' : dry) + '</b></div><div><span>Rain, last 30 days</span><b>' + n(dP(rain30), U.us() ? 2 : 0) + ' ' + U.p() + '</b></div><div><span>Smoke (fine particles)</span><b>' + (pm == null ? '—' : n(pm) + ' µg/m³' + (pm > 35 ? ' · smoky' : pm > 12 ? ' · hazy' : ' · clean')) + '</b></div><div><span>Fires within 100 mi</span><b id="fiNearCount">…</b></div></div></div>' +
        '<div class="chart" id="fiChart" style="margin-top:14px;height:200px"></div><div class="dim small">This rating is Skywatch\'s own estimate from heat, dry air, wind and recent rain. It is not an official fire danger rating: follow your local fire agency.</div>';
      const b = Math.min(h.time.length, i0 + 72);
      SW.chart($('#fiChart'), { tz, unit: 'fire weather index', y2: { unit: 'humidity %', range: [0, 100] }, data: [h.time.slice(i0, b), idx.slice(i0, b), h.relative_humidity_2m.slice(i0, b), h.wind_gusts_10m.slice(i0, b).map(dW)], series: [{ label: 'Fire weather index', color: '#ff8a4a', fill: '#ff8a4a22', width: 2.5, dec: 0 }, { label: 'Humidity', color: '#3fc6ff', width: 1.3, scale: 'y2', dec: 0 }, { label: 'Gusts (' + U.w() + ')', color: '#c9a7ff', width: 1.3, dec: 0 }] });
      nearCount();
    } catch (e) { SW.fail(box, e, () => danger(loc, gen)); }
  }
  function nearCount() { const e = $('#fiNearCount'); if (e) e.textContent = fires.length || lay.loaded ? fires.filter(f => f.d < 161 && f.active).length : '…'; }

  async function incidents(loc, g) {
    try {
      const q = 'WFIGS_Incident_Locations_Current/FeatureServer/0/query?where=' + encodeURIComponent("IncidentTypeCategory='WF' AND FireDiscoveryDateTime >= CURRENT_TIMESTAMP - INTERVAL '45' DAY") + '&outFields=IncidentName,IncidentSize,PercentContained,FireDiscoveryDateTime,POOState,POOCounty,FireCause,TotalIncidentPersonnel&orderByFields=' + encodeURIComponent('IncidentSize DESC') + '&f=geojson&resultRecordCount=2000';
      const j = await api.json(WFIGS + q, 900); if (g !== gen) return;
      fires = (j.features || []).filter(f => f.geometry).map(function mk(f) {
        const p = f.properties, la = f.geometry.coordinates[1], lo = f.geometry.coordinates[0], d = SW.dist(loc.lat, loc.lon, la, lo);
        const brg = (Math.atan2(Math.sin((lo - loc.lon) * Math.PI / 180) * Math.cos(la * Math.PI / 180), Math.cos(loc.lat * Math.PI / 180) * Math.sin(la * Math.PI / 180) - Math.sin(loc.lat * Math.PI / 180) * Math.cos(la * Math.PI / 180) * Math.cos((lo - loc.lon) * Math.PI / 180)) * 180 / Math.PI + 360) % 360;
        return { name: p.IncidentName, size: p.IncidentSize, cont: p.PercentContained, t: p.FireDiscoveryDateTime / 1000, state: (p.POOState || '').replace('US-', ''), county: p.POOCounty, cause: p.FireCause, crew: p.TotalIncidentPersonnel, la, lo, d, brg, active: p.PercentContained == null || p.PercentContained < 100 };
      });
      lay.loaded = true; drawFires(); list('near'); nearCount();
    } catch (e) { SW.fail($('#fiList'), e, () => incidents(loc, gen)); }
  }
  const fireColor = f => !f.active ? '#7c8aa5' : f.cont >= 50 ? '#ffb020' : '#ff4a3a';
  function drawFires() {
    if (!fmap) return;
    swap('fires', on('fires') ? L.layerGroup(fires.map(f => L.circleMarker([f.la, f.lo], { radius: Math.max(5, Math.min(22, 3 + Math.sqrt(f.size || 1) / 9)), color: '#000', weight: 1, fillColor: fireColor(f), fillOpacity: 0.85 }).bindPopup(popup(f)))) : null);
  }
  const popup = f => '<b>' + esc(f.name) + ' Fire</b><br>' + acres(f.size) + ' · ' + (f.cont == null ? 'containment not reported' : f.cont + '% contained') + '<br>' + esc(f.county || '') + (f.state ? ', ' + f.state : '') + '<br><span class="dim">Started ' + SW.fmt(f.t, null, 'date') + (f.cause ? ' · cause: ' + esc(f.cause.toLowerCase()) : '') + (f.crew ? ' · ' + f.crew + ' people assigned' : '') + '</span>';
  function list(mode) {
    const box = $('#fiList'); if (!box) return;
    const arr = fires.filter(f => (f.active && f.size >= 1) || f.d < 161).sort(mode === 'big' ? (a, b) => (b.size || 0) - (a.size || 0) : (a, b) => a.d - b.d).slice(0, 60);
    box.innerHTML = arr.length ? arr.map((f, i) => '<div class="al" data-i="' + i + '" style="border-left-color:' + fireColor(f) + '"><b>' + esc(f.name) + ' Fire</b><span>' + acres(f.size) + ' · ' + (f.cont == null ? 'containment unknown' : f.cont + '% contained') + '</span><br><span>' + n(U.cD(f.d)) + ' ' + U.d() + ' ' + SW.compass(f.brg) + ' of you · ' + esc(f.county || '') + (f.state ? ', ' + f.state : '') + '</span></div>').join('') : '<div class="state">No wildfires have been reported in the last 45 days.</div>';
    $$('.al', box).forEach(e => e.onclick = () => { const f = arr[+e.dataset.i]; fmap.setView([f.la, f.lo], 10); });
  }

  let viewGen = 0;
  async function view() { // things that load for the area on screen
    if (!fmap) return; const g = ++viewGen, b = fmap.getBounds(), z = fmap.getZoom(), env = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map(v => v.toFixed(3)).join(',');
    const geo = '&geometry=' + env + '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects';
    if (on('perims') && z >= 6) api.json(WFIGS + 'WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?where=1%3D1&outFields=poly_IncidentName,poly_GISAcres&f=geojson&resultRecordCount=300&maxAllowableOffset=' + (z >= 10 ? 0.0005 : 0.004) + geo, 900).then(function perims(j) {
      if (g !== viewGen) return; swap('perims', L.geoJSON(j, { style: { color: '#ff8a4a', weight: 1.5, fillColor: '#ff4a3a', fillOpacity: 0.22 }, onEachFeature: (f, l) => l.bindPopup('<b>' + esc(f.properties.poly_IncidentName || 'Fire') + '</b><br>Burned area: ' + acres(f.properties.poly_GISAcres)) })); if (lay.fires) lay.fires.eachLayer(l => l.bringToFront());
    }, () => { }); else swap('perims');
    if (on('hot') && z >= 6) api.json('https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/Satellite_VIIRS_Thermal_Hotspots_and_Fire_Activity/FeatureServer/0/query?where=1%3D1&outFields=frp,acq_time,confidence&f=geojson&resultRecordCount=3000' + geo, 900).then(function hot(j) {
      if (g !== viewGen) return; const cut = Date.now() - 48 * 3600000;
      swap('hot', L.layerGroup((j.features || []).filter(f => f.properties.acq_time > cut).map(f => L.circleMarker([f.geometry.coordinates[1], f.geometry.coordinates[0]], { radius: 3.5, stroke: false, fillColor: f.properties.acq_time > Date.now() - 12 * 3600000 ? '#ff2b2b' : '#ff9d2b', fillOpacity: 0.8 }).bindPopup('<b>Heat seen from space</b><br>' + SW.fmt(f.properties.acq_time / 1000, null, 'full') + '<br><span class="dim">A satellite spotted something hot here. Usually a fire, sometimes a factory or a controlled burn.</span>'))));
    }, () => { }); else swap('hot');
    if (on('cams') && cams && z >= 8) swap('cams', L.layerGroup(cams.filter(c => b.contains([c.la, c.lo])).slice(0, 400).map(c => L.circleMarker([c.la, c.lo], { radius: 5, color: '#04121c', weight: 1, fillColor: '#3fc6ff', fillOpacity: 0.9 }).on('click', () => big(c)))));
    else { swap('cams'); if (on('cams') && z < 8 && cams) SW.toast('Zoom in to see the cameras.'); }
  }
  function rfw() {
    if (!fmap) return;
    const feats = on('rfw') ? (SW.alertsAll || []).filter(f => f.geometry && /Red Flag|Fire Weather|Fire Warning/.test(f.properties.event)) : [];
    swap('rfw', feats.length ? L.geoJSON(feats, { style: { color: '#ff1493', weight: 2, fillColor: '#ff1493', fillOpacity: 0.15 }, onEachFeature: (f, l) => l.bindPopup('<b style="color:#ff1493">' + esc(f.properties.event) + '</b><br>' + esc((f.properties.areaDesc || '').slice(0, 140)) + '<br><a href="#" onclick="SW.openAlert(\'' + f.properties.id + '\');return false">Read the full text</a>') }) : null);
  }
  async function spc() {
    if (!fmap) return; if (!on('spc')) { swap('spc'); return; }
    try {
      const js = await Promise.all(['day1fw_windrh', 'day1fw_dryt'].map(k => api.json('https://www.spc.noaa.gov/products/fire_wx/' + k + '.lyr.geojson', 1800)));
      const feats = [].concat(...js.map(j => j.features || [])).filter(f => f.geometry && f.geometry.coordinates && f.geometry.coordinates.length);
      if (!feats.length) { SW.toast('The Storm Prediction Center has no fire weather areas outlined today.'); swap('spc'); return; }
      swap('spc', L.geoJSON(feats, { style: f => ({ color: f.properties.stroke || '#ffb020', weight: 2, fillColor: f.properties.fill || '#ffb020', fillOpacity: 0.25 }), onEachFeature: (f, l) => l.bindPopup('<b>Fire weather outlook</b><br>' + esc(f.properties.LABEL2 || f.properties.LABEL || '')) }));
    } catch (e) { SW.toast('Fire weather outlook unavailable: ' + e.message); }
  }

  // ---------- cameras (ALERTCalifornia network) ----------
  const camUrl = c => 'https://cameras.alertcalifornia.org/public-camera-data/' + c.stream + '/latest-frame.jpg?t=' + Math.floor(Date.now() / 30000);
  async function cameras(loc, g) {
    const box = $('#fiCams');
    try {
      if (!cams) {
        const j = await api.json('https://cameras.alertcalifornia.org/public-camera-data/all_cameras-v3.json', 3600);
        cams = j.features.filter(f => f.geometry && f.properties.stream_ids && f.properties.stream_ids[0]).map(f => ({ name: f.properties.name, stream: f.properties.stream_ids[0], la: f.geometry.coordinates[1], lo: f.geometry.coordinates[0], az: f.properties.az_current, last: f.properties.last_frame_ts }));
      }
      if (g !== gen) return;
      cams.forEach(c => c.d = SW.dist(loc.lat, loc.lon, c.la, c.lo));
      const fresh = Date.now() / 1000 - 6 * 3600, near = cams.filter(c => c.d < 120 && (!c.last || c.last > fresh)).sort((a, b) => a.d - b.d).slice(0, 8);
      if (!near.length) { box.innerHTML = '<div class="state">No public fire-watch camera within 75 miles. The camera network Skywatch can read covers California.</div>'; $('#fiCamNote').textContent = ''; return; }
      $('#fiCamNote').textContent = 'Live stills from ALERTCalifornia · refreshes every minute · click to enlarge';
      box.innerHTML = near.map((c, i) => '<figure class="cam" data-i="' + i + '"><img alt="" loading="lazy" src="' + camUrl(c) + '"><figcaption><b>' + esc(c.name) + '</b><span>' + n(U.cD(c.d)) + ' ' + U.d() + ' away' + (c.az != null ? ' · looking ' + SW.compass(c.az) : '') + '</span></figcaption></figure>').join('');
      $$('.cam', box).forEach(function wire(e) { const c = near[+e.dataset.i]; e.onclick = () => big(c); e.querySelector('img').onerror = function gone() { e.classList.add('off'); }; e._cam = c; });
    } catch (e) { box.innerHTML = '<div class="state">The camera network is not answering right now (' + esc(e.message) + ').</div>'; }
  }
  function refreshCams() { $$('#fiCams .cam').forEach(e => { if (e._cam && !e.classList.contains('off')) e.querySelector('img').src = camUrl(e._cam); }); }
  function big(c) { $('#camBigImg').src = camUrl(c); $('#camBigCap').innerHTML = '<b>' + esc(c.name) + '</b> <span class="dim">· ' + (c.az != null ? 'looking ' + SW.compass(c.az) + ' · ' : '') + 'ALERTCalifornia · click anywhere to close</span>'; $('#camBig').classList.remove('hidden'); }

  SW.fire = { load };
  void st;
})();

// Skywatch nature: what is in the air (pollen, mold, dust, smoke, UV), and what today's weather means
// for the plants and animals that live around the chosen place. Local species come from iNaturalist sightings.
(function natureMod() {
  const { $, $$, api, U, n, esc, st } = SW;
  let D = null, gen = 0, lifeP = null, lifeKey = '';
  const LV = ['Very low', 'Low', 'Moderate', 'High', 'Very high'], LC = ['#3ddc97', '#9be564', '#ffe44a', '#ffb020', '#ff5a5a'];
  const lvl = v => v < 1 ? 0 : v < 2.5 ? 1 : v < 4.5 ? 2 : v < 7 ? 3 : 4;
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const dT = f => U.us() ? f : (f - 32) * 5 / 9, dW = m => U.us() ? m : m * 1.609, dP = i => U.us() ? i : i * 25.4;
  const GRASS = 'Festuca Bromus Avena Lolium Poa Holcus Dactylis Anthoxanthum Briza Elymus Hordeum Phalaris Cynosurus Aira Calamagrostis Deschampsia Danthonia Stipa Nassella Agrostis Phleum Cortaderia Ammophila Cynodon Sorghum Paspalum Andropogon Schizachyrium Panicum Bouteloua Muhlenbergia Leymus Vulpia Polypogon Distichlis Melica Koeleria Arrhenatherum Alopecurus Setaria Digitaria Pennisetum Cenchrus Spartina Sporobolus Phragmites Zea Triticum Secale'.split(' ');

  // Plants whose pollen travels on the wind. Months are for the northern half of the world (shifted six months in the south).
  const ALLERGENS = [
    { k: 'Grasses', type: 'grass', g: GRASS, m: [4, 5, 6, 7], sev: 3, note: 'The most common cause of hay fever. Grass flowers are tiny and green, so you never notice them, but they shed clouds of very light pollen.' },
    { k: 'Alder', type: 'tree', g: ['Alnus'], m: [1, 2, 3], sev: 2, note: 'One of the first trees to release pollen each year, from dangling catkins, often while it is still winter.' },
    { k: 'Oak and tanoak', type: 'tree', g: ['Quercus', 'Notholithocarpus', 'Chrysolepis'], m: [3, 4, 5], sev: 3, note: 'Oaks make huge amounts of pollen in spring; it is the yellow-green dust on cars.' },
    { k: 'Cypress, juniper and cedar', type: 'tree', g: ['Cupressus', 'Hesperocyparis', 'Juniperus', 'Calocedrus', 'Thuja', 'Chamaecyparis', 'Callitropsis', 'Cryptomeria', 'Taxodium'], m: [12, 1, 2, 3], sev: 3, note: 'Cypress-family trees pollinate in winter. On a dry breezy day you can see pollen smoke off the branches.' },
    { k: 'Redwood', type: 'tree', g: ['Sequoia', 'Sequoiadendron'], m: [12, 1, 2], sev: 1, note: 'Redwoods shed pollen in winter. It bothers fewer people than cypress, but there can be a lot of it.' },
    { k: 'Pine, fir and spruce', type: 'tree', g: ['Pinus', 'Pseudotsuga', 'Abies', 'Picea', 'Tsuga', 'Larix', 'Cedrus'], m: [4, 5, 6], sev: 1, note: 'Makes the yellow dust you can see on puddles and windshields. The grains are big and waxy, so they rarely cause allergies.' },
    { k: 'Birch', type: 'tree', g: ['Betula'], m: [3, 4, 5], sev: 3, note: 'A strong allergy tree. Its pollen is small, light and travels a long way.' },
    { k: 'Willow', type: 'tree', g: ['Salix'], m: [2, 3, 4], sev: 1, note: 'Mostly pollinated by insects, so only a little gets in the air.' },
    { k: 'Cottonwood, poplar and aspen', type: 'tree', g: ['Populus'], m: [3, 4], sev: 2, note: 'The pollen comes weeks before the famous white fluff. The fluff itself is seed and does not cause allergies.' },
    { k: 'Maple and box elder', type: 'tree', g: ['Acer'], m: [3, 4], sev: 2, note: 'Box elder is the strongest of the maples for allergies.' },
    { k: 'Ash', type: 'tree', g: ['Fraxinus'], m: [3, 4], sev: 2, note: 'Sheds heavily for a short time in early spring.' },
    { k: 'Elm', type: 'tree', g: ['Ulmus'], m: [2, 3, 4], sev: 2, note: 'Most elms pollinate in late winter; a few kinds do it in fall.' },
    { k: 'Walnut, pecan and hickory', type: 'tree', g: ['Juglans', 'Carya'], m: [4, 5], sev: 3, note: 'Heavy pollen that mostly bothers people living near the trees.' },
    { k: 'Mulberry', type: 'tree', g: ['Morus', 'Broussonetia'], m: [3, 4, 5], sev: 3, note: 'So strong an allergen that some cities ban planting the male trees.' },
    { k: 'Olive and privet', type: 'tree', g: ['Olea', 'Ligustrum'], m: [4, 5, 6], sev: 3, note: 'Olive pollen is a major cause of hay fever wherever the trees are planted.' },
    { k: 'Sycamore and plane tree', type: 'tree', g: ['Platanus'], m: [3, 4, 5], sev: 2, note: 'Besides pollen, the fuzz on young leaves irritates noses and throats.' },
    { k: 'Hazel', type: 'tree', g: ['Corylus'], m: [1, 2, 3], sev: 2, note: 'Catkins open in the middle of winter.' },
    { k: 'Eucalyptus and acacia', type: 'tree', g: ['Eucalyptus', 'Acacia', 'Corymbia'], m: [12, 1, 2, 3], sev: 1, note: 'Mostly insect-pollinated. They bother people who are right under the trees.' },
    { k: 'Wax myrtle and bayberry', type: 'tree', g: ['Morella', 'Myrica'], m: [3, 4, 5], sev: 2, note: 'A coastal shrub with wind-carried pollen in spring.' },
    { k: 'Ragweed', type: 'weed', g: ['Ambrosia', 'Iva'], m: [8, 9, 10], sev: 3, note: 'The worst weed for allergies. One plant can release a billion grains, and they travel hundreds of miles.' },
    { k: 'Sagebrush, mugwort and wormwood', type: 'weed', g: ['Artemisia'], m: [8, 9, 10], sev: 3, note: 'A strong late-summer and fall allergen across the West.' },
    { k: 'Coyote brush', type: 'weed', g: ['Baccharis'], m: [9, 10, 11, 12], sev: 2, note: 'A coastal shrub that flowers in fall, when little else does. Related to ragweed.' },
    { k: 'Plantain', type: 'weed', g: ['Plantago'], m: [5, 6, 7, 8], sev: 2, note: 'A lawn and roadside weed with tall thin flower spikes.' },
    { k: 'Dock and sorrel', type: 'weed', g: ['Rumex'], m: [4, 5, 6, 7], sev: 2, note: 'Rusty-red flower stalks in fields. Often overlaps with grass season.' },
    { k: 'Nettle and pellitory', type: 'weed', g: ['Urtica', 'Parietaria'], m: [5, 6, 7, 8, 9], sev: 2, note: 'Tiny pollen that puffs out when the flowers are warmed by the sun.' },
    { k: 'Pigweed, goosefoot and saltbush', type: 'weed', g: ['Amaranthus', 'Chenopodium', 'Atriplex', 'Salsola', 'Kochia', 'Bassia'], m: [7, 8, 9, 10], sev: 2, note: 'Weeds of disturbed and salty ground that pollinate in late summer.' }
  ];
  const TYPES = { tree: 'Trees', grass: 'Grasses', weed: 'Weeds and shrubs' };

  function season(a, t, south) { // 0 out of season, 0.6 at the edges, 1 in the middle
    let m = new Date(t * 1000).getUTCMonth() + 1; if (south) m = (m + 5) % 12 + 1;
    const i = a.m.indexOf(m); return i < 0 ? 0 : (i === 0 || i === a.m.length - 1) && a.m.length > 2 ? 0.6 : 1;
  }

  // ---------- data ----------
  async function load() {
    const root = $('#v-nature'), loc = SW.loc(); if (!loc) return; const g = ++gen, tab = st.natureTab || 'air';
    root.innerHTML = '<div class="head"><h1>Nature</h1><div class="seg" id="naTabs"><button data-t="air">Air &amp; allergies</button><button data-t="plants">Plants</button><button data-t="animals">Animals</button></div><span class="dim">' + esc(loc.name) + '</span></div><div id="naBody"></div>';
    $$('#naTabs button').forEach(b => { b.classList.toggle('on', b.dataset.t === tab); b.onclick = () => { st.natureTab = b.dataset.t; SW.save(); $$('#naTabs button').forEach(x => x.classList.toggle('on', x === b)); draw(); }; });
    const body = $('#naBody'); SW.loading(body, 'Sniffing the air…');
    try {
      const [wx, aq] = await Promise.all([
        api.json(SW.omUrl('https://api.open-meteo.com/v1/forecast', loc, '&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,cloud_cover,visibility,wind_speed_10m,wind_gusts_10m,uv_index,uv_index_clear_sky,is_day&daily=uv_index_max,sunrise,sunset,temperature_2m_min,temperature_2m_max&past_days=3&forecast_days=5&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch'), 1200),
        api.json(SW.omUrl('https://air-quality-api.open-meteo.com/v1/air-quality', loc, '&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,dust&hourly=us_aqi,pm2_5,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen&forecast_days=3'), 1800).catch(() => null)
      ]);
      if (g !== gen) return;
      D = { loc, wx, aq, life: null };
      const key = loc.lat.toFixed(2) + ',' + loc.lon.toFixed(2);
      if (lifeKey !== key) { lifeKey = key; lifeP = life(loc); }
      lifeP.then(function gotLife(l) { if (g !== gen) return; D.life = l; draw(); });
      draw();
    } catch (e) { SW.fail(body, e, load); }
  }

  // what people have recorded within about 20 miles: all plants, what is flowering this month, and this month's animals
  function life(loc) {
    const south = loc.lat < 0, mo = new Date().getMonth() + 1;
    const base = 'https://api.inaturalist.org/v1/observations/species_counts?verifiable=true&quality_grade=research&locale=en&lat=' + loc.lat.toFixed(2) + '&lng=' + loc.lon.toFixed(2) + '&radius=32';
    const get = (q, per) => api.json(base + '&per_page=' + per + q, 86400).then(j => (j.results || []).map(function mk(r) {
      const t = r.taxon, p = t.default_photo, free = p && p.license_code;
      return { id: t.id, sci: t.name, genus: t.name.split(' ')[0], name: cap(t.preferred_common_name || t.name), count: r.count, img: free ? p.square_url : null, big: free ? p.medium_url : null, credit: free ? p.attribution : '', group: t.iconic_taxon_name };
    }));
    const an = (tx, per) => get('&month=' + mo + '&iconic_taxa=' + tx, per).catch(() => []);
    return Promise.all([
      get('&iconic_taxa=Plantae', 500).catch(() => null), get('&month=' + mo + '&iconic_taxa=Plantae&term_id=12&term_value_id=13', 16).catch(() => []), an('Fungi', 10),
      an('Aves', 60), an('Mammalia', 24), an('Amphibia', 10), an('Reptilia', 10), an('Insecta', 24), an('Mollusca', 24), an('Animalia,Arachnida,Actinopterygii', 20)
    ]).then(r => ({ south, plants: r[0], flowering: r[1], fungi: r[2], animals: [].concat(r[3], r[4], r[5], r[6], r[7], r[8], r[9]) }));
  }

  // ---------- reading the weather ----------
  function weather() {
    const h = D.wx.hourly, now = Date.now() / 1000, off = D.wx.utc_offset_seconds || 0; let a = h.time.findIndex(t => t >= now - 1800); if (a < 0) a = 0;
    const b = Math.min(h.time.length, a + 24), sum = (k, i, j) => { let s = 0; for (let q = Math.max(0, i); q < j; q++) s += h[k][q] || 0; return s; };
    const mx = (k, dir) => { let m = a; for (let q = a; q < b; q++) if (dir * (h[k][q] - h[k][m]) > 0) m = q; return m; };
    const T = h.temperature_2m[a], rh = h.relative_humidity_2m[a], code = h.weather_code[a], vis = h.visibility[a], gust = h.wind_gusts_10m[a], cloud = h.cloud_cover[a];
    const hi = mx('temperature_2m', 1), lo = mx('temperature_2m', -1), rainDay = sum('precipitation', a, b), rain72 = sum('precipitation', a - 72, a), rain48n = sum('precipitation', a, Math.min(h.time.length, a + 48));
    let sunH = 0, fogH = 0; for (let q = a; q < b; q++) { if (h.is_day[q] && h.cloud_cover[q] < 40) sunH++; if (h.weather_code[q] === 45 || h.weather_code[q] === 48 || h.visibility[q] < 1000) fogH++; }
    return {
      h, a, b, off, now, T, rh, gust, cloud, hour: new Date((h.time[a] + off) * 1000).getUTCHours(), month: new Date((now + off) * 1000).getUTCMonth() + 1,
      raining: h.precipitation[a] > 0.005 || (code >= 51 && code < 100), fog: code === 45 || code === 48 || vis < 1000, night: !h.is_day[a], sunny: !!h.is_day[a] && cloud < 40,
      damp: rh >= 85, dryAir: rh < 40, hot: T >= 85, warm: T >= 65, mild: T >= 50 && T < 85, cool: T < 50, cold: T < 40, frost: h.temperature_2m[lo] <= 33, windy: gust >= 25, gale: gust >= 40,
      hiT: h.temperature_2m[hi], loT: h.temperature_2m[lo], hiAt: h.time[hi], loAt: h.time[lo], maxGust: h.wind_gusts_10m[mx('wind_gusts_10m', 1)], rainDay, rain72, rain48n, wet: rain72 >= 0.1 || rainDay >= 0.05, soaked: rain72 >= 1, rainComing: rainDay >= 0.05, sunH, fogH
    };
  }
  const tm = t => SW.fmt(t, D.wx.timezone, 'hour'), deg = f => n(dT(f)) + '°';

  // ---------- pollen ----------
  function pollen(w) {
    const h = w.h, L = D.life, south = D.loc.lat < 0, have = L && L.plants && L.plants.length > 20;
    const local = ALLERGENS.map(function near(a) { const ex = have ? L.plants.filter(p => a.g.includes(p.genus)) : []; return Object.assign({ ex, here: have ? ex.length > 0 : true, s: season(a, w.now, south) }, a); }).filter(a => a.here);
    const act = local.filter(a => a.s > 0).sort((x, y) => y.sev * y.s - x.sev * x.s);
    const typeBase = t => { const l = act.filter(a => a.type === t); return l.length ? Math.min(4.2, l[0].sev * l[0].s * (1 + 0.15 * Math.min(3, l.length - 1))) : 0; };
    const base = { tree: typeBase('tree'), grass: typeBase('grass'), weed: typeBase('weed') }, top = Math.max(base.tree, base.grass, base.weed), all = top + 0.25 * (base.tree + base.grass + base.weed - top);
    // real pollen counts exist where Europe's air model reaches
    const aqh = D.aq && D.aq.hourly, real = aqh && aqh.grass_pollen && aqh.grass_pollen.some(v => v != null);
    const fac = function hourFactor(i) {
      const T = h.temperature_2m[i], rh = h.relative_humidity_2m[i], wd = h.wind_speed_10m[i], hr = new Date((h.time[i] + w.off) * 1000).getUTCHours();
      let rainNow = 0, rain12 = 0; for (let q = Math.max(0, i - 12); q <= i; q++) { rain12 += h.precipitation[q] || 0; if (q >= i - 2) rainNow += h.precipitation[q] || 0; }
      let f = T < 38 ? 0.15 : T < 50 ? 0.55 : T < 60 ? 0.85 : T <= 88 ? 1.1 : 0.9;
      f *= rainNow > 0.01 ? 0.12 : rain12 > 0.1 ? 0.55 : 1; f *= rh > 92 ? 0.4 : rh > 78 ? 0.7 : rh < 45 ? 1.2 : 1; f *= wd < 3 ? 0.7 : wd < 15 ? 1.1 : 1.3;
      f *= hr >= 6 && hr <= 10 ? 1.25 : hr >= 11 && hr <= 16 ? 1 : hr >= 17 && hr <= 20 ? 0.8 : 0.45;
      return f;
    };
    const xs = [], ys = [], mold = [];
    for (let i = w.a; i < Math.min(h.time.length, w.a + 60); i++) {
      xs.push(h.time[i]);
      if (real) { const j = aqh.time.indexOf(h.time[i]), v = k => (j >= 0 && aqh[k][j]) || 0; ys.push(j < 0 ? null : Math.min(10, Math.max(v('grass_pollen') / 8, v('birch_pollen') / 15, v('alder_pollen') / 15, v('olive_pollen') / 20, v('ragweed_pollen') / 5, v('mugwort_pollen') / 5))); }
      else ys.push(Math.min(10, all * fac(i) * 1.45));
      // mold spores: plenty after rain while it is mild, and stirred up on breezy days
      let r72 = 0; for (let q = Math.max(0, i - 72); q <= i; q++) r72 += h.precipitation[q] || 0;
      const T = h.temperature_2m[i], rh = h.relative_humidity_2m[i];
      mold.push(Math.min(10, (T < 40 ? 0.3 : T < 50 ? 0.7 : 1) * ((r72 > 1 ? 4.5 : r72 > 0.2 ? 3.2 : r72 > 0.02 ? 2 : 0.8) + (rh > 88 ? 1.8 : rh > 75 ? 1 : 0) + (h.wind_speed_10m[i] > 12 && h.precipitation[i] < 0.01 ? 1 : 0)) * ((w.month >= 9 && w.month <= 12) !== south ? 1.25 : 1)));
    }
    const end = Math.min(xs.length, 24); let pk = 0, lo = 0, mpk = 0; for (let i = 0; i < end; i++) { if (ys[i] > ys[pk]) pk = i; if (ys[i] < ys[lo]) lo = i; if (mold[i] > mold[mpk]) mpk = i; }
    return { local, act, base, xs, ys, mold, pk, lo, mpk, real, have, f0: fac(w.a) };
  }

  // ---------- air & allergies tab ----------
  const gauge = (c, big, small) => '<div class="fi-gauge na-gauge" style="--c:' + c + '"><b>' + big + '</b><span>' + small + '</span></div>';
  const UVL = v => v < 3 ? ['Low', '#3ddc97'] : v < 6 ? ['Moderate', '#ffe44a'] : v < 8 ? ['High', '#ffb020'] : v < 11 ? ['Very high', '#ff5a5a'] : ['Extreme', '#c77dff'];
  const AQL = v => v == null ? ['—', '#8b9ab3'] : v <= 50 ? ['Good', '#3ddc97'] : v <= 100 ? ['Moderate', '#ffe44a'] : v <= 150 ? ['Unhealthy if sensitive', '#ffb020'] : v <= 200 ? ['Unhealthy', '#ff5a5a'] : ['Very unhealthy', '#c77dff'];
  function air(w) {
    const p = pollen(w), h = w.h, aq = D.aq, c = aq && aq.current, pNow = p.ys[0] || 0, pl = lvl(pNow), ppk = lvl(p.ys[p.pk]), ml = lvl(p.mold[0]);
    const uvNow = h.uv_index[w.a] || 0, today = [];
    const day0 = SW.fmt(w.now, D.wx.timezone, 'date'); h.time.forEach((t, i) => { if (SW.fmt(t, D.wx.timezone, 'date') === day0) today.push(i); });
    let up = today[0]; today.forEach(i => { if ((h.uv_index[i] || 0) > (h.uv_index[up] || 0)) up = i; });
    const uvMax = h.uv_index[up] || 0, need = today.filter(i => h.uv_index[i] >= 3), uvl = UVL(uvNow), uml = UVL(uvMax), clear = h.uv_index_clear_sky[up] || 0, cut = clear > 0.5 ? Math.round((1 - uvMax / clear) * 100) : 0;
    const why = [];
    if (!p.act.length) why.push(p.have ? 'None of the wind-pollinated plants recorded around here are in season right now.' : 'Very few plants release pollen at this time of year.');
    else {
      const f = p.f0;
      why.push('In season near you: <b>' + p.act.slice(0, 4).map(a => a.k.toLowerCase()).join(', ') + '</b>.');
      if (w.raining) why.push('Rain is washing pollen out of the air right now.'); else if (w.rain72 > 0.1 && h.relative_humidity_2m[w.a] > 78) why.push('Recent rain and damp air are keeping pollen down.');
      else if (w.fog || w.damp) why.push('Damp air makes pollen grains heavy, so they do not travel far.'); else if (f > 1.2) why.push('Dry air and a breeze are spreading it around.');
      if (w.cool && !w.raining) why.push('Cool air slows flowers from opening.');
    }
    let html = '<div class="grid"><div class="card" id="naHero"><div class="hero" style="align-items:center;gap:22px"><div class="na-gauges">' + gauge(LC[pl], LV[pl], 'pollen now') + gauge(AQL(c && c.us_aqi)[1], c && c.us_aqi != null ? n(c.us_aqi) : '—', 'air quality') + gauge(uml[1], n(uvMax, 1), 'peak UV today') + '</div>' +
      '<div style="max-width:560px"><div style="font-size:16px;line-height:1.55">' + why.join(' ') + '</div>' +
      (p.act.length ? '<div class="dim" style="margin-top:8px">Worst for allergies in the next day: <b style="color:' + LC[ppk] + '">' + LV[ppk] + '</b> around <b>' + SW.fmt(p.xs[p.pk], D.wx.timezone, 'full') + '</b> · easiest around ' + tm(p.xs[p.lo]) + '</div>' : '') +
      '<div class="dim small" style="margin-top:8px;line-height:1.5">' + (p.real ? 'Pollen here comes from Europe\'s air-quality forecast model.' : 'Nobody publishes free pollen counts for this area, so this is Skywatch\'s own estimate: which local plants are in season, and how today\'s rain, humidity, wind and warmth affect how much pollen gets into the air. Treat it as a guide, not a measurement.') + '</div></div></div></div>';

    // pollen by type + mold
    const row = (name, v, sub) => { const l = lvl(v); return '<div class="na-row"><span>' + name + '</span><div class="na-bar"><i style="width:' + Math.max(4, Math.min(100, v * 11)) + '%;background:' + LC[l] + '"></i></div><b style="color:' + LC[l] + '">' + LV[l] + '</b>' + (sub ? '<em>' + sub + '</em>' : '') + '</div>'; };
    const ty = t => { const l = p.act.filter(a => a.type === t); return row(TYPES[t], Math.min(10, p.base[t] * p.f0 * 1.45), l.length ? l.map(a => a.k).join(', ') : 'Nothing in season'); };
    html += '<div class="grid g2"><div class="card" id="naTypes"><h2>What is in the air right now</h2>' + (p.real ? row('Pollen', pNow, 'From the forecast model') : ty('tree') + ty('grass') + ty('weed')) +
      row('Mold spores', p.mold[0], w.wet ? 'Mold loves the damp after rain. Worst around ' + tm(p.xs[p.mpk]) + '.' : 'Dry weather keeps mold quiet.') + parts(c) + '</div>' +
      '<div class="card" id="naWhen"><h2>When it will be worst</h2><div class="chart" id="naChart" style="height:250px"></div><p class="dim small" style="line-height:1.5;margin:8px 0 0">Pollen is usually highest from sunrise to mid-morning, when flowers open and the air starts to stir, and lowest during and just after rain. Mold is the opposite: it peaks in damp, mild weather. ' + (ml >= 3 ? 'Mold is high today, so raking leaves or mowing will stir it up.' : '') + '</p></div></div>';

    // plants to look out for
    const look = p.local.slice().sort((x, y) => (y.s > 0) - (x.s > 0) || y.sev * y.s - x.sev * x.s || y.sev - x.sev);
    const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], south = D.loc.lat < 0;
    html += '<div class="card" id="naLook"><h2>Plants to look out for near you</h2>' + (D.life ? '' : '<div class="dim small" style="margin-bottom:8px"><span class="spin"></span> Looking up which plants grow around here…</div>') + '<div class="na-look">' + look.map(function one(a) {
      const ms = a.m.map(m => mn[((south ? m + 5 : m - 1) % 12)]), st = a.s >= 1 ? ['In season now', LC[Math.min(4, a.sev + 1)]] : a.s > 0 ? ['Starting or finishing', LC[2]] : ['Not now · ' + ms[0] + ' to ' + ms[ms.length - 1], '#5b6a85'];
      return '<div class="na-al' + (a.s > 0 ? ' on' : '') + '"><div class="na-al-h"><b>' + a.k + '</b><span class="pill" style="background:' + st[1] + '22;color:' + st[1] + ';border-color:' + st[1] + '55">' + st[0] + '</span></div><div class="dim small" style="line-height:1.45">' + a.note + ' <span style="white-space:nowrap">Strength: ' + '●'.repeat(a.sev) + '○'.repeat(3 - a.sev) + '</span></div>' + (a.ex.length ? '<div class="na-chips">' + a.ex.slice(0, 4).map(chip).join('') + '</div>' : '') + '</div>';
    }).join('') + '</div><p class="dim small" style="margin:10px 0 0">' + (p.have ? 'These are the wind-pollinated plants people have actually recorded within about 20 miles of ' + esc(D.loc.name) + '. Showy flowers are missing on purpose: their pollen is sticky and carried by bees, so it rarely gets up your nose.' : 'Showing the usual suspects, because the local plant list is not available right now.') + '</p></div>';

    // UV
    const burn = v => v < 1 ? null : Math.round(170 / v / 5) * 5;
    html += '<div class="grid g2"><div class="card" id="naUV"><h2>Sun strength (UV)</h2><div class="kv" style="grid-template-columns:repeat(2,auto);margin-bottom:10px">' +
      '<div><span>Right now</span><b style="color:' + uvl[1] + '">' + n(uvNow, 1) + ' · ' + uvl[0] + '</b></div><div><span>Strongest today</span><b style="color:' + uml[1] + '">' + n(uvMax, 1) + ' · ' + uml[0] + ' at ' + tm(h.time[up]) + '</b></div>' +
      '<div><span>Cover up between</span><b>' + (need.length ? tm(h.time[need[0]]) + ' and ' + tm(h.time[need[need.length - 1]] + 3600) : 'No need today') + '</b></div><div><span>Fair skin burns in about</span><b>' + (burn(uvMax) ? burn(uvMax) + ' min at the peak' : 'Not today') + '</b></div></div>' +
      '<div class="chart" id="naUVChart" style="height:200px"></div><p class="dim small" style="line-height:1.5;margin:8px 0 0">UV is the part of sunlight that burns skin. It follows the height of the sun, not the temperature, so a cool breezy day can still burn. ' + (cut >= 15 ? 'Clouds are blocking about ' + cut + '% of it at the peak today. ' : uvMax >= 3 ? 'Thin cloud and fog let most of it through. ' : '') + 'At 3 or more, sunscreen and a hat are worth it.</p></div>' +
      '<div class="card" id="naUVDays"><h2>UV for the next few days</h2><div class="idx">' + D.wx.daily.time.map(function dayRow(t, i) {
        if (t < w.now - 86400 || D.wx.daily.uv_index_max[i] == null) return ''; const v = D.wx.daily.uv_index_max[i], l = UVL(v); let pk = -1; h.time.forEach((x, q) => { if (x >= t && x < t + 86400 && (pk < 0 || h.uv_index[q] > h.uv_index[pk])) pk = q; });
        return '<div><span>' + SW.fmt(t + 43200, D.wx.timezone, 'date') + '</span><b style="color:' + l[1] + '">' + n(v, 1) + ' · ' + l[0] + (pk >= 0 && v >= 1 ? ' <span class="dim" style="font-weight:400">peak ' + tm(h.time[pk]) + '</span>' : '') + '</b></div>';
      }).join('') + '</div><p class="dim small" style="line-height:1.5;margin:10px 0 0">The scale: 0 to 2 low, 3 to 5 moderate, 6 to 7 high, 8 to 10 very high, 11 and up extreme. Water, sand and snow bounce UV back at you, so the beach is stronger than the number says.</p></div></div></div>';
    $('#naBody').innerHTML = html;
    SW.chart($('#naChart'), { tz: D.wx.timezone, unit: 'level (0 to 10)', yRange: [0, 10], data: [p.xs, p.ys, p.mold], series: [{ label: 'Pollen', color: '#ffd24a', fill: '#ffd24a22', width: 2.5, dec: 1 }, { label: 'Mold spores', color: '#c9a7ff', width: 1.5, dec: 1 }] });
    const ux = today.map(i => h.time[i]);
    SW.chart($('#naUVChart'), { tz: D.wx.timezone, unit: 'UV index', data: [ux, today.map(i => h.uv_index[i]), today.map(i => h.uv_index_clear_sky[i])], series: [{ label: 'UV', color: '#ff8a4a', fill: '#ff8a4a22', width: 2.5, dec: 1 }, { label: 'If the sky were clear', color: '#8b9ab3', width: 1.2, dash: [5, 4], dec: 1 }] });
  }
  function parts(c) { // the other things floating in the air
    if (!c) return '<p class="dim small">Air quality readings are not available right now.</p>';
    const P = [['Fine particles (smoke, soot)', c.pm2_5, [9, 35, 55], 'µg/m³', 1], ['Coarse particles (dust, sea salt)', c.pm10, [54, 154, 254], 'µg/m³', 0], ['Ozone (smog)', c.ozone, [108, 140, 170], 'µg/m³', 0], ['Nitrogen dioxide (traffic)', c.nitrogen_dioxide, [100, 190, 680], 'µg/m³', 0], ['Sulfur dioxide (industry, ships)', c.sulphur_dioxide, [92, 200, 500], 'µg/m³', 1], ['Carbon monoxide (exhaust, fires)', c.carbon_monoxide, [5000, 10800, 14000], 'µg/m³', 0], ['Blowing desert dust', c.dust, [20, 50, 150], 'µg/m³', 0]];
    const words = ['Clean', 'Some', 'A lot', 'Unhealthy'], cols = ['#3ddc97', '#ffe44a', '#ffb020', '#ff5a5a'];
    return '<h2 style="margin-top:14px">Besides pollen</h2><div class="idx">' + P.filter(r => r[1] != null).map(function partRow(r) { const l = r[1] <= r[2][0] ? 0 : r[1] <= r[2][1] ? 1 : r[1] <= r[2][2] ? 2 : 3; return '<div><span>' + r[0] + '</span><b><span style="color:' + cols[l] + '">' + words[l] + '</span> <span class="dim" style="font-weight:400">' + n(r[1], r[4]) + ' ' + r[3] + '</span></b></div>'; }).join('') + '</div>';
  }

  // ---------- local species ----------
  const EMO = { Plantae: '🌿', Fungi: '🍄', Aves: '🐦', Mammalia: '🦌', Amphibia: '🐸', Reptilia: '🦎', Insecta: '🦋', Mollusca: '🐚', Arachnida: '🕷️', Actinopterygii: '🐟', Animalia: '🦀' };
  function chip(s) { return '<a class="na-sp" target="_blank" href="https://www.inaturalist.org/taxa/' + s.id + '" data-credit="' + esc(s.credit || '') + '">' + (s.img ? '<img alt="" loading="lazy" src="' + esc(s.img) + '">' : '<i>' + (EMO[s.group] || '🌿') + '</i>') + '<span>' + esc(s.name) + '</span></a>'; }
  function tile(s) { return '<a class="na-tile" target="_blank" href="https://www.inaturalist.org/taxa/' + s.id + '" data-credit="' + esc(s.credit || '') + '">' + (s.big ? '<img alt="" loading="lazy" src="' + esc(s.big) + '">' : '<i>' + (EMO[s.group] || '🌿') + '</i>') + '<b>' + esc(s.name) + '</b><span>' + esc(s.sci) + '</span></a>'; }
  const MOOD = { love: ['Loving it', '#3ddc97'], ok: ['Doing fine', '#8fb8ff'], hard: ['Having a hard day', '#ffb020'], busy: ['Busy', '#3ddc97'], quiet: ['Lying low', '#8b9ab3'], out: ['Out and about', '#3fc6ff'] };
  function groupCard(g, v, list) {
    const m = MOOD[v[0]];
    return '<div class="card na-g"><div class="na-g-h"><i>' + g.ico + '</i><div><b>' + g.k + '</b><span class="pill" style="background:' + m[1] + '22;color:' + m[1] + ';border-color:' + m[1] + '55">' + m[0] + '</span></div></div><p>' + v[1] + '</p>' + (list.length ? '<div class="na-chips">' + list.slice(0, 6).map(chip).join('') + '</div>' : '') + '</div>';
  }
  const credit = '<p class="dim small" style="margin:12px 0 0;line-height:1.5">The species shown are the ones people have recorded most often within about 20 miles of ' + '%P' + ', from the iNaturalist community. Hover a photo for its credit; click to read about it. What each one is doing is the usual pattern for that kind of plant or animal in this weather, so take it as a good guess: nature does not read forecasts.</p>';
  const waitLife = what => '<div class="card"><div class="state"><span class="spin"></span>Finding out which ' + what + ' live around ' + esc(D.loc.name) + '…</div></div>';

  // ---------- plants tab ----------
  const PLANTS = [
    { k: 'Redwoods', ico: '🌲', g: ['Sequoia', 'Sequoiadendron'], v: w => w.fog || w.fogH >= 4 ? ['love', 'Fog is a drink for a redwood. The needles comb water out of the mist and it drips to the roots; on a foggy coast that can be a third of the water they get all year.'] : w.raining || w.rainComing ? ['love', 'Rain is soaking in around their wide, shallow roots. Redwoods do nearly all their growing in the wet months.'] : w.hot || (w.dryAir && w.windy) ? ['hard', 'Hot, dry wind pulls water out of the needles faster than the roots can replace it. This is the weather redwoods like least.'] : w.gale ? ['hard', 'Strong wind is the main thing that brings down old redwoods, especially when the ground is soft from rain.'] : ['ok', 'Mild and calm suits them. They are quietly waiting for the next fog or rain.'] },
    { k: 'Ferns and horsetails', ico: '🌿', g: ['Polystichum', 'Pteridium', 'Polypodium', 'Blechnum', 'Struthiopteris', 'Athyrium', 'Adiantum', 'Dryopteris', 'Woodwardia', 'Pentagramma', 'Equisetum', 'Asplenium', 'Cystopteris', 'Osmunda', 'Onoclea', 'Matteuccia', 'Selaginella', 'Lomaria'], v: w => w.raining || w.fog || w.damp ? ['love', 'Ferns need wet air, and they have it. Polypody ferns that curled up brown in the dry season unroll and turn green within a day of rain.'] : w.hot || w.dryAir ? ['hard', 'Thin fern leaves lose water fast in dry air. They will be curled or drooping anywhere the sun reaches them.'] : w.frost ? ['hard', 'Frost burns tender fronds. The plant survives underground and sends up new ones.'] : ['ok', 'Shade and leftover moisture in the soil are keeping them comfortable.'] },
    { k: 'Mosses and lichens', ico: '🪨', g: ['Polytrichum', 'Dendroalsia', 'Isothecium', 'Kindbergia', 'Hypnum', 'Dicranum', 'Sphagnum', 'Marchantia', 'Bryum', 'Funaria', 'Rhytidiadelphus', 'Hylocomium', 'Thuidium', 'Leucolepis', 'Homalothecium', 'Scleropodium', 'Syntrichia', 'Tortula', 'Grimmia', 'Ceratodon', 'Atrichum', 'Plagiomnium', 'Conocephalum', 'Lunularia', 'Porella', 'Frullania', 'Racomitrium', 'Antitrichia', 'Neckera', 'Metaneckera', 'Orthotrichum', 'Claopodium', 'Eurhynchium', 'Fissidens'], v: w => w.raining || w.fog || w.damp ? ['love', 'Moss has no roots; it drinks through its leaves. Within minutes of getting wet it swells, turns bright green and starts growing.'] : w.dryAir || w.hot ? ['quiet', 'Dried to a crisp and switched off. That is normal: moss can wait months like this and wake up with the first rain.'] : ['ok', 'Still holding a little water from the last damp spell.'] },
    { k: 'Wildflowers', ico: '🌼', flowering: 1, g: [], v: w => w.raining ? ['quiet', 'Many flowers close or nod in rain to keep their pollen dry. They reopen when the sun comes back.'] : w.frost ? ['hard', 'Frost can blacken open petals. Buds that have not opened usually survive.'] : w.gale ? ['hard', 'Strong wind shreds petals and keeps the bees away.'] : w.sunny && w.mild ? ['love', 'Sun and mild air: flowers are wide open and bees can fly, so this is a good day for getting pollinated.' + (w.wet ? ' Recent rain means more are on the way.' : '')] : w.fog || w.cool ? ['quiet', 'Cool, gray weather keeps many flowers half-closed and most pollinators grounded. They will wait for sun.'] : ['ok', 'Open for business whenever the sun is out.'] },
    { k: 'Grasses', ico: '🌾', g: GRASS, v: w => w.raining || w.wet ? ['love', 'Rain is what grass waits for. In dry-summer country the hills turn from gold to green within a couple of weeks of the first good rain.'] : w.hot && w.dryAir ? ['quiet', 'Annual grasses have dried out and dropped their seed. Golden hills are not dead: the next generation is already lying in the soil.'] : w.frost ? ['quiet', 'Frost stops growth for the day, but grass shrugs it off.'] : ['ok', 'Growing slowly. Grass does most of its growing when it is mild and the soil is moist.'] },
    { k: 'Succulents and bluff plants', ico: '🪴', g: ['Dudleya', 'Sedum', 'Carpobrotus', 'Mesembryanthemum', 'Opuntia', 'Agave', 'Yucca', 'Cylindropuntia', 'Echinocereus', 'Ferocactus', 'Mammillaria', 'Aloe', 'Crassula', 'Aeonium', 'Sempervivum', 'Lewisia', 'Hesperoyucca', 'Delosperma'], v: w => w.frost ? ['hard', 'Leaves full of water can freeze and turn to mush. Frost is the biggest danger for succulents.'] : w.soaked ? ['hard', 'They store their own water and do not want more. Long soaking rain can rot them, which is why they grow on cliffs and rocks that drain fast.'] : w.sunny || w.dryAir ? ['love', 'Sun and dry air are exactly what they are built for. Fat leaves hold water for weeks.'] : w.raining ? ['ok', 'Topping up their water tanks. A little rain is welcome.'] : ['ok', 'Unbothered. These are some of the toughest plants around.'] },
    { k: 'Shrubs and brush', ico: '🌳', g: ['Baccharis', 'Ceanothus', 'Arctostaphylos', 'Gaultheria', 'Rhododendron', 'Vaccinium', 'Frangula', 'Morella', 'Rubus', 'Lupinus', 'Salvia', 'Artemisia', 'Adenostoma', 'Eriogonum', 'Heteromeles', 'Ribes', 'Rosa', 'Sambucus', 'Garrya', 'Holodiscus', 'Symphoricarpos', 'Lonicera', 'Cornus', 'Viburnum', 'Ilex', 'Rhus', 'Prunus', 'Amelanchier', 'Ericameria', 'Diplacus', 'Eriophyllum', 'Physocarpus', 'Mahonia', 'Berberis', 'Cytisus', 'Genista', 'Ulex', 'Larrea', 'Encelia', 'Spiraea', 'Kalmia', 'Lindera', 'Hamamelis'], v: w => w.hot && w.dryAir ? ['hard', 'Tough leaves with a waxy coat keep water in, but in heat like this even brush shuts down and waits. It is also when brush burns most easily.'] : w.raining || w.wet ? ['love', 'Deep roots are refilling. Many shrubs put on new leaves and flower buds after rain.'] : w.gale ? ['ok', 'Shrubs on windy coasts grow low and leaning for exactly this reason. They can take it.'] : ['ok', 'Mild weather is easy for them. Look for berries and late flowers.'] },
    { k: 'Poison oak, ivy and sumac', ico: '⚠️', g: ['Toxicodendron'], v: w => w.month >= 11 || w.month <= 2 ? ['quiet', 'Bare sticks at this time of year, and still able to give you a rash. The oil is in the stems too, and wet weather does not wash it off.'] : w.month <= 5 ? ['love', 'New leaves are shiny and reddish and full of oil. Leaves of three, let it be.'] : w.hot || w.dryAir ? ['ok', 'Leaves turn red early in dry weather. Pretty, and still not to be touched.'] : ['ok', 'In full leaf. The oil that causes the rash is there in any weather.'] },
    { k: 'Broadleaf trees', ico: '🍂', g: ['Quercus', 'Alnus', 'Acer', 'Salix', 'Umbellularia', 'Arbutus', 'Notholithocarpus', 'Populus', 'Betula', 'Fagus', 'Fraxinus', 'Aesculus', 'Platanus', 'Juglans', 'Carya', 'Ulmus', 'Tilia', 'Liquidambar', 'Liriodendron', 'Magnolia', 'Cercis', 'Cornus', 'Eucalyptus', 'Acacia', 'Robinia', 'Celtis', 'Nyssa', 'Sassafras', 'Castanea', 'Carpinus', 'Ostrya', 'Malus', 'Crataegus', 'Sorbus'], v: w => w.gale ? ['hard', 'Wind this strong strips leaves and snaps branches, worst when the ground is wet and soft.'] : w.frost ? ['ok', 'A frosty night is the signal that turns leaves red and gold and tells the tree to go to sleep for winter.'] : w.raining || w.wet ? ['love', 'Rain reaches the deep roots that carry them through the dry months.'] : w.hot && w.dryAir ? ['hard', 'In heat like this trees close the tiny pores in their leaves to save water, which also stops them growing.'] : ['ok', 'Comfortable. ' + (w.month >= 9 && w.month <= 11 ? 'Shorter days are telling them to pull the green out of their leaves.' : w.month >= 3 && w.month <= 5 ? 'Longer days are bringing out new leaves.' : 'Nothing to complain about today.')] },
    { k: 'Pines, firs and cypress', ico: '🌲', g: ['Pinus', 'Pseudotsuga', 'Abies', 'Picea', 'Tsuga', 'Hesperocyparis', 'Cupressus', 'Juniperus', 'Thuja', 'Calocedrus', 'Larix', 'Taxus', 'Torreya', 'Chamaecyparis'], v: w => w.gale ? ['hard', 'Evergreens catch the wind like sails. After soaking rain, this is when they come down across roads and power lines.'] : w.hot && w.dryAir ? ['hard', 'Needles lose little water, but weeks of dry heat weaken them and bark beetles move in.'] : w.raining || w.fog ? ['love', 'Needles collect fog and drizzle and drip it to the ground. Stand under one in fog and it is raining.'] : w.sunny ? ['love', 'Evergreens keep making food from sunlight all winter while other trees are bare.'] : ['ok', 'Steady as ever.'] }
  ];
  function garden(w) {
    const out = [], inch = v => n(dP(v), U.us() ? 2 : 0) + ' ' + U.p();
    if (w.rain72 >= 0.25) out.push('<b>No need to water.</b> ' + inch(w.rain72) + ' of rain fell in the last three days.'); else if (w.rain48n >= 0.25) out.push('<b>Hold off watering.</b> About ' + inch(w.rain48n) + ' of rain is on the way in the next two days.');
    else if (w.hot || (w.dryAir && w.windy)) out.push('<b>Water deeply this evening or early tomorrow.</b> Heat and dry wind are pulling water out of leaves fast.'); else if (w.rain72 < 0.02 && w.hiT >= 65) out.push('<b>Check pots and new plants.</b> No rain in three days, and none coming soon.'); else out.push('<b>Watering can wait.</b> Cool, damp air means plants are using very little.');
    if (w.frost) out.push('<b>Frost tonight</b> (low ' + deg(w.loT) + ' around ' + tm(w.loAt) + '). Cover tender plants or bring pots in.');
    if (w.maxGust >= 35) out.push('<b>Gusts to ' + n(dW(w.maxGust)) + ' ' + U.w() + '.</b> Stake tall plants and bring in anything that can blow over.');
    if (w.sunny && w.mild && !w.windy) out.push('A good day to plant, weed or just be out there.'); else if (w.raining) out.push('Stay off wet beds; walking on soaked soil packs it down.');
    return out;
  }
  function plants(w) {
    const L = D.life; if (!L) { $('#naBody').innerHTML = waitLife('plants'); return; }
    const all = L.plants || [], today = (w.raining ? 'Raining' : w.fog ? 'Foggy' : w.sunny ? 'Sunny' : w.night ? 'Night' : 'Cloudy') + ', ' + deg(w.T) + ', ' + n(w.rh) + '% humidity' + (w.windy ? ', gusty' : '');
    const cards = PLANTS.map(function one(g) { const list = g.flowering ? L.flowering : all.filter(p => g.g.includes(p.genus)); return list.length || g.flowering ? [g, g.v(w), list] : null; }).filter(Boolean);
    const order = { love: 0, hard: 1, ok: 2, quiet: 3 }; cards.sort((x, y) => order[x[1][0]] - order[y[1][0]]);
    const lovers = cards.filter(c => c[1][0] === 'love').map(c => c[0].k.toLowerCase()), haters = cards.filter(c => c[1][0] === 'hard').map(c => c[0].k.toLowerCase());
    $('#naBody').innerHTML = '<div class="grid"><div class="card" id="naPlHero"><div class="fn-lead">' + today + '. ' + (lovers.length ? 'Good weather for <b style="color:#3ddc97">' + lovers.join(', ') + '</b>.' : 'An ordinary day for most plants.') + (haters.length ? ' Tougher on <b style="color:#ffb020">' + haters.join(', ') + '</b>.' : '') + '</div>' +
      '<div class="na-garden"><span>In the garden today</span><ul>' + garden(w).map(x => '<li>' + x + '</li>').join('') + '</ul></div></div>' +
      (all.length ? '' : '<div class="card"><div class="state">The local plant list is not available right now, so only general notes are shown.</div></div>') +
      '<div class="na-cards">' + cards.map(c => groupCard(c[0], c[1], c[2])).join('') + '</div>' +
      (L.flowering.length ? '<div class="card" id="naBloom"><h2>Flowering near you this month</h2><div class="na-tiles">' + L.flowering.slice(0, 12).map(tile).join('') + '</div></div>' : '') +
      (L.fungi.length ? '<div class="card" id="naFungi"><h2>Mushrooms out this month</h2><p class="dim" style="margin:0 0 10px;line-height:1.5">' + (w.wet && !w.cold ? 'Rain followed by mild days is what brings mushrooms up. This is good mushroom weather: look a few days after each soaking.' : w.dryAir || w.rain72 < 0.02 ? 'Too dry for most mushrooms right now. The fungus is still there underground, waiting for rain.' : 'A mushroom is only the fruit; the fungus lives in the soil and wood all year and fruits after rain.') + ' Never eat one on the strength of a photo.</p><div class="na-tiles">' + L.fungi.slice(0, 8).map(tile).join('') + '</div></div>' : '') +
      '<div class="card">' + credit.replace('%P', esc(D.loc.name)).replace('<p class="dim small" style="margin:12px 0 0;', '<p class="dim small" style="margin:0;') + '</div></div>';
  }

  // ---------- animals tab ----------
  const nm = re => s => re.test(s.name), grp = k => s => s.group === k, westCoast = l => l.lon < -116.5 && l.lon > -126 && l.lat > 32 && l.lat < 49.5;
  const ANIMALS = [
    { k: 'Songbirds and garden birds', ico: '🐦', f: s => s.group === 'Aves' && !/Hawk|Vulture|Eagle|Kite|Falcon|Osprey|Harrier|Condor|Kestrel|Owl|Gull|Pelican|Cormorant|Oystercatcher|Egret|Heron|Sandpiper|Tern|Murre|Loon|Grebe|Plover|Turnstone|Willet|Whimbrel|Curlew|Duck|Goose|Scoter|Merganser|Guillemot|Surfbird|Tattler|Sanderling|Godwit|Dowitcher|Teal|Mallard|Coot|Swan|Shearwater|Albatross|Puffin|Auklet|Bufflehead|Wigeon|Scaup|Brant|Avocet|Stilt|Killdeer|Yellowlegs|Dunlin|Ibis|Crane|Rail|Kingfisher|Hummingbird/.test(s.name), v: w => w.night ? ['quiet', 'Asleep, tucked deep in thick branches' + (w.cold ? ' and fluffed up into a ball to hold their heat. Small birds can burn a tenth of their weight just getting through a cold night.' : '.')] : w.gale ? ['quiet', 'Staying low and out of the wind. Flying in gusts like these costs too much energy.'] : w.raining ? ['quiet', 'Light rain does not stop them, but in steady rain they sit tight in cover. Watch for a rush to feed the moment it lets up.'] : w.rainComing && !w.raining ? ['busy', 'Birds feel the pressure drop before a storm and feed hard while they can. Feeders get busy before rain.'] : w.fog ? ['quiet', 'Quieter than usual. Birds start their day by the light, so on a foggy morning the singing starts late.'] : w.cold ? ['busy', 'Cold burns fuel, so they spend nearly the whole day eating.'] : w.hot ? ['quiet', 'Resting in the shade through the hot hours, beaks open to cool off. Busiest at dawn and dusk.'] : w.hour < 10 ? ['busy', 'Morning is their busiest time: feeding after the night, and singing to hold their patch.'] : ['out', 'Feeding and moving about. A calm, mild day is easy living.'] },
    { k: 'Hummingbirds', ico: '🌺', f: nm(/Hummingbird/), v: w => w.night || w.cold ? ['quiet', 'On a cold night a hummingbird drops into a deep sleep called torpor: its heart slows from over a thousand beats a minute to about fifty so it does not starve before morning.'] : w.raining ? ['out', 'Still feeding. They burn fuel so fast that they cannot afford to wait out the rain.'] : w.gale ? ['quiet', 'Perched out of the wind, making quick dashes to flowers between gusts.'] : ['busy', 'Visiting hundreds of flowers today. A hummingbird has to eat about every fifteen minutes.'] },
    { k: 'Hawks, vultures and owls', ico: '🦅', f: nm(/Hawk|Vulture|Eagle|Kite|Falcon|Osprey|Harrier|Condor|Kestrel|Owl/), v: w => w.night ? ['busy', 'The day hunters are roosting; this is the owls\' shift.' + (w.windy || w.raining ? ' Wind and rain make it hard for owls to hear mice, so it is a hungry night.' : ' A calm night is perfect: they hunt by sound.')] : w.raining || w.fog ? ['quiet', 'Grounded. Soaring birds need rising warm air, and there is none in ' + (w.fog ? 'fog' : 'rain') + '. Look for them hunched on fence posts and poles.'] : w.windy ? ['out', 'Riding the wind where it pushes up over ridges and bluffs. Kestrels and kites hang in one spot, facing into it.'] : w.sunny && w.hour >= 10 && w.hour <= 16 ? ['busy', 'The sun has warmed the ground and columns of rising air are forming. Vultures and hawks circle up on them without flapping.'] : w.hour < 10 ? ['quiet', 'Waiting for the day to warm up. Vultures often sit with wings spread to dry off and heat up first.'] : ['out', 'Hunting from perches, since there is not much lift in the air.'] },
    { k: 'Shorebirds and seabirds', ico: '🌊', f: nm(/Gull|Pelican|Cormorant|Oystercatcher|Egret|Heron|Sandpiper|Tern|Murre|Loon|Grebe|Plover|Turnstone|Willet|Whimbrel|Curlew|Duck|Goose|Scoter|Merganser|Guillemot|Surfbird|Tattler|Sanderling|Godwit|Dowitcher|Teal|Mallard|Coot|Shearwater|Bufflehead|Wigeon|Scaup|Brant|Avocet|Stilt|Killdeer|Yellowlegs|Dunlin|Kingfisher/), v: w => w.gale ? ['quiet', 'Storm winds push ocean birds close to shore and into sheltered coves. Gulls stand in flocks all facing the wind, so it smooths their feathers.'] : w.fog ? ['out', 'Fog does not bother them much. Shorebirds work by the tide, not the weather: they feed when the water is low.'] : w.raining ? ['out', 'Already waterproof. Herons and egrets keep fishing; rain on the water can even hide them from the fish.'] : w.night ? ['out', 'Many shorebirds feed at night when the tide is low, finding food by touch.'] : ['busy', 'Feeding on the falling tide and resting at high tide. Pelicans and cormorants dive wherever small fish are near the top.'] },
    { k: 'Deer, elk and other grazers', ico: '🦌', f: nm(/Deer|Elk|Moose|Pronghorn|Sheep|Rabbit|Hare|Cottontail|Jackrabbit/), v: w => w.gale ? ['quiet', 'Nervous and hidden. In strong wind they cannot hear or smell danger coming, so they bed down in thick cover.'] : w.raining ? ['quiet', 'Bedded down under trees in steady rain. They come out to feed hungry as soon as it eases, so the hour after rain is the best time to see them.'] : w.hot ? ['quiet', 'Lying in the shade until evening. Look at dawn and dusk.'] : w.fog ? ['out', 'Fog makes them bolder; they wander out into the open at times they normally would not. Drive carefully.'] : w.night || w.hour < 8 || w.hour >= 16 ? ['busy', 'This is their time: grazers feed most around dawn and dusk. Watch for them on road edges.'] : w.cool ? ['out', 'On cool days they stay up and feeding through the middle of the day.'] : ['quiet', 'Resting and chewing in cover through the middle of the day; out again toward evening.'] },
    { k: 'Foxes, bobcats, raccoons and other hunters', ico: '🦊', f: nm(/Fox|Bobcat|Coyote|Raccoon|Skunk|Lion|Cougar|Bear|Weasel|Badger|Ringtail|Opossum|Mink|Marten|Fisher|Lynx|Wolf/), v: w => w.raining ? ['quiet', 'Curled up somewhere dry. They hunt in the gaps between showers. Soft wet ground afterward is the best time to find their tracks.'] : w.gale ? ['quiet', 'Wind hides the small sounds they hunt by, so most stay in.'] : w.night ? ['busy', 'Night shift. ' + (w.fog ? 'Fog carries scent well and hides them, so it is a good night for hunting.' : 'Calm nights are best: they find mice by sound.')] : w.hour < 8 || w.hour >= 17 ? ['busy', 'Dawn and dusk are when the hunters are moving.'] : w.cool && !w.sunny ? ['out', 'On cool gray days foxes and bobcats often hunt in daylight.'] : ['quiet', 'Asleep in a den or thicket until evening.'] },
    { k: 'Squirrels, chipmunks and other small mammals', ico: '🐿️', f: nm(/Squirrel|Chipmunk|Gopher|Vole|Mouse|Rat\b|Woodrat|Mole|Shrew|Beaver|Porcupine|Marmot|Groundhog|Muskrat/), v: w => w.raining || w.gale ? ['quiet', 'In the nest. Squirrels hate getting soaked and will skip a day\'s feeding in bad weather.'] : w.night ? ['quiet', 'Squirrels are asleep; mice and woodrats are out, staying under cover on bright nights.'] : w.month >= 9 && w.month <= 11 ? ['busy', 'Fall is the rush: gathering and burying nuts and seeds for winter.'] : w.hot ? ['quiet', 'Stretched out flat on a cool branch or in a burrow through the heat.'] : ['busy', 'Out feeding. Gophers and moles push up fresh mounds when the soil is soft after rain.'] },
    { k: 'Bats', ico: '🦇', f: nm(/Bat\b|Myotis|Pipistrelle/), v: w => !w.night ? ['quiet', 'Asleep in roosts until dusk.'] : w.raining || w.gale || w.T < 50 ? ['quiet', 'Staying in. Below about 50° there are too few flying insects to be worth the trip, and rain soaks their fur.'] : ['busy', 'A warm, calm night with insects in the air: bats are out. One can eat a thousand mosquito-sized bugs in an hour.'] },
    { k: 'Seals, sea lions, otters and whales', ico: '🦭', f: nm(/Seal|Sea Lion|Whale|Otter|Dolphin|Porpoise|Orca/), v: function sea(w) {
      let s = w.gale ? ['quiet', 'Rough seas keep seals and sea lions in the water, where it is calmer than on wave-washed rocks. Too choppy to spot whales.'] : w.fog ? ['out', 'They carry on as normal, but you will not see far. Listen for sea lions barking.'] : w.sunny && !w.windy ? ['out', 'Calm and sunny: seals haul out on the rocks to warm up and rest, most of all at low tide. Flat water makes whale spouts easy to see.'] : ['out', 'Seals rest on the rocks at low tide and feed at high tide, whatever the sky is doing.'];
      const m = w.month; if (westCoast(D.loc)) s = [s[0], s[1] + (m === 12 || m <= 2 ? ' Gray whales are passing now on their way south to Mexico.' : m >= 3 && m <= 5 ? ' Gray whales are heading north now, mothers and calves close to shore. Harbor seal pups are being born: keep well back from any pup on the beach, its mother is nearby.' : m >= 6 && m <= 10 ? ' Humpback and blue whales feed offshore in summer and fall.' : '')]; return s;
    } },
    { k: 'Frogs, newts and salamanders', ico: '🐸', f: grp('Amphibia'), v: w => (w.raining || w.wet) && w.T >= 42 ? ['love', (w.night ? 'A mild, wet night is the big event of their year. ' : 'This is their weather. ') + 'Amphibians breathe partly through their skin and must stay damp. Newts and salamanders walk to their breeding ponds on rainy nights, often across roads, and frogs sing after dark.'] : w.fog || w.damp ? ['out', 'Damp enough to come out. Look under logs and along stream edges; frogs call on mild evenings.'] : w.frost || w.cold ? ['quiet', 'Too cold. They are tucked into burrows and under logs, barely moving.'] : ['quiet', 'Hiding from the dry air under logs, in rodent burrows and in damp cracks. They come out when it rains.'] },
    { k: 'Lizards, snakes and turtles', ico: '🦎', f: grp('Reptilia'), v: w => w.night || w.T < 55 ? ['quiet', 'Reptiles cannot make their own heat. Below about 55° they are too stiff to hunt and stay hidden under rocks and bark.'] : w.raining ? ['quiet', 'Under cover. Garter snakes are the exception: they hunt frogs and slugs on wet days.'] : w.hot ? ['quiet', 'Too hot even for them in the open. They hunt early and late; rattlesnakes switch to evenings in summer.'] : w.sunny ? ['busy', 'Basking weather. Lizards sit on warm rocks and fence rails to heat up, then hunt. Snakes stretch out on sunny paths, so watch your step.'] : ['out', 'Warm enough to move, but without sun they are slow. Look on dark rocks and pavement, which hold heat.'] },
    { k: 'Butterflies, bees and dragonflies', ico: '🦋', f: s => s.group === 'Insecta', v: w => w.raining ? ['quiet', 'Grounded. A raindrop to a butterfly is like a bowling ball to us. They hang under leaves and wait.'] : w.night ? ['quiet', 'Butterflies and bees are asleep. ' + (w.T >= 55 ? 'Moths are out; watch the porch light.' : 'Too cold for most moths too.')] : w.gale ? ['quiet', 'Too windy to fly. Bees stay home above about 20 mph.'] : w.T < 55 ? ['quiet', 'Too cold. Butterflies need their flight muscles at about 80° and warm them in the sun; honey bees stay in the hive below about 55°. Bumble bees can shiver themselves warm and are the only ones out.'] : w.sunny ? ['busy', 'Warm and sunny: flying weather. Butterflies bask with wings open, bees work the flowers, dragonflies patrol over water.'] : ['out', 'Warm enough for bees, but butterflies fly little without sun.'] },
    { k: 'Slugs and snails', ico: '🐌', f: nm(/Slug|Snail(?!.*(Sea|Tegula|Turban|Moon|Periwinkle|Dog|Top))|Sideband|Shoulderband|Lancetooth/), v: w => w.raining || w.fog || (w.damp && !w.sunny) ? ['love', 'A slug is mostly water with no shell to hold it in, so wet weather means freedom. They are out in the open, eating fallen leaves and mushrooms.'] : w.night && w.rh > 70 ? ['out', 'Out under cover of dark, when the air is damp and nothing can dry them.'] : ['quiet', 'Hidden under logs and leaves, sealed in their own slime to keep from drying out.'] },
    { k: 'Tide pool and shore life', ico: '🦀', f: s => (s.group === 'Mollusca' && !/Slug|Sideband|Shoulderband|Lancetooth/.test(s.name) || /Mussel|Chiton|Limpet|Abalone|Dorid|Nudibranch|Tegula|Anemone|Star|Crab|Urchin|Barnacle|Sea |Kelp|Sculpin|Sand Dollar|By-the-wind/.test(s.name)) && !/Garden|Land /.test(s.name) && s.group !== 'Aves' && s.group !== 'Mammalia' && s.group !== 'Insecta', v: w => w.gale ? ['hard', 'Big surf pounds the rocks. Mussels and barnacles hold on with glue and threads; anything loose gets torn off. Stay well back from the water.'] : w.hot && w.sunny ? ['hard', 'A hot, sunny low tide is the hardest time: animals left out of the water bake. Anemones fold shut and cover themselves in bits of shell as sunscreen.'] : w.raining ? ['ok', 'Rain dilutes the salt in shallow pools. Snails and limpets clamp down tight until the tide returns.'] : ['ok', 'Their day runs on the tide, not the weather: feeding underwater, closed up when the water drops. The lowest tides are the time to see them (Ocean has the times). Never turn your back on the sea.'] }
  ];
  function animals(w) {
    const L = D.life; if (!L) { $('#naBody').innerHTML = waitLife('animals'); return; }
    const all = L.animals || [], used = new Set();
    const cards = ANIMALS.map(function one(g) { const list = all.filter(s => !used.has(s.id) && g.f(s)); list.forEach(s => used.add(s.id)); return list.length ? [g, g.v(w), list] : null; }).filter(Boolean);
    const order = { love: 0, busy: 0, out: 1, ok: 2, hard: 2, quiet: 3 }; cards.sort((x, y) => order[x[1][0]] - order[y[1][0]]);
    const act = cards.filter(c => order[c[1][0]] === 0).map(c => c[0].k.toLowerCase()), low = cards.filter(c => c[1][0] === 'quiet').length;
    const scene = (w.raining ? 'Raining' : w.fog ? 'Foggy' : w.night ? 'Dark' : w.sunny ? 'Sunny' : 'Cloudy') + ' and ' + deg(w.T) + (w.windy ? ', with gusts to ' + n(dW(w.gust)) + ' ' + U.w() : '') + ' at ' + SW.fmt(w.now, D.wx.timezone, 'time');
    const best = w.raining || w.gale ? 'Most wildlife is sheltering. The first calm hour after the weather clears is usually the best time to look.' : w.night ? 'The night animals have the place to themselves.' : w.hour < 9 || w.hour >= 16 ? 'This is one of the two best times of day to see wildlife.' : 'Midday is the quiet time. Dawn and dusk are when most animals move.';
    const top = all.filter(s => s.big).sort((a, b) => b.count - a.count).slice(0, 12);
    $('#naBody').innerHTML = '<div class="grid"><div class="card" id="naAnHero"><div class="fn-lead">' + scene + '. ' + (act.length ? 'Most active right now: <b style="color:#3ddc97">' + act.slice(0, 4).join(', ') + '</b>.' : low ? 'A quiet moment out there.' : '') + '</div><div class="dim" style="margin-top:8px;font-size:15px">' + best + '</div></div>' +
      (cards.length ? '<div class="na-cards">' + cards.map(c => groupCard(c[0], c[1], c[2])).join('') + '</div>' : '<div class="card"><div class="state">No wildlife sightings have been recorded near here for this month, or the list is not available right now.</div></div>') +
      (top.length ? '<div class="card" id="naSeen"><h2>Most often seen near you this month</h2><div class="na-tiles">' + top.map(tile).join('') + '</div></div>' : '') +
      '<div class="card">' + credit.replace('%P', esc(D.loc.name)).replace('<p class="dim small" style="margin:12px 0 0;', '<p class="dim small" style="margin:0;') + '</div></div>';
  }

  function draw() {
    if (!D || !$('#naBody')) return; const w = weather(), t = st.natureTab || 'air';
    if (t === 'plants') plants(w); else if (t === 'animals') animals(w); else air(w);
  }
  SW.nature = { load };
})();

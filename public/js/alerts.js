// Skywatch alerts: NWS warnings for the saved place and nationwide, with desktop notices.
(function alertsMod() {
  const { $, api, st, esc } = SW;
  const ORDER = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };
  let local = [], sel = null, q = '', sevF = 'all', built = false;
  SW.alertsAll = null;
  SW.localAlerts = () => local;

  SW.getAlerts = async function getAlerts() {
    const j = await api.json('https://api.weather.gov/alerts/active?status=actual&message_type=alert,update', 120);
    SW.alertsAll = j.features.sort((a, b) => (ORDER[a.properties.severity] - ORDER[b.properties.severity]) || (Date.parse(b.properties.sent) - Date.parse(a.properties.sent)));
    SW.emit('alerts');
    return SW.alertsAll;
  };
  async function getLocal() {
    const loc = SW.loc(); if (!loc) return [];
    try {
      const j = await api.json('https://api.weather.gov/alerts/active?status=actual&point=' + loc.lat.toFixed(4) + ',' + loc.lon.toFixed(4), 120);
      local = j.features;
    } catch (e) { local = []; }
    const b = $('#alertBadge'); b.textContent = local.length; b.classList.toggle('hidden', !local.length);
    // desktop notice for anything new at the saved place
    const fresh = local.filter(f => !st.seenAlerts.includes(f.properties.id));
    if (fresh.length) {
      st.seenAlerts = st.seenAlerts.concat(fresh.map(f => f.properties.id)).slice(-200); SW.save();
      if (st.notify !== false) fresh.slice(0, 3).forEach(function notify(f) {
        try { const nt = new Notification(f.properties.event + ' · ' + loc.name, { body: f.properties.headline || f.properties.areaDesc || '', icon: 'icon.png' }); nt.onclick = () => SW.openAlert(f.properties.id); } catch (e) { }
      });
    }
    return local;
  }

  function item(f) {
    const p = f.properties;
    return '<div class="al sev-' + p.severity + (sel === p.id ? ' on' : '') + '" data-id="' + p.id + '" style="border-left-color:' + SW.alertColor(p) + '"><b>' + esc(p.event) + '</b><span>' + esc((p.areaDesc || '').slice(0, 90)) + '</span><br><span>Until ' + (p.ends || p.expires ? SW.fmt(Date.parse(p.ends || p.expires) / 1000, null, 'full') : '—') + '</span></div>';
  }
  function renderList() {
    const box = $('#alList'); if (!box) return;
    const loc = SW.loc(), all = SW.alertsAll || [];
    const ql = q.trim().toLowerCase();
    const filt = all.filter(f => (sevF === 'all' || f.properties.severity === sevF) && (!ql || (f.properties.event + ' ' + f.properties.areaDesc).toLowerCase().includes(ql)));
    box.innerHTML = '<div class="sub">At ' + esc(loc ? loc.name : '') + '</div>' + (local.length ? local.map(item).join('') : '<div class="state" style="padding:12px">Nothing in effect here.</div>') +
      '<div class="sub">Across the country · ' + filt.length + ' of ' + all.length + '</div>' + (SW.alertsAll ? filt.slice(0, 250).map(item).join('') + (filt.length > 250 ? '<div class="state">Showing the 250 most serious. Type in the box to narrow it down.</div>' : '') : '<div class="state"><span class="spin"></span>Loading…</div>');
    SW.$$('.al', box).forEach(e => e.onclick = () => select(e.dataset.id));
  }
  function find(id) { return local.concat(SW.alertsAll || []).find(f => f.properties.id === id); }
  function select(id) {
    sel = id; const f = find(id), box = $('#alertDetail'); if (!box) return;
    SW.$$('#alList .al').forEach(e => e.classList.toggle('on', e.dataset.id === id));
    if (!f) { box.innerHTML = '<div class="state">That alert has ended.</div>'; return; }
    const p = f.properties, t = s => s ? SW.fmt(Date.parse(s) / 1000, null, 'fullz') : '—';
    box.innerHTML = '<h1 style="color:' + SW.alertColor(p) + '">' + esc(p.event) + '</h1><p class="dim">' + esc(p.senderName || '') + ' · ' + esc(p.severity) + ' · ' + esc(p.certainty) + ' · ' + esc(p.urgency) + '</p>' +
      '<div class="card" style="margin:12px 0"><div class="kv" style="grid-template-columns:repeat(3,auto)"><div><span>Issued</span><b>' + t(p.sent) + '</b></div><div><span>Starts</span><b>' + t(p.onset || p.effective) + '</b></div><div><span>Ends</span><b>' + t(p.ends || p.expires) + '</b></div></div></div>' +
      (f.geometry ? '<p><button class="btn" id="alMap">Show on the map</button></p>' : '') +
      '<p><b>' + esc(p.headline || '') + '</b></p><p class="dim">' + esc(p.areaDesc || '') + '</p>' +
      '<pre class="prod">' + esc(p.description || '') + '</pre>' + (p.instruction ? '<h3 style="margin:16px 0 6px;color:var(--warn)">What to do</h3><pre class="prod">' + esc(p.instruction) + '</pre>' : '');
    const mb = $('#alMap'); if (mb) mb.onclick = () => { SW.show('map'); SW.map.focus(f); };
  }
  SW.openAlert = function openAlert(id) { SW.show('alerts'); load().then(() => { select(id); const e = $('#alList .al.on'); if (e) e.scrollIntoView({ block: 'center' }); }); };

  async function load() {
    const root = $('#v-alerts');
    if (!built) {
      root.innerHTML = '<div id="alertList"><div class="row" style="margin-bottom:8px"><input type="text" id="alQ" placeholder="Filter: tornado, flood, a county…" style="width:100%"><select id="alSev" style="width:130px"><option value="all">All levels</option><option>Extreme</option><option>Severe</option><option>Moderate</option><option>Minor</option></select></div><div id="alList"></div></div><div id="alertDetail"><div class="state">Pick an alert on the left to read it.</div></div>';
      $('#alQ').oninput = e => { q = e.target.value; renderList(); };
      $('#alSev').onchange = e => { sevF = e.target.value; renderList(); };
      built = true;
    }
    renderList();
    await Promise.all([getLocal(), SW.getAlerts().catch(e => { SW.toast('Alerts feed problem: ' + e.message); })]);
    renderList();
    if (!sel && local[0]) select(local[0].properties.id);
  }
  SW.alerts = { load, poll: function poll() { getLocal().then(renderList); SW.getAlerts().then(renderList, () => { }); } };
  SW.on('loc', () => { sel = null; getLocal().then(renderList); });
})();

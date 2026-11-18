// Skywatch discussions: the forecasters' own written products.
(function briefingMod() {
  const { $, api, esc } = SW;
  const PRODUCTS = [
    ['AFD', 'Forecast discussion (local office)', 1], ['HWO', 'Hazardous weather outlook', 1], ['ZFP', 'Zone forecast', 1], ['CWF', 'Coastal waters forecast', 1], ['FWF', 'Fire weather forecast', 1], ['RER', 'Record report', 1], ['PNS', 'Public information statement', 1], ['LSR', 'Local storm reports', 1],
    ['SWODY1', 'Storm Prediction Center: today', 0], ['SWODY2', 'Storm Prediction Center: tomorrow', 0], ['PMDSPD', 'National short-range discussion', 0], ['PMDEPD', 'National extended discussion', 0], ['TWOAT', 'Atlantic tropical outlook', 0], ['TWOEP', 'East Pacific tropical outlook', 0]
  ];
  let type = 'AFD';
  async function load() {
    const root = $('#v-briefing'), loc = SW.loc(); if (!loc) return;
    root.innerHTML = '<div class="head"><h1>Discussions</h1><span class="dim" id="brOffice"></span><div class="spacer"></div><select id="brType">' + PRODUCTS.map(p => '<option value="' + p[0] + '">' + p[1] + '</option>').join('') + '</select><select id="brVer" style="max-width:240px"></select></div><div class="card"><div id="brBody"></div></div>';
    $('#brType').value = type; $('#brType').onchange = e => { type = e.target.value; load(); };
    const body = $('#brBody'); SW.loading(body, 'Finding the latest…');
    try {
      const P = PRODUCTS.find(p => p[0] === type); let url = 'https://api.weather.gov/products/types/' + type;
      if (P[2]) { const pt = await SW.nwsPoint(loc); $('#brOffice').textContent = 'NWS office ' + pt.cwa + ' · ' + loc.name; url += '/locations/' + pt.cwa; }
      const list = (await api.json(url, 600))['@graph'] || [];
      if (!list.length) { body.innerHTML = '<div class="state">This office has not issued one recently.</div>'; return; }
      const ver = $('#brVer'); ver.innerHTML = list.slice(0, 12).map(x => '<option value="' + x.id + '">' + SW.fmt(Date.parse(x.issuanceTime) / 1000, null, 'full') + '</option>').join('');
      const show = async id => { SW.loading(body); try { const p = await api.json('https://api.weather.gov/products/' + id, 86400); body.innerHTML = '<pre class="prod">' + esc(p.productText.trim()) + '</pre>'; } catch (e) { SW.fail(body, e, () => show(id)); } };
      ver.onchange = e => show(e.target.value);
      await show(list[0].id);
    } catch (e) {
      if (/404|Not Found|Unable|Invalid/i.test(e.message)) body.innerHTML = '<div class="state">Written discussions come from the US National Weather Service, so they are only available for places in the United States.</div>';
      else SW.fail(body, e, load);
    }
  }
  SW.briefing = { load };
})();

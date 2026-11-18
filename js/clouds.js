// Skywatch cloud guide: pictures of the ten main kinds of cloud, and a best guess at which are overhead.
(function cloudsMod() {
  const sky = (a, b) => '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient><filter id="s"><feGaussianBlur stdDeviation="2.2"/></filter><filter id="s2"><feGaussianBlur stdDeviation="5"/></filter></defs><rect width="220" height="120" fill="url(#g)"/>';
  const puff = (x, y, r, f, o) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + (f || '#fff') + '" opacity="' + (o || 1) + '"/>';
  const cumulus = (x, y, k, top, base) => '<g filter="url(#s)">' + puff(x, y, 16 * k, base) + puff(x + 20 * k, y - 4 * k, 20 * k, base) + puff(x + 42 * k, y, 15 * k, base) + '<rect x="' + (x - 14 * k) + '" y="' + y + '" width="' + (70 * k) + '" height="' + (13 * k) + '" rx="' + (6 * k) + '" fill="' + base + '"/>' + puff(x + 4 * k, y - 8 * k, 13 * k, top) + puff(x + 22 * k, y - 14 * k, 17 * k, top) + puff(x + 38 * k, y - 6 * k, 12 * k, top) + '</g>';
  const ground = '<rect y="108" width="220" height="12" fill="#1d3a2a"/>';
  const rain = (x0, x1, y0, y1, c) => { let s = ''; for (let x = x0; x < x1; x += 9) s += '<path d="M' + x + ' ' + y0 + 'l-5 ' + (y1 - y0) + '" stroke="' + (c || '#9cc4ff') + '" stroke-width="1.3" opacity=".75"/>'; return s; };
  const svg = body => '<svg viewBox="0 0 220 120" preserveAspectRatio="xMidYMid slice" style="stroke:none;fill:initial">' + body + '</svg>';

  const CLOUDS = [
    { id: 'cirrus', name: 'Cirrus', nick: 'wispy mare\'s tails', level: 'High · above 20,000 ft',
      art: svg(sky('#1f5fae', '#8fc0ee') + '<g fill="none" stroke="#fff" stroke-linecap="round" filter="url(#s)" opacity=".9"><path d="M14 46q46-30 96-14" stroke-width="3"/><path d="M28 62q52-26 108-6" stroke-width="2.2"/><path d="M96 30q40-18 92-2q10 4 16 12" stroke-width="2.6"/><path d="M118 78q36-16 86-4" stroke-width="1.8"/><path d="M10 84q30-12 62-6" stroke-width="1.6"/></g>'),
      looks: 'Thin white streaks and feathery hooks, very high up.',
      why: 'It is so cold up there that the cloud is made of ice crystals, not water drops. The crystals fall slowly and strong high winds comb them into long streaks, like hair blowing in the wind.' },
    { id: 'cirrostratus', name: 'Cirrostratus', nick: 'the halo veil', level: 'High · above 20,000 ft',
      art: svg(sky('#3d74b8', '#a9cdee') + '<rect width="220" height="120" fill="#fff" opacity=".34"/><circle cx="110" cy="56" r="9" fill="#fffbe6"/><circle cx="110" cy="56" r="20" fill="#fff8d0" opacity=".3" filter="url(#s2)"/><circle cx="110" cy="56" r="40" fill="none" stroke="#fff" stroke-width="2.5" opacity=".75" filter="url(#s)"/>'),
      looks: 'A smooth, milky sheet that turns the sky pale. The sun or moon shines through with a ring around it.',
      why: 'A thin, even layer of ice crystals covers the whole sky. Each crystal bends light like a tiny prism, and together they draw a halo. It often means rain or snow within a day.' },
    { id: 'altocumulus', name: 'Altocumulus', nick: 'a flock of sheep', level: 'Middle · 6,500 to 20,000 ft',
      art: svg(sky('#2c69b2', '#9cc6ee') + '<g filter="url(#s)">' + [0, 1, 2, 3].map(r => [0, 1, 2, 3, 4, 5, 6].map(c => '<ellipse cx="' + (18 + c * 31 + (r % 2) * 14) + '" cy="' + (22 + r * 22) + '" rx="12" ry="7" fill="#fff" opacity=".93"/><ellipse cx="' + (18 + c * 31 + (r % 2) * 14) + '" cy="' + (26 + r * 22) + '" rx="10" ry="4" fill="#b9c6d8" opacity=".7"/>').join('')).join('') + '</g>'),
      looks: 'Rows of small white and gray puffs, like a flock of sheep or fish scales.',
      why: 'A layer of damp air in the middle of the sky is gently bubbling. Each rising bubble makes a little puff, and the sinking air between them leaves the gaps of blue.' },
    { id: 'altostratus', name: 'Altostratus', nick: 'frosted glass', level: 'Middle · 6,500 to 20,000 ft',
      art: svg(sky('#5f7fa6', '#aebfd2') + '<rect width="220" height="120" fill="#8f9db2" opacity=".72"/><circle cx="118" cy="50" r="15" fill="#f4f1e0" opacity=".55" filter="url(#s2)"/><circle cx="118" cy="50" r="7" fill="#fbf8ea" opacity=".6" filter="url(#s)"/>' + ground),
      looks: 'A flat gray-blue sheet. The sun shows only as a dim blur, as if through frosted glass, and you cast no shadow.',
      why: 'A broad, thick layer of water drops and ice has spread across the middle of the sky as warm air slides up over cooler air. It is thick enough to scatter the sunlight in every direction.' },
    { id: 'stratocumulus', name: 'Stratocumulus', nick: 'lumpy gray rolls', level: 'Low · below 6,500 ft',
      art: svg(sky('#3a70b4', '#a3c7ea') + '<g filter="url(#s)">' + [0, 1].map(r => [0, 1, 2, 3].map(c => '<ellipse cx="' + (26 + c * 58 + r * 26) + '" cy="' + (34 + r * 34) + '" rx="34" ry="15" fill="#f2f4f8"/><ellipse cx="' + (26 + c * 58 + r * 26) + '" cy="' + (42 + r * 34) + '" rx="31" ry="9" fill="#77859b" opacity=".85"/>').join('')).join('') + '</g>' + ground),
      looks: 'Big, lumpy gray-and-white rolls or patches with bits of blue between them.',
      why: 'Low, moist air is being stirred but cannot rise far, because a lid of warmer air sits on top. So the cloud spreads sideways into lumpy rolls. This is the classic cloud of the California coast.' },
    { id: 'stratus', name: 'Stratus', nick: 'the gray blanket', level: 'Low · below 6,500 ft',
      art: svg(sky('#8b97a8', '#b9c2ce') + '<rect width="220" height="78" fill="#8791a1"/><rect y="60" width="220" height="34" fill="#9ba5b3" filter="url(#s2)"/>' + ground + '<path d="M150 108l10-26 10 26z M30 108l8-20 8 20z" fill="#12261b"/>'),
      looks: 'A flat, featureless gray blanket low overhead. Dull light, sometimes drizzle.',
      why: 'It is basically fog that is not touching the ground. Air has cooled evenly over a wide area, so the cloud forms as one smooth layer with no bumps.' },
    { id: 'cumulus', name: 'Cumulus', nick: 'cotton balls', level: 'Low · bases below 6,500 ft',
      art: svg(sky('#1d62b6', '#8ec2f0') + cumulus(34, 58, 1.1, '#fff', '#c4d0e0') + cumulus(136, 44, 0.85, '#fff', '#c9d4e2') + cumulus(112, 88, 0.55, '#fff', '#ccd6e4') + ground),
      looks: 'Bright white heaps with flat bottoms and cauliflower tops, floating in a blue sky.',
      why: 'The sun warms the ground and bubbles of warm air float upward. When a bubble gets high enough to cool off, its moisture turns to droplets: that height is the flat base. The puffy top is the bubble still rising.' },
    { id: 'towering', name: 'Towering cumulus', nick: 'shower clouds', level: 'Low base, growing tall',
      art: svg(sky('#2a66ae', '#93c0ea') + '<g filter="url(#s)">' + puff(92, 84, 26, '#8492a8') + puff(124, 86, 24, '#8492a8') + '<rect x="70" y="84" width="80" height="12" rx="5" fill="#77859b"/>' + puff(98, 66, 24, '#eef1f6') + puff(120, 60, 22, '#fff') + puff(108, 42, 20, '#fff') + puff(120, 26, 15, '#fff') + '</g>' + rain(84, 140, 96, 110) + ground),
      looks: 'Cumulus that has grown into tall, hard-edged towers with dark bases. Brief showers fall from them.',
      why: 'The air is unstable, meaning a rising bubble stays warmer than the air around it and just keeps climbing. The taller it grows, the more water it holds, until it falls as a shower.' },
    { id: 'nimbostratus', name: 'Nimbostratus', nick: 'the steady-rain cloud', level: 'Low to middle, very thick',
      art: svg(sky('#4a5361', '#6c7684') + '<rect width="220" height="70" fill="#4b5462"/><rect y="52" width="220" height="30" fill="#5d6675" filter="url(#s2)"/>' + rain(8, 220, 62, 108, '#a9c6f2') + ground),
      looks: 'A thick, dark gray layer with no shape at all, and rain or snow falling steadily from it.',
      why: 'A storm system is lifting a huge mass of moist air slowly and evenly. The cloud is thousands of feet thick, so very little sunlight gets through, and it rains for hours instead of minutes.' },
    { id: 'cumulonimbus', name: 'Cumulonimbus', nick: 'the thunderhead', level: 'Ground to 40,000 ft or more',
      art: svg(sky('#274a7c', '#7f9fc6') + '<g filter="url(#s)"><path d="M36 26h150q14 0 10 9q-6 9-40 11h-90q-34-2-38-11q-4-9 8-9z" fill="#eef1f6"/>' + puff(92, 52, 22, '#e3e8ef') + puff(126, 52, 22, '#e9edf3') + puff(110, 70, 26, '#b3bfd0') + puff(86, 84, 22, '#5d6a7e') + puff(132, 84, 24, '#56637a') + '<rect x="62" y="84" width="96" height="12" rx="5" fill="#465166"/></g><path d="M112 94l-9 10h7l-6 10 14-13h-7z" fill="#ffe45a"/>' + rain(70, 100, 97, 110) + rain(124, 156, 97, 110) + ground),
      looks: 'A giant cloud mountain with a dark base and a flat, spreading top shaped like an anvil. It brings lightning, downpours, hail and gusty wind.',
      why: 'Very unstable air shoots upward for miles until it hits the ceiling of the weather layer and has to spread sideways, making the anvil. Ice and water colliding inside build up the electric charge that becomes lightning.' },
    { id: 'fog', name: 'Fog', nick: 'a cloud on the ground', level: 'At ground level',
      art: svg(sky('#8793a3', '#aab3bf') + ground + '<path d="M40 108l12-34 12 34z M150 108l14-42 14 42z M100 108l8-22 8 22z" fill="#22382c"/><g fill="#d3d9e1" filter="url(#s2)"><rect y="56" width="220" height="16" opacity=".55"/><rect y="74" width="220" height="16" opacity=".7"/><rect y="92" width="220" height="22" opacity=".8"/></g>'),
      looks: 'The world goes gray and soft, and you cannot see far.',
      why: 'The air near the ground has cooled until it cannot hold all its moisture, so tiny droplets form right where you are standing. It happens on clear, calm nights, or when damp sea air drifts over cold water or land.' }
  ];

  // a best guess at what is overhead, from cloud amount at each height, rain, and storm energy
  function guess(o) { // {low, mid, high, code, cape, day}
    const on = [], c = o.code;
    if (c === 45 || c === 48) on.push('fog');
    if (c >= 95 || (o.cape > 1200 && c >= 80)) on.push('cumulonimbus');
    else if ((c >= 80 && c <= 86) || (o.cape > 500 && o.low > 25 && o.day)) on.push('towering');
    else if ((c >= 51 && c <= 67) || (c >= 71 && c <= 77)) on.push('nimbostratus');
    if (!on.includes('nimbostratus') && !on.includes('fog')) {
      if (o.low >= 85) on.push('stratus'); else if (o.low >= 45) on.push('stratocumulus'); else if (o.low >= 8) on.push(o.day && !on.includes('towering') ? 'cumulus' : on.includes('towering') ? null : 'stratocumulus');
    }
    if (o.mid >= 70) on.push('altostratus'); else if (o.mid >= 12) on.push('altocumulus');
    if (o.high >= 70) on.push('cirrostratus'); else if (o.high >= 8) on.push('cirrus');
    return on.filter(Boolean);
  }
  function card(o) {
    const on = guess(o), list = CLOUDS.slice().sort((a, b) => on.includes(b.id) - on.includes(a.id));
    const names = on.map(id => CLOUDS.find(c => c.id === id).name.toLowerCase());
    const lead = !on.length ? 'You\'ll probably see no cloud to speak of right now: just open sky.' : 'If you look up right now, you\'ll probably see <b>' + (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]) + '</b>.' + (on.includes('altostratus') || on.includes('stratus') || on.includes('nimbostratus') ? ' The lower layers may hide whatever is above them.' : '');
    return '<div class="card" id="luClouds"><h2>What kind of clouds, and why they look that way</h2><p style="margin:0 0 12px;font-size:15px">' + lead + ' <span class="dim">This is a best guess, not a sighting. The forecast tells Skywatch how much cloud there is at each height, whether it is raining, and how unstable the air is, and Skywatch works out the likely kinds from those clues.</span></p><div class="cl-grid">' +
      list.map(c => '<div class="cl' + (on.includes(c.id) ? ' on' : '') + '">' + art(c) + '<div class="cl-t"><b>' + c.name + '</b>' + (on.includes(c.id) ? '<span class="pill" style="background:var(--accent2)">You\'ll probably see this</span>' : '') + '<i>' + c.nick + ' · ' + c.level + '</i><p>' + c.looks + '</p><p class="why"><u>Why:</u> ' + c.why + '</p></div></div>').join('') + '</div></div>';
  }
  // real photos (a few per kind, because the same cloud can look quite different); the drawing shows if a photo is missing
  function art(c) {
    const ph = (window.SW_CLOUD_PHOTOS || {})[c.id] || [];
    if (!ph.length) return c.art;
    return '<div class="cl-art" data-id="' + c.id + '" data-i="0"><img alt="' + c.name + '" src="clouds/' + ph[0].f + '" onerror="this.classList.add(\'hidden\');this.nextElementSibling.classList.remove(\'hidden\')"><div class="cl-draw hidden">' + c.art + '</div>' +
      (ph.length > 1 ? '<button class="cl-nav" data-d="-1" title="Previous photo">‹</button><button class="cl-nav r" data-d="1" title="Next photo">›</button><div class="cl-dots">' + ph.map((p, i) => '<i class="' + (i ? '' : 'on') + '"></i>').join('') + '</div>' : '') +
      '<a class="cl-credit" target="_blank" href="' + SW.esc(ph[0].page) + '">' + credit(ph[0]) + '</a></div>';
  }
  const credit = p => 'Photo: ' + SW.esc(p.artist) + ' · ' + SW.esc(p.license);
  document.addEventListener('click', function cloudNav(e) {
    const b = e.target.closest && e.target.closest('.cl-nav'); if (!b) return;
    const box = b.parentElement, ph = (window.SW_CLOUD_PHOTOS || {})[box.dataset.id] || [], i = (+box.dataset.i + +b.dataset.d + ph.length) % ph.length, img = box.querySelector('img');
    box.dataset.i = i; img.classList.remove('hidden'); box.querySelector('.cl-draw').classList.add('hidden'); img.src = 'clouds/' + ph[i].f;
    box.querySelectorAll('.cl-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    const a = box.querySelector('.cl-credit'); a.href = ph[i].page; a.innerHTML = credit(ph[i]);
  });
  SW.clouds = { card, guess };
})();

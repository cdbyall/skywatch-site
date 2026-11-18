// Skywatch astronomy: where the sun, moon, planets and stars are for any place and time.
// Low-precision formulas (good to a fraction of a degree), which is plenty for a sky chart.
(function astroMod(root) {
  const R = Math.PI / 180, sin = x => Math.sin(x * R), cos = x => Math.cos(x * R), norm = x => ((x % 360) + 360) % 360;
  const days = t => t / 86400 + 2440587.5 - 2451545.0;            // days since J2000 from unix seconds
  const OBL = 23.4393;

  function eclToEq(lam, bet) {
    const ra = Math.atan2(sin(lam) * cos(OBL) - Math.tan(bet * R) * sin(OBL), cos(lam)) / R;
    const dec = Math.asin(sin(bet) * cos(OBL) + cos(bet) * sin(OBL) * sin(lam)) / R;
    return { ra: norm(ra), dec };
  }
  function sunEcl(d) { const g = 357.528 + 0.9856003 * d, L = 280.460 + 0.9856474 * d; return norm(L + 1.915 * sin(g) + 0.020 * sin(2 * g)); }
  function sun(t) { const d = days(t), lam = sunEcl(d); return Object.assign(eclToEq(lam, 0), { lam }); }
  function moon(t) {
    const T = days(t) / 36525;
    const lam = 218.32 + 481267.881 * T + 6.29 * sin(135.0 + 477198.87 * T) - 1.27 * sin(259.3 - 413335.36 * T) + 0.66 * sin(235.7 + 890534.22 * T) + 0.21 * sin(269.9 + 954397.74 * T) - 0.19 * sin(357.5 + 35999.05 * T) - 0.11 * sin(186.5 + 966404.03 * T);
    const bet = 5.13 * sin(93.3 + 483202.02 * T) + 0.28 * sin(228.2 + 960400.89 * T) - 0.28 * sin(318.3 + 6003.15 * T) - 0.17 * sin(217.6 - 407332.21 * T);
    const par = 0.9508 + 0.0518 * cos(135.0 + 477198.87 * T) + 0.0095 * cos(259.3 - 413335.36 * T) + 0.0078 * cos(235.7 + 890534.22 * T) + 0.0028 * cos(269.9 + 954397.74 * T);
    const s = sun(t), e = eclToEq(lam, bet);
    const elong = Math.acos(sin(s.dec) * sin(e.dec) + cos(s.dec) * cos(e.dec) * cos(s.ra - e.ra)) / R;
    return Object.assign(e, { lam: norm(lam), par, lit: (1 - cos(elong)) / 2, waxing: norm(lam - s.lam) < 180, age: norm(lam - s.lam) / 360 });
  }
  // JPL approximate elements: a, e, I, L, long. of perihelion, long. of node; then their change per century
  const EL = {
    Mercury: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
    Venus: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255, 0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
    Earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
    Mars: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
    Jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
    Saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]
  };
  function helio(name, T) {
    const q = EL[name], a = q[0] + q[6] * T, e = q[1] + q[7] * T, I = q[2] + q[8] * T, L = q[3] + q[9] * T, wb = q[4] + q[10] * T, O = q[5] + q[11] * T;
    const w = wb - O, M = norm(L - wb + 180) - 180;
    let E = M + e / R * sin(M);
    for (let i = 0; i < 6; i++) E += (M - (E - e / R * sin(E))) / (1 - e * cos(E));
    const xp = a * (cos(E) - e), yp = a * Math.sqrt(1 - e * e) * sin(E);
    return [
      (cos(w) * cos(O) - sin(w) * sin(O) * cos(I)) * xp + (-sin(w) * cos(O) - cos(w) * sin(O) * cos(I)) * yp,
      (cos(w) * sin(O) + sin(w) * cos(O) * cos(I)) * xp + (-sin(w) * sin(O) + cos(w) * cos(O) * cos(I)) * yp,
      sin(w) * sin(I) * xp + cos(w) * sin(I) * yp
    ];
  }
  const PMAG = { Mercury: 0, Venus: -4.2, Mars: 0.5, Jupiter: -2.3, Saturn: 0.7 };
  function planets(t) {
    const T = days(t) / 36525, e = helio('Earth', T);
    return ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].map(function one(n) {
      const p = helio(n, T), x = p[0] - e[0], y = p[1] - e[1], z = p[2] - e[2];
      const lam = Math.atan2(y, x) / R, bet = Math.atan2(z, Math.hypot(x, y)) / R;
      return Object.assign(eclToEq(lam, bet), { name: n, mag: PMAG[n] });
    });
  }
  // sky position for a place: altitude (degrees above the horizon) and azimuth (compass bearing)
  function lst(t, lon) { return norm(280.46061837 + 360.98564736629 * days(t) + lon); }
  function altaz(ra, dec, t, lat, lon, lstDeg) {
    const H = (lstDeg == null ? lst(t, lon) : lstDeg) - ra;
    const alt = Math.asin(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H)) / R;
    const az = norm(Math.atan2(sin(H), cos(H) * sin(lat) - Math.tan(dec * R) * cos(lat)) / R + 180);
    return { alt, az };
  }
  function sunPos(t, lat, lon) { const s = sun(t); return altaz(s.ra, s.dec, t, lat, lon); }
  function moonPos(t, lat, lon) { const m = moon(t), p = altaz(m.ra, m.dec, t, lat, lon); p.alt -= m.par * cos(p.alt); return Object.assign(p, { lit: m.lit, waxing: m.waxing, age: m.age }); }
  // next times a body crosses a given altitude: returns [{t, up:true|false}] within the window
  function crossings(fn, level, t0, hours) {
    const out = [], step = 300; let prev = fn(t0) - level;
    for (let t = t0 + step; t <= t0 + hours * 3600; t += step) {
      const cur = fn(t) - level;
      if ((prev < 0) !== (cur < 0)) out.push({ t: t - step + step * (-prev) / (cur - prev), up: cur > 0 });
      prev = cur;
    }
    return out;
  }
  const PHASES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  const phaseName = age => PHASES[Math.round(age * 8) % 8];
  const compass = az => ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(az / 45) % 8];

  root.SWastro = { sun, moon, planets, lst, altaz, sunPos, moonPos, crossings, phaseName, compass };
})(typeof window !== 'undefined' ? window : globalThis);

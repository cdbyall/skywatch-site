// Skywatch Explain mode: point at anything and get a plain-language explanation.
(function explainMod() {
  const { $, $$, st } = SW;

  // ---- model names (used by dropdowns, chart legends and the table) ----
  const MODEL = {
    'best available blend': 'A mix that automatically uses whichever computer forecast is best for this spot. A good default when you just want an answer.',
    gfs: 'GFS: the main American worldwide forecast. Runs four times a day and looks 16 days ahead. Good for the big picture, a bit blurry on small details.',
    hrrr: 'HRRR: a very detailed American forecast that is rebuilt every hour, but only looks about two days ahead. The best one for "what will the storms do this afternoon?"',
    nam: 'NAM: an American forecast for North America that looks about three days ahead in medium detail.',
    nbm: 'NBM: the National Blend of Models. The Weather Service mixes many forecasts together and corrects them using what really happened. Often the most reliable single line.',
    ecmwf: 'ECMWF (the "Euro"): the European worldwide forecast. Widely thought to be the most accurate over several days.',
    'ecmwf aifs': 'ECMWF AIFS: the European forecast made by artificial intelligence that learned from decades of past weather. New, fast and surprisingly good.',
    icon: 'ICON: the German worldwide forecast. A solid second opinion.',
    gem: 'GEM: the Canadian worldwide forecast. Another second opinion, especially handy in winter.',
    ukmo: 'UKMO: the British worldwide forecast from the Met Office.',
    jma: 'JMA: the Japanese worldwide forecast.',
    arpege: 'ARPEGE: the French worldwide forecast.',
    graphcast: 'GraphCast: an artificial-intelligence forecast from Google that learned from past weather instead of solving physics equations.'
  };
  const MODEL_ID = { best_match: 'best available blend', gfs_seamless: 'gfs', ncep_hrrr_conus: 'hrrr', ncep_nam_conus: 'nam', ncep_nbm_conus: 'nbm', ecmwf_ifs025: 'ecmwf', ecmwf_aifs025_single: 'ecmwf aifs', icon_seamless: 'icon', gem_seamless: 'gem', ukmo_seamless: 'ukmo', jma_seamless: 'jma', meteofrance_seamless: 'arpege', gfs_graphcast025: 'graphcast' };
  const modelTip = name => { const k = String(name || '').toLowerCase().replace(/[●\s]+/g, ' ').trim(); for (const m of Object.keys(MODEL).sort((a, b) => b.length - a.length)) if (k.startsWith(m)) return MODEL[m]; return null; };

  // ---- what each dropdown choice means ----
  const OPT = {
    radarSel: {
      none: 'Radar is switched off.',
      iem: 'Every US weather radar stitched into one picture. Colors show rain or snow falling right now: blue and green are light, yellow is moderate, red and pink are very heavy or hail.',
      mrms_bref: 'A cleaned-up national radar picture that removes false echoes like birds and hills. It shows rain close to the ground.',
      mrms_cref: 'Like the normal radar, but it shows the strongest rain found at any height in the cloud. Storms look bigger and scarier here, which helps spot ones that are still growing.',
      rec: 'Radar pictures that Skywatch saved on this computer while it was running. Choose which six-hour stretch to replay, then press play.',
      rv: 'Radar from many countries joined together, so you can look outside the United States. Less detailed than the US pictures.',
      etops: 'How tall the storm clouds are. Taller clouds mean stronger storms.',
      ptype: 'What is falling: rain, snow, or an icy mix.',
      s_sr_bref: 'The raw view from one single radar dish, at its sharpest. Best for looking closely at one storm near you.',
      s_sr_bvel: 'Wind seen by one radar. Green is air moving toward the radar, red is moving away. Bright green right next to bright red means the air is spinning, which is how forecasters spot tornadoes.',
      s_bdhc: 'The radar\'s best guess at what each echo is made of: rain, heavy rain, hail, snow, or things that are not weather at all, like birds.',
      s_boha: 'How much rain the radar thinks fell in the last hour.',
      s_bdsa: 'How much rain the radar thinks has fallen since the storm began.'
    },
    satSel: {
      none: 'Satellite is switched off.',
      GeoColor: 'What the clouds would look like from space with your own eyes. At night it switches to a view that still shows clouds, with city lights underneath.',
      Infrared: 'A heat picture of the clouds, which works day and night. Colder means higher cloud tops, and the brightest colors are the tallest storms.',
      Visible: 'A sharp black-and-white photo using sunlight. Great detail by day, completely dark at night.',
      Air_Mass: 'A special color view that tells warm, moist air apart from cold, dry air. Forecasters use it to find jet streams and big storm systems.'
    },
    mfVar: {
      temperature_2m: 'How warm or cold the air will be at head height.',
      dew_point_2m: 'How much moisture is in the air. Above about 60°F (16°C) feels muggy; storms love high dew points.',
      precipitation: 'How much rain (or snow, once melted) is expected in each hour.',
      snowfall: 'How much snow is expected to pile up in each hour.',
      wind_gusts_10m: 'The strongest short bursts of wind expected.',
      cloud_cover: 'How much of the sky is covered by cloud.',
      pressure_msl: 'The weight of the air. Low pressure areas bring storms, high pressure brings calm, clear weather.',
      cape: 'Fuel for thunderstorms. Near zero means none; over 1,000 is plenty; over 2,500 can power severe storms.'
    },
    spcSel: {
      none: 'Storm outlook is switched off.',
      day1otlk_cat: 'Where the Storm Prediction Center expects thunderstorms today, shaded from general storms up through marginal, slight, enhanced, moderate and high risk of severe weather.',
      day1otlk_torn: 'The chance of a tornado within 25 miles of any point today.',
      day1otlk_wind: 'The chance of damaging thunderstorm winds within 25 miles of any point today.',
      day1otlk_hail: 'The chance of large hail within 25 miles of any point today.',
      day2otlk_cat: 'The severe storm risk areas for tomorrow.',
      day3otlk_cat: 'The severe storm risk areas for the day after tomorrow.'
    },
    baseSel: { dark: 'A dark map that makes radar colors stand out.', light: 'A light map, easier to read in a bright room.', imagery: 'Real photos of the ground from above.', topo: 'A map showing hills, mountains and valleys.' },
    mdVar: {
      temperature_2m: 'Compare what each model thinks the temperature will be.',
      dew_point_2m: 'Compare how humid each model thinks it will be.',
      precip_acc: 'A running total of rain. Each line climbs as that model adds more rain, so the right-hand end is its total for the whole period.',
      precipitation: 'How much rain each model expects hour by hour.',
      wind_speed_10m: 'Compare the steady wind each model expects.',
      wind_gusts_10m: 'Compare the strongest gusts each model expects.',
      pressure_msl: 'Compare air pressure. A sharp dip means a storm system passing.',
      cloud_cover: 'Compare how cloudy each model thinks it will be.',
      snowfall: 'Compare how much snow each model expects each hour.',
      cape: 'Compare thunderstorm fuel between models.'
    },
    mdEns: {
      gfs025: 'The American model run 31 times with slightly different starting points.',
      ecmwf_ifs025: 'The European model run 51 times with slightly different starting points. The gold standard for judging confidence.',
      icon_seamless: 'The German model run 40 times with slightly different starting points.',
      gem_global: 'The Canadian model run 21 times with slightly different starting points.'
    },
    brType: {
      AFD: 'Your local forecasters explaining, in their own words, what they expect and how sure they are. The single best thing to read to understand the "why" behind the forecast.',
      HWO: 'A short list of any dangerous weather your local office is watching for over the next week.',
      ZFP: 'The plain-text forecast for each part of your area.',
      CWF: 'The forecast for boaters near the coast: wind, waves and swell.',
      FWF: 'A forecast for firefighters: humidity, wind and how easily fires could spread.',
      RER: 'Notes when a weather record is tied or broken, such as a record high.',
      PNS: 'General announcements, such as rainfall or snowfall totals after a storm.',
      LSR: 'Reports from spotters and the public of what actually happened: hail sizes, wind damage, flooding.',
      SWODY1: 'The national severe storm experts explaining today\'s thunderstorm risk.',
      SWODY2: 'The national severe storm experts explaining tomorrow\'s thunderstorm risk.',
      PMDSPD: 'National forecasters describing the weather across the country for the next two days.',
      PMDEPD: 'National forecasters describing the pattern for days three to seven.',
      TWOAT: 'What the National Hurricane Center is watching in the Atlantic.',
      TWOEP: 'What the National Hurricane Center is watching in the eastern Pacific.'
    }
  };
  const HEAD = {
    radarSel: 'Radar: choose which radar picture to show.', satSel: 'Satellite: choose a view of the clouds from space.', mfVar: 'What the model map shows.',
    spcSel: 'Storm outlook.', baseSel: 'Base map: the map drawn underneath.', mdVar: 'What to compare.', mdEns: 'Which ensemble to show.', brType: 'Which written product to read.'
  };

  // ---- labelled numbers (matched by their little caption) ----
  const TERM = {
    sun: 'Where the sun is. Degrees up means height above the horizon: 0 is on the horizon, 90 is straight overhead.',
    'low clouds': 'Thick clouds below about 6,500 feet. These are the ones that turn the day gray and hide stars completely.',
    'middle clouds': 'Clouds between about 6,500 and 20,000 feet.', 'high clouds': 'Thin, wispy ice clouds above 20,000 feet. You can often see the sun, moon and bright stars through them.',
    'fully dark': 'The hours when the sun is far enough below the horizon that no twilight glow is left. This is when you can see the most stars.',
    'average cloud': 'How much of the sky clouds are expected to cover, averaged over the dark hours.',
    sky: 'Whether the sun is up, the sky is in twilight, or it is fully dark at the chosen time.', 'cloud forecast': 'How much of the sky clouds should cover at the chosen time.',
    mercury: 'The closest planet to the sun. Hard to spot: only ever low in the sky just after sunset or before sunrise.', venus: 'The brightest thing in the sky after the sun and moon. Seen in the evening or morning, never in the middle of the night.',
    mars: 'The red planet. Look for a steady orange-red dot.', jupiter: 'The biggest planet: a very bright, steady white dot. Binoculars show its moons.', saturn: 'The ringed planet: a steady pale-yellow dot. A small telescope shows the rings.', planets: 'Planets look like bright stars that do not twinkle.',
    'wettest hour': 'If rain is involved, the hour with the heaviest rain. If it stays dry, the hour when the air holds the most moisture (highest humidity), usually near dawn.', 'driest hour': 'The hour when the air is driest (lowest humidity), usually mid-afternoon.',
    'warmest hour': 'The hour with the highest temperature.', 'coldest hour': 'The hour with the lowest temperature. Usually just around sunrise.', 'windiest hour': 'The hour with the strongest gusts.', 'best chance of rain': 'The hour when rain is most likely, and how likely.',
    'average high / low': 'The typical afternoon high and overnight low for the days counted so far.', 'total rain': 'All the rain that fell this month, and how many days had any.', 'warmest day': 'The day with the highest temperature this month.', 'coldest night': 'The day with the lowest temperature this month.', 'wettest day': 'The day with the most rain this month.', 'days counted': 'How many days of this month have happened and are included.',
    'days since rain': 'How many days since it last rained enough to matter. The longer the stretch, the drier the grass and brush.', 'rain, last 30 days': 'Total rain over the last month.', 'smoke (fine particles)': 'Tiny particles in the air, mostly from smoke. Under 12 is clean, over 35 is smoky and worth avoiding outdoor exercise.', 'fires within 100 mi': 'Wildfires that are not fully contained within 100 miles of you.', temperature: 'How warm the air is.',
    'next high': 'When the water will next be at its highest, and how high.', 'next low': 'When the water will next be at its lowest, and how low.', 'today\'s swing': 'The difference between today\'s highest and lowest water.',
    'tide strength': 'Spring tides (nothing to do with the season) happen at full and new moon and have the biggest swing. Neap tides happen at half moon and have the smallest.',
    'measured level': 'The real water height from a gauge at this station right now, if it has one.', 'above prediction': 'How far the real water is above or below the tide table. Strong onshore wind and low air pressure push it up.', 'water temperature': 'The sea temperature measured at this station.',
    'lowest low (best tide-pooling)': 'The lowest water of the week: the best time to explore tide pools and walk the exposed beach.', 'highest high': 'The highest water of the week.', why: 'What the moon and sun are doing to make the tides bigger or smaller this week.',
    wind: 'How fast the air is moving and where it is coming from. "SW 8" means it blows from the southwest at 8.',
    gusts: 'The strongest short bursts of wind. Gusts over about 40 mph (65 km/h) can break branches.',
    humidity: 'How full of water the air is, compared with the most it could hold right now. 100% often means fog or dew.',
    'dew point': 'The temperature the air would have to cool to before dew or fog forms. It is the best measure of mugginess: under 55°F (13°C) feels dry, over 65°F (18°C) feels sticky.',
    pressure: 'The weight of the air above you, in hectopascals. About 1013 is normal. Falling pressure usually means weather is on the way; rising means clearing.',
    cloud: 'How much of the sky is covered by clouds.',
    visibility: 'How far you can see. Low numbers mean fog, smoke or heavy rain.',
    'uv index': 'How strong the sunburn rays are. 0 to 2 is low, 6 or more means you burn quickly without protection.',
    sunrise: 'When the sun comes up today.', sunset: 'When the sun goes down today.',
    moon: 'The moon\'s shape tonight and how much of its face is lit.',
    'air quality': 'How clean the air is on the US scale. Under 50 is good, over 100 can bother sensitive people, over 150 is unhealthy for everyone.',
    'storm energy (cape)': 'Fuel for thunderstorms. Near zero means storms can\'t grow. Over 1,000 is plenty, and over 2,500 can power severe storms.',
    'cap (cin)': 'A lid of warm air that holds storms down. A big number means storms struggle to start; but if the lid breaks, they can go up fast.',
    'lifted index': 'A quick stability check. Positive means calm air. Negative means air wants to rise, and below about −4 means strong storms are possible.',
    'cloud base (lcl)': 'How high up clouds would start to form, given as an air pressure. A bigger number means lower clouds.',
    'wind shear 0–6 km': 'How much the wind changes between the ground and about 4 miles up. Over about 35 knots helps storms organize and rotate.',
    'lapse rate 700–500': 'How quickly it gets colder as you go up through the middle of the sky. Over about 7 means rising air keeps accelerating, which feeds big storms.',
    'water in the air': 'If you squeezed all the moisture out of the whole column of air above you, this is how deep the puddle would be. High values mean heavy downpours are possible.',
    'freezing level': 'The height where the air drops below freezing. Above this, precipitation is snow or ice.',
    issued: 'When the Weather Service sent this alert out.', starts: 'When the dangerous weather is expected to begin.', ends: 'When the alert is due to end. It may be extended or cancelled early.'
  };
  const CARD = [
    ['what is in the air right now', 'Everything floating in the air you breathe: pollen by the kind of plant it comes from, mold spores, and then smoke, dust and gases.'],
    ['when it will be worst', 'How pollen and mold are expected to rise and fall over the next two days. Plan to be outdoors in the dips.'],
    ['plants to look out for', 'The wind-pollinated plants that grow near you, with the ones releasing pollen now listed first.'],
    ['sun strength', 'How strong the burning part of sunlight is today, hour by hour. The dashed line is what it would be with no clouds.'],
    ['uv for the next few days', 'The strongest UV expected each day.'],
    ['flowering near you', 'Plants that people nearby have photographed in flower during this month in past years.'],
    ['mushrooms out this month', 'Mushrooms and other fungi recorded near you at this time of year, and whether the weather is right for them.'],
    ['most often seen near you', 'The animals people have recorded most often near you during this month.'],
    ['roads around', 'What driving is like near your place right now and over the next day.'],
    ['weather warnings on your route', 'Official warnings in force somewhere along this drive. Click one to read it.'],
    ['chain controls', 'Where California requires tire chains or snow tires. R-1 means chains or snow tires; R-2 means chains unless you have four-wheel drive with snow tires; R-3 means chains on everything.'],
    ['closures and one-way', 'Places on your route where the road is closed, or down to one lane with traffic taking turns, during your drive.'],
    ['see the road', 'Live pictures from highway cameras along your route, in the order you will pass them.'],
    ['what kind of clouds', 'A picture guide to the main kinds of cloud. The ones marked "You will probably see this" are Skywatch\'s best guess at what is overhead, worked out from how much cloud the forecast has at each height, whether it is raining, and how unstable the air is.'],
    ['if you looked up right now', 'A plain description of the sky over your head this minute: how cloudy it is, and where the sun and moon are. "Degrees up" is how high something is: 0 is the horizon, 90 is straight overhead. Your fist held at arm\'s length covers about 10 degrees.'],
    ['stargazing tonight', 'A rating for tonight\'s sky once it is fully dark. Clouds matter most. A bright moon also washes out faint stars, like a streetlight in the sky.'],
    ['the sky at any hour', 'A map of the sky for the time on the slider. The center is straight up and the edge is the horizon all around you. Dots are stars (bigger means brighter), lines join the constellations, and the sun, moon and planets are labeled. Gray smudges show how cloudy the forecast says it will be.'],
    ['cloud cover ahead', 'How much of the sky clouds will cover over the next two days. Low clouds are the thick gray ones, middle clouds are in between, and high clouds are thin wisps you can often see stars through.'],
    ['the next 24 hours', 'The standout hours of the coming day: when it will be warmest, coldest and windiest, and when rain is most likely.'],
    ['the month in numbers', 'A summary of the month on the calendar: typical highs and lows, total rain, and the days that stood out.'],
    ['hour by hour', 'The white line is what the temperature really did. The dashed lines are what the forecast said it would do, 1, 3 and 7 days beforehand. The closer the dashed lines hug the white one, the better the forecast was. Blue bars are rain.'],
    ['how good was the forecast', 'A report card. Each row is a forecast made that many days ahead, compared with what really happened. Within 2 degrees with the rain right is "spot on".'],
    ['how the forecast has changed', 'What the forecast for this future day said yesterday, the day before, and so on. If the numbers keep changing, forecasters are not sure yet.'],
    ['wildfires', 'Every wildfire reported to the national fire center in the last 45 days. Red means under half contained, orange means mostly contained, gray means fully contained. "Contained" means crews have a line around that much of the fire\'s edge. Click one to find it on the map.'],
    ['fire-watch cameras', 'Live pictures from mountaintop cameras that fire agencies use to spot smoke. A new picture loads every minute. Click one to make it big.'],
    ['the next week', 'The blue wave is the predicted tide. If there is a yellow line, that is the real water level measured by a gauge: when it sits above the blue, wind or a storm is pushing extra water in.'],
    ['worth knowing this week', 'The lowest low tide is the best time to explore tide pools. The highest high is when low-lying spots are most likely to get wet.'],
    ['high and low tides', 'Every high and low tide for the coming week, with the time and how high the water will be.'],
    ['hottest', 'The warmest official weather stations reporting right now. Click a place to see it on the map.'],
    ['coldest', 'The coldest official weather stations reporting right now. Click a place to see it on the map.'],
    ['most comfortable', 'Stations closest to perfect weather: about 72°F (22°C), dry air, a light breeze, and no rain or fog.'],
    ['windiest', 'The strongest winds being measured anywhere right now.'],
    ['muggiest', 'The stickiest air on Earth right now, judged by dew point. Over 75°F (24°C) is oppressive.'],
    ['driest air', 'The lowest humidity being measured. Below 10% your skin and lips feel it quickly.'],
    ['highest station', 'The highest-altitude weather station reporting right now, and how cold it is up there.'],
    ['your weather twin', 'A place at least 900 miles away that has nearly the same temperature, humidity and wind as you do this minute.'],
    ['your weather opposite', 'The reporting place whose temperature is furthest from yours this minute.'],
    ['for comparison', 'The most extreme readings ever officially measured, to put today\'s numbers in perspective.'],
    ['10-day outlook', 'One box per day: the weather picture, the high (bold) and low, the chance of rain, and how much rain is expected.'],
    ['temperature', 'Orange is the air temperature, dotted yellow is how it will feel on your skin once wind and humidity are counted, and green is the dew point (moisture). When orange and green get close together, expect fog or dew. The dashed upright line is right now.'],
    ['rain & snow', 'Blue bars show how much rain falls in each hour (read on the left). The gray line is the chance of any rain at all (read on the right).'],
    ['wind', 'The blue area is the steady wind and the pink line is the strongest gusts.'],
    ['pressure & cloud', 'The yellow line is air pressure: a drop means a storm system is approaching. The gray area is how cloudy it will be.'],
    ['national weather service forecast', 'The official forecast written by the human forecasters at your local Weather Service office.'],
    ['all models', 'Each colored line is a different computer forecast for this spot. Where the lines stay together, the forecast is trustworthy. Where they spread apart, nobody really knows yet. Click a name to hide it; drag across the chart to zoom in.'],
    ['ensemble spread', 'One model run many times with tiny changes to the starting weather. The white line is the average. A tight bundle means high confidence; a wide fan means the weather could go several ways.'],
    ['daily numbers by model', 'For each day, what each model says the high and low will be, and the total rain underneath. Reading down a column shows how much the models agree.'],
    ['wind with height', 'Hodograph: a line tracing how the wind changes as you go up. The center is calm, and each ring is 20 knots faster. A short straight line means boring weather. A long curved line means the wind turns with height, which lets storms rotate.'],
    ['key numbers', 'The handful of numbers forecasters pull from a sounding to judge whether storms can form and how bad they might be. Point at each one for what it means.'],
    ['wave height', 'How tall the waves will be. The blue area is everything together, green is swell (smooth waves from far-off storms), and orange is chop whipped up by local wind.'],
    ['swell period', 'The seconds between one wave and the next. Longer gaps (12 seconds and up) mean powerful waves from distant storms. Orange is the sea temperature.'],
    ['tides', 'The rise and fall of the sea from the pull of the moon and sun, measured above the average lowest tide. The table lists each high and low.'],
    ['feed health', 'A count of how many times each data source answered or failed since you opened the app. Useful if something looks out of date.']
  ];

  // ---- everything else, first match wins while walking up from what you point at ----
  const RULES = [
    ['#rail [data-view=nature]', 'What is in the air (pollen, mold, dust, smoke and UV), and what today\'s weather means for the plants and animals that live around you.'],
    ['#rail [data-view=drive]', 'The weather along a drive: type where you are going and see what each part of the road will be like when you get there.'],
    ['#naTabs button', el => ({ air: 'Pollen, mold, what else is floating in the air, and how strong the sun is.', plants: 'Which of your local plants love today\'s weather and which are struggling, plus what is flowering.', animals: 'What the wildlife around you is probably doing in this weather.' })[el.dataset.t]],
    ['.na-gauge', el => /pollen/.test(el.textContent) ? 'How much pollen is likely in the air right now. It is an estimate from which local plants are in season and how the weather is moving pollen around.' : /air/.test(el.textContent) ? 'The Air Quality Index: one number for how clean the air is. Under 50 is good, 51 to 100 is fine for most people, over 100 starts to bother people with asthma, over 150 bothers everyone.' : 'The UV index at its strongest today. UV is the part of sunlight that burns skin. 3 or more means sunscreen is worth it; 8 or more burns fair skin in under 20 minutes.'],
    ['.na-row', 'One thing in the air and how much of it there is right now, from very low to very high. The small print says which plants are behind it.'],
    ['#naTypes .idx > div', 'Something else in the air besides pollen, with how much there is in millionths of a gram per cubic meter of air. "Clean" means too little to matter.'],
    ['.na-al', 'A plant near you whose pollen blows on the wind. The label says whether it is releasing pollen now; the dots show how strongly it affects people with allergies.'],
    ['.na-sp, .na-tile', el => 'A species people have recorded near you. Click to read about it on iNaturalist.' + (el.dataset.credit ? '\n\nPhoto: ' + el.dataset.credit : '')],
    ['.na-g', 'One group of local plants or animals, and how today\'s weather suits it. The little pictures are members of the group that have been recorded near you. It is the usual pattern, not a guarantee.'],
    ['.na-garden', 'Practical garden advice for today, worked out from recent rain, rain on the way, heat, wind and frost.'],
    ['#naUV .kv > div', el => ({ 'right now': 'The UV index this hour.', 'strongest today': 'The highest UV of the day and the hour it happens, usually around the middle of the day when the sun is highest.', 'cover up between': 'The hours when UV is 3 or more. In this window, sunscreen, a hat and shade are worth it.', 'fair skin burns in about': 'Roughly how long pale, unprotected skin can take the midday sun before it starts to burn. Darker skin takes longer; nobody is immune.' })[el.querySelector('span').textContent.trim().toLowerCase()]],
    ['#naUVDays .idx > div', 'The strongest UV expected that day, and the hour it peaks.'],
    ['#drTo', 'Type the town you are driving to and pick it from the list. The trip starts from the place chosen at the top of the window.'],
    ['#drWhen', 'When you plan to leave. The road colors change to match the weather you would meet.'],
    ['#drClear', 'Forget this trip and go back to the roads around home.'],
    ['.dr-rec .chip', 'A place you looked up before. Click to plan that drive again.'],
    ['#drL_radar', 'Show where it is raining or snowing right now, from weather radar (United States).', 1], ['#drL_alerts', 'Outline the areas under weather warnings that affect driving, such as snow, flooding, fog and high wind.', 1],
    ['.dr-key', 'What the road colors mean. Green: dry and clear. Yellow: wet, breezy or glare. Orange: heavy rain, fog, snow or strong gusts. Red: dangerous.'],
    ['.dr-verdict', 'The worst conditions on this drive, in one word.'],
    ['.dr-run', 'One stretch of the drive where conditions stay about the same: when you would reach it, how far in it is, and what the road will be like. Click to see it on the map.'],
    ['.dr-strip', el => 'Each block is one hour. ' + (el.classList.contains('pick') ? 'Its color is the worst thing you would meet if you left at that time. Click a block to switch to it.' : 'Its color is what the roads near you will be like then.')],
    ['#driveMap', 'Your route, colored by the weather you will meet on each part of it. Point at the line for details. Purple dots are chain controls, red dots are closures, blue dots are highway cameras.'],
    ['#drCams .cam', 'A live picture from a highway camera on your route, so you can see the road for yourself. A new picture loads every couple of minutes. Click to enlarge.'],
    ['.cl', el => 'A kind of cloud: what it looks like, how high it is, and why it forms that shape.' + (el.classList.contains('on') ? ' You will probably see this one if you look up now. It is a best guess.' : '')],
    ['#notifyBtn', 'Notification settings: rain heads-ups, warnings for your place, and whether Skywatch keeps watching after you close the window.'],
    ['#rainPill', 'A heads-up from the short-range forecast, which looks ahead in 15-minute steps. It is a best guess: showers can speed up, slow down or miss you.'],
    ['#luNowBtn', 'Jump the sky chart back to this minute.'], ['#luNightBtn', 'Jump the sky chart to the best stargazing hour tonight.'],
    ['#luT', 'Slide to see the sky at any time over the next two days, in 10-minute steps.'], ['#luTime', 'The time the sky chart is showing.'],
    ['#luCl', 'Show or hide the forecast clouds on the sky chart.', 1], ['#luLn', 'Show or hide the constellation lines and names.', 1],
    ['#luSky', 'A map of the sky for the chosen time. The center is straight up; the edge is the horizon. East is on the left because you are looking up. Point at a bright star or planet to see its name.'],
    ['.lu-big', 'A plain description of what is over your head this minute.'],
    ['.pill', 'A quick verdict. Green is good, yellow is fair, orange is poor.'],
    ['#hiPrev', 'Go back one month.'], ['#hiNext', 'Go forward one month.'], ['#hiToday', 'Jump back to this month and today.'],
    ['#hiMon', 'Pick a month.'], ['#hiYear', 'Pick a year. The record goes back to 1940.'],
    ['.cal-d', 'One day: the weather picture, the high (bold), the low, and how much rain fell. Click it for the full story of that day and how well it was forecast. Faded days are still in the future.'],
    ['.cal-h', 'Day of the week.'],
    ['#hiAccCard tr', 'One forecast, made that many days ahead, compared with what really happened.'],
    ['.fi-gauge', 'Skywatch\'s fire weather rating right now, from Low to Extreme. It combines heat, dry air and wind (a standard formula called the Fosberg index) and is turned down when recent rain has left things damp. It is an estimate, not an official rating.'],
    ['.fi-flag', 'An official fire weather alert is in effect for your place. Click to read it.'],
    ['#fiL_fires', 'Show reported wildfires. Bigger circles are bigger fires.', 1], ['#fiL_perims', 'Show the outline of the ground each fire has burned. Zoom in to see them.', 1],
    ['#fiL_hot', 'Show spots where a satellite saw intense heat in the last two days. Red is within 12 hours, orange is older. This often shows a new fire before anyone reports it.', 1],
    ['#fiL_rfw', 'Show areas under a Red Flag Warning, which means hot, dry, windy weather that lets fires spread fast.', 1],
    ['#fiL_spc', 'Show where national forecasters expect dangerous fire weather today.', 1], ['#fiL_cams', 'Show fire-watch cameras on the map. Zoom in, then click one for its live picture.', 1],
    ['#fiSort', 'List the fires closest to you first, or the biggest first.'],
    ['#fireMap', 'The fire map. Circles are wildfires, shaded shapes are burned areas, and small dots are heat seen by satellite.'],
    ['.cam', 'A live picture from a fire-watch camera. Click to enlarge.'],
    ['#tdStn', 'Which tide station to use, nearest first. Tides can differ a lot between the open coast and a bay.'],
    ['.fn-top', 'The current leader. Click to see it on the map.'], ['.fn li', 'A runner-up. Click to see it on the map.'], ['.fn-lead', 'The hottest and coldest places reporting right now, and the gap between them.'], ['.fn-chips', 'How many weather stations around the world are reporting each kind of weather this minute.'],
    ['#explainBtn', 'Explain mode. While this is on, point at anything in the app for a plain-language explanation. Click to turn it off.'],
    ['#locSearch', 'Type a town, city or zip code to add a place. You can keep up to six.'],
    ['.chip', 'A saved place. Click to switch the whole app to it, or the ✕ to remove it.'],
    ['#nowLine', 'A quick summary of the weather right now at your chosen place, and when the app last refreshed.'],
    ['#unitBtn', 'Switch between American units (°F, mph, inches) and metric (°C, km/h, millimeters).'],
    ['#refreshBtn', 'Throw away everything stored and fetch it all fresh. The app also refreshes by itself every few minutes.'],
    ['#rail [data-view=mine]', 'Your page: your own page made from the panels you pick from any of the other pages, arranged the way you like.'],
    ['#rail [data-view=map]', 'The live map: radar, satellite, warnings and model maps layered on top of each other.'],
    ['#rail [data-view=forecast]', 'The forecast for your place: right now, the next 10 days, and hour-by-hour charts.'],
    ['#rail [data-view=models]', 'Compare what different computer forecasts say. Agreement means confidence.'],
    ['#rail [data-view=sounding]', 'A slice of the sky straight up from your place, showing temperature, moisture and wind at every height. This is how forecasters judge storm potential.'],
    ['#rail [data-view=alerts]', 'Official warnings, watches and advisories. The red number is how many are in effect at your place.'],
    ['#rail [data-view=briefing]', 'The written explanations forecasters publish, in their own words.'],
    ['#rail [data-view=marine]', 'The ocean: tide times and heights, plus waves, swell and sea temperature.'],
    ['.oc-tabs', 'Switch between the tide tables and the wave forecast.'],
    ['.cl-nav', 'See another photo of this kind of cloud. The same kind can look quite different from day to day.'],
    ['.cl-credit', 'Who took this photo and the license it is shared under. Click to open the original.'],
    ['#rail [data-view=lookup]', 'What you would see if you looked up: clouds, sun, moon, tonight\'s stargazing, and a star map for any hour.'],
    ['#rail [data-view=history]', 'A calendar of what the weather actually did on any day back to 1940, and how well it was forecast.'],
    ['#rail [data-view=fire]', 'Fire danger at your place, active wildfires, heat seen by satellite, and live fire-watch cameras.'],
    ['#rail [data-view=tides]', 'Everything about the tides: next high and low, the week ahead, and the real water level.'],
    ['#rail [data-view=fun]', 'Just for fun: the hottest, coldest, windiest and most comfortable places on Earth right now.'],
    ['#rail [data-view=about]', 'Where every piece of data comes from, and whether each source is answering.'],
    ['#recDays', 'Save the radar picture for about 470 miles around your place every 5 minutes, so you can replay a storm later. Pick how long to keep it; older pictures are deleted automatically. It uses roughly 2 to 15 MB a day. Skywatch keeps recording from the tray by the clock after you close the window, and starts again when you sign in to Windows.'],
    ['#satDays', 'Save the satellite picture (GOES true color: real color by day, cloud heat at night) for about 470 miles around your place every 10 minutes, so you can replay how the clouds moved. Pick how long to keep it; older pictures are deleted automatically. It uses about 80 MB a day. It keeps recording from the tray after you close the window.'],
    ['#satInfo', 'How much satellite is saved on this computer and how much disk space it is using.'],
    ['#satClear', 'Delete all the saved satellite pictures from this computer.'],
    ['#satWin', 'Which six-hour stretch of your satellite recording to replay.'],
    ['#recInfo', 'How much radar is saved on this computer and how much disk space it is using.'],
    ['#recClear', 'Delete all the saved radar from this computer.'],
    ['#recWin', 'Which six-hour stretch of your recording to replay.'],
    ['#siteSel', 'Which radar dish to look through, listed nearest first. Each one sees about 140 miles around itself.'],
    ['#radarOp', 'How see-through the radar is. Slide left to see the map underneath.'],
    ['#satOp', 'How see-through the satellite picture is.'],
    ['#mfLoad', 'Fetch the chosen model and draw it over the part of the map you are looking at. It is a coarse, smoothed picture, good for the overall pattern.'],
    ['#mfOff', 'Remove the model map.'],
    ['#mfHour', 'Slide to move forward in time through the next three days of the model map.'],
    ['#mfLabel', 'The time being shown and which model it came from.'],
    ['#mfModel', el => 'Which computer forecast to draw. ' + (MODEL[MODEL_ID[el.value]] || '')],
    ['#ovAlerts', 'Outlines the areas under an official warning or advisory. Click an outlined area to read it.', 1],
    ['#ovMetar', 'Shows real temperature readings from airports and weather stations. The color tells pilots the flying conditions: green good, blue fair, red or pink poor. Zoom in to see them.', 1],
    ['#ovSites', 'Marks every US radar dish. Click one to look through that radar on its own.', 1],
    ['#ovTrop', 'Marks any active hurricane or tropical storm with a spiral.', 1],
    ['#tlPlay', 'Play or pause the loop of the last hour or two, so you can see which way the weather is moving.'],
    ['#tlSlider', 'Drag to step back and forth through the loop. Far right is the newest picture.'],
    ['#tlTime', 'The time of the picture on screen, and how old it is.'],
    ['#tlSpeed', 'How fast the loop plays.'],
    ['#legend', 'What the colors mean. For radar, the number is echo strength: 20 is light rain, 40 is heavy rain, 55 or more is torrential rain or hail.'],
    ['#readout', 'The model\'s value at the spot under your pointer.'],
    ['.home-dot', 'Your chosen place.'],
    ['.rsite', 'A radar dish. Click to look through it.'],
    ['.stn', 'A real temperature reading from a weather station. Click it for wind, visibility and the raw report.'],
    ['.trop', 'An active tropical storm or hurricane. Click for its wind speed and direction of travel.'],
    ['.leaflet-control-zoom', 'Zoom the map in and out. You can also use the mouse wheel.'],
    ['.leaflet-control-attribution', 'Credit to the organizations that provide the map and data on screen.'],
    ['#map', 'The live map. Drag to move around, scroll to zoom. Use the panel on the right to choose what is drawn on it.'],
    ['.hero .ico', 'A picture of the weather right now.'],
    ['.hero .big', 'The temperature right now, from the latest computer analysis for your exact spot.'],
    ['#fcObs', 'An actual thermometer reading from the nearest official weather station, and when it was taken.'],
    ['#naTypes .na-row', 'How much of this is in the air now. Pollen, mold, dust mites and pet dander rows are Skywatch estimates from the weather and local plants; dust comes from the air-quality forecast. Each row says which.'],
    ['#fcBody .day[data-i]', 'One day of the 10-day outlook. Click it for that day in full: hour by hour, when rain is most likely, and the Weather Service wording.'],
    ['#fcBody .cert', 'How sure the forecast is for that day: how closely 82 separate forecast runs (the US and European ensembles) agree on rain or no rain and on the high. Low numbers mean the weather could still go either way.'],
    ['#fcDayCard', 'The forecast for the day you clicked: what to expect, how sure it is, hour by hour, and the Weather Service wording for that day.'],
    ['#fcDayCard .fc-hr', 'Every third hour: the temperature, the chance of rain and the wind.'],
    ['#fcRec', 'What is normal for today, and the hottest and coldest this date has ever been, from the nearest long-running official weather station.'],
    ['#hiRecCard', 'Record highs, lows and rain for the day you picked, its month and all time. They come from real thermometer and rain gauge readings at the nearest long-running official station, checked for gaps and typos. Where there is no station close by, they are marked as a rough estimate.'],
    ['#hiRec .rec td', 'A record and the year it was set.'],
    ['#fcSpan','How far ahead to look: changes this card (the warmest, coldest, wettest and windiest hours) and the hour-by-hour charts below.'],
    ['.day', 'One day: the weather picture, the high (bold) and the low, then the chance of rain and how much is expected.'],
    ['.period', 'The official wording for this part of the day from your local Weather Service office.'],
    ['#mdDays', 'How many days ahead to compare. Short-range models stop after two or three days.'],
    ['.u-series', el => modelTip(el.textContent) || (/average/i.test(el.textContent) ? 'The average of all the runs: the single best guess.' : /lowest/i.test(el.textContent) ? 'The lowest value any run produced: the bottom of what is plausible.' : /highest/i.test(el.textContent) ? 'The highest value any run produced: the top of what is plausible.' : 'Click to show or hide this line. Move across the chart to read its value at any time.')],
    ['#mdTable td:first-child', el => modelTip(el.textContent)],
    ['#mnAdd, #mnAdd2', 'Add a panel to Your page: choose a page, then press Add next to any of its panels. You can add as many as you like.'],
    ['#mnStart', 'Fill Your page with a starter set: current conditions, the radar map, the 10-day outlook, this month\'s history and the sun and UV. Change it any way you like afterward.'],
    ['.mn-pg', 'Show the panels of this page, ready to add to Your page.'],
    ['#mnArrange', 'Arrange Your page: drag any panel to a new spot, make it full or half width, or take it off. Press Done arranging when it looks right.'],
    ['#mnPickX', 'Close the panel chooser.'],
    ['.mn-opt button', 'Put this panel on Your page. It is the real panel, so it updates and works just like on its own page.'],
    ['.mn-w', 'Make this panel stretch across the whole page, or go back to half width so two sit side by side.'],
    ['.mn-up', 'Move this panel one place earlier on Your page.'],
    ['.mn-dn', 'Move this panel one place later on Your page.'],
    ['.mn-x', 'Take this panel off Your page. It stays on its own page.'],
    ['.prod-doc', 'The forecasters\' own words, laid out for reading. Times ending in Z are in universal time. Original text, underneath, shows it exactly as it was sent.'],
    ['.pd-raw summary', 'Show the text exactly as the Weather Service sent it, line for line.'],
    ['.mn-wait', 'This panel is on its way from its own page. It fills in as soon as the latest data arrives.'],
    ['.mn-miss', 'This panel is not showing on its own page right now. Some panels only appear for some places or some weather.'],
    ['.mn-empty', 'Your page is empty. Add the panels you look at most from any of the other pages.'],
    ['#mdTable td', 'That model\'s high and low for the day, with its total rain underneath.'],
    ['#sdModel', el => 'Which computer forecast the sounding comes from. ' + (MODEL[MODEL_ID[el.value]] || '')],
    ['#sdHour', 'Slide to see how the air overhead changes over the next three days.'],
    ['#sdTime', 'The time this sounding is for.'],
    ['#skewt', 'A Skew-T chart: a picture of the air straight above you, ground at the bottom, about 10 miles up at the top. The red line is temperature and the green line is moisture; where they touch there is cloud, and where they are far apart the air is dry. The dashed white line is the path a rising bubble of air would follow: if it sits to the right of the red line, the bubble is warmer than its surroundings and keeps rising, which is how thunderstorms grow. The little flags on the right show the wind at each height.'],
    ['#hodo', 'Hodograph: a line tracing how the wind changes as you go up. A long curved line means the wind turns with height, which lets storms rotate.'],
    ['#alQ', 'Type to narrow the list, for example "flood" or a county name.'],
    ['#alSev', 'Show only alerts of one seriousness level.'],
    ['.al', el => { const t = el.textContent; return (/Warning/.test(t) ? 'A WARNING means it is happening now or about to. Act now.' : /Watch/.test(t) ? 'A WATCH means conditions are right for it to happen. Be ready.' : /Advisory/.test(t) ? 'An ADVISORY is for weather that is a nuisance or could be dangerous if you are careless.' : 'A notice from the Weather Service.') + ' The colored edge shows how serious it is. Click to read the full text.'; }],
    ['#alMap', 'Jump to the map and zoom to the area this alert covers.'],
    ['#alertDetail', 'The full official text of the alert: what is happening, where, and what to do.'],
    ['#brVer', 'Earlier versions of this product, newest first.'],
    ['#brOffice', 'The Weather Service office responsible for your area.'],
    ['pre.prod', 'The forecasters\' own words. It uses shorthand; times ending in Z are in universal time.'],
    ['#mrHilo tr', 'A high or low tide: when it happens and how high the water will be.'],
    ['.src tr', 'One data source the app uses.']
  ];

  const FALLBACK = [
    ['#naHero', 'The air at a glance: pollen, air quality and the sun\'s strength.'], ['#naPlHero', 'How today\'s weather suits the plants around you.'], ['#naAnHero', 'What the animals around you are probably doing right now.'], ['#drBar', 'Plan a drive: where to, and when you are leaving.'], ['#drSide', 'How the weather will affect this drive, stretch by stretch.'], ['#driveMap', 'The road map.'],
    ['.hero .big', 'The weather right now at your place, with the details forecasters look at first.'], ['#skewt', 'The sounding chart. Slide the bar to change the time.'], ['pre.prod', 'The forecasters\' own words. It uses shorthand; times ending in Z are in universal time.'],
    ['.src', 'Where each kind of data in Skywatch comes from.'], ['#hiCal', 'The calendar. Each square is one day; click any day for its full story.'], ['#hiStory', 'The story of the chosen day in plain words.'], ['#fiDanger, .fi-gauge', 'How easily a fire would spread at your place, and the weather behind that rating.'],
    ['#fireMap', 'The fire map.'], ['.fn-lead', 'The hottest and coldest places reporting right now.'], ['.state', 'A note about this section.'], ['.dim', 'An explanation of how to read this section.']
  ];
  function lookup(start) {
    for (let el = start; el && el !== document.body; el = el.parentElement) {
      if (!el.matches) continue;
      const id = el.id;
      if (el.tagName === 'SELECT' && OPT[id]) {
        const o = OPT[id], v = el.value, k = o[v] ? v : Object.keys(o).find(x => v.includes(x));
        return HEAD[id] + (k ? '\n\nSelected now: ' + o[k] : '');
      }
      if (el.classList.contains('chk')) { const inp = el.querySelector('input'), r = inp && RULES.find(x => x[0] === '#' + inp.id); if (r) return r[1]; }
      for (const r of RULES) if (!r[2] && el.matches(r[0])) { const t = typeof r[1] === 'function' ? r[1](el) : r[1]; if (t) return t; }
      const cap = (el.parentElement && (el.parentElement.classList.contains('kv') || el.parentElement.classList.contains('idx'))) ? el.querySelector('span') : null;
      if (cap && TERM[cap.textContent.trim().toLowerCase()]) return TERM[cap.textContent.trim().toLowerCase()];
      if (el.classList.contains('card')) { const h = el.querySelector('h2'); if (h) { const t = h.textContent.trim().toLowerCase(); const c = CARD.find(x => t.startsWith(x[0])); if (c) return c[1]; } const fb = FALLBACK.find(x => el.matches(x[0]) || el.querySelector(x[0])); if (fb) return fb[1]; }
    }
    return null;
  }

  // ---- the floating card ----
  const tip = SW.el('div', { id: 'tip', class: 'hidden' }); document.body.appendChild(tip);
  let cur = null, timer = null, mx = 0, my = 0;
  function place() {
    const w = tip.offsetWidth, h = tip.offsetHeight; let x = mx + 18, y = my + 20;
    if (x + w > innerWidth - 10) x = mx - w - 14; if (y + h > innerHeight - 10) y = my - h - 14;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
  }
  function hide() { clearTimeout(timer); cur = null; tip.classList.add('hidden'); }
  document.addEventListener('mousemove', function onTipMove(e) {
    if (!st.explain) return;
    mx = e.clientX; my = e.clientY;
    const text = lookup(e.target);
    if (!text) { hide(); return; }
    if (text !== cur) {
      cur = text; clearTimeout(timer); tip.classList.add('hidden');
      timer = setTimeout(function showTip() { tip.textContent = text; tip.classList.remove('hidden'); place(); }, 220);
    } else if (!tip.classList.contains('hidden')) place();
  });
  document.addEventListener('mouseleave', hide);
  document.addEventListener('mousedown', hide);
  window.addEventListener('blur', hide);

  function apply() {
    const b = $('#explainBtn'); b.classList.toggle('on', !!st.explain);
    document.body.classList.toggle('explain', !!st.explain);
    if (!st.explain) hide();
  }
  $('#explainBtn').onclick = function toggleExplain() { st.explain = !st.explain; SW.save(); apply(); SW.toast(st.explain ? 'Explain mode is on. Point at anything to learn what it is.' : 'Explain mode is off.'); };
  apply();

  SW.explain = { lookup };
  // self-test: on every screen, list the controls and readouts that have no explanation
  SW.explainTest = async function explainTest() {
    const out = { covered: 0, missing: [] }, sel = '.cl, .cal-d[data-d], .cam, .fn li, .fn-top, .fi-gauge, .pill, select, button, input, .kv > div, .idx > div, .card, .chk, .day, .al, canvas, #legend, #nowLine, .chip, .u-series, #mdTable td:first-child';
    for (const vv of ['map', 'forecast', 'lookup', 'history', 'models', 'sounding', 'alerts', 'fire', 'nature', 'nature/plants', 'nature/animals', 'drive', 'drive/trip', 'tides', 'marine', 'briefing', 'fun', 'about', 'mine']) {
      const v = vv.split('/')[0], part = vv.split('/')[1];
      await SW.show(v); if (v === 'nature') { await new Promise(r => setTimeout(r, part ? 500 : 7000)); $('#naTabs [data-t=' + (part || 'air') + ']').click(); } if (part === 'trip') await SW.driveTest(); await new Promise(r => setTimeout(r, v === 'map' ? 1500 : part ? 1500 : v === 'fire' || v === 'fun' || v === 'history' || v === 'mine' ? 8000 : 4500));
      $$(sel + ', .na-row, .na-al, .na-sp, .na-tile, .na-g, .na-garden, .dr-run, .dr-strip, .dr-verdict, .dr-key', $('#v-' + v)).concat(v === 'map' ? $$(sel, $('#top')).concat($$('button', $('#rail'))) : []).forEach(function check(el) {
        if (!el.offsetParent) return;
        if (lookup(el)) out.covered++; else out.missing.push(vv + ': ' + el.tagName + (el.id ? '#' + el.id : '') + '.' + el.className + ' "' + el.textContent.trim().slice(0, 30) + '"');
      });
    }
    out.missing = Array.from(new Set(out.missing));
    return out;
  };
})();

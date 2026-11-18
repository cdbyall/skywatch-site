// Skywatch feed relay: the one piece of server code the website needs.
// Some public weather servers refuse requests that come straight from a web page, so the page asks
// this relay to fetch them instead. It only fetches from the weather sources listed here, nothing else.
const ALLOW = ['open-meteo.com', 'weather.gov', 'noaa.gov', 'iastate.edu', 'aviationweather.gov', 'arcgis.com', 'arcgisonline.com', 'earthdata.nasa.gov', 'alertcalifornia.org', 'inaturalist.org', 'openstreetmap.de', 'project-osrm.org', 'dot.ca.gov', 'rainviewer.com'];

// returns { status, headers, body } where body is a web ReadableStream (or text for errors)
async function relay(target, accept, sameSite) {
  let t; try { t = new URL(target); } catch (e) { return { status: 400, headers: {}, body: 'Bad address' }; }
  if (sameSite === false) return { status: 403, headers: {}, body: 'This relay only serves the Skywatch page' };
  if (t.protocol !== 'https:' || !ALLOW.some(h => t.hostname === h || t.hostname.endsWith('.' + h))) return { status: 403, headers: {}, body: 'Not a Skywatch weather source' };
  const r = await fetch(t.href, { headers: { 'User-Agent': 'Skywatch/1.5 (home weather page)', Accept: accept || '*/*' }, redirect: 'follow' });
  return { status: r.status, headers: { 'Content-Type': r.headers.get('content-type') || 'application/octet-stream', 'Cache-Control': 'public, max-age=60' }, body: r.body };
}

export const config = { runtime: 'edge' };
export default async function handler(request) {
  const u = new URL(request.url).searchParams.get('u'), s = request.headers.get('sec-fetch-site');
  try { const r = await relay(u, request.headers.get('accept'), s ? s === 'same-origin' : undefined); return new Response(r.body, { status: r.status, headers: r.headers }); }
  catch (e) { return new Response(String(e.message || e), { status: 502 }); }
}

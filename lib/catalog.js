// Precios canónicos: SIEMPRE se recalculan acá, nunca se confía en el precio
// que mande el navegador (si no, cualquiera podría abrir la consola y pagar
// 1 dólar por una foto). Se leen en vivo desde data.json en GitHub — el
// mismo archivo que edita el bot de Telegram — así nunca queda un precio
// viejo dando vueltas en dos lugares distintos.
const owner = process.env.GITHUB_OWNER || 'Azerian126';
const repo = process.env.GITHUB_REPO || 'Cantbelievetheview';
const branch = process.env.GITHUB_BRANCH || 'main';

let cache = null;
let cacheAt = 0;
const CACHE_MS = 60 * 1000; // 1 minuto — evita pegarle a GitHub en cada request sin quedar desactualizado por mucho tiempo

async function getSiteData() {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/data.json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No pude leer data.json de GitHub (${r.status})`);
  cache = await r.json();
  cacheAt = Date.now();
  return cache;
}

/**
 * SKU de Prodigi para cada material+tamaño. Confirmado contra la API real
 * (GET /v4.0/products/{sku}) — el patrón es GLOBAL-{PAP|MET}-{tamaño en
 * pulgadas}, ej. GLOBAL-PAP-16X20, GLOBAL-MET-8X10. sizeId en data.json ya
 * viene en ese mismo formato (en minúsculas, ej. "16x20"), así que el SKU
 * se arma solo — no hay mapa que mantener a mano.
 *
 * Si en algún momento se agrega un material nuevo que no siga este patrón,
 * agregarlo acá explícitamente en vez de asumir el prefijo.
 */
const PRODIGI_PREFIX = {
  algodon: 'GLOBAL-PAP',
  aluminio: 'GLOBAL-MET',
};

function prodigiSkuFor(materialId, sizeId) {
  const prefix = PRODIGI_PREFIX[materialId];
  if (!prefix || !sizeId) return null;
  return `${prefix}-${sizeId.toUpperCase()}`;
}

function formatCoords(lat, lng) {
  const ns = lat >= 0 ? `${lat.toFixed(2)}° N` : `${Math.abs(lat).toFixed(2)}° S`;
  const ew = lng >= 0 ? `${lng.toFixed(2)}° E` : `${Math.abs(lng).toFixed(2)}° O`;
  return `${ns}  /  ${ew}`;
}

/** Busca una foto por su id (no por URL — desde que separamos la URL limpia
 *  de data.json, el id es lo único que viaja del carrito hacia acá). Junta
 *  el displayUrl (con marca de agua, para mostrar en el checkout de Stripe)
 *  con las coordenadas/lugar (de la foto puntual si las tiene, si no las
 *  del país) — lo que va impreso en la tarjeta del sobre. */
function findPhotoById(site, photoId) {
  for (const c of site.visited) {
    const photo = (c.photos || []).find((p) => p && p.id === photoId);
    if (!photo) continue;
    const lat = photo.lat !== undefined ? photo.lat : c.lat;
    const lng = photo.lng !== undefined ? photo.lng : c.lng;
    return { displayUrl: photo.displayUrl, coordsText: formatCoords(lat, lng), place: c.name };
  }
  for (const cat of site.categories) {
    const photo = (cat.photos || []).find((p) => p && p.id === photoId);
    if (!photo) continue;
    const coordsText = photo.lat !== undefined ? formatCoords(photo.lat, photo.lng) : '';
    return { displayUrl: photo.displayUrl, coordsText, place: cat.name };
  }
  return null;
}

module.exports = { getSiteData, prodigiSkuFor, findPhotoById };

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
 * Mapeo material+tamaño -> SKU de Prodigi. HAY QUE COMPLETARLO A MANO una vez
 * que tengas cuenta en Prodigi: Dashboard -> Product catalogue (o pegándole a
 * GET /v4.0/products) y copiando el SKU exacto para cada combinación.
 *
 * Ejemplo real de Prodigi para papel fine art: GLOBAL-FAP-16x24 (en pulgadas).
 * Para metal/aluminio el prefijo es otro — confirmalo en tu dashboard, no lo
 * inventes ni lo copies de acá literal.
 *
 * Mientras una combinación no esté acá, el checkout la va a rechazar en vez
 * de mandarle a Prodigi un SKU inventado (que fallaría el pedido después de
 * ya haberle cobrado al cliente).
 */
const PRODIGI_SKU_MAP = {
  // 'algodon:S': 'GLOBAL-FAP-TODO',
  // 'algodon:M': 'GLOBAL-FAP-TODO',
  // 'algodon:L': 'GLOBAL-FAP-TODO',
  // 'aluminio:S': 'TODO',
  // 'aluminio:M': 'TODO',
  // 'aluminio:L': 'TODO',
};

function prodigiSkuFor(materialId, sizeId) {
  return PRODIGI_SKU_MAP[`${materialId}:${sizeId}`] || null;
}

module.exports = { getSiteData, prodigiSkuFor };

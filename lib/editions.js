// Numeración real de ediciones: cada vez que se vende una impresión de una
// foto puntual, le asignamos el número siguiente (1, 2, 3...) usando un
// contador atómico en Redis — así dos compras simultáneas de la misma foto
// nunca terminan con el mismo número.
//
// Podés reusar la MISMA base de Upstash que ya conectaste al bot de
// Telegram (las claves llevan un prefijo distinto, "cbtv:edition:", así que
// no chocan con las de sesión del bot, "cbtv:session:"), o conectar una
// nueva acá — cualquiera de las dos funciona, solo necesita las mismas
// variables de entorno.
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

function key(photoUrl) {
  return `cbtv:edition:${photoUrl}`;
}

/** Devuelve el número de esta impresión (1 la primera vez que se vende esa
 *  foto, 2 la segunda, etc.) — INCR es atómico, así que es seguro aunque
 *  dos compras de la misma foto lleguen al mismo tiempo. */
async function nextEditionNumber(photoUrl) {
  return redis.incr(key(photoUrl));
}

module.exports = { nextEditionNumber };

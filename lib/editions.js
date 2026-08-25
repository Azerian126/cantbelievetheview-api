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

// Igual que con Resend: el cliente se crea recién cuando hace falta, no al
// cargar el archivo. Si el constructor de Redis llega a tirar (url/token
// mal formados, por ejemplo), que rompa acá adentro de un try/catch de
// quien nos llama, no en el require() de todo el webhook.
let redis = null;
function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

function key(photoId) {
  return `cbtv:edition:${photoId}`;
}

/** Devuelve el número de esta impresión (1 la primera vez que se vende esa
 *  foto, 2 la segunda, etc.) — INCR es atómico, así que es seguro aunque
 *  dos compras de la misma foto lleguen al mismo tiempo. Antes se indexaba
 *  por URL; ahora por id, que es el identificador estable de la foto. */
async function nextEditionNumber(photoId) {
  return getRedis().incr(key(photoId));
}

module.exports = { nextEditionNumber };

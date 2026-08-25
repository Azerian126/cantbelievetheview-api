// Guarda la URL "limpia" (sin marca de agua, buena calidad) de cada foto,
// separada del data.json público — data.json solo tiene displayUrl
// (con marca de agua) porque se lee sin auth desde GitHub y se sirve tal
// cual en el sitio, así que cualquier campo ahí adentro es visible para
// cualquiera. La URL limpia solo la necesita el backend, al momento de
// imprimir o mandar el email de confirmación — nunca antes de eso.
//
// Mismo Upstash Redis que ya usa editions.js (prefijo distinto,
// "cbtv:photo:", para no chocar con "cbtv:edition:") — y el bot de
// Telegram, que es quien escribe acá al subir cada foto nueva.
const { Redis } = require('@upstash/redis');

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
  return `cbtv:photo:${photoId}`;
}

/** Devuelve la URL limpia de una foto por su id, o null si no la
 *  encuentra (foto vieja sin migrar, id typeado mal, etc.). */
async function getCleanPhotoUrl(photoId) {
  if (!photoId) return null;
  return getRedis().get(key(photoId));
}

module.exports = { getCleanPhotoUrl };

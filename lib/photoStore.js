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

function printKey(photoId) {
  return `cbtv:photoprint:${photoId}`;
}

/** Devuelve la URL de la derivada de impresión de una foto para un material
 *  puntual (ver cantbelievetheview-bot/lib/printPrep.js — ahí se generan y
 *  se guardan al subir la foto), o null si no existe. Null es un caso
 *  esperado, no un error: fotos subidas antes de este cambio, o si la
 *  preparación falló al subir — quien llama tiene que caer a
 *  getCleanPhotoUrl() en ese caso, nunca bloquear la venta por esto. */
async function getPrintUrl(photoId, materialId) {
  if (!photoId || !materialId) return null;
  const urls = await getRedis().get(printKey(photoId));
  return (urls && urls[materialId]) || null;
}

module.exports = { getCleanPhotoUrl, getPrintUrl };

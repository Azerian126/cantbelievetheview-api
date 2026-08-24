// Los mismos orígenes permitidos que ya usás en el backend de tasa-ves-usdt
// (lista separada por comas en CORS_ORIGIN), para no reinventar el patrón.
const allowed = (process.env.CORS_ORIGIN || 'https://cantbelievetheview.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/** Llamar al principio de cada handler. Devuelve true si ya respondió
 *  (preflight OPTIONS) y el handler debe cortar ahí. */
function handleCors(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { handleCors };

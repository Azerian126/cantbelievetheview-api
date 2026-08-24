// Prodigi Print API v4 — https://www.prodigi.com/print-api/docs/reference/
// Sandbox: https://api.sandbox.prodigi.com/v4.0  ·  Live: https://api.prodigi.com/v4.0
// PRODIGI_ENV=sandbox mientras probás (no imprime ni cobra nada de verdad).

const BASE_URL =
  process.env.PRODIGI_ENV === 'live'
    ? 'https://api.prodigi.com/v4.0'
    : 'https://api.sandbox.prodigi.com/v4.0';

/**
 * Crea un pedido de impresión en Prodigi.
 * @param {Object} p
 * @param {string} p.merchantReference - referencia nuestra (usamos el id de la sesión de Stripe)
 * @param {string} p.sku - SKU de Prodigi (de catalog.js -> prodigiSkuFor)
 * @param {string} p.imageUrl - URL pública de la foto (el archivo limpio de Cloudinary, sin marca de agua)
 * @param {Object} p.recipient - { name, email, address:{line1,line2,postalOrZipCode,countryCode,townOrCity,stateOrCounty} }
 */
async function createOrder({ merchantReference, sku, imageUrl, recipient }) {
  const body = {
    merchantReference,
    shippingMethod: 'Standard',
    recipient: {
      name: recipient.name,
      email: recipient.email,
      address: recipient.address,
    },
    items: [
      {
        sku,
        copies: 1,
        sizing: 'fillPrintArea',
        assets: [{ printArea: 'default', url: imageUrl }],
      },
    ],
  };

  const r = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.PRODIGI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await r.json();
  if (!r.ok) {
    throw new Error(`Prodigi rechazó el pedido (${r.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

module.exports = { createOrder };

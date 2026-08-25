// Prodigi Print API v4 — https://www.prodigi.com/print-api/docs/reference/
// Sandbox: https://api.sandbox.prodigi.com/v4.0  ·  Live: https://api.prodigi.com/v4.0
// PRODIGI_ENV=sandbox mientras probás (no imprime ni cobra nada de verdad).

const BASE_URL =
  process.env.PRODIGI_ENV === 'live'
    ? 'https://api.prodigi.com/v4.0'
    : 'https://api.sandbox.prodigi.com/v4.0';

// Cada línea de producto de Prodigi pide sus propios atributos obligatorios
// al crear un pedido (confirmado contra GET /v4.0/products/{sku}). Sin esto
// el pedido se rechaza. "high gloss" en aluminio matchea con "Aluminio ·
// brillante" que ya dice el sitio.
const MATERIAL_ATTRIBUTES = {
  algodon: { paperType: 'LPP', substrateWeight: '240gsm' },
  aluminio: { edge: 'Rounded edges', finish: 'high gloss', frame: 'Metal float hanger', paperType: 'ChromaLuxe aluminium' },
};

/**
 * Crea un pedido de impresión en Prodigi.
 * @param {Object} p
 * @param {string} p.merchantReference - referencia nuestra (usamos el id de la sesión de Stripe)
 * @param {string} p.sku - SKU de Prodigi (de catalog.js -> prodigiSkuFor)
 * @param {string} p.materialId - 'algodon' | 'aluminio' — determina los atributos del item
 * @param {string} p.imageUrl - URL pública de la foto (el archivo limpio de Cloudinary, sin marca de agua)
 * @param {Object} p.recipient - { name, email, address:{line1,line2,postalOrZipCode,countryCode,townOrCity,stateOrCounty} }
 */
async function createOrder({ merchantReference, sku, materialId, imageUrl, recipient }) {
  const attributes = MATERIAL_ATTRIBUTES[materialId];
  if (!attributes) {
    throw new Error(`No conozco los atributos de Prodigi para el material "${materialId}"`);
  }

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
        attributes,
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

const stripe = require('../lib/stripe');
const { prodigiSkuFor } = require('../lib/catalog');
const { createOrder } = require('../lib/prodigi');

// Necesitamos el body CRUDO (sin parsear) para poder verificar la firma de
// Stripe — por eso se apaga el bodyParser automático de Vercel acá.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function mapAddress(shipping) {
  if (!shipping || !shipping.address) return null;
  const a = shipping.address;
  return {
    line1: a.line1,
    line2: a.line2 || undefined,
    postalOrZipCode: a.postal_code,
    countryCode: a.country,
    townOrCity: a.city,
    stateOrCounty: a.state || undefined,
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await readRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Firma de Stripe inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const count = parseInt(session.metadata?.item_count || '0', 10);
    const items = [];
    for (let i = 0; i < count; i++) {
      const raw = session.metadata[`item_${i}`];
      if (raw) items.push(JSON.parse(raw));
    }

    const address = mapAddress(session.shipping_details);
    const buyerName = session.shipping_details?.name || session.customer_details?.name || 'Cliente';
    const buyerEmail = session.customer_details?.email;

    for (const item of items) {
      if (item.type !== 'print') continue; // digital no necesita imprenta

      const sku = prodigiSkuFor(item.materialId, item.sizeId);
      if (!sku) {
        console.error(
          `[ALERTA] Pedido ${session.id}: falta el SKU de Prodigi para ${item.materialId}/${item.sizeId} — ` +
            `este item NO se mandó a imprimir. Completá PRODIGI_SKU_MAP en lib/catalog.js y procesalo a mano por ahora.`
        );
        continue;
      }
      if (!address) {
        console.error(`[ALERTA] Pedido ${session.id}: item de impresión sin dirección de envío.`);
        continue;
      }

      try {
        const order = await createOrder({
          merchantReference: `${session.id}-${item.photoUrl.slice(-12)}`,
          sku,
          materialId: item.materialId,
          imageUrl: item.photoUrl,
          recipient: { name: buyerName, email: buyerEmail, address },
        });
        console.log(`Pedido enviado a Prodigi: ${order.order?.id || '(sin id)'} — sesión ${session.id}`);
      } catch (err) {
        console.error(`[ALERTA] Falló el pedido a Prodigi para la sesión ${session.id}:`, err.message);
        // No relanzamos: si un item falla, no queremos que Stripe reintente
        // el webhook entero (ya se cobró). Queda logueado para procesar a mano.
      }
    }
  }

  res.status(200).json({ received: true });
};

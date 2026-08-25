const stripe = require('../lib/stripe');
const { prodigiSkuFor, getSiteData, findPhotoMeta } = require('../lib/catalog');
const { createOrder } = require('../lib/prodigi');
const { renderPostcard } = require('../lib/postcard');
const { nextEditionNumber } = require('../lib/editions');
const { uploadBuffer } = require('../lib/cloudinary');
const { sendOrderConfirmation } = require('../lib/email');

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

async function handleCheckoutCompleted(session) {
  const count = parseInt(session.metadata?.item_count || '0', 10);
  const items = [];
  for (let i = 0; i < count; i++) {
    const raw = session.metadata[`item_${i}`];
    if (raw) items.push(JSON.parse(raw));
  }

  // Desde la API version 2025+ de Stripe, la dirección de envío recolectada
  // en Checkout vive en collected_information.shipping_details — versiones
  // más viejas la tenían directo en session.shipping_details. Probamos las
  // dos para no depender de cuál te toque.
  const shippingDetails = session.collected_information?.shipping_details || session.shipping_details;
  const address = mapAddress(shippingDetails);
  const buyerName = shippingDetails?.name || session.customer_details?.name || 'Cliente';
  const buyerEmail = session.customer_details?.email;

  for (const item of items) {
    if (item.type !== 'print') continue; // digital no necesita imprenta

    const sku = prodigiSkuFor(item.materialId, item.sizeId);
    if (!sku) {
      console.error(
        `[ALERTA] Pedido ${session.id}: falta el SKU de Prodigi para ${item.materialId}/${item.sizeId} — ` +
          `este item NO se mandó a imprimir. Revisá lib/catalog.js y procesalo a mano por ahora.`
      );
      continue;
    }
    if (!address) {
      console.error(`[ALERTA] Pedido ${session.id}: item de impresión sin dirección de envío.`);
      continue;
    }

    // La tarjeta del sobre (nombre + coordenadas + firma + N° de edición) es
    // un extra — si falla generarla, igual mandamos el pedido de impresión
    // sin ella en vez de bloquear un pedido ya cobrado.
    let postcardUrl;
    try {
      const site = await getSiteData();
      const { coordsText, place } = findPhotoMeta(site, item.photoUrl);
      const editionNumber = await nextEditionNumber(item.photoUrl);
      const png = await renderPostcard({ title: item.title, coordsText, place, editionNumber });
      postcardUrl = await uploadBuffer(png, `${session.id}-${editionNumber}`);
    } catch (err) {
      // err.message venía "undefined" en algunos casos (p.ej. errores del SDK
      // de Cloudinary, que no siempre son instancias de Error) — logueamos el
      // objeto completo para no seguir adivinando a ciegas.
      console.error(`[ALERTA] No se pudo generar la tarjeta para la sesión ${session.id}:`, err?.message || err, err?.error || '');
    }

    try {
      const order = await createOrder({
        merchantReference: `${session.id}-${item.photoUrl.slice(-12)}`,
        sku,
        materialId: item.materialId,
        imageUrl: item.photoUrl,
        postcardUrl,
        recipient: { name: buyerName, email: buyerEmail, address },
      });
      console.log(`Pedido enviado a Prodigi: ${order.order?.id || '(sin id)'} — sesión ${session.id}`);
    } catch (err) {
      console.error(`[ALERTA] Falló el pedido a Prodigi para la sesión ${session.id}:`, err.message);
      // No relanzamos: si un item falla, no queremos que Stripe reintente
      // el webhook entero (ya se cobró). Queda logueado para procesar a mano.
    }
  }

  try {
    await sendOrderConfirmation({
      to: buyerEmail,
      items,
      total: `${(session.amount_total / 100).toFixed(2)} ${(session.currency || 'usd').toUpperCase()}`,
    });
  } catch (err) {
    console.error(`[ALERTA] No se pudo mandar el email de confirmación para la sesión ${session.id}:`, err.message);
  }
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

  // El pago ya se cobró en cuanto Stripe nos llama acá — pase lo que pase
  // adentro (un bug nuestro, Prodigi caído, etc.) siempre respondemos 200,
  // nunca 500. Un 500 hace que Stripe reintente el mismo evento una y otra
  // vez sin que eso arregle nada, y además nos tapa la causa real del error
  // (Stripe solo nos mostraba "A server error has occurred", sin detalle).
  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object);
    }
  } catch (err) {
    console.error(`[ALERTA] Error inesperado procesando el webhook (evento ${event.id}):`, err);
  }

  res.status(200).json({ received: true });
};

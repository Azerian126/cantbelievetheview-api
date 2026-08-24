const stripe = require('../lib/stripe');
const { handleCors } = require('../lib/cors');
const { getSiteData } = require('../lib/catalog');

// Lista amplia de países a los que Stripe puede pedir dirección de envío.
// Editable — sacá los que no quieras enviar, o agregá los que falten
// (código ISO de 2 letras). No existe un "todos" literal en Stripe.
const SHIPPING_COUNTRIES = [
  'US','CA','MX','AR','BR','CL','CO','PE','UY','PY','BO','EC','VE',
  'ES','PT','FR','DE','IT','GB','IE','NL','BE','CH','AT','SE','NO','FI','DK',
  'PL','CZ','HU','GR','HR',
  'AU','NZ','JP','KR','SG','TH','MY','PH','IN',
  'AE','IL','ZA',
];

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío.' });
    }
    if (items.length > 20) {
      return res.status(400).json({ error: 'Demasiados items en un solo pedido.' });
    }

    const site = await getSiteData();

    // Todas las fotos reales que existen en el sitio (países + categorías),
    // para poder validar que lo que llega del carrito es legítimo.
    const allPhotoUrls = new Set();
    [...site.visited, ...site.categories].forEach((entry) => {
      (entry.photos || []).forEach((p) => allPhotoUrls.add(typeof p === 'string' ? p : p.url));
    });

    let hasPrint = false;
    const lineItems = [];
    const metaItems = [];

    for (const raw of items) {
      const { type, title, group, photoUrl, materialId, sizeId } = raw || {};

      if (!photoUrl || !allPhotoUrls.has(photoUrl)) {
        return res.status(400).json({ error: `Foto no reconocida: ${title || photoUrl}` });
      }

      let priceUsd, variantLabel;
      if (type === 'digital') {
        priceUsd = site.digitalPrice;
        variantLabel = 'Digital';
      } else if (type === 'print') {
        const material = site.materials.find((m) => m.id === materialId);
        const size = site.sizes.find((s) => s.id === sizeId);
        if (!material || !size) {
          return res.status(400).json({ error: `Material o tamaño inválido para "${title}".` });
        }
        priceUsd = size.price + material.mod;
        variantLabel = `Impresión ${size.id} · ${material.label}`;
        hasPrint = true;
      } else {
        return res.status(400).json({ error: `Tipo de item inválido: ${type}` });
      }

      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(priceUsd * 100),
          product_data: {
            name: `${title} — ${group || ''}`.trim(),
            description: variantLabel,
            images: [photoUrl],
          },
        },
        quantity: 1,
      });

      metaItems.push({ type, title, group, photoUrl, materialId: materialId || null, sizeId: sizeId || null });
    }

    const metadata = { item_count: String(metaItems.length) };
    metaItems.forEach((item, i) => {
      metadata[`item_${i}`] = JSON.stringify(item);
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      metadata,
      customer_email: req.body.email || undefined,
      shipping_address_collection: hasPrint ? { allowed_countries: SHIPPING_COUNTRIES } : undefined,
      success_url: 'https://cantbelievetheview.com/?checkout=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://cantbelievetheview.com/?checkout=cancelled',
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Error creando checkout session:', err);
    res.status(500).json({ error: 'No se pudo iniciar el pago. Probá de nuevo en un rato.' });
  }
};

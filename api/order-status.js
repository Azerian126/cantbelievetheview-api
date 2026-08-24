const stripe = require('../lib/stripe');
const { handleCors } = require('../lib/cors');

// Lo llama la página de éxito (cantbelievetheview.com/?checkout=success&session_id=...)
// para mostrar los links de descarga de lo digital y confirmar qué se compró,
// sin depender de que el navegador se haya quedado abierto durante el pago.
module.exports = async (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const sessionId = req.query?.session_id;
  if (!sessionId) return res.status(400).json({ error: 'Falta session_id' });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(200).json({ paid: false });
    }

    const count = parseInt(session.metadata?.item_count || '0', 10);
    const items = [];
    for (let i = 0; i < count; i++) {
      const raw = session.metadata[`item_${i}`];
      if (raw) items.push(JSON.parse(raw));
    }

    res.status(200).json({
      paid: true,
      email: session.customer_details?.email || null,
      items: items.map((it) => ({
        title: it.title,
        group: it.group,
        type: it.type,
        downloadUrl: it.type === 'digital' ? it.photoUrl : null,
      })),
    });
  } catch (err) {
    console.error('Error consultando order-status:', err);
    res.status(500).json({ error: 'No se pudo confirmar el pedido.' });
  }
};

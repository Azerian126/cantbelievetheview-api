// Email de confirmación real, con el link de descarga permanente para lo
// digital — sin esto, si el cliente cierra la pestaña de éxito sin
// descargar, no tiene ninguna otra forma de acceder a la foto que compró.
const { Resend } = require('resend');

// El cliente se crea recién cuando hace falta (no al cargar el archivo) —
// así, si todavía no cargaste RESEND_API_KEY en Vercel, el peor caso es que
// no se manda el email (queda logueado), en vez de tirar abajo TODO el
// webhook (que sí le pasó a esto con @resvg/resvg-js: un error al cargar
// el módulo pasa por arriba de cualquier try/catch nuestro).
let resend = null;
function getResend() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

// onboarding@resend.dev funciona sin verificar dominio propio — sirve para
// arrancar. Cuando tengas hola@cantbelievetheview.com verificado en Resend,
// cambiá FROM_EMAIL en las env vars y listo, no hace falta tocar código.
const FROM = process.env.FROM_EMAIL || 'Cant Believe The View <onboarding@resend.dev>';

function itemRowHtml(item) {
  if (item.type === 'digital') {
    return `<tr>
      <td style="padding:12px 0; border-bottom:1px solid #e5e2d9;">
        <div style="font-family:Georgia,serif; font-style:italic; font-size:15px; color:#14140f;">${item.title}</div>
        <div style="font-size:12px; color:#6f6a5c; margin-top:2px;">${item.group || ''} · Digital</div>
      </td>
      <td style="padding:12px 0; border-bottom:1px solid #e5e2d9; text-align:right;">
        <a href="${item.photoUrl}" style="color:#b5713b; font-size:13px; text-decoration:none;">Descargar ↓</a>
      </td>
    </tr>`;
  }
  const previewNote = item.postcardPng
    ? ' · vista previa de la tarjeta adjunta en este email'
    : '';
  return `<tr>
    <td colspan="2" style="padding:12px 0; border-bottom:1px solid #e5e2d9;">
      <div style="font-family:Georgia,serif; font-style:italic; font-size:15px; color:#14140f;">${item.title}</div>
      <div style="font-size:12px; color:#6f6a5c; margin-top:2px;">${item.group || ''} · Impresión — se envía por correo, numerada y con tarjeta firmada${previewNote}</div>
    </td>
  </tr>`;
}

// Nombre de archivo legible para la tarjeta adjunta — sin acentos ni
// caracteres raros, que algunos clientes de correo rechazan en adjuntos.
function slugify(text) {
  return (text || 'tarjeta')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // saca los acentos (á -> a + tilde combinante -> a)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * @param {Object} p
 * @param {string} p.to
 * @param {Array} p.items - items del pedido (mismo formato que se guarda en metadata de Stripe)
 * @param {string} p.total - ej. "USD 45"
 */
async function sendOrderConfirmation({ to, items, total }) {
  if (!to) return;
  if (!process.env.RESEND_API_KEY) {
    console.error('[ALERTA] Falta RESEND_API_KEY — no se mandó el email de confirmación.');
    return;
  }
  const rows = items.map(itemRowHtml).join('');
  const hasPrint = items.some((i) => i.type === 'print');

  // Vista previa de la tarjeta que va adentro del sobre — antes se generaba
  // y se mandaba a Prodigi para imprimir, pero nunca le llegaba una copia
  // al cliente para ver cómo queda. resvg-wasm devuelve un Uint8Array, no
  // un Buffer — Resend necesita base64 o Buffer, así que se convierte acá.
  const printItemsWithPostcard = items.filter((i) => i.type === 'print' && i.postcardPng);
  const attachments = printItemsWithPostcard.map((item, i) => ({
    filename: `tarjeta-${slugify(item.title)}${printItemsWithPostcard.length > 1 ? `-${i + 1}` : ''}.png`,
    content: Buffer.from(item.postcardPng).toString('base64'),
  }));

  const html = `
  <div style="background:#faf8f3; padding:40px 20px; font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:480px; margin:0 auto; background:#ffffff; border-radius:8px; padding:32px;">
      <div style="font-family:Georgia,serif; font-size:14px; letter-spacing:2px; text-transform:uppercase; color:#a29c8e; margin-bottom:24px;">cantbelievetheview</div>
      <h1 style="font-family:Georgia,serif; font-weight:normal; font-size:22px; color:#14140f; margin:0 0 8px;">Gracias por tu compra</h1>
      <p style="font-size:14px; color:#6f6a5c; line-height:1.6; margin:0 0 24px;">
        ${hasPrint ? 'Tu impresión se numera y se envía con una tarjeta firmada por mí, con las coordenadas de dónde se tomó la foto.' : 'Acá está el link de descarga de tu foto.'}
      </p>
      <table style="width:100%; border-collapse:collapse;">${rows}</table>
      <p style="font-size:13px; color:#a29c8e; margin-top:24px;">Total pagado: ${total}</p>
      <p style="font-family:Georgia,serif; font-style:italic; font-size:14px; color:#a29c8e; margin-top:32px;">— Mario</p>
    </div>
  </div>`;

  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Tu compra en Cant Believe The View',
    html,
    ...(attachments.length ? { attachments } : {}),
  });
}

module.exports = { sendOrderConfirmation };

# cantbelievetheview-api

Backend de checkout de [cantbelievetheview.com](https://cantbelievetheview.com): cobra el pago con
**Stripe** (tarjeta + PayPal) y manda los pedidos de impresión a **Prodigi**, que imprime
(papel de algodón / aluminio) y envía a domicilio en todo el mundo con packaging sin marca.

## Cómo funciona (resumen)

```
Cliente en el sitio → agrega fotos al carrito (digital o impresión)
                    → "Finalizar compra" → POST /api/checkout
                    → el backend recalcula los precios desde data.json
                      (nunca confía en el precio que mande el navegador)
                    → crea una Stripe Checkout Session y devuelve su URL
                    → el cliente paga en la página de Stripe (tarjeta o PayPal)
                    → Stripe manda un webhook a /api/stripe-webhook
                    → por cada item de IMPRESIÓN: se crea un pedido en Prodigi
                      (la foto, el material/tamaño, la dirección de envío)
                    → Prodigi imprime y envía directo al cliente
                    → el cliente vuelve al sitio, que le muestra los links de
                      descarga de lo digital (vía /api/order-status)
```

Los items **digitales** no pasan por Prodigi — el "envío" es la URL de Cloudinary
de la foto sin marca de agua (la marca de agua es una capa de CSS, el archivo
real siempre estuvo limpio).

## ⚠️ Antes de activarlo con plata real, hacé esto en orden

### 1. Cuenta de Stripe
[dashboard.stripe.com/register](https://dashboard.stripe.com/register). Una vez creada:
- **Developers → API keys** → copiá la **Secret key** de modo **Test** (`sk_test_...`) → `STRIPE_SECRET_KEY`
- **Settings → Payment methods** → activá **PayPal** (además de tarjetas, que ya vienen activas)

### 2. Cuenta de Prodigi
[prodigi.com](https://www.prodigi.com/) → creá cuenta (te da Sandbox y Live automáticamente).
- **Settings → Integrations → API** → "Show API Key" → `PRODIGI_API_KEY`
- Dejá `PRODIGI_ENV=sandbox` hasta haber probado un pedido de punta a punta (sandbox no imprime ni cobra nada real)

### 3. ⚠️ Completar el mapeo de materiales → SKU de Prodigi (obligatorio)
Este es el paso que **no puedo hacer por vos** — necesita tu cuenta de Prodigi:
1. En el dashboard de Prodigi, buscá el catálogo de productos ("Product catalogue") o
   pegale a `GET https://api.sandbox.prodigi.com/v4.0/products` con tu API key.
2. Para **papel de algodón** buscá algo tipo `GLOBAL-FAP-...` (fine art paper) en las
   medidas más parecidas a 30×40cm, 50×70cm y 70×100cm (Prodigi mide en pulgadas).
3. Para **aluminio** buscá su línea de metal prints (el prefijo puede variar, confirmalo
   ahí — no lo inventes).
4. Editá [`lib/catalog.js`](lib/catalog.js) y completá `PRODIGI_SKU_MAP` con los 6 SKUs
   reales (3 tamaños × 2 materiales). Mientras una combinación no esté ahí, el checkout
   la va a **rechazar en vez de mandarle a Prodigi un SKU inventado**.
5. Commiteá y pusheá ese cambio.

### 4. Subir este proyecto a GitHub y deployarlo en Vercel
Igual que hicimos con el sitio y el bot:
```bash
git init && git add -A && git commit -m "Backend inicial de checkout"
git branch -M main
git remote add origin https://github.com/Azerian126/cantbelievetheview-api.git
git push -u origin main
```
Después en [vercel.com](https://vercel.com) → **Add New Project** → importá el repo.
Cargá las variables de `.env.example` en **Project Settings → Environment Variables**.

### 5. Conectar el webhook de Stripe
Una vez deployado (te da una URL tipo `cantbelievetheview-api.vercel.app`):
- Dashboard de Stripe → **Developers → Webhooks → Add endpoint**
- URL: `https://cantbelievetheview-api.vercel.app/api/stripe-webhook`
- Evento a escuchar: `checkout.session.completed`
- Copiá el **Signing secret** (`whsec_...`) → cargalo como `STRIPE_WEBHOOK_SECRET` en Vercel
  y volvé a deployar para que lo tome.

### 6. Probar un pedido de punta a punta en modo TEST
Con `STRIPE_SECRET_KEY` en modo test y `PRODIGI_ENV=sandbox`:
1. Agregá una foto al carrito en el sitio (necesita al menos una foto real cargada — ver el bot de Telegram).
2. Pagá con una [tarjeta de prueba de Stripe](https://docs.stripe.com/testing) (ej. `4242 4242 4242 4242`, cualquier fecha futura y CVC).
3. Revisá en el dashboard de Stripe que el pago se ve como pagado, y en el de Prodigi
   (sandbox) que el pedido de impresión se creó.
4. Recién cuando esto funcione, pasá `STRIPE_SECRET_KEY` a la clave **live** (`sk_live_...`)
   y `PRODIGI_ENV=live` — ahí sí empieza a cobrar y a imprimir de verdad.

## Variables de entorno

| Variable | De dónde sale |
|---|---|
| `STRIPE_SECRET_KEY` | Dashboard de Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Dashboard de Stripe → Developers → Webhooks → tu endpoint |
| `PRODIGI_API_KEY` | Dashboard de Prodigi → Settings → Integrations → API |
| `PRODIGI_ENV` | `sandbox` mientras probás, `live` cuando ya confirmaste que funciona |
| `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH` | Repo del sitio (`Azerian126`/`Cantbelievetheview`/`main`) — de acá se leen los precios canónicos |
| `CORS_ORIGIN` | `https://cantbelievetheview.com` |

## Si algo se traba

- **"Foto no reconocida" al pagar**: la URL de la foto no está en `data.json` (revisá que
  la foto se haya subido por el bot y esté publicada).
- **El webhook no llega**: revisá en el dashboard de Stripe → Webhooks → tu endpoint → "logs de eventos" que esté devolviendo 200.
- **Se cobró pero no se mandó a imprimir**: mirá los logs de la función `stripe-webhook`
  en Vercel — si falta el SKU en `PRODIGI_SKU_MAP`, queda un `[ALERTA]` bien visible ahí,
  y ese pedido hay que cargarlo a mano en Prodigi mientras tanto.

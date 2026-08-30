# cantbelievetheview — la API

El backend de pagos y pedidos de impresión. Recibe la compra, cobra con **Stripe** y manda
el pedido a **Prodigi**, que imprime y envía.

**Node 24 · Vercel · despliegue automático en cada push a `main`.**

## ⚠️ Este repositorio es PÚBLICO

El código puede serlo sin problema, pero **una sola clave commiteada aquí queda expuesta al
mundo entero** — y aquí viven Stripe y Prodigi. Todas las credenciales van en *Vercel →
Project Settings → Environment Variables*, nunca en el repo.

Se verificó el 26 de agosto de 2026 que el historial está limpio. Que siga así.

## El checkout está APAGADO

Todo el código está hecho y probado, pero **no puede cobrar todavía**. Falta lo que solo
puede hacer Mario:

- Llave `sk_live` de Stripe (hoy en modo prueba)
- Cuenta de Prodigi
- El webhook de Stripe apuntando a producción

Lo que falta es configuración, no infraestructura.

## Cómo elige qué imprimir

El bot sube **tres versiones** de cada foto a Cloudinary: la del sitio, más `-algodon` y
`-aluminio`, preparadas para el rango de color de cada material. La API **elige la derivada
según el material comprado** al armar el pedido a Prodigi.

Y **cae a la foto original si no encuentra la derivada** — a propósito, para no romper una
venta nunca. Las URLs viven en Redis (`cbtv:photoprint:<id>`), no en `data.json`.

## Pendiente que importa antes de cobrar de verdad

⚠️ **El backend no revalida el límite de 200 dpi.** La web oculta los tamaños que la foto no
aguanta, pero **una petición manipulada los pediría igual** — y saldría una impresión
borrosa a nombre de Mario. Cerrarlo antes de activar los cobros.

También pendiente: los **perfiles ICC reales de Prodigi**. Hoy la preparación de impresión
usa límites de gama genéricos; con el perfil real del papel se puede hacer prueba de color
de verdad.

## Nunca se ha probado la cadena completa

Bot y API se validaron por separado, pero **nadie ha subido una foto y la ha comprado**. Que
Prodigi reciba la derivada correcta sigue siendo teoría hasta que se haga un pedido real de
cada material.

## Dependencias

`stripe`, `cloudinary`, `@upstash/redis`, `resend`, `satori`, `@resvg/resvg-wasm`. Las dos
últimas generan la tarjeta A6 que acompaña cada pedido de impresión.

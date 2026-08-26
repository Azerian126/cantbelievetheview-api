// Genera la tarjeta A6 que va adentro del sobre con cada impresión: nombre
// de la foto, coordenadas, país/categoría, y la firma de Mario. Se arma al
// vuelo con satori (HTML/CSS -> SVG) + resvg (SVG -> PNG), y esa imagen es
// la que se le manda a Prodigi como "postcard" branding en el pedido.
//
// Si el pedido es un regalo, se suma un bloque Para/De/Nota y la firma de
// Mario pasa a segundo plano (mucho más chica) para no competir con el
// mensaje — es la carta del que regala, no la suya.

const fs = require('fs');
const satori = require('satori').default;
const { Resvg, initWasm } = require('@resvg/resvg-wasm');

// La versión WASM (no la nativa @resvg/resvg-js) es la que hay que usar acá
// a propósito: la nativa trae un binario compilado por plataforma, y el
// build local (Mac) no sirve en el runtime de Vercel (Linux) — ahí el
// require ni siquiera llega a nuestro código, tira un 500 genérico antes de
// que cualquier try/catch pueda atajarlo. WASM corre igual en cualquier
// plataforma. Se inicializa una sola vez por instancia tibia de la función.
let wasmReady = null;
function ensureWasm() {
  if (!wasmReady) {
    const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
    wasmReady = initWasm(fs.readFileSync(wasmPath));
  }
  return wasmReady;
}

// Chrome viejo hace que Google Fonts devuelva .ttf en vez de .woff2 —
// satori necesita ttf/otf, no puede leer woff2.
const OLD_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36';

let fontCache = null;

async function fetchGoogleFontTTF(cssParam) {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${cssParam}&display=swap`, {
    headers: { 'User-Agent': OLD_UA },
  }).then((r) => r.text());
  // El bloque "/* latin */" es el que trae los caracteres que usamos
  // (incluye tildes/ñ) — los primeros bloques del CSS son otros charsets
  // (cyrillic, greek, etc.) que no nos sirven.
  const latinBlock = css.split('/* latin */')[1] || css;
  const match = latinBlock.match(/src: url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
  if (!match) throw new Error(`No pude sacar la fuente de Google Fonts para ${cssParam}`);
  const bytes = await fetch(match[1]).then((r) => r.arrayBuffer());
  return Buffer.from(bytes);
}

async function loadFonts() {
  if (fontCache) return fontCache;
  const [frauncesItalic, mono, signature] = await Promise.all([
    fetchGoogleFontTTF('Fraunces:ital,wght@1,400'),
    fetchGoogleFontTTF('JetBrains+Mono:wght@400'),
    fetchGoogleFontTTF('Alex+Brush'),
  ]);
  fontCache = [
    { name: 'Fraunces', data: frauncesItalic, weight: 400, style: 'italic' },
    { name: 'JetBrains Mono', data: mono, weight: 400, style: 'normal' },
    { name: 'Alex Brush', data: signature, weight: 400, style: 'normal' },
  ];
  return fontCache;
}

// A6 a 300dpi ≈ 1240x1748px. Usamos la mitad de resolución (620x874) —
// de sobra para el tamaño que imprime Prodigi, y más liviano/rápido.
const WIDTH = 620;
const HEIGHT = 874;

const INK = '#14140f';
const DIM = '#a29c8e';
const MID = '#6f6a5c';
const LINE = '#d8d3c6';

function label(text) {
  return {
    type: 'div',
    props: {
      style: {
        fontFamily: 'JetBrains Mono',
        fontSize: 12,
        letterSpacing: 3,
        textTransform: 'uppercase',
        color: DIM,
      },
      children: text,
    },
  };
}

function giftName(text) {
  return {
    type: 'div',
    props: {
      style: { fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 27, color: INK, marginTop: 5 },
      children: text,
    },
  };
}

/** Bloque "Para / De / nota" — cada parte es opcional, aparece solo la que
 *  Mario cargó en el checkout. Es el centro visual de una carta de regalo. */
function buildGiftBlock(gift) {
  const parts = [];
  if (gift.to) {
    parts.push({
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 },
        children: [label('Para'), giftName(gift.to)],
      },
    });
  }
  if (gift.note) {
    parts.push({
      type: 'div',
      props: {
        style: {
          fontFamily: 'Fraunces',
          fontStyle: 'italic',
          fontSize: 20,
          color: '#3a382f',
          lineHeight: 1.55,
          margin: '6px 26px',
          display: 'flex',
        },
        children: `"${gift.note}"`,
      },
    });
  }
  if (gift.from) {
    parts.push({
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 16 },
        children: [label('De'), giftName(gift.from)],
      },
    });
  }

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        borderTop: `1px solid ${LINE}`,
        borderBottom: `1px solid ${LINE}`,
        padding: '26px 0',
      },
      children: parts,
    },
  };
}

/**
 * @param {Object} p
 * @param {string} p.title - nombre/título de la foto
 * @param {string} p.coordsText - ej. "13.1631° S / 72.5450° O"
 * @param {string} p.place - país o categoría
 * @param {number} p.editionNumber - número real de esta impresión (de lib/editions.js)
 * @param {Object} [p.gift] - si el pedido es un regalo: { to, from, note } (todos opcionales)
 */
async function renderPostcard({ title, coordsText, place, editionNumber, gift }) {
  await ensureWasm();
  const fonts = await loadFonts();

  const isGift = !!(gift && (gift.to || gift.from || gift.note));

  const children = [
    {
      type: 'div',
      props: {
        style: {
          fontFamily: 'JetBrains Mono',
          fontSize: 16,
          letterSpacing: 4,
          textTransform: 'uppercase',
          color: DIM,
        },
        children: 'cantbelievetheview',
      },
    },
    {
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
        children: [
          {
            type: 'div',
            props: {
              style: {
                fontFamily: 'Fraunces',
                fontStyle: 'italic',
                fontSize: isGift ? 32 : 38,
                color: INK,
                marginBottom: 18,
                lineHeight: 1.3,
              },
              children: title,
            },
          },
          {
            type: 'div',
            props: {
              style: { fontFamily: 'JetBrains Mono', fontSize: 17, letterSpacing: 1, color: MID },
              children: coordsText || '',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontFamily: 'JetBrains Mono',
                fontSize: 15,
                letterSpacing: 2,
                color: DIM,
                textTransform: 'uppercase',
                marginTop: 4,
              },
              children: place || '',
            },
          },
        ],
      },
    },
  ];

  if (isGift) children.push(buildGiftBlock(gift));

  // Sin regalo, la firma es la pieza principal del pie (grande, en tinta).
  // Con regalo, pasa a segundo plano — chica y en gris, solo como
  // procedencia/autoría, no como protagonista de la tarjeta.
  children.push({
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
      children: [
        {
          type: 'div',
          props: {
            style: {
              fontFamily: 'Alex Brush',
              fontSize: isGift ? 26 : 58,
              color: isGift ? MID : INK,
            },
            children: 'Mario Mazzone',
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontFamily: 'JetBrains Mono',
              fontSize: 13,
              letterSpacing: 1.5,
              color: DIM,
              textTransform: 'uppercase',
              marginTop: 4,
            },
            children: `Impresión N.° ${editionNumber} · pieza única`,
          },
        },
      ],
    },
  });

  const tree = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        background: '#edeae2',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '56px 50px',
      },
      children,
    },
  };

  const svg = await satori(tree, { width: WIDTH, height: HEIGHT, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
  return png; // Buffer
}

module.exports = { renderPostcard };

// Sube la tarjeta generada (PNG) a Cloudinary para tener una URL pública
// que mandarle a Prodigi como "branding" del pedido. Mismas credenciales
// que ya usa el bot de Telegram (misma cuenta de Cloudinary).
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadBuffer(buffer, publicIdHint) {
  // renderPostcard() (resvg-wasm) devuelve un Uint8Array, no un Buffer de
  // Node — Uint8Array.toString() ignora el argumento de encoding y cae al
  // toString() de array normal (junta los bytes con comas), así que sin
  // este Buffer.from() la "base64" queda corrupta (bytes en decimal
  // separados por coma) y Cloudinary explota con ENAMETOOLONG al tratar de
  // abrirla como si fuera un path de archivo.
  const base64 = `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`;
  const uploaded = await cloudinary.uploader.upload(base64, {
    folder: 'cantbelievetheview/postcards',
    public_id: publicIdHint,
    overwrite: false,
    unique_filename: true,
  });
  return uploaded.secure_url;
}

module.exports = { uploadBuffer };

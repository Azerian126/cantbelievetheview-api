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
  const base64 = `data:image/png;base64,${buffer.toString('base64')}`;
  const uploaded = await cloudinary.uploader.upload(base64, {
    folder: 'cantbelievetheview/postcards',
    public_id: publicIdHint,
    overwrite: false,
    unique_filename: true,
  });
  return uploaded.secure_url;
}

module.exports = { uploadBuffer };

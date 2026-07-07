const crypto = require('crypto');

function verifyShopifyWebhook(req, res, next) {
  console.log("===== SHOPIFY WEBHOOK =====");
  console.log("URL :", req.originalUrl);
  console.log("Headers :", req.headers);

  const hmac = req.headers['x-shopify-hmac-sha256'];
  console.log("HMAC reçu :", hmac);

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  console.log("Secret présent :", !!secret);

  if (!hmac) {
    return res.status(401).json({ message: 'Signature Shopify manquante' });
  }

  if (!secret) {
    return res.status(500).json({ message: 'Secret Shopify non configure' });
  }

  if (!Buffer.isBuffer(req.body)) {
    console.log("Le body n'est PAS un Buffer");
    return res.status(400).json({ message: 'Raw body requis' });
  }

  console.log("Raw body OK");
}
  // laisse le reste du code inchangé...

module.exports = verifyShopifyWebhook;

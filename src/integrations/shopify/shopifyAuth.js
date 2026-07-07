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
    return res.status(500).json({ message: 'Secret Shopify non configuré' });
  }

  if (!Buffer.isBuffer(req.body)) {
    console.log("Le body n'est PAS un Buffer");
    return res.status(400).json({ message: 'Raw body requis' });
  }

  console.log("Raw body OK");

  const generated = crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('base64');

  console.log("HMAC généré :", generated);
  console.log("HMAC reçu :", hmac);

  const receivedBuffer = Buffer.from(hmac, 'base64');
  const generatedBuffer = Buffer.from(generated, 'base64');

  const isValid =
    receivedBuffer.length === generatedBuffer.length &&
    crypto.timingSafeEqual(receivedBuffer, generatedBuffer);

  console.log("Signature valide :", isValid);

  if (!isValid) {
    return res.status(401).json({ message: 'Signature invalide' });
  }

  try {
    req.body = JSON.parse(req.body.toString('utf8'));
  } catch (err) {
    return res.status(400).json({ message: 'JSON invalide' });
  }

  console.log("Webhook validé, passage au contrôleur");
  next();
}

module.exports = verifyShopifyWebhook;
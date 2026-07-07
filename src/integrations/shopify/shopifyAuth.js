const crypto = require('crypto');

function verifyShopifyWebhook(req, res, next) {
  const hmac = req.headers['x-shopify-hmac-sha256'];

  if (!hmac) {
    return res.status(401).json({ message: 'Signature Shopify manquante' });
  }

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  if (!secret) {
    return res.status(500).json({ message: 'Secret Shopify non configure' });
  }

  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({ message: 'Raw body requis pour verifier Shopify' });
  }

  const generated = crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('base64');

  const receivedBuffer = Buffer.from(hmac, 'base64');
  const generatedBuffer = Buffer.from(generated, 'base64');
  const isValid =
    receivedBuffer.length === generatedBuffer.length &&
    crypto.timingSafeEqual(receivedBuffer, generatedBuffer);

  if (!isValid) {
    return res.status(401).json({ message: 'Signature invalide' });
  }

  try {
    req.body = JSON.parse(req.body.toString('utf8'));
  } catch (error) {
    return res.status(400).json({ message: 'JSON Shopify invalide' });
  }

  next();
}

module.exports = verifyShopifyWebhook;

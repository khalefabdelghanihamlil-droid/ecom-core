const crypto = require('crypto');

function verifyShopifyWebhook(req, res, next) {
  const hmac = req.headers['x-shopify-hmac-sha256'];

  if (!hmac) {
    return next();
  }

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  if (!secret) {
    return next();
  }

  const generated = crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('base64');

  if (hmac !== generated) {
    return res.status(401).json({ message: 'Signature invalide' });
  }

  next();
}

module.exports = verifyShopifyWebhook;

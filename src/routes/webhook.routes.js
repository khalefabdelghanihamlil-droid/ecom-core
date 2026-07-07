const express = require('express');
const router = express.Router();
const { handleShopifyOrder } = require('../controllers/webhookController');
const verifyShopifyWebhook = require('../integrations/shopify/shopifyAuth');

// NOTE: pas de rate-limit par IP ici — les webhooks Shopify proviennent des
// serveurs Shopify (IP partagée), pas du client final. Un rate-limit par IP
// plafonnerait toute la boutique, pas les fraudeurs. La protection anti-abus
// se fait désormais via fraudEngine.evaluateFraudRisk (score par commande).
router.post(
  '/shopify-order',
  express.raw({ type: 'application/json' }),
  verifyShopifyWebhook,
  handleShopifyOrder
);

module.exports = router;

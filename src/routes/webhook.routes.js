const express = require('express');
const router = express.Router();
const { handleShopifyOrder } = require('../controllers/webhookController');
const verifyShopifyWebhook = require('../middleware/shopifyAuth');
const limiterCommande = require('../middleware/rateLimiter');

router.post('/shopify-order', limiterCommande, verifyShopifyWebhook, handleShopifyOrder);

module.exports = router;

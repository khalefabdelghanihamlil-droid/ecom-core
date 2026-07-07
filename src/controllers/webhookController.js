const { processNewOrder } = require('../services/commande.service');

async function handleShopifyOrder(req, res) {
  try {
    const order = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    console.log("===== WEBHOOK SHOPIFY =====");
console.log(JSON.stringify(order, null, 2));
console.log("===========================");
    
    // Extraire les donnees pertinentes du webhook
    const orderData = {
      telephone: order.phone || (order.shipping_address && order.shipping_address.phone),
      email: order.email,
      montant: parseFloat(order.total_price),
      shopifyOrderId: String(order.id),
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      deviceFingerprint: null
    };
  console.log("Téléphone :", orderData.telephone);
console.log("Email :", orderData.email);
console.log("Montant :", orderData.montant); 
    // Déléguer au service de commande orchestrateur
    const resultat = await processNewOrder(orderData);

    return res.status(200).json(resultat);

  } catch (err) {
    console.log('Erreur webhook: ' + err.message);
    const statusCode = err.message.includes('invalides') ? 400 : 500;
    return res.status(statusCode).json({ message: err.message });
  }
}

module.exports = { handleShopifyOrder };

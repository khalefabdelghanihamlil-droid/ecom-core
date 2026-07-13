const crypto = require('crypto');

async function sendMetaPurchase(order) {
  try {
    console.log('[META CAPI] Purchase envoyé');

    // Le vrai appel HTTP sera ajouté à l'étape suivante.

    return true;
  } catch (err) {
    console.error('[META CAPI]', err.message);
    return false;
  }
}

async function sendTikTokPurchase(order) {
  try {
    console.log('[TIKTOK EVENTS API] Purchase envoyé');

    // Le vrai appel HTTP sera ajouté à l'étape suivante.

    return true;
  } catch (err) {
    console.error('[TIKTOK EVENTS API]', err.message);
    return false;
  }
}

module.exports = {
  sendMetaPurchase,
  sendTikTokPurchase
};
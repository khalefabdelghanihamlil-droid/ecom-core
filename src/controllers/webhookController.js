const supabase = require('../config/supabase');
const { validerTelephone, validerEmail } = require('../services/validationService');
const { calculerScoreRisque } = require('../services/riskScoring');
const { genererCodeOTP, envoyerSMS } = require('../services/smsService');

async function handleShopifyOrder(req, res) {
  try {
    const order = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const telephone = order.phone || (order.shipping_address && order.shipping_address.phone);
    const email = order.email;
    const montant = parseFloat(order.total_price);
    const shopifyOrderId = String(order.id);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const deviceFingerprint = null;

    // Validation des donnees
    if (!validerTelephone(telephone) || !validerEmail(email)) {
      return res.status(400).json({ message: 'Donnees invalides' });
    }

    // Idempotence - verifier si commande existe deja
    const { data: existeDeja } = await supabase
      .from('commande')
      .select('id')
      .eq('shopify_order_id', shopifyOrderId)
      .single();

    if (existeDeja) {
      return res.status(200).json({ message: 'Deja traite' });
    }

    // Trouver ou creer le client
    let { data: client } = await supabase
      .from('client')
      .select('*')
      .eq('telephone', telephone)
      .single();

    if (!client) {
      const { data: nouveauClient } = await supabase
        .from('client')
        .insert([{ telephone: telephone, email: email, score_risque: 0 }])
        .select()
        .single();
      client = nouveauClient;
    }

    // Blacklist - rejet immediat
    if (client && client.blackliste) {
      await supabase.from('commande').insert([{
        client_id: client.id,
        shopify_order_id: shopifyOrderId,
        montant: montant,
        ip_address: ip,
        statut: 'rejetee_blacklist',
        is_fake: true
      }]);
      return res.status(200).json({ message: 'Client blackliste' });
    }

    // Calcul du score de risque
    const { score, details, necessiteOTP } = await calculerScoreRisque(
      client, montant, email, ip, deviceFingerprint
    );

    // Creation de la commande
    const { data: commande } = await supabase
      .from('commande')
      .insert([{
        client_id: client.id,
        shopify_order_id: shopifyOrderId,
        montant: montant,
        ip_address: ip,
        email: email,
        score_risque_calcule: score,
        statut: necessiteOTP ? 'en_attente_otp' : 'confirmee'
      }])
      .select()
      .single();

    // Envoi OTP si necessaire
    if (necessiteOTP) {
      const code = genererCodeOTP();
      await supabase.from('verif_otp').insert([{
        commande_id: commande.id,
        code: code,
        valide: false,
        tentatives: 0
      }]);

      console.log('OTP genere pour ' + telephone + ': ' + code);
    }

    return res.status(200).json({
      message: 'Commande traitee',
      score: score,
      details: details,
      statut: necessiteOTP ? 'en_attente_otp' : 'confirmee'
    });

  } catch (err) {
    console.log('Erreur webhook: ' + err.message);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = { handleShopifyOrder };

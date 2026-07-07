const confirmationService = require('../services/confirmation.service');

async function envoyerOTP(req, res) {
  try {
    const commande_id = req.body.commande_id;
    if (!commande_id) return res.status(400).json({ message: 'commande_id requis' });

    const resultat = await confirmationService.demanderOTP(commande_id);
    return res.status(200).json(resultat);
  } catch (err) {
    console.log('Erreur envoi OTP: ' + err.message);
    const status = err.message.includes('Trop de tentatives') ? 429 : (err.message.includes('introuvable') ? 404 : 500);
    return res.status(status).json({ message: err.message });
  }
}

async function verifierOTP(req, res) {
  try {
    const { commande_id, code_saisi } = req.body;
    if (!commande_id || !code_saisi) {
      return res.status(400).json({ message: 'commande_id et code_saisi requis' });
    }

    const resultat = await confirmationService.validerOTP(commande_id, code_saisi);
    return res.status(200).json(resultat);
  } catch (err) {
    console.log('Erreur verification OTP: ' + err.message);
    const status = err.message.includes('déjà utilisé') ? 409
      : (err.message.includes('expiré') || err.message.includes('incorrect')) ? 400
      : err.message.includes('rejetee') ? 403
      : 500;
    return res.status(status).json({ message: err.message });
  }
}

async function statutOTP(req, res) {
  try {
    const commande_id = req.params.commande_id;
    const statut = await confirmationService.verifierStatutOTP(commande_id);

    if (!statut) {
      return res.status(404).json({ message: 'Pas d\'OTP pour cette commande' });
    }

    res.json(statut);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { envoyerOTP, verifierOTP, statutOTP };

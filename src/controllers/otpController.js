const supabase = require('../config/supabase');
const { genererCodeOTP, envoyerSMS } = require('../services/smsService');

async function envoyerOTP(req, res) {
  try {
    const commande_id = req.body.commande_id;

    if (!commande_id) {
      return res.status(400).json({ message: 'commande_id requis' });
    }

    const { data: commande } = await supabase
      .from('commande')
      .select('id, client:client_id(telephone)')
      .eq('id', commande_id)
      .single();

    if (!commande) {
      return res.status(404).json({ message: 'Commande introuvable' });
    }

    const code = genererCodeOTP();

    await supabase.from('verif_otp').upsert(
      { commande_id: commande_id, code: code, valide: false, tentatives: 0 },
      { onConflict: 'commande_id' }
    );

    const message = 'Votre code de confirmation: ' + code;
    const envoye = await envoyerSMS(commande.client.telephone, message);

    if (!envoye) {
      return res.status(500).json({ message: 'Echec envoi SMS' });
    }

    return res.status(200).json({ message: 'OTP envoye' });

  } catch (err) {
    console.log('Erreur envoi OTP: ' + err.message);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

async function verifierOTP(req, res) {
  try {
    const commande_id = req.body.commande_id;
    const code_saisi = req.body.code_saisi;

    if (!commande_id || !code_saisi) {
      return res.status(400).json({ message: 'commande_id et code_saisi requis' });
    }

    const { data: otp } = await supabase
      .from('verif_otp')
      .select('*')
      .eq('commande_id', commande_id)
      .single();

    if (!otp) {
      return res.status(404).json({ message: 'Verification introuvable' });
    }

    // Trop de tentatives
    if (otp.tentatives >= 3) {
      await supabase
        .from('commande')
        .update({ statut: 'rejetee_otp_echec', is_fake: true })
        .eq('id', commande_id);
      return res.status(403).json({ message: 'Trop de tentatives, commande rejetee' });
    }

    // Code correct
    if (otp.code === code_saisi) {
      await supabase
        .from('verif_otp')
        .update({ valide: true })
        .eq('commande_id', commande_id);

      await supabase
        .from('commande')
        .update({ statut: 'confirmee' })
        .eq('id', commande_id);

      return res.status(200).json({ message: 'Commande confirmee' });
    }

    // Code incorrect
    await supabase
      .from('verif_otp')
      .update({ tentatives: otp.tentatives + 1 })
      .eq('commande_id', commande_id);

    return res.status(400).json({
      message: 'Code incorrect',
      tentatives_restantes: 3 - (otp.tentatives + 1)
    });

  } catch (err) {
    console.log('Erreur verification OTP: ' + err.message);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = { envoyerOTP, verifierOTP };

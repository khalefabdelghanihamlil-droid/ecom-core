const supabase = require('../config/supabase');
const { genererCodeOTP, envoyerSMS } = require('../integrations/sms/smsProvider');

const OTP_EXPIRATION_MINUTES = 5;

/**
 * Évalue l'expiration d'un OTP à partir de son created_at.
 * Fail-safe sécurité : un horodatage absent ou invalide est considéré comme
 * EXPIRÉ (on refuse plutôt que d'accepter un OTP dont on ne connaît pas l'âge).
 */
function evaluerExpiration(created_at) {
  if (!created_at) {
    return { expire: true, minutesRestantes: 0 };
  }
  const dateCreation = new Date(created_at);
  const diffMinutes = (Date.now() - dateCreation.getTime()) / 1000 / 60;
  if (Number.isNaN(diffMinutes)) {
    return { expire: true, minutesRestantes: 0 };
  }
  return {
    expire: diffMinutes > OTP_EXPIRATION_MINUTES,
    minutesRestantes: Math.max(0, Math.floor(OTP_EXPIRATION_MINUTES - diffMinutes))
  };
}

/**
 * Service gérant la confirmation par OTP.
 */
class ConfirmationService {

  async demanderOTP(commande_id) {
    const { data: commande } = await supabase
      .from('commande')
      .select('id, client:client_id(telephone)')
      .eq('id', commande_id)
      .single();

    if (!commande) {
      throw new Error('Commande introuvable');
    }

    const { data: otpExistant } = await supabase
      .from('verif_otp')
      .select('tentatives, created_at')
      .eq('commande_id', commande_id)
      .single();

    if (otpExistant && otpExistant.tentatives >= 3) {
      throw new Error('Trop de tentatives d\'envoi. Veuillez contacter le support.');
    }

    const code = genererCodeOTP();
    const { error: otpError } = await supabase
      .from('verif_otp')
      .upsert(
        {
          commande_id: commande_id,
          code: code,
          valide: false,
          tentatives: otpExistant ? otpExistant.tentatives + 1 : 0,
          // On force created_at à chaque (ré)envoi : le DEFAULT now() ne s'applique
          // qu'à l'INSERT, pas à l'UPDATE. Sans cela, un OTP renvoyé conserverait
          // l'horodatage initial et pourrait naître déjà expiré.
          created_at: new Date().toISOString()
        },
        { onConflict: 'commande_id' }
      );

    if (otpError) throw new Error('Erreur lors de la sauvegarde de l\'OTP');

    const message = `Votre code de confirmation: ${code} (Valide ${OTP_EXPIRATION_MINUTES} minutes)`;
    const envoye = await envoyerSMS(commande.client.telephone, message);

    if (!envoye) {
      throw new Error('Echec envoi SMS');
    }

    return { success: true, message: 'OTP envoye' };
  }

  async validerOTP(commande_id, code_saisi) {
    const { data: otp } = await supabase
      .from('verif_otp')
      .select('*')
      .eq('commande_id', commande_id)
      .single();

    if (!otp) {
      throw new Error('Verification introuvable');
    }

    // Garde anti-réutilisation : un OTP déjà validé ne peut pas resservir.
    if (otp.valide) {
      throw new Error('OTP déjà utilisé');
    }

    if (evaluerExpiration(otp.created_at).expire) {
      throw new Error('Ce code OTP a expiré. Veuillez en demander un nouveau.');
    }

    if (otp.tentatives >= 3) {
      await supabase
        .from('commande')
        .update({ statut: 'rejetee_otp_echec', is_fake: true })
        .eq('id', commande_id);
      throw new Error('Trop de tentatives, commande rejetee');
    }

    if (otp.code === code_saisi) {
      await supabase
        .from('verif_otp')
        .update({ valide: true })
        .eq('commande_id', commande_id);

      await supabase
        .from('commande')
        .update({ statut: 'confirmee' })
        .eq('id', commande_id);

      return { success: true, message: 'Commande confirmee' };
    }

    await supabase
      .from('verif_otp')
      .update({ tentatives: otp.tentatives + 1 })
      .eq('commande_id', commande_id);

    throw new Error(`Code incorrect. Tentatives restantes: ${3 - (otp.tentatives + 1)}`);
  }

  async verifierStatutOTP(commande_id) {
    const { data: otp, error } = await supabase
      .from('verif_otp')
      .select('valide, tentatives, created_at')
      .eq('commande_id', commande_id)
      .single();

    if (error || !otp) {
      return null;
    }

    const { expire, minutesRestantes } = evaluerExpiration(otp.created_at);

    return {
      valide: otp.valide,
      tentatives: otp.tentatives,
      expire: expire,
      minutes_restantes: minutesRestantes
    };
  }
}

module.exports = new ConfirmationService();

const supabase = require('../config/supabase');
const { emailEstJetable, verifierPaysIP } = require('./validationService');

const POINTS = {
  NOUVEAU_CLIENT: 20,
  MONTANT_ELEVE: 25,
  RAFALE_COMMANDES: 40,
  TELEPHONE_SIGNALE: 100,
  EMAIL_JETABLE: 20,
  IP_PAYS_DIFFERENT: 30,
  DEVICE_MULTI_COMPTES: 40
};

const SEUIL_OTP = 30;

async function calculerScoreRisque(client, montant, email, ip, deviceFingerprint) {
  let score = 0;
  const details = [];

  // Nouveau client
  if (!client) {
    score += POINTS.NOUVEAU_CLIENT;
    details.push('nouveau_client');
  }

  // Premiere commande montant eleve
  if (!client && montant > 15000) {
    score += POINTS.MONTANT_ELEVE;
    details.push('montant_eleve');
  }

  // Rafale de commandes
  if (client) {
    const dixMinutesAvant = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('commande')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id)
      .gte('date_commande', dixMinutesAvant);

    if (count > 3) {
      score += POINTS.RAFALE_COMMANDES;
      details.push('rafale_commandes');
    }
  }

  // Telephone blackliste
  if (client && client.blackliste) {
    score += POINTS.TELEPHONE_SIGNALE;
    details.push('telephone_signale');
  }

  // Email jetable
  if (emailEstJetable(email)) {
    score += POINTS.EMAIL_JETABLE;
    details.push('email_jetable');
  }

  // IP hors Algerie
  const paysIP = await verifierPaysIP(ip);
  if (paysIP && paysIP !== 'DZ') {
    score += POINTS.IP_PAYS_DIFFERENT;
    details.push('ip_pays_different');
  }

  // Device multi-comptes
  if (deviceFingerprint) {
    const { data: devices } = await supabase
      .from('device_tracking')
      .select('client_id')
      .eq('device_fingerprint', deviceFingerprint);

    if (devices && devices.length > 0) {
      const ids = devices.map(function(d) { return d.client_id; });
      const uniques = new Set(ids);
      if (client && uniques.size > 1 && !ids.includes(client.id)) {
        score += POINTS.DEVICE_MULTI_COMPTES;
        details.push('device_multi_comptes');
      }
    }
  }

  return { score, details, necessiteOTP: score >= SEUIL_OTP };
}

module.exports = { calculerScoreRisque };

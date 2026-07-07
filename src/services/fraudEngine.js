const supabase = require('../config/supabase');
const { emailEstJetable, verifierPaysIP } = require('./validationService');

const PAYS_ATTENDU = 'DZ'; // Boutique ciblant l'Algérie (cf. validerTelephone: 05/06/07)
const MONTANT_ELEVE = 20000; // DZD
const SCORE_BLOCK = 60;
const SCORE_OTP = 30;

// Historique du client : commandes déjà marquées fake/rejetées
async function getHistoriqueClient(clientId) {
    if (!clientId) {
        return { total: 0, fakes: 0 };
    }

    const { data } = await supabase
        .from('commande')
        .select('id, is_fake')
        .eq('client_id', clientId);

    const commandes = data || [];
    return {
        total: commandes.length,
        fakes: commandes.filter((c) => c.is_fake).length
    };
}

/**
 * Calcule un score de risque pondéré pour une commande entrante.
 * Périmètre volontairement minimal (débloquer le pipeline Commandes) :
 * l'ajustement fin des poids/critères est traité au Module Anti-fraude.
 */
async function evaluateFraudRisk(client, montant, email, ip, deviceFingerprint) {
    const reasons = [];
    let score = 0;

    // 1. Email jetable
    if (emailEstJetable(email)) {
        score += 25;
        reasons.push('Email jetable détecté');
    }

    // 2. Pays de l'IP différent du pays cible de la boutique
    const paysIP = await verifierPaysIP(ip);
    if (paysIP && paysIP !== PAYS_ATTENDU) {
        score += 20;
        reasons.push(`IP hors zone attendue (${paysIP})`);
    }

    // 3. Montant élevé
    if (Number(montant) >= MONTANT_ELEVE) {
        score += 15;
        reasons.push('Montant de commande élevé');
    }

    // 4. Historique du client (commandes déjà signalées fake)
    const historique = await getHistoriqueClient(client?.id);
    if (historique.fakes > 0) {
        score += 30;
        reasons.push(`${historique.fakes} commande(s) déjà signalée(s) fake pour ce client`);
    }

    // 5. Score de risque déjà cumulé sur le client
    if (Number(client?.score_risque || 0) >= 50) {
        score += 20;
        reasons.push('Score de risque client déjà élevé');
    }

    // 6. Nouveau client avec montant élevé (combinaison suspecte)
    if (historique.total === 0 && Number(montant) >= MONTANT_ELEVE) {
        score += 10;
        reasons.push('Nouveau client avec montant élevé');
    }

    score = Math.min(score, 100);

    let decision = 'ALLOW';
    if (score >= SCORE_BLOCK) {
        decision = 'BLOCK';
    } else if (score >= SCORE_OTP) {
        decision = 'OTP_REQUIRED';
    }

    return { decision, reasons, score };
}

module.exports = {
    evaluateFraudRisk
};

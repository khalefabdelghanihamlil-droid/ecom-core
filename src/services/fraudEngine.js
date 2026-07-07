const supabase = require('../config/supabase');
const { emailEstJetable, verifierPaysIP } = require('./validationService');

const PAYS_ATTENDU = 'DZ';
const MONTANT_ELEVE = 20000;
const SCORE_BLOCK = 60;
const SCORE_OTP = 30;

async function getHistoriqueClient(clientId) {
    if (!clientId) {
        return { total: 0, fakes: 0 };
    }

    try {
        const { data, error } = await supabase
            .from('commande')
            .select('id,is_fake')
            .eq('client_id', clientId);

        if (error) {
            console.error("Erreur historique :", error);
            return { total: 0, fakes: 0 };
        }

        const commandes = data || [];

        return {
            total: commandes.length,
            fakes: commandes.filter(c => c.is_fake).length
        };

    } catch (err) {
        console.error("Exception historique :", err);
        return { total: 0, fakes: 0 };
    }
}

async function evaluateFraudRisk(client, montant, email, ip, deviceFingerprint) {

    console.log("===== FRAUD ENGINE =====");

    const reasons = [];
    let score = 0;

    try {

        if (emailEstJetable(email)) {
            score += 25;
            reasons.push("Email jetable");
        }

        console.log("Étape A OK");

        let paysIP = null;

        try {
            paysIP = await verifierPaysIP(ip);
        } catch (err) {
            console.error("Erreur IP :", err);
        }

        console.log("Pays IP :", paysIP);

        if (paysIP && paysIP !== PAYS_ATTENDU) {
            score += 20;
            reasons.push("IP étrangère");
        }

        console.log("Étape B OK");

        if (Number(montant) >= MONTANT_ELEVE) {
            score += 15;
            reasons.push("Montant élevé");
        }

        const historique = await getHistoriqueClient(client?.id);

        console.log("Historique :", historique);

        if (historique.fakes > 0) {
            score += 30;
            reasons.push("Historique fraude");
        }

        if ((client?.score_risque || 0) >= 50) {
            score += 20;
            reasons.push("Client risqué");
        }

        if (historique.total === 0 && Number(montant) >= MONTANT_ELEVE) {
            score += 10;
            reasons.push("Nouveau client montant élevé");
        }

        score = Math.min(score, 100);

        let decision = "ALLOW";

        if (score >= SCORE_BLOCK) {
            decision = "BLOCK";
        } else if (score >= SCORE_OTP) {
            decision = "OTP_REQUIRED";
        }

        console.log("Décision :", decision);
        console.log("Score :", score);
        console.log("===== FIN FRAUD ENGINE =====");

        return {
            decision,
            reasons,
            score
        };

    } catch (err) {

        console.error("ERREUR FRAUD ENGINE :", err);

        return {
            decision: "ALLOW",
            reasons: [],
            score: 0
        };
    }
}

module.exports = {
    evaluateFraudRisk
};
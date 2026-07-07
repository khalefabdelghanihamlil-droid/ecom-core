const supabase = require('../config/supabase');

// Statistiques globales de fraude
async function getStatsFraude() {
    const { data: commandes, error } = await supabase
        .from('commande')
        .select('id, statut, score_risque_calcule, is_fake, date_commande');

    if (error) throw error;

    const total = commandes.length;
    const fakes = commandes.filter(function(c) { return c.is_fake; }).length;
    const rejetees = commandes.filter(function(c) {
        return c.statut === 'rejetee_blacklist' ||
               c.statut === 'rejetee_otp_echec' ||
               c.statut === 'rejetee_auto';
    }).length;

    const scores = commandes
        .map(function(c) { return parseFloat(c.score_risque_calcule || 0); })
        .filter(function(s) { return s > 0; });

    const scoreMoyen = scores.length > 0
        ? (scores.reduce(function(a, b) { return a + b; }, 0) / scores.length).toFixed(1)
        : 0;

    const tauxFraude = total > 0 ? ((fakes / total) * 100).toFixed(1) : 0;

    return {
        total_commandes: total,
        commandes_fake: fakes,
        commandes_rejetees: rejetees,
        taux_fraude: tauxFraude + '%',
        score_risque_moyen: scoreMoyen,
        commandes_otp: commandes.filter(function(c) { return c.statut === 'en_attente_otp'; }).length,
        commandes_confirmees: commandes.filter(function(c) { return c.statut === 'confirmee'; }).length
    };
}

// Top 10 clients à haut risque
async function getTopClientsRisques() {
    const { data: clients, error } = await supabase
        .from('client')
        .select('id, telephone, email, nom, prenom, score_risque, blackliste')
        .order('score_risque', { ascending: false })
        .limit(10);

    if (error) throw error;

    // Enrichir avec le nombre de commandes et taux de retour
    const enrichis = [];
    for (const client of clients) {
        const { data: commandes } = await supabase
            .from('commande')
            .select('id, statut')
            .eq('client_id', client.id);

        const totalCmd = commandes ? commandes.length : 0;
        const retours = commandes
            ? commandes.filter(function(c) { return c.statut === 'retournee'; }).length
            : 0;

        enrichis.push({
            ...client,
            total_commandes: totalCmd,
            retours: retours,
            taux_retour: totalCmd > 0 ? ((retours / totalCmd) * 100).toFixed(1) + '%' : '0%'
        });
    }

    return enrichis;
}

// Tendances fraude sur N jours
async function getTendancesFraude(jours) {
    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - (jours || 30));

    const { data: commandes, error } = await supabase
        .from('commande')
        .select('score_risque_calcule, is_fake, date_commande')
        .gte('date_commande', dateDebut.toISOString())
        .order('date_commande', { ascending: true });

    if (error) throw error;

    // Grouper par jour
    const parJour = {};
    for (const cmd of commandes) {
        const jour = cmd.date_commande ? cmd.date_commande.split('T')[0] : 'inconnu';
        if (!parJour[jour]) {
            parJour[jour] = { date: jour, total: 0, fakes: 0, score_total: 0 };
        }
        parJour[jour].total++;
        if (cmd.is_fake) parJour[jour].fakes++;
        parJour[jour].score_total += parseFloat(cmd.score_risque_calcule || 0);
    }

    return Object.values(parJour).map(function(j) {
        return {
            date: j.date,
            total_commandes: j.total,
            commandes_fake: j.fakes,
            score_moyen: j.total > 0 ? (j.score_total / j.total).toFixed(1) : 0,
            taux_fraude: j.total > 0 ? ((j.fakes / j.total) * 100).toFixed(1) + '%' : '0%'
        };
    });
}

module.exports = { getStatsFraude, getTopClientsRisques, getTendancesFraude };

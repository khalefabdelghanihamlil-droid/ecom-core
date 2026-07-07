const supabase = require('../config/supabase');
const { validerTelephone, validerEmail } = require('./validationService');
const fraudEngine = require('./fraudEngine');
const confirmationService = require('./confirmation.service');

// Récupérer toutes les commandes avec jointures
async function getAllCommandes(page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
        .from('commande')
        .select('*, client:client_id(id, telephone, email, nom, prenom, blackliste)', { count: 'exact' })
        .order('date_commande', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
        commandes: data,
        total: count,
        page: page,
        pages: Math.ceil((count || 0) / limit)
    };
}

// Récupérer une commande par ID (détail complet)
async function getCommandeById(id) {
    const { data, error } = await supabase
        .from('commande')
        .select('*, client:client_id(id, telephone, email, nom, prenom, blackliste)')
        .eq('id', id)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Commande introuvable');

    // Récupérer la livraison associée
    const { data: livraison } = await supabase
        .from('livraison')
        .select('*')
        .eq('commande_id', id)
        .single();

    // Récupérer les données finance
    const { data: finance } = await supabase
        .from('finance')
        .select('*')
        .eq('commande_id', id)
        .single();

    // Récupérer l'OTP
    const { data: otp } = await supabase
        .from('verif_otp')
        .select('*')
        .eq('commande_id', id)
        .single();

    return {
        ...data,
        livraison: livraison || null,
        finance: finance || null,
        otp: otp || null
    };
}

// Créer une commande manuellement
async function createCommande(commandeData) {
    const { client_id, montant, email, product_id } = commandeData;

    if (!client_id || !montant) {
        throw new Error('client_id et montant sont requis');
    }

    // Vérifier que le client existe
    const { data: client } = await supabase
        .from('client')
        .select('id, blackliste')
        .eq('id', client_id)
        .single();

    if (!client) throw new Error('Client introuvable');
    if (client.blackliste) throw new Error('Client blacklisté — commande refusée');

    const { data, error } = await supabase
        .from('commande')
        .insert({
            client_id: client_id,
            montant: parseFloat(montant),
            email: email || null,
            product_id: product_id || null,
            statut: 'confirmee',
            is_fake: false,
            score_risque_calcule: 0
        })
        .select('*, client:client_id(id, telephone, email, nom, prenom)')
        .single();

    if (error) throw error;
    return data;
}

// Changer le statut d'une commande
async function updateStatut(id, nouveauStatut) {
    // Doit rester aligné sur TOUS les statuts réellement produits par le système
    // (dont 'rejetee_auto', écrit par processNewOrder lors d'un BLOCK anti-fraude)
    // et sur STATUT_OPTIONS côté dashboard (commande.service.js frontend).
    const statutsValides = [
        'en_attente_otp', 'confirmee', 'expediee',
        'en_transit', 'livree', 'retournee',
        'annulee', 'rejetee_blacklist', 'rejetee_otp_echec',
        'rejetee_auto'
    ];

    if (!statutsValides.includes(nouveauStatut)) {
        throw new Error('Statut invalide. Valides: ' + statutsValides.join(', '));
    }

    // maybeSingle() : évite la 500 PGRST116 (« Cannot coerce... ») si l'id
    // n'existe pas ; on renvoie alors une 404 « Commande introuvable » propre.
    const { data, error } = await supabase
        .from('commande')
        .update({ statut: nouveauStatut })
        .eq('id', id)
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Commande introuvable');
    return data;
}

// Commandes d'un client
async function getCommandesByClient(clientId) {
    const { data, error } = await supabase
        .from('commande')
        .select('*')
        .eq('client_id', clientId)
        .order('date_commande', { ascending: false });

    if (error) throw error;
    return data;
}

// Commandes par statut
async function getCommandesByStatut(statut) {
    const { data, error } = await supabase
        .from('commande')
        .select('*, client:client_id(id, telephone, email, nom, prenom)')
        .eq('statut', statut)
        .order('date_commande', { ascending: false });

    if (error) throw error;
    return data;
}

// Statistiques des commandes
async function getStatistiquesCommandes() {
    const { data: toutes, error } = await supabase
        .from('commande')
        .select('id, statut, montant, date_commande, is_fake');

    if (error) throw error;

    const stats = {
        total: toutes.length,
        par_statut: {},
        ca_total: 0,
        commandes_fake: 0,
        commandes_aujourd_hui: 0,
        montant_moyen: 0
    };

    const aujourd_hui = new Date().toISOString().split('T')[0];

    for (const cmd of toutes) {
        // Par statut
        if (!stats.par_statut[cmd.statut]) {
            stats.par_statut[cmd.statut] = 0;
        }
        stats.par_statut[cmd.statut]++;

        // CA total
        stats.ca_total += parseFloat(cmd.montant || 0);

        // Fake
        if (cmd.is_fake) stats.commandes_fake++;

        // Aujourd'hui
        if (cmd.date_commande && cmd.date_commande.startsWith(aujourd_hui)) {
            stats.commandes_aujourd_hui++;
        }
    }

    stats.montant_moyen = stats.total > 0
        ? (stats.ca_total / stats.total).toFixed(2)
        : 0;
    stats.ca_total = stats.ca_total.toFixed(2);

    return stats;
}

// Traiter une nouvelle commande (ex: depuis Shopify Webhook)
async function processNewOrder(orderData) {
    const { telephone, email, montant, shopifyOrderId, ip, deviceFingerprint } = orderData;
console.log("===== NOUVELLE COMMANDE SHOPIFY =====");
console.log("Téléphone :", telephone);
console.log("Email :", email);
console.log("Montant :", montant);
console.log("Order ID :", shopifyOrderId);
console.log("Étape 1 : Validation OK");
console.log("Étape 2 : Recherche client");
console.log("Étape 3 : Client prêt");

    // 1. Validation de base
    if (!validerTelephone(telephone) || !validerEmail(email)) {
        throw new Error('Données invalides (téléphone ou email)');
    }
   
    // 2. Idempotence
    const { data: existeDeja } = await supabase
        .from('commande')
        .select('id')
        .eq('shopify_order_id', shopifyOrderId)
        .single();

    if (existeDeja) {
        return { message: 'Déjà traité', statut: 'ignoree' };
    }

    // 3. Trouver ou Créer Client
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

    // 4. Moteur Anti-Fraude (Fraud Engine)
    const { decision, reasons, score } = await fraudEngine.evaluateFraudRisk(client, montant, email, ip, deviceFingerprint);
    console.log("Étape 4 : Fraude évaluée");
console.log(decision, score);

    // Initialisation des données de la commande
    let statut = '';
    let is_fake = false;

    if (decision === 'BLOCK' || (client && client.blackliste)) {
        statut = client?.blackliste ? 'rejetee_blacklist' : 'rejetee_auto';
        is_fake = true;
    } else if (decision === 'OTP_REQUIRED') {
        statut = 'en_attente_otp';
    } else {
        statut = 'confirmee';
    }

    // 5. Création de la commande
    const { data: commande, error: insertError } = await supabase
        .from('commande')
        .insert([{
            client_id: client.id,
            shopify_order_id: shopifyOrderId,
            montant: montant,
            ip_address: ip,
            email: email,
            score_risque_calcule: score,
            statut: statut,
            is_fake: is_fake,
            fraud_reasons: reasons
        }])
        .select()
        .single();

    if (insertError) throw insertError;

    // 6. Action Post-Création (OTP)
    if (decision === 'OTP_REQUIRED') {
        try {
            await confirmationService.demanderOTP(commande.id);
        } catch (err) {
            console.log('Erreur lors de la demande OTP automatique: ' + err.message);
        }
    }
    console.log("Étape 6 : Fin OK");
   
    return {
        message: decision === 'BLOCK' ? 'Commande bloquée' : 'Commande traitée',
        decision: decision,
        score: score,
        reasons: reasons,
        statut: statut,
        commande_id: commande.id
    };
}

module.exports = {
    getAllCommandes,
    getCommandeById,
    createCommande,
    updateStatut,
    getCommandesByClient,
    getCommandesByStatut,
    getStatistiquesCommandes,
    processNewOrder
};

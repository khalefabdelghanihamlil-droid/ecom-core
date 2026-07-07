const supabase = require('../config/supabase');

// Récupérer tous les clients
async function getAllClients() {
    const { data, error } = await supabase
        .from('client')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

// Récupérer un client par ID
async function getClientById(id) {
    // maybeSingle() renvoie null (au lieu de lever PGRST116) quand aucune ligne
    // ne correspond : on peut ainsi retourner une 404 propre plutôt qu'une 500.
    const { data, error } = await supabase
        .from('client')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Client introuvable');
    return data;
}

// Créer un client
async function createClient(client) {
    // Vérifier si le téléphone existe déjà
    const { data: existingClient } = await supabase
        .from('client')
        .select('*')
        .eq('telephone', client.telephone)
        .single();

    if (existingClient) {
        throw new Error('Ce numéro de téléphone existe déjà.');
    }

    const { data, error } = await supabase
        .from('client')
        .insert({
            telephone: client.telephone,
            email: client.email || null,
            nom: client.nom || null,
            prenom: client.prenom || null,
            wilaya: client.wilaya || null,
            adresse: client.adresse || null,
            score_risque: 0,
            blackliste: false
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Modifier un client
async function updateClient(id, updates) {
    // Vérifier que le client existe
    await getClientById(id);

    const allowedFields = ['telephone', 'email', 'nom', 'prenom', 'wilaya', 'adresse'];
    const cleanUpdates = {};
    for (const key of allowedFields) {
        if (updates[key] !== undefined) {
            cleanUpdates[key] = updates[key];
        }
    }

    if (Object.keys(cleanUpdates).length === 0) {
        throw new Error('Aucun champ valide à mettre à jour');
    }

    const { data, error } = await supabase
        .from('client')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Supprimer un client
async function deleteClient(id) {
    await getClientById(id);

    const { data, error } = await supabase
        .from('client')
        .delete()
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Basculer le statut blacklist
async function toggleBlacklist(id) {
    const client = await getClientById(id);

    const { data, error } = await supabase
        .from('client')
        .update({ blackliste: !client.blackliste })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Récupérer les clients blacklistés
async function getBlacklistedClients() {
    const { data, error } = await supabase
        .from('client')
        .select('*')
        .eq('blackliste', true)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

module.exports = {
    getAllClients,
    getClientById,
    createClient,
    updateClient,
    deleteClient,
    toggleBlacklist,
    getBlacklistedClients
};
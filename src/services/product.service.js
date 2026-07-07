const supabase = require('../config/supabase');

// Statuts valides pour un produit
const STATUTS_VALIDES = ['actif', 'inactif', 'en_test'];

// Champs autorisés en écriture (mass assignment protection)
const ALLOWED_FIELDS = ['nom', 'prix_achat', 'prix_vente', 'status'];

// Valide et nettoie les données d'entrée d'un produit (création ou modification)
function sanitizeProductInput(product, { partial = false } = {}) {
    const cleaned = {};
    for (const key of ALLOWED_FIELDS) {
        if (product[key] !== undefined) {
            cleaned[key] = product[key];
        }
    }

    const errors = [];

    if (!partial || cleaned.nom !== undefined) {
        if (typeof cleaned.nom !== 'string' || !cleaned.nom.trim()) {
            errors.push('Le nom du produit est obligatoire.');
        } else {
            cleaned.nom = cleaned.nom.trim();
        }
    }

    if (!partial || cleaned.prix_achat !== undefined) {
        const prixAchat = Number(cleaned.prix_achat);
        if (!Number.isFinite(prixAchat) || prixAchat <= 0) {
            errors.push('Le prix d\'achat doit être un nombre supérieur à 0.');
        } else {
            cleaned.prix_achat = prixAchat;
        }
    }

    if (!partial || cleaned.prix_vente !== undefined) {
        const prixVente = Number(cleaned.prix_vente);
        if (!Number.isFinite(prixVente) || prixVente <= 0) {
            errors.push('Le prix de vente doit être un nombre supérieur à 0.');
        } else {
            cleaned.prix_vente = prixVente;
        }
    }

    if (
        Number.isFinite(Number(cleaned.prix_achat)) &&
        Number.isFinite(Number(cleaned.prix_vente)) &&
        Number(cleaned.prix_vente) < Number(cleaned.prix_achat)
    ) {
        errors.push('Le prix de vente doit être supérieur ou égal au prix d\'achat.');
    }

    if (cleaned.status !== undefined && !STATUTS_VALIDES.includes(cleaned.status)) {
        errors.push('Statut invalide. Valides: ' + STATUTS_VALIDES.join(', '));
    }

    if (errors.length > 0) {
        const error = new Error(errors.join(' '));
        error.status = 400;
        throw error;
    }

    return cleaned;
}

// Récupérer tous les produits
async function getAllProducts() {

    const { data, error } = await supabase
        .from('product')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    return data;
}

// Créer un produit
async function createProduct(product) {

    const cleaned = sanitizeProductInput(product);
    cleaned.status = cleaned.status || 'actif';

    const { data, error } = await supabase
        .from('product')
        .insert([cleaned])
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}

// Récupérer un produit par son ID
async function getProductById(id) {

    const { data, error } = await supabase
        .from('product')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        const notFoundError = new Error('Produit introuvable');
        notFoundError.status = 404;
        throw notFoundError;
    }

    return data;
}

// Modifier un produit
async function updateProduct(id, product) {

    // Vérifie que le produit existe avant modification (renvoie une 404 propre sinon)
    await getProductById(id);

    const cleaned = sanitizeProductInput(product, { partial: true });

    if (Object.keys(cleaned).length === 0) {
        const error = new Error('Aucun champ valide à mettre à jour');
        error.status = 400;
        throw error;
    }

    const { data, error } = await supabase
        .from('product')
        .update(cleaned)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}
// Supprimer un produit
async function deleteProduct(id) {

    // Vérifie que le produit existe avant suppression (renvoie une 404 propre sinon)
    await getProductById(id);

    const { data, error } = await supabase
        .from('product')
        .delete()
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}

module.exports = {
    getAllProducts,
    createProduct,
    getProductById,
    updateProduct,
    deleteProduct
};
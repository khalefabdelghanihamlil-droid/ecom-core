const commandeService = require('../services/commande.service');

// GET /commandes — Liste paginée
async function getCommandes(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const result = await commandeService.getAllCommandes(page, limit);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// GET /commandes/stats — Statistiques
async function getStats(req, res) {
    try {
        const stats = await commandeService.getStatistiquesCommandes();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// GET /commandes/:id — Détail complet
async function getCommandeById(req, res) {
    try {
        const commande = await commandeService.getCommandeById(req.params.id);
        res.json(commande);
    } catch (error) {
        const status = error.message === 'Commande introuvable' ? 404 : 500;
        res.status(status).json({ message: error.message });
    }
}

// POST /commandes — Créer une commande
async function createCommande(req, res) {
    try {
        const commande = await commandeService.createCommande(req.body);
        res.status(201).json(commande);
    } catch (error) {
        const status = error.message.includes('introuvable') ? 404
            : error.message.includes('blacklisté') ? 403
            : error.message.includes('requis') ? 400
            : 500;
        res.status(status).json({ message: error.message });
    }
}

// PATCH /commandes/:id/statut — Changer le statut
async function updateStatut(req, res) {
    try {
        const { statut } = req.body;
        if (!statut) {
            return res.status(400).json({ message: 'statut requis dans le body' });
        }
        const commande = await commandeService.updateStatut(req.params.id, statut);
        res.json({ message: 'Statut mis à jour ✅', commande: commande });
    } catch (error) {
        const status = error.message === 'Commande introuvable' ? 404
            : error.message.includes('invalide') ? 400
            : 500;
        res.status(status).json({ message: error.message });
    }
}

// GET /commandes/client/:clientId — Commandes d'un client
async function getByClient(req, res) {
    try {
        const commandes = await commandeService.getCommandesByClient(req.params.clientId);
        res.json(commandes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// GET /commandes/statut/:statut — Commandes par statut
async function getByStatut(req, res) {
    try {
        const commandes = await commandeService.getCommandesByStatut(req.params.statut);
        res.json(commandes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    getCommandes,
    getStats,
    getCommandeById,
    createCommande,
    updateStatut,
    getByClient,
    getByStatut
};

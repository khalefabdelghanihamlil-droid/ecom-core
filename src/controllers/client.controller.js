const clientService = require('../services/client.services');

// GET /clients — Liste tous les clients
async function getClients(req, res) {
    try {
        const clients = await clientService.getAllClients();
        res.json(clients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// GET /clients/blacklisted — Clients blacklistés
async function getBlacklisted(req, res) {
    try {
        const clients = await clientService.getBlacklistedClients();
        res.json(clients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// GET /clients/:id — Un client par ID
async function getClientById(req, res) {
    try {
        const client = await clientService.getClientById(req.params.id);
        res.json(client);
    } catch (error) {
        const status = error.message === 'Client introuvable' ? 404 : 500;
        res.status(status).json({ message: error.message });
    }
}

// POST /clients — Créer un client
async function createClient(req, res) {
    try {
        const newClient = await clientService.createClient(req.body);
        res.status(201).json(newClient);
    } catch (error) {
        const status = error.message.includes('existe déjà') ? 409 : 500;
        res.status(status).json({ message: error.message });
    }
}

// PUT /clients/:id — Modifier un client
async function updateClient(req, res) {
    try {
        const updated = await clientService.updateClient(req.params.id, req.body);
        res.json(updated);
    } catch (error) {
        const status = error.message === 'Client introuvable' ? 404 : 500;
        res.status(status).json({ message: error.message });
    }
}

// DELETE /clients/:id — Supprimer un client
async function deleteClient(req, res) {
    try {
        const deleted = await clientService.deleteClient(req.params.id);
        res.json({ message: 'Client supprimé avec succès ✅', client: deleted });
    } catch (error) {
        const status = error.message === 'Client introuvable' ? 404 : 500;
        res.status(status).json({ message: error.message });
    }
}

// PATCH /clients/:id/blacklist — Basculer blacklist
async function toggleBlacklist(req, res) {
    try {
        const updated = await clientService.toggleBlacklist(req.params.id);
        const statut = updated.blackliste ? 'blacklisté' : 'retiré de la blacklist';
        res.json({ message: 'Client ' + statut + ' ✅', client: updated });
    } catch (error) {
        const status = error.message === 'Client introuvable' ? 404 : 500;
        res.status(status).json({ message: error.message });
    }
}

module.exports = {
    getClients,
    getClientById,
    createClient,
    updateClient,
    deleteClient,
    toggleBlacklist,
    getBlacklisted
};

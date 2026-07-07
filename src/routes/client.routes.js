const express = require('express');
const router = express.Router();
const clientController = require('../controllers/client.controller');

// GET /clients — Liste tous les clients
router.get('/', clientController.getClients);

// GET /clients/blacklisted — Clients blacklistés (AVANT :id pour éviter conflit)
router.get('/blacklisted', clientController.getBlacklisted);

// GET /clients/:id — Un client par ID
router.get('/:id', clientController.getClientById);

// POST /clients — Créer un client
router.post('/', clientController.createClient);

// PUT /clients/:id — Modifier un client
router.put('/:id', clientController.updateClient);

// DELETE /clients/:id — Supprimer un client
router.delete('/:id', clientController.deleteClient);

// PATCH /clients/:id/blacklist — Basculer blacklist
router.patch('/:id/blacklist', clientController.toggleBlacklist);

module.exports = router;
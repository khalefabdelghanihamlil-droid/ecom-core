const express = require('express');
const router = express.Router();
const commandeController = require('../controllers/commande.controller');

// GET /commandes — Liste paginée (?page=1&limit=50)
router.get('/', commandeController.getCommandes);

// GET /commandes/stats — Statistiques globales
router.get('/stats', commandeController.getStats);

// GET /commandes/client/:clientId — Commandes d'un client
router.get('/client/:clientId', commandeController.getByClient);

// GET /commandes/statut/:statut — Par statut
router.get('/statut/:statut', commandeController.getByStatut);

// GET /commandes/:id — Détail complet
router.get('/:id', commandeController.getCommandeById);

// POST /commandes — Créer une commande
router.post('/', commandeController.createCommande);

// PATCH /commandes/:id/statut — Changer le statut
router.patch('/:id/statut', commandeController.updateStatut);

module.exports = router;

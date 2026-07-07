const express = require('express');
const router = express.Router();
const fraudController = require('../controllers/fraud.controller');

// GET /fraud/stats — Statistiques globales fraude
router.get('/stats', fraudController.stats);

// GET /fraud/top-risks — Top clients risqués
router.get('/top-risks', fraudController.topRisks);

// GET /fraud/tendances?jours=30 — Tendances sur N jours
router.get('/tendances', fraudController.tendances);

module.exports = router;

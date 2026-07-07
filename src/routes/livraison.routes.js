const express = require('express');
const router = express.Router();
const { getAllLivraisons, expedierCommande, suiviColis, syncStatuts, getLivraisonStats } = require('../controllers/livraisonController');

router.get('/', getAllLivraisons);
router.get('/stats', getLivraisonStats);
router.post('/sync', syncStatuts);
router.post('/expedier', expedierCommande);
router.get('/suivi/:tracking_id', suiviColis);

module.exports = router;

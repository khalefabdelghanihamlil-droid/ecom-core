const express = require('express');
const router = express.Router();
const { expedierCommande, suiviColis } = require('../controllers/livraisonController');

router.post('/expedier', expedierCommande);
router.get('/suivi/:tracking_id', suiviColis);

module.exports = router;

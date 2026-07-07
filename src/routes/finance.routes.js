const express = require('express');
const router = express.Router();
const { enregistrerProfit, resumeFinance, profitParProduit, profitEvolution } = require('../controllers/financeController');

router.post('/calculer', enregistrerProfit);
router.get('/resume', resumeFinance);
router.get('/par-produit', profitParProduit);
router.get('/evolution', profitEvolution);

module.exports = router;

const express = require('express');
const router = express.Router();
const { enregistrerProfit, resumeFinance } = require('../controllers/financeController');

router.post('/calculer', enregistrerProfit);
router.get('/resume', resumeFinance);

module.exports = router;

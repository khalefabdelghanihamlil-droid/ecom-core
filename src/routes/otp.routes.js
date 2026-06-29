const express = require('express');
const router = express.Router();
const { envoyerOTP, verifierOTP } = require('../controllers/otpController');

router.post('/envoyer', envoyerOTP);
router.post('/verifier', verifierOTP);

module.exports = router;

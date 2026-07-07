const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { login, me, logout } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// Anti brute-force sur la connexion : 10 tentatives / 15 min / IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' }
});

router.post('/login', loginLimiter, login);
router.get('/me', requireAuth, me);
router.post('/logout', requireAuth, logout);

module.exports = router;

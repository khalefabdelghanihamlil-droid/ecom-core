 const express = require('express');
  const router = express.Router();

  // Route d'accueil
  router.get('/', (req, res) => {
    res.json({
      message: 'Bienvenue sur mon API E-commerce 🚀',
      status: 'active',
      timestamp: new Date().toISOString()
    });
  });

  // Route de santé
  router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  module.exports = router;
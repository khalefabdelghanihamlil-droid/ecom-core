const rateLimit = require('express-rate-limit');

const limiterCommande = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: { message: 'Trop de requetes, reessayez dans 10 minutes' }
});

module.exports = limiterCommande;

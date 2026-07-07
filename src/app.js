const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const indexRoutes = require('./routes/index.routes');
const authRoutes = require('./routes/auth.routes');
const { requireAuth } = require('./middleware/auth.middleware');
const productRoutes = require('./routes/product.routes');
const webhookRoutes = require('./routes/webhook.routes');
const otpRoutes = require('./routes/otp.routes');
const livraisonRoutes = require('./routes/livraison.routes');
const financeRoutes = require('./routes/finance.routes');
const clientRoutes = require('./routes/client.routes');
const commandeRoutes = require('./routes/commande.routes');
const fraudRoutes = require('./routes/fraud.routes');
const settingsRoutes = require('./routes/settings.routes');

const app = express();

// En-têtes de sécurité HTTP (deploy prep). API JSON : la CSP par défaut de
// helmet n'impacte pas les réponses JSON.
app.use(helmet());

// CORS configurable pour la production : définir CORS_ORIGIN (ex:
// https://mon-dashboard.app, plusieurs origines séparées par des virgules).
// Sans valeur -> autorise toutes les origines (pratique en développement).
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true;
app.use(cors({ origin: corsOrigin }));

// Webhooks AVANT express.json() : la vérification HMAC Shopify exige le raw body.
app.use('/webhooks', webhookRoutes);

app.use(express.json());

// --- Routes PUBLIQUES ---
app.use('/', indexRoutes);        // '/' et '/health' (sonde uptime)
app.use('/auth', authRoutes);     // '/auth/login' public ; '/auth/me' & '/auth/logout' protégés dans le routeur

// --- Routes PROTÉGÉES (JWT single-admin) ---
// requireAuth appliqué à chaque module métier : aucune donnée n'est accessible
// sans un token admin valide correspondant à la session active.
app.use('/products', requireAuth, productRoutes);
app.use('/otp', requireAuth, otpRoutes);
app.use('/livraison', requireAuth, livraisonRoutes);
app.use('/finance', requireAuth, financeRoutes);
app.use('/clients', requireAuth, clientRoutes);
app.use('/commandes', requireAuth, commandeRoutes);
app.use('/fraud', requireAuth, fraudRoutes);
app.use('/settings', requireAuth, settingsRoutes);

// 404 — route inconnue
app.use((req, res) => {
  res.status(404).json({ message: `Route introuvable: ${req.method} ${req.originalUrl}` });
});

// Gestionnaire d'erreurs centralisé — dernier maillon de la chaîne Express.
// Garantit une réponse JSON propre même en cas d'exception non interceptée.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Erreur non interceptée:', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Erreur serveur interne' });
});

module.exports = app;

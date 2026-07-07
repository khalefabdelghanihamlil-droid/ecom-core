const supabase = require('../config/supabase');

// Constantes de configuration métier (source de vérité documentée).
// OTP : cf. confirmation.service.js — Fraude : cf. fraudEngine.js
const OTP_EXPIRATION_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 3;
const FRAUD_SCORE_BLOCK = 60;
const FRAUD_SCORE_OTP = 30;

/**
 * Indique si une variable d'environnement est renseignée (non vide).
 */
function estConfigure(nomVar) {
  const valeur = process.env[nomVar];
  return typeof valeur === 'string' && valeur.trim().length > 0;
}

/**
 * Teste la connectivité réelle à la base Supabase (lecture légère).
 */
async function testerConnexionDB() {
  try {
    const { error } = await supabase.from('client').select('id').limit(1);
    return !error;
  } catch (err) {
    return false;
  }
}

/**
 * Construit l'état de configuration global du système, SANS jamais exposer
 * de secret (uniquement des booléens « configuré / non configuré »).
 * Sert de tableau de bord de préparation au déploiement (Paramètres UI).
 */
async function getConfiguration() {
  const dbConfigure = estConfigure('SUPABASE_URL') && estConfigure('SUPABASE_KEY');
  const dbConnecte = dbConfigure ? await testerConnexionDB() : false;

  const shopifyConfigure = estConfigure('SHOPIFY_WEBHOOK_SECRET');
  const smsConfigure = estConfigure('SMS_PROVIDER_URL') && estConfigure('SMS_PROVIDER_KEY');

  const carriers = {
    yalidine: process.env.ENABLE_YALIDINE === 'true',
    zr_express: process.env.ENABLE_ZR_EXPRESS === 'true',
    dhd_express: process.env.ENABLE_DHD_EXPRESS === 'true'
  };
  carriers.active_count = Object.values(carriers).filter((v) => v === true).length;

  // Avertissements bloquants ou recommandés avant production
  const warnings = [];
  if (!dbConfigure) warnings.push('Base de données Supabase non configurée (SUPABASE_URL / SUPABASE_KEY).');
  else if (!dbConnecte) warnings.push('Base de données configurée mais injoignable.');
  if (!shopifyConfigure) warnings.push('Webhook Shopify non sécurisé (SHOPIFY_WEBHOOK_SECRET manquant).');
  if (!smsConfigure) warnings.push('Envoi SMS/OTP non opérationnel (SMS_PROVIDER_URL / SMS_PROVIDER_KEY manquants).');
  if (carriers.active_count === 0) warnings.push('Aucun transporteur actif — les expéditions échoueront.');

  // Prêt pour la production si les briques critiques sont opérationnelles.
  const readyForProduction = dbConnecte && shopifyConfigure && carriers.active_count > 0;

  return {
    environment: {
      node_env: process.env.NODE_ENV || 'development',
      port: Number(process.env.PORT) || 3000
    },
    database: {
      provider: 'supabase',
      configured: dbConfigure,
      connected: dbConnecte
    },
    shopify: {
      webhook_configured: shopifyConfigure
    },
    sms: {
      provider_configured: smsConfigure,
      otp_expiration_minutes: OTP_EXPIRATION_MINUTES,
      otp_max_attempts: OTP_MAX_ATTEMPTS
    },
    fraud: {
      score_block: FRAUD_SCORE_BLOCK,
      score_otp: FRAUD_SCORE_OTP
    },
    carriers,
    ready_for_production: readyForProduction,
    warnings
  };
}

/**
 * Sonde de santé : statut applicatif + connectivité DB (pour Railway/monitoring).
 */
async function getHealth() {
  const dbConnecte = await testerConnexionDB();
  return {
    status: dbConnecte ? 'ok' : 'degraded',
    database: dbConnecte ? 'connected' : 'unreachable',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  };
}

module.exports = { getConfiguration, getHealth };

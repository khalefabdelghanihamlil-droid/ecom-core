const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';

// SINGLE SESSION : un seul identifiant de session est valide à un instant T.
// Toute nouvelle connexion réussie régénère ce sid et invalide donc la session
// précédente (garantie « un seul administrateur, une seule session »).
// Stockage en mémoire volontaire : un redémarrage force une reconnexion.
let currentSessionId = null;

function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// L'authentification n'est opérationnelle que si le secret et un mot de passe
// (hashé ou en clair) sont configurés dans l'environnement.
function isConfigured() {
  return Boolean(
    process.env.JWT_SECRET &&
    (process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD)
  );
}

async function verifyCredentials(username, password) {
  if (!username || !password) return false;
  const userOk = timingSafeEqualStr(username, ADMIN_USERNAME);

  let passOk = false;
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) {
    passOk = await bcrypt.compare(password, hash);
  } else if (process.env.ADMIN_PASSWORD) {
    passOk = timingSafeEqualStr(password, process.env.ADMIN_PASSWORD);
  }
  // Toujours évaluer les deux pour limiter l'oracle temporel.
  return userOk && passOk;
}

function issueToken() {
  currentSessionId = crypto.randomUUID();
  return jwt.sign(
    { sub: ADMIN_USERNAME, role: 'admin', sid: currentSessionId },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET); // lève si invalide/expiré
  if (!currentSessionId || payload.sid !== currentSessionId) {
    const err = new Error('Session expirée ou remplacée');
    err.code = 'SESSION_INVALID';
    throw err;
  }
  return payload;
}

function invalidateSession() {
  currentSessionId = null;
}

module.exports = {
  isConfigured,
  verifyCredentials,
  issueToken,
  verifyToken,
  invalidateSession,
  ADMIN_USERNAME
};

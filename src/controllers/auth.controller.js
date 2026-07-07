const authService = require('../services/auth.service');

// POST /auth/login — publique. Émet un JWT si les identifiants admin sont valides.
async function login(req, res) {
  try {
    if (!authService.isConfigured()) {
      return res.status(500).json({
        message: 'Authentification non configurée (JWT_SECRET et ADMIN_PASSWORD/ADMIN_PASSWORD_HASH requis).'
      });
    }

    const { username, password } = req.body || {};
    const ok = await authService.verifyCredentials(username, password);
    if (!ok) {
      return res.status(401).json({ message: 'Identifiants invalides' });
    }

    const token = authService.issueToken();
    return res.json({
      token,
      user: { username: authService.ADMIN_USERNAME, role: 'admin' }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// GET /auth/me — protégée. Renvoie l'admin courant (validation de session côté client).
async function me(req, res) {
  return res.json({ user: req.admin });
}

// POST /auth/logout — protégée. Invalide la session courante (single session).
async function logout(req, res) {
  authService.invalidateSession();
  return res.json({ message: 'Déconnecté' });
}

module.exports = { login, me, logout };

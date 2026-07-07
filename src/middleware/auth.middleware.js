const authService = require('../services/auth.service');

// Protège une route : exige un JWT Bearer valide correspondant à la session
// admin active (single session). Renvoie 401 sinon.
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const parts = header.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({ message: 'Authentification requise' });
  }

  try {
    const payload = authService.verifyToken(parts[1]);
    req.admin = { username: payload.sub, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalide ou session expirée' });
  }
}

module.exports = { requireAuth };

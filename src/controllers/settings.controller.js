const settingsService = require('../services/settings.service');

// GET /settings — État de configuration global (sans secrets)
async function getSettings(req, res) {
  try {
    const config = await settingsService.getConfiguration();
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// GET /settings/health — Sonde de santé (statut + connectivité DB)
async function getHealth(req, res) {
  try {
    const health = await settingsService.getHealth();
    const code = health.status === 'ok' ? 200 : 503;
    res.status(code).json(health);
  } catch (error) {
    res.status(503).json({ status: 'error', message: error.message });
  }
}

module.exports = { getSettings, getHealth };

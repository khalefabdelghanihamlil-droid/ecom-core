const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');

// GET /settings — Configuration & préparation production
router.get('/', settingsController.getSettings);

// GET /settings/health — Sonde de santé (DB + uptime)
router.get('/health', settingsController.getHealth);

module.exports = router;

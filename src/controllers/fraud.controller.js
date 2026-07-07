const { getStatsFraude, getTopClientsRisques, getTendancesFraude } = require('../services/fraudAnalytics.service');

// GET /fraud/stats
async function stats(req, res) {
    try {
        const data = await getStatsFraude();
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// GET /fraud/top-risks
async function topRisks(req, res) {
    try {
        const data = await getTopClientsRisques();
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// GET /fraud/tendances?jours=30
async function tendances(req, res) {
    try {
        const jours = parseInt(req.query.jours) || 30;
        const data = await getTendancesFraude(jours);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = { stats, topRisks, tendances };

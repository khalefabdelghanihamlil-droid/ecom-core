const BaseLivraisonService = require('./baseLivraisonService');

class DhdExpressService extends BaseLivraisonService {
  constructor() {
    super('DHD Express');
    this.apiKey = process.env.DHD_API_KEY || 'simulated_key';
    this.baseUrl = 'https://api.dhdexpress.dz/v1'; // URL d'exemple
  }

  async creerColis(commande) {
    // TODO: brancher quand tu as les credentials DHD Express
    console.log('DHD Express - creation colis simulee pour: ' + commande.telephone);
    return {
      success: true,
      tracking_id: 'DHD-SIM-' + Date.now(),
      transporteur: 'DHD Express',
      statut: 'en_preparation'
    };
  }

  async getStatut(trackingId) {
    return { tracking_id: trackingId, statut: 'en_transit' };
  }

  async annulerColis(trackingId) {
    return { success: true, tracking_id: trackingId };
  }
}

module.exports = DhdExpressService;

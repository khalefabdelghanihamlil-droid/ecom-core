const BaseLivraisonService = require('./baseLivraisonService');

class ZRExpressService extends BaseLivraisonService {
  constructor() {
    super('ZR Express');
    this.apiKey = process.env.ZR_API_KEY;
    this.baseUrl = 'https://api.zrexpress.dz/v1';
  }

  async creerColis(commande) {
    // TODO: brancher quand tu as le compte ZR Express
    console.log('ZR Express - creation colis simulee pour: ' + commande.telephone);
    return {
      success: true,
      tracking_id: 'ZR-SIM-' + Date.now(),
      transporteur: 'ZR Express',
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

module.exports = ZRExpressService;

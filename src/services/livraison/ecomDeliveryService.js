const BaseLivraisonService = require('./baseLivraisonService');

class EcomDeliveryService extends BaseLivraisonService {
  constructor() {
    super('Ecom Delivery');
    this.apiKey = process.env.ECOM_DELIVERY_API_KEY;
    this.baseUrl = 'https://api.ecomdelivery.dz/v1';
  }

  async creerColis(commande) {
    // TODO: brancher quand tu as le compte Ecom Delivery
    console.log('Ecom Delivery - creation colis simulee pour: ' + commande.telephone);
    return {
      success: true,
      tracking_id: 'ECOM-SIM-' + Date.now(),
      transporteur: 'Ecom Delivery',
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

module.exports = EcomDeliveryService;

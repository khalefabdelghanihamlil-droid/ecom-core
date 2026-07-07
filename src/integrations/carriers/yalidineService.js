const BaseLivraisonService = require('./baseLivraisonService');

class YalidineService extends BaseLivraisonService {
  constructor() {
    super('Yalidine');
    this.apiKey = process.env.YALIDINE_API_KEY;
    this.apiToken = process.env.YALIDINE_API_TOKEN;
    this.baseUrl = 'https://api.yalidine.app/v1';
  }

  async creerColis(commande) {
    // TODO: brancher quand tu as le compte Yalidine
    // const response = await fetch(this.baseUrl + '/parcels/', {
    //   method: 'POST',
    //   headers: {
    //     'X-API-ID': this.apiKey,
    //     'X-API-TOKEN': this.apiToken,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     firstname: commande.nom,
    //     familyname: commande.prenom,
    //     contact_phone: commande.telephone,
    //     address: commande.adresse,
    //     to_wilaya_id: commande.wilaya_id,
    //     price: commande.montant,
    //     product_list: commande.produit
    //   })
    // });
    // return await response.json();

    // SIMULATION (a remplacer par le vrai code ci-dessus)
    console.log('Yalidine - creation colis simulee pour: ' + commande.telephone);
    return {
      success: true,
      tracking_id: 'YAL-SIM-' + Date.now(),
      transporteur: 'Yalidine',
      statut: 'en_preparation'
    };
  }

  async getStatut(trackingId) {
    // TODO: brancher quand tu as le compte Yalidine
    // const response = await fetch(this.baseUrl + '/parcels/' + trackingId, {
    //   headers: {
    //     'X-API-ID': this.apiKey,
    //     'X-API-TOKEN': this.apiToken
    //   }
    // });
    // return await response.json();

    return { tracking_id: trackingId, statut: 'en_transit' };
  }

  async annulerColis(trackingId) {
    return { success: true, tracking_id: trackingId };
  }
}

module.exports = YalidineService;

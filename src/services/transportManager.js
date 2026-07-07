const supabase = require('../config/supabase');
const YalidineService = require('../integrations/carriers/yalidineService');
const ZRExpressService = require('../integrations/carriers/zrExpressService');
const DhdExpressService = require('../integrations/carriers/dhdExpressService');

class TransportManager {
  constructor() {
    this.transporteurs = {};

    // Initialization based on environment variables
    if (process.env.ENABLE_YALIDINE === 'true') {
      this.transporteurs['yalidine'] = new YalidineService();
    }
    if (process.env.ENABLE_ZR_EXPRESS === 'true') {
      this.transporteurs['zr_express'] = new ZRExpressService();
    }
    if (process.env.ENABLE_DHD_EXPRESS === 'true') {
      this.transporteurs['dhd_express'] = new DhdExpressService();
    }
  }

  // Logique de choix du transporteur
  choisirTransporteur(commande) {
    const wilaya = commande.wilaya_id;

    // Wilayas de l'Est → ZR Express
    const wilayasEst = [25, 36, 23, 24, 43, 21, 40];

    // Priority 1: ZR Express for the East, if active
    if (wilaya && wilayasEst.includes(wilaya) && this.transporteurs['zr_express']) {
      return 'zr_express';
    }

    // Priority 2: Yalidine for Algiers, if active
    if (wilaya && wilaya === 16 && this.transporteurs['yalidine']) {
      return 'yalidine';
    }

    // Priority 3: DHD Express as default, if active
    if (this.transporteurs['dhd_express']) {
      return 'dhd_express';
    }

    // Fallback: Return the first active carrier if specific rules didn't match
    const activeCarriers = Object.keys(this.transporteurs);
    if (activeCarriers.length > 0) {
      return activeCarriers[0];
    }

    throw new Error('Aucun transporteur actif disponible');
  }

  async creerColis(commande) {
    const choix = this.choisirTransporteur(commande);
    const service = this.transporteurs[choix];

    console.log(`Transporteur choisi: ${service.nom}`);

    try {
      const resultat = await service.creerColis(commande);

      if (!resultat.success) {
        throw new Error(`Echec creation colis chez ${service.nom}`);
      }

      // Enregistrer dans la table LIVRAISON
      await supabase.from('livraison').insert([{
        commande_id: commande.id,
        transporteur: service.nom,
        tracking_id: resultat.tracking_id,
        statut_livraison: 'en_preparation',
        frais_livraison: commande.frais_livraison || 0
      }]);

      // Mettre a jour statut commande
      await supabase
        .from('commande')
        .update({ statut: 'expediee' })
        .eq('id', commande.id);

      return resultat;

    } catch (err) {
      console.log(`Erreur ${service.nom}: ${err.message}`);

      // Smart fallback: try any other active carrier that wasn't the first choice
      const otherCarriers = Object.keys(this.transporteurs).filter(key => key !== choix);
      
      for (const fallbackKey of otherCarriers) {
        console.log(`Fallback sur ${this.transporteurs[fallbackKey].nom}...`);
        try {
           return await this.transporteurs[fallbackKey].creerColis(commande);
        } catch (fallbackErr) {
           console.log(`Echec du fallback sur ${this.transporteurs[fallbackKey].nom}`);
        }
      }

      throw err; // If all fallbacks fail, throw the original error
    }
  }

  async getStatut(trackingId, transporteur) {
    let transporteurKey = transporteur.toLowerCase().replace(' ', '_');
    
    const service = this.transporteurs[transporteurKey];
    if (!service) {
      throw new Error(`Transporteur inactif ou inconnu: ${transporteur}`);
    }
    return await service.getStatut(trackingId);
  }
}

module.exports = new TransportManager();

const supabase = require('../config/supabase');
const YalidineService = require('../integrations/carriers/yalidineService');
const ZRExpressService = require('../integrations/carriers/zrExpressService');
const DhdExpressService = require('../integrations/carriers/dhdExpressService');

class TransportManager {
  constructor() {
    this.transporteurs = {};

    // ===== DIAGNOSTIC POINT 1 : Valeurs brutes des variables d'environnement =====
    console.log('===== [DIAG] TransportManager — INITIALISATION =====');
    console.log('[DIAG] ENABLE_ZR_EXPRESS  =', JSON.stringify(process.env.ENABLE_ZR_EXPRESS), '| typeof:', typeof process.env.ENABLE_ZR_EXPRESS);
    console.log('[DIAG] ENABLE_YALIDINE    =', JSON.stringify(process.env.ENABLE_YALIDINE), '| typeof:', typeof process.env.ENABLE_YALIDINE);
    console.log('[DIAG] ENABLE_DHD_EXPRESS =', JSON.stringify(process.env.ENABLE_DHD_EXPRESS), '| typeof:', typeof process.env.ENABLE_DHD_EXPRESS);

    // Initialization based on environment variables
    if (process.env.ENABLE_YALIDINE === 'true') {
      // ===== DIAGNOSTIC POINT 3 : Instanciation Yalidine =====
      console.log('[DIAG] → Instanciation YalidineService...');
      this.transporteurs['yalidine'] = new YalidineService();
      console.log('[DIAG] → YalidineService instancié OK, nom:', this.transporteurs['yalidine'].nom);
    } else {
      console.log('[DIAG] → YALIDINE IGNORÉ (condition === "true" non remplie)');
    }

    if (process.env.ENABLE_ZR_EXPRESS === 'true') {
      // ===== DIAGNOSTIC POINT 3 : Instanciation ZR Express =====
      console.log('[DIAG] → Instanciation ZRExpressService...');
      this.transporteurs['zr_express'] = new ZRExpressService();
      console.log('[DIAG] → ZRExpressService instancié OK, nom:', this.transporteurs['zr_express'].nom);
    } else {
      console.log('[DIAG] → ZR_EXPRESS IGNORÉ (condition === "true" non remplie)');
    }

    if (process.env.ENABLE_DHD_EXPRESS === 'true') {
      // ===== DIAGNOSTIC POINT 3 : Instanciation DHD Express =====
      console.log('[DIAG] → Instanciation DhdExpressService...');
      this.transporteurs['dhd_express'] = new DhdExpressService();
      console.log('[DIAG] → DhdExpressService instancié OK, nom:', this.transporteurs['dhd_express'].nom);
    } else {
      console.log('[DIAG] → DHD_EXPRESS IGNORÉ (condition === "true" non remplie)');
    }

    // ===== DIAGNOSTIC POINT 2 : Contenu final de this.transporteurs =====
    const cles = Object.keys(this.transporteurs);
    console.log('[DIAG] Transporteurs actifs après init:', cles.length > 0 ? cles : '[] (VIDE — AUCUN TRANSPORTEUR)');
    console.log('===== [DIAG] FIN INITIALISATION =====');
  }

  // Logique de choix du transporteur
  choisirTransporteur(commande) {
    // ===== DIAGNOSTIC POINT 4 : Données reçues et état au moment de la sélection =====
    console.log('[DIAG] choisirTransporteur() appelé avec:', JSON.stringify({
      wilaya_id: commande.wilaya_id,
      id: commande.id,
      telephone: commande.telephone
    }));
    console.log('[DIAG] this.transporteurs contient:', Object.keys(this.transporteurs));

    const wilaya = commande.wilaya_id;

    // Wilayas de l'Est → ZR Express
    const wilayasEst = [25, 36, 23, 24, 43, 21, 40];

    // Priority 1: ZR Express for the East, if active
    if (wilaya && wilayasEst.includes(wilaya) && this.transporteurs['zr_express']) {
      console.log('[DIAG] → Sélection: zr_express (wilaya Est)');
      return 'zr_express';
    }

    // Priority 2: Yalidine for Algiers, if active
    if (wilaya && wilaya === 16 && this.transporteurs['yalidine']) {
      console.log('[DIAG] → Sélection: yalidine (wilaya 16)');
      return 'yalidine';
    }

    // Priority 3: DHD Express as default, if active
    if (this.transporteurs['dhd_express']) {
      console.log('[DIAG] → Sélection: dhd_express (défaut)');
      return 'dhd_express';
    }

    // Fallback: Return the first active carrier if specific rules didn't match
    const activeCarriers = Object.keys(this.transporteurs);
    if (activeCarriers.length > 0) {
      console.log('[DIAG] → Sélection fallback:', activeCarriers[0]);
      return activeCarriers[0];
    }

    // ===== DIAGNOSTIC POINT 5 : Ligne exacte du throw =====
    console.error('[DIAG] ❌ AUCUN TRANSPORTEUR — this.transporteurs est VIDE à ce stade');
    console.error('[DIAG] ❌ Relire les logs INITIALISATION ci-dessus pour identifier la cause');
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

const supabase = require('../../config/supabase');
const YalidineService = require('./yalidineService');
const ZRExpressService = require('./zrExpressService');
const EcomDeliveryService = require('./ecomDeliveryService');

const transporteurs = {
  yalidine: new YalidineService(),
  zr_express: new ZRExpressService(),
  ecom_delivery: new EcomDeliveryService()
};

// Wilayas de l'Est → ZR Express
const wilayasEst = [25, 36, 23, 24, 43, 21, 40];

// Logique de choix du transporteur
function choisirTransporteur(commande) {
  const wilaya = commande.wilaya_id;

  // Wilaya de l'Est → ZR Express
  if (wilaya && wilayasEst.includes(wilaya)) {
    return 'zr_express';
  }

  // Alger et environs → Yalidine
  if (wilaya && wilaya === 16) {
    return 'yalidine';
  }

  // Par defaut → Ecom Delivery
  return 'ecom_delivery';
}

async function creerColis(commande) {
  const choix = choisirTransporteur(commande);
  const service = transporteurs[choix];

  console.log('Transporteur choisi: ' + service.nom);

  try {
    const resultat = await service.creerColis(commande);

    if (!resultat.success) {
      throw new Error('Echec creation colis chez ' + service.nom);
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
    console.log('Erreur ' + service.nom + ': ' + err.message);

    // Fallback sur Yalidine si autre transporteur echoue
    if (choix !== 'yalidine') {
      console.log('Fallback sur Yalidine...');
      return await transporteurs.yalidine.creerColis(commande);
    }

    throw err;
  }
}

async function getStatut(trackingId, transporteur) {
  const service = transporteurs[transporteur];
  if (!service) {
    throw new Error('Transporteur inconnu: ' + transporteur);
  }
  return await service.getStatut(trackingId);
}

module.exports = { creerColis, getStatut, choisirTransporteur };

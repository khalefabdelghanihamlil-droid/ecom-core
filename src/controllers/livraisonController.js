const supabase = require('../config/supabase');
const { creerColis, getStatut } = require('../services/livraison/livraisonRouter');

async function expedierCommande(req, res) {
  try {
    const { commande_id, wilaya_id, adresse, frais_livraison } = req.body;

    if (!commande_id) {
      return res.status(400).json({ message: 'commande_id requis' });
    }

    // Recuperer la commande
    const { data: commande } = await supabase
      .from('commande')
      .select('*, client:client_id(telephone, email)')
      .eq('id', commande_id)
      .single();

    if (!commande) {
      return res.status(404).json({ message: 'Commande introuvable' });
    }

    if (commande.statut !== 'confirmee') {
      return res.status(400).json({
        message: 'Commande non confirmee, statut actuel: ' + commande.statut
      });
    }

    // Preparer les donnees du colis
    const donneesColis = {
      id: commande.id,
      telephone: commande.client.telephone,
      email: commande.client.email,
      montant: commande.montant,
      wilaya_id: wilaya_id,
      adresse: adresse,
      frais_livraison: frais_livraison || 0
    };

    const resultat = await creerColis(donneesColis);

    return res.status(200).json({
      message: 'Colis cree avec succes',
      transporteur: resultat.transporteur,
      tracking_id: resultat.tracking_id,
      statut: resultat.statut
    });

  } catch (err) {
    console.log('Erreur expedition: ' + err.message);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

async function suiviColis(req, res) {
  try {
    const { tracking_id } = req.params;

    const { data: livraison } = await supabase
      .from('livraison')
      .select('*')
      .eq('tracking_id', tracking_id)
      .single();

    if (!livraison) {
      return res.status(404).json({ message: 'Colis introuvable' });
    }

    const transporteurKey = livraison.transporteur
      .toLowerCase()
      .replace(' ', '_');

    const statut = await getStatut(tracking_id, transporteurKey);

    // Mettre a jour le statut en DB
    await supabase
      .from('livraison')
      .update({ statut_livraison: statut.statut })
      .eq('tracking_id', tracking_id);

    return res.status(200).json({
      tracking_id: tracking_id,
      transporteur: livraison.transporteur,
      statut: statut.statut
    });

  } catch (err) {
    console.log('Erreur suivi: ' + err.message);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = { expedierCommande, suiviColis };

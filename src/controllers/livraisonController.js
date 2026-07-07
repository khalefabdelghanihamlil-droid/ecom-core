const supabase = require('../config/supabase');
const transportManager = require('../services/transportManager');

// Construit la requête de base (sélection + filtres) — factorisé pour permettre
// un repli propre si le tri chronologique n'est pas disponible.
function construireQueryLivraisons({ transporteur, statut }) {
  let query = supabase
    .from('livraison')
    .select('*, commande:commande_id(montant, statut, client:client_id(nom, prenom, telephone))');
  if (transporteur) query = query.eq('transporteur', transporteur);
  if (statut) query = query.eq('statut_livraison', statut);
  return query;
}

// Récupérer toutes les livraisons avec filtres
async function getAllLivraisons(req, res) {
  try {
    const filtres = { transporteur: req.query.transporteur, statut: req.query.statut };

    // Tri chronologique si la colonne created_at existe (cf. migration 003).
    let { data, error } = await construireQueryLivraisons(filtres)
      .order('created_at', { ascending: false });

    // Repli résilient : tant que la migration 003 n'est pas appliquée, la colonne
    // created_at est absente — on renvoie alors la liste sans tri plutôt que 500.
    if (error && /created_at/.test(error.message || '')) {
      ({ data, error } = await construireQueryLivraisons(filtres));
    }

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// Expédier une commande
async function expedierCommande(req, res) {
  try {
    const { commande_id, wilaya_id, adresse, frais_livraison } = req.body;

    if (!commande_id) {
      return res.status(400).json({ message: 'commande_id requis' });
    }

    // Recuperer la commande
    const { data: commande } = await supabase
      .from('commande')
      .select('*, client:client_id(telephone, email, nom, prenom)')
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
      nom: commande.client.nom,
      prenom: commande.client.prenom,
      montant: commande.montant,
      wilaya_id: wilaya_id,
      adresse: adresse,
      frais_livraison: frais_livraison || 0
    };

    const resultat = await transportManager.creerColis(donneesColis);

    return res.status(200).json({
      message: 'Colis cree avec succes',
      transporteur: resultat.transporteur,
      tracking_id: resultat.tracking_id,
      statut: resultat.statut
    });

  } catch (err) {
    console.log('Erreur expedition: ' + err.message);
    return res.status(500).json({ message: 'Erreur serveur: ' + err.message });
  }
}

// Suivre un colis spécifique
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

    const statut = await transportManager.getStatut(tracking_id, livraison.transporteur);

    // Mettre a jour le statut en DB
    if (statut.statut !== livraison.statut_livraison) {
        await supabase
        .from('livraison')
        .update({ statut_livraison: statut.statut })
        .eq('tracking_id', tracking_id);
    }

    return res.status(200).json({
      tracking_id: tracking_id,
      transporteur: livraison.transporteur,
      statut: statut.statut
    });

  } catch (err) {
    console.log('Erreur suivi: ' + err.message);
    return res.status(500).json({ message: 'Erreur serveur: ' + err.message });
  }
}

// Synchroniser les statuts de toutes les livraisons en cours
async function syncStatuts(req, res) {
    try {
        const { data: livraisonsEnCours } = await supabase
            .from('livraison')
            .select('*')
            .in('statut_livraison', ['en_preparation', 'en_transit', 'en_attente_retrait']);

        if (!livraisonsEnCours || livraisonsEnCours.length === 0) {
            return res.json({ message: 'Aucun colis en cours à synchroniser', maj: 0 });
        }

        let misesAJour = 0;
        const erreurs = [];

        for (const livraison of livraisonsEnCours) {
            try {
                const statut = await transportManager.getStatut(livraison.tracking_id, livraison.transporteur);
                if (statut.statut !== livraison.statut_livraison) {
                    await supabase
                        .from('livraison')
                        .update({ statut_livraison: statut.statut })
                        .eq('tracking_id', livraison.tracking_id);
                    misesAJour++;

                    // Si livrée ou retournée, mettre à jour la commande associée
                    if (statut.statut === 'livree' || statut.statut === 'retournee') {
                        await supabase
                            .from('commande')
                            .update({ statut: statut.statut })
                            .eq('id', livraison.commande_id);
                    }
                }
            } catch (error) {
                erreurs.push({ tracking_id: livraison.tracking_id, erreur: error.message });
            }
        }

        res.json({
            message: 'Synchronisation terminée',
            colis_verifies: livraisonsEnCours.length,
            mis_a_jour: misesAJour,
            erreurs: erreurs.length > 0 ? erreurs : null
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

// Obtenir des statistiques de livraison
async function getLivraisonStats(req, res) {
    try {
        const { data: livraisons, error } = await supabase
            .from('livraison')
            .select('statut_livraison, transporteur');

        if (error) throw error;

        const stats = {
            total: livraisons.length,
            par_statut: {},
            par_transporteur: {}
        };

        for (const liv of livraisons) {
            stats.par_statut[liv.statut_livraison] = (stats.par_statut[liv.statut_livraison] || 0) + 1;
            stats.par_transporteur[liv.transporteur] = (stats.par_transporteur[liv.transporteur] || 0) + 1;
        }

        // Calcul taux de livraison
        const livrees = stats.par_statut['livree'] || 0;
        const retournees = stats.par_statut['retournee'] || 0;
        const terminees = livrees + retournees;
        
        stats.taux_livraison = terminees > 0 ? ((livrees / terminees) * 100).toFixed(1) + '%' : '0%';

        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

module.exports = { getAllLivraisons, expedierCommande, suiviColis, syncStatuts, getLivraisonStats };

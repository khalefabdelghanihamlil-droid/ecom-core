const supabase = require('../config/supabase');

async function calculerProfit(commandeId, coutProduit, coutPub, coutLivraison) {
  try {
    // Recuperer la commande
    const { data: commande } = await supabase
      .from('commande')
      .select('*')
      .eq('id', commandeId)
      .single();

    if (!commande) {
      throw new Error('Commande introuvable');
    }

    const ca = parseFloat(commande.montant);
    const cout_produit = parseFloat(coutProduit) || 0;
    const cout_pub = parseFloat(coutPub) || 0;
    const cout_livraison = parseFloat(coutLivraison) || 0;

    const profit_net = ca - cout_produit - cout_pub - cout_livraison;
    const marge = ca > 0 ? ((profit_net / ca) * 100).toFixed(2) : 0;

    // Enregistrer dans la table finance
    const { data: finance } = await supabase
      .from('finance')
      .upsert([{
        commande_id: commandeId,
        cout_produit: cout_produit,
        cout_pub: cout_pub,
        cout_livraison: cout_livraison,
        profit_net: profit_net
      }], { onConflict: 'commande_id' })
      .select()
      .single();

    return {
      commande_id: commandeId,
      ca: ca,
      cout_produit: cout_produit,
      cout_pub: cout_pub,
      cout_livraison: cout_livraison,
      profit_net: profit_net,
      marge_percent: marge
    };

  } catch (err) {
    throw new Error('Erreur calcul profit: ' + err.message);
  }
}

async function getResumeFinance() {
  try {
    const { data: finances } = await supabase
      .from('finance')
      .select('*, commande:commande_id(montant, statut, date_commande)');

    if (!finances || finances.length === 0) {
      return {
        total_ca: 0,
        total_profit: 0,
        total_commandes: 0,
        marge_moyenne: 0
      };
    }

    const total_ca = finances.reduce(function(sum, f) {
      return sum + parseFloat(f.commande.montant || 0);
    }, 0);

    const total_profit = finances.reduce(function(sum, f) {
      return sum + parseFloat(f.profit_net || 0);
    }, 0);

    const marge_moyenne = total_ca > 0
      ? ((total_profit / total_ca) * 100).toFixed(2)
      : 0;

    return {
      total_ca: total_ca.toFixed(2),
      total_profit: total_profit.toFixed(2),
      total_commandes: finances.length,
      marge_moyenne: marge_moyenne
    };

  } catch (err) {
    throw new Error('Erreur resume finance: ' + err.message);
  }
}

module.exports = { calculerProfit, getResumeFinance };

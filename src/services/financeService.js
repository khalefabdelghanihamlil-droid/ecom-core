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

async function getResumeFinanceDetaille() {
  try {
    const { data: finances } = await supabase
      .from('finance')
      .select('*, commande:commande_id(montant, statut, date_commande)');

    if (!finances || finances.length === 0) {
      return {
        total_ca: 0,
        total_profit: 0,
        total_commandes: 0,
        marge_moyenne: 0,
        roas_global: 0,
        couts: { produit: 0, pub: 0, livraison: 0 }
      };
    }

    let total_ca = 0;
    let cout_produit_total = 0;
    let cout_pub_total = 0;
    let cout_livraison_total = 0;

    finances.forEach(function(f) {
        total_ca += parseFloat(f.commande.montant || 0);
        cout_produit_total += parseFloat(f.cout_produit || 0);
        cout_pub_total += parseFloat(f.cout_pub || 0);
        cout_livraison_total += parseFloat(f.cout_livraison || 0);
    });

    const total_profit = total_ca - cout_produit_total - cout_pub_total - cout_livraison_total;

    const marge_moyenne = total_ca > 0
      ? ((total_profit / total_ca) * 100).toFixed(2)
      : 0;

    const roas_global = cout_pub_total > 0
        ? (total_ca / cout_pub_total).toFixed(2)
        : total_ca > 0 ? "∞" : 0;

    return {
      total_ca: total_ca.toFixed(2),
      total_profit: total_profit.toFixed(2),
      total_commandes: finances.length,
      marge_moyenne: marge_moyenne,
      roas_global: roas_global,
      couts: {
          produit: cout_produit_total.toFixed(2),
          pub: cout_pub_total.toFixed(2),
          livraison: cout_livraison_total.toFixed(2)
      }
    };

  } catch (err) {
    throw new Error('Erreur resume finance: ' + err.message);
  }
}

// Fonction utilitaire obsolète, redirige vers la nouvelle
async function getResumeFinance() {
    return getResumeFinanceDetaille();
}


async function getProfitParProduit() {
    try {
        const { data: finances } = await supabase
            .from('finance')
            .select('profit_net, cout_produit, cout_pub, cout_livraison, commande:commande_id(montant, product_id, product:product_id(nom))');

        const produits = {};

        finances.forEach(f => {
            const pId = f.commande.product_id;
            const pNom = f.commande.product ? f.commande.product.nom : 'Produit inconnu';

            if (pId) {
                if (!produits[pId]) {
                    produits[pId] = { id: pId, nom: pNom, ca: 0, profit: 0, commandes: 0 };
                }
                produits[pId].ca += parseFloat(f.commande.montant || 0);
                produits[pId].profit += parseFloat(f.profit_net || 0);
                produits[pId].commandes++;
            }
        });

        // Calcul des marges par produit
        return Object.values(produits).map(p => ({
            ...p,
            marge: p.ca > 0 ? ((p.profit / p.ca) * 100).toFixed(2) + '%' : '0%'
        }));
    } catch (err) {
        throw new Error('Erreur profit par produit: ' + err.message);
    }
}


async function getProfitEvolution(jours = 30) {
     try {
        const dateDebut = new Date();
        dateDebut.setDate(dateDebut.getDate() - jours);

        const { data: finances } = await supabase
            .from('finance')
            .select('profit_net, commande:commande_id(montant, date_commande)')
            .gte('commande.date_commande', dateDebut.toISOString());

        // Filtrer les finances où la jointure a fonctionné (sinon commande est null)
        const financesValides = finances.filter(f => f.commande && f.commande.date_commande);

        const evolution = {};

        financesValides.forEach(f => {
            const date = f.commande.date_commande.split('T')[0];
            if (!evolution[date]) {
                evolution[date] = { date: date, ca: 0, profit: 0 };
            }
            evolution[date].ca += parseFloat(f.commande.montant || 0);
            evolution[date].profit += parseFloat(f.profit_net || 0);
        });

        // Transformer l'objet en tableau trié par date
        return Object.values(evolution).sort((a, b) => a.date.localeCompare(b.date));

     } catch (err) {
         throw new Error('Erreur évolution finance: ' + err.message);
     }
}

module.exports = { calculerProfit, getResumeFinance, getResumeFinanceDetaille, getProfitParProduit, getProfitEvolution };

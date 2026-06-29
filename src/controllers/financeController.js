const { calculerProfit, getResumeFinance } = require('../services/financeService');

async function enregistrerProfit(req, res) {
  try {
    const { commande_id, cout_produit, cout_pub, cout_livraison } = req.body;

    if (!commande_id) {
      return res.status(400).json({ message: 'commande_id requis' });
    }

    const resultat = await calculerProfit(
      commande_id,
      cout_produit,
      cout_pub,
      cout_livraison
    );

    return res.status(200).json({
      message: 'Profit calcule avec succes',
      data: resultat
    });

  } catch (err) {
    console.log('Erreur finance: ' + err.message);
    return res.status(500).json({ message: err.message });
  }
}

async function resumeFinance(req, res) {
  try {
    const resume = await getResumeFinance();
    return res.status(200).json(resume);
  } catch (err) {
    console.log('Erreur resume: ' + err.message);
    return res.status(500).json({ message: err.message });
  }
}

module.exports = { enregistrerProfit, resumeFinance };

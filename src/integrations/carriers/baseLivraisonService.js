class BaseLivraisonService {
  constructor(nom) {
    this.nom = nom;
  }

  async creerColis(commande) {
    throw new Error(this.nom + ' : creerColis() non implementee');
  }

  async getStatut(trackingId) {
    throw new Error(this.nom + ' : getStatut() non implementee');
  }

  async annulerColis(trackingId) {
    throw new Error(this.nom + ' : annulerColis() non implementee');
  }
}

module.exports = BaseLivraisonService;

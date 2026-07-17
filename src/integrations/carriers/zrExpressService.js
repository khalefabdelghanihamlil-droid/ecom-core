const BaseLivraisonService = require('./baseLivraisonService');
const axios = require('axios');

class ZRExpressService extends BaseLivraisonService {

  constructor() {

    super('ZR Express');

    this.apiKey = process.env.ZR_API_KEY;
    this.tenant = process.env.ZR_TENANT;

    this.baseUrl = 'https://api.zrexpress.app/api/v1';

  }


  getHeaders() {

    return {

      "X-Api-Key": this.apiKey,
      "X-Tenant": this.tenant,
      "Content-Type": "application/json",
      "accept": "application/json"

    };

  }


  async creerColis(commande) {

    try {

      const body = {

        customerId: commande.customerId,

        hubId: commande.hubId,


        deliveryAddress: {

          cityTerritoryId: commande.cityTerritoryId,

          districtTerritoryId: commande.districtTerritoryId,

          street: commande.adresse,

          postalCode: commande.codePostal || ""

        },


        orderedProducts: [

          {

            productId: commande.productId,

            quantity: 1,

            unitPrice: commande.prix,

            stockType: "local"

          }

        ],


        deliveryType: "home",

        description: commande.description || "",

        amount: commande.prix,


        weight: {

          weight: 1,

          dimensionalWeight: 1

        },


        externalId: commande.id.toString()

      };



      const response = await axios.post(

        `${this.baseUrl}/parcels`,

        body,

        {

          headers: this.getHeaders()

        }

      );



      console.log("ZR Express colis créé");



      return {

        success: true,

        tracking_id: response.data.id,

        transporteur: "ZR Express",

        statut: "cree"

      };



    } catch(error) {


      console.error(
        "ZR ERROR:",
        error.response?.data || error.message
      );



      return {

        success:false,

        erreur:error.response?.data || error.message

      };

    }

  }
  async rechercherTerritoire(nom){

    const response = await axios.post(

        `${this.baseUrl}/territories/search`,

        {
            pageSize:10,
            pageNumber:1
        },

        {
            headers:this.getHeaders()
        }

    );


    return response.data.items;
  }





  async getStatut(trackingId) {

    return {

      tracking_id: trackingId,

      statut:"en_transit"

    };

  }



  async annulerColis(trackingId) {

    return {

      success:true,

      tracking_id:trackingId

    };

  }


}


module.exports = ZRExpressService;
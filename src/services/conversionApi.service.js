const axios = require('axios');
const crypto = require('crypto');

async function sendMetaPurchase({
    montant,
    email,
    telephone
}) {

    try {

        await axios.post(

            `https://graph.facebook.com/v23.0/${process.env.META_PIXEL_ID}/events`,

            {

                data: [

                    {

                        event_name: "Purchase",

                        event_time: Math.floor(Date.now() / 1000),

                        action_source: "website",

                        user_data: {

                            em: email
                                ? crypto.createHash("sha256").update(email.toLowerCase()).digest("hex")
                                : undefined,

                            ph: telephone
                                ? crypto.createHash("sha256").update(telephone).digest("hex")
                                : undefined

                        },

                        custom_data: {

                            currency: "DZD",

                            value: montant

                        }

                    }

                ]

            },

            {

                params: {

                    access_token: process.env.META_CAPI_TOKEN

                }

            }

        );

        console.log("✅ Meta Purchase envoyé");

    }

    catch (err) {

        console.error("❌ Meta :", err.response?.data || err.message);

    }

}

async function sendTikTokPurchase({

    montant,

    email,

    telephone

}) {

    try {

        await axios.post(

            "https://business-api.tiktok.com/open_api/v1.3/event/track/",

            {

                pixel_code: process.env.TIKTOK_PIXEL_ID,

                event: "Purchase",

                timestamp: Math.floor(Date.now() / 1000),

                context: {

                    email,

                    phone_number: telephone

                },

                properties: {

                    currency: "DZD",

                    value: montant

                }

            },

            {

                headers: {

                    Access_Token: process.env.TIKTOK_ACCESS_TOKEN

                }

            }

        );

        console.log("✅ TikTok Purchase envoyé");

    }

    catch (err) {

        console.error("❌ TikTok :", err.response?.data || err.message);

    }

}

module.exports = {

    sendMetaPurchase,

    sendTikTokPurchase

};
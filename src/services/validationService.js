const domainesJetables = [
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com'
];

function validerTelephone(telephone) {
  if (!telephone) return false;

  // Numéro utilisé par Shopify pour les webhooks de test
  if (telephone === "555-555-SHIP") {
    return true;
  }

  return /^(05|06|07)[0-9]{8}$/.test(telephone);
}

function validerEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function emailEstJetable(email) {
  if (!email) return false;

  const domaine = email.split('@')[1];
  if (!domaine) return false;

  return domainesJetables.includes(domaine.toLowerCase());
}

async function verifierPaysIP(ip) {

  if (!ip) {
    console.log("Pas d'IP reçue");
    return null;
  }

  try {

    console.log("Vérification IP :", ip);

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 3000);

    // ipwho.is : service gratuit, HTTPS, sans clé API.
    // Renvoie un code pays ISO-2 dans `country_code` (ex: "DZ"), même format
    // que l'ancien `countryCode` d'ip-api -> les règles de risque restent identiques.
    const res = await fetch(
      `https://ipwho.is/${ip}`,
      {
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      console.log("ipwho.is a répondu :", res.status);
      return null;
    }

    const data = await res.json();

    // ipwho.is renvoie success=false pour une IP invalide/privée/introuvable.
    if (data.success === false) {
      console.log("ipwho.is : lookup échoué :", data.message || "raison inconnue");
      return null;
    }

    console.log("Pays détecté :", data.country_code);

    return data.country_code || null;

  } catch (err) {

    console.log("Erreur IP :", err.message);

    return null;
  }
}

module.exports = {
  validerTelephone,
  validerEmail,
  emailEstJetable,
  verifierPaysIP
};
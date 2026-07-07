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

    const res = await fetch(
      `https://ip-api.com/json/${ip}?fields=countryCode`,
      {
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      console.log("ip-api a répondu :", res.status);
      return null;
    }

    const data = await res.json();

    console.log("Pays détecté :", data.countryCode);

    return data.countryCode || null;

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
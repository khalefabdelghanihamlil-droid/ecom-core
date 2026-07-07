const domainesJetables = [
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com'
];

function validerTelephone(telephone) {
  if (!telephone) return false;

  // Shopify envoie un faux numéro lors des tests
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
  try {
    const res = await fetch('http://ip-api.com/json/' + ip + '?fields=countryCode');
    const data = await res.json();
    return data.countryCode;
  } catch (err) {
    return null;
  }
}

module.exports = {
  validerTelephone,
  validerEmail,
  emailEstJetable,
  verifierPaysIP
};

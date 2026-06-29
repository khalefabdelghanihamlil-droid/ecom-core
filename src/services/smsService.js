function genererCodeOTP() {
  const code = Math.floor(100000 + Math.random() * 900000);
  return code.toString();
}

async function envoyerSMS(telephone, message) {
  try {
    const response = await fetch(process.env.SMS_PROVIDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.SMS_PROVIDER_KEY
      },
      body: JSON.stringify({
        to: telephone,
        message: message
      })
    });
    return response.ok;
  } catch (err) {
    console.log('Erreur envoi SMS: ' + err.message);
    return false;
  }
}

module.exports = {
  genererCodeOTP,
  envoyerSMS
};

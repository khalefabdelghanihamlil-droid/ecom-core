const http = require('http');

function tester(path, body) {
  return new Promise(function(resolve) {
    const data = JSON.stringify(body);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, function(res) {
      let reponse = '';
      res.on('data', function(chunk) {
        reponse += chunk;
      });
      res.on('end', function() {
        console.log('Test: ' + path);
        console.log('Reponse: ' + reponse);
        console.log('---');
        resolve();
      });
    });

    req.on('error', function(err) {
      console.log('Erreur ' + path + ': ' + err.message);
      resolve();
    });

    req.write(data);
    req.end();
  });
}

async function lancerTests() {
  console.log('Demarrage des tests...\n');

  // Test webhook avec une fausse commande Shopify
  await tester('/webhooks/shopify-order', {
    id: 99999,
    phone: '0551234567',
    email: 'test@gmail.com',
    total_price: '2500',
    shipping_address: { phone: '0551234567' },
    note_attributes: []
  });

  // Test OTP envoyer
  await tester('/otp/envoyer', {
    commande_id: 'test-id-123'
  });

  // Test OTP verifier
  await tester('/otp/verifier', {
    commande_id: 'test-id-123',
    code_saisi: '123456'
  });

  console.log('Tests termines !');
}

lancerTests();

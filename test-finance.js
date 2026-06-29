const http = require('http');

function tester(path, body, method) {
  return new Promise(function(resolve) {
    const data = JSON.stringify(body);
    const methode = method || 'POST';

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: methode,
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
        console.log('Test: ' + methode + ' ' + path);
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
  console.log('Test Module Finance...\n');

  // REMPLACE ICI PAR TON VRAI ID
  const COMMANDE_ID = 'db9647a8-9f8c-43b4-9bc8-d9d0817c9ede';

  // Test calcul profit
  await tester('/finance/calculer', {
    commande_id: COMMANDE_ID,
    cout_produit: 1500,
    cout_pub: 800,
    cout_livraison: 400
  });

  // Test resume global
  await tester('/finance/resume', {}, 'GET');

  console.log('Tests termines !');
}

lancerTests();

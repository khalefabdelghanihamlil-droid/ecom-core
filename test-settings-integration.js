/**
 * Tests d'intégration — MODULE PARAMÈTRES (Settings) + SMOKE TEST des routes.
 *
 * 1) Vérifie GET /settings (structure, aucun secret exposé) et /settings/health.
 * 2) Smoke test : chaque route GET principale répond sans 404 ni 5xx inattendu,
 *    et une route inconnue renvoie bien 404 (handler centralisé).
 *
 * App Express démarrée en mémoire ; lecture seule, aucun nettoyage nécessaire.
 */
require('dotenv').config();
const http = require('http');
const app = require('./src/app');

const PORT = 3197;

let pass = 0, fail = 0;
const failures = [];
function check(nom, condition, detail) {
  if (condition) { pass++; console.log(`  ✅ ${nom}`); }
  else { fail++; failures.push(nom + (detail ? ` — ${detail}` : '')); console.log(`  ❌ ${nom}${detail ? ' — ' + detail : ''}`); }
}

function req(method, path) {
  return new Promise((resolve) => {
    const r = http.request({ hostname: 'localhost', port: PORT, path, method }, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => { let p; try { p = JSON.parse(buf); } catch { p = buf; } resolve({ status: res.statusCode, body: p }); });
    });
    r.on('error', (e) => resolve({ status: 0, body: { message: e.message } }));
    r.end();
  });
}

async function main() {
  console.log('\n=== TESTS D\'INTÉGRATION — PARAMÈTRES + SMOKE ROUTES ===\n');
  const server = app.listen(PORT);
  await new Promise((r) => server.on('listening', r));

  try {
    // ---- 1. GET /settings ----
    console.log('[1] GET /settings');
    {
      const r = await req('GET', '/settings');
      check('-> 200', r.status === 200, `reçu ${r.status}`);
      const b = r.body || {};
      check('bloc database', b.database && typeof b.database.connected === 'boolean');
      check('bloc shopify', b.shopify && typeof b.shopify.webhook_configured === 'boolean');
      check('bloc sms', b.sms && typeof b.sms.provider_configured === 'boolean');
      check('bloc carriers + active_count', b.carriers && typeof b.carriers.active_count === 'number');
      check('ready_for_production booléen', typeof b.ready_for_production === 'boolean');
      check('warnings tableau', Array.isArray(b.warnings));
      // Sécurité : aucun secret ne doit fuiter
      const brut = JSON.stringify(b);
      const secret = process.env.SUPABASE_KEY || '___none___';
      check('aucun secret Supabase exposé', !brut.includes(secret));
    }

    // ---- 2. GET /settings/health ----
    console.log('\n[2] GET /settings/health');
    {
      const r = await req('GET', '/settings/health');
      check('-> 200 ou 503', r.status === 200 || r.status === 503, `reçu ${r.status}`);
      check('champ status', r.body && typeof r.body.status === 'string');
      check('champ database', r.body && typeof r.body.database === 'string');
      check('uptime_seconds numérique', r.body && typeof r.body.uptime_seconds === 'number');
    }

    // ---- 3. Smoke test des routes GET principales ----
    console.log('\n[3] Smoke test — routes GET principales');
    const routesGet = [
      '/', '/health',
      '/products', '/clients', '/clients/blacklisted',
      '/commandes', '/commandes/stats',
      '/finance/resume', '/finance/par-produit', '/finance/evolution',
      '/fraud/stats', '/fraud/top-risks', '/fraud/tendances',
      '/livraison', '/livraison/stats'
    ];
    for (const route of routesGet) {
      const r = await req('GET', route);
      // On tolère 200 (OK). On refuse 404 (route absente) et 500 (crash).
      check(`GET ${route} répond sans 404/500`, r.status !== 404 && r.status !== 500 && r.status !== 0, `reçu ${r.status}${r.body && r.body.message ? ' — ' + r.body.message : ''}`);
    }

    // ---- 4. Route inconnue -> 404 JSON ----
    console.log('\n[4] Route inconnue -> 404');
    {
      const r = await req('GET', '/route-qui-nexiste-pas');
      check('-> 404', r.status === 404, `reçu ${r.status}`);
      check('message JSON', r.body && typeof r.body.message === 'string');
    }
  } catch (e) {
    console.error('\n💥 ERREUR FATALE :', e.message);
    fail++; failures.push('ERREUR FATALE: ' + e.message);
  } finally {
    server.close();
  }

  console.log('\n=== BILAN SETTINGS/SMOKE ===');
  console.log(`✅ Réussis : ${pass}`);
  console.log(`❌ Échoués : ${fail}`);
  if (failures.length) { console.log('\nÉchecs :'); failures.forEach((f) => console.log('  - ' + f)); }
  process.exit(fail === 0 ? 0 : 1);
}

main();

/**
 * Tests d'intégration backend — MODULE COMMANDES
 *
 * Couvre :
 *   - Les 7 endpoints HTTP (GET liste/stats/detail/client/statut, POST, PATCH)
 *   - Le pipeline anti-fraude via commandeService.processNewOrder
 *     (ALLOW / OTP_REQUIRED / BLOCK / blacklist / idempotence / validation)
 *
 * L'app Express est démarrée en mémoire sur un port de test.
 * Les données créées sont nettoyées en fin d'exécution.
 */
require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const supabase = require('./src/config/supabase');
const commandeService = require('./src/services/commande.service');

const PORT = 3199;
const BASE = `http://localhost:${PORT}`;

// ---- Suivi des ressources créées (pour nettoyage) ----
const created = { clients: new Set(), commandes: new Set() };

// ---- Mini framework d'assertions ----
let pass = 0, fail = 0;
const failures = [];
function check(nom, condition, detail) {
  if (condition) { pass++; console.log(`  ✅ ${nom}`); }
  else { fail++; failures.push(nom + (detail ? ` — ${detail}` : '')); console.log(`  ❌ ${nom}${detail ? ' — ' + detail : ''}`); }
}

// ---- Helper HTTP ----
function req(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: PORT, path, method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(buf); } catch { parsed = buf; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    r.on('error', (e) => resolve({ status: 0, body: { message: e.message } }));
    if (data) r.write(data);
    r.end();
  });
}

const FAUX_UUID = '00000000-0000-0000-0000-000000000000';

async function creerClientTest(overrides = {}) {
  const suffix = String(Math.floor(Math.random() * 1e8)).padStart(8, '0'); // 8 chiffres
  const { data, error } = await supabase.from('client').insert([{
    telephone: '07' + suffix, // 07 + 8 chiffres = format DZ valide (10 chiffres)
    email: `test_${suffix}@gmail.com`,
    nom: '__TEST__',
    prenom: 'Integration',
    blackliste: false,
    score_risque: 0,
    ...overrides
  }]).select().single();
  if (error) throw new Error('Création client test: ' + error.message);
  created.clients.add(data.id);
  return data;
}

async function main() {
  console.log('\n=== TESTS D\'INTÉGRATION — MODULE COMMANDES ===\n');

  const server = app.listen(PORT);
  await new Promise((r) => server.on('listening', r));

  try {
    // Clients de référence
    const clientNormal = await creerClientTest();
    const clientBl = await creerClientTest({ blackliste: true });
    const clientRisque = await creerClientTest({ score_risque: 60 });

    // ============ 1. POST /commandes (création manuelle) ============
    console.log('\n[1] POST /commandes — création manuelle');
    {
      let r = await req('POST', '/commandes', { client_id: clientNormal.id }); // montant manquant
      check('montant manquant -> 400', r.status === 400, `reçu ${r.status}`);

      r = await req('POST', '/commandes', { client_id: FAUX_UUID, montant: 1000 });
      check('client inexistant -> 404', r.status === 404, `reçu ${r.status}`);

      r = await req('POST', '/commandes', { client_id: clientBl.id, montant: 1000 });
      check('client blacklisté -> 403', r.status === 403, `reçu ${r.status}`);

      r = await req('POST', '/commandes', { client_id: clientNormal.id, montant: 2500, email: 'ok@gmail.com' });
      check('création valide -> 201', r.status === 201, `reçu ${r.status}`);
      check('réponse contient un id', r.body && !!r.body.id);
      check('statut = confirmee', r.body && r.body.statut === 'confirmee', r.body && r.body.statut);
      check('jointure client présente', r.body && r.body.client && r.body.client.id === clientNormal.id);
      if (r.body && r.body.id) created.commandes.add(r.body.id);
      var commandeManuelle = r.body;
    }

    // ============ 2. GET /commandes/:id (détail complet) ============
    console.log('\n[2] GET /commandes/:id — détail');
    {
      let r = await req('GET', `/commandes/${commandeManuelle.id}`);
      check('détail -> 200', r.status === 200, `reçu ${r.status}`);
      check('champs jointure présents (livraison/finance/otp)',
        r.body && 'livraison' in r.body && 'finance' in r.body && 'otp' in r.body);

      r = await req('GET', `/commandes/${FAUX_UUID}`);
      check('id inexistant -> 404', r.status === 404, `reçu ${r.status}`);
    }

    // ============ 3. PATCH /commandes/:id/statut ============
    console.log('\n[3] PATCH /commandes/:id/statut');
    {
      let r = await req('PATCH', `/commandes/${commandeManuelle.id}/statut`, {});
      check('statut manquant -> 400', r.status === 400, `reçu ${r.status}`);

      r = await req('PATCH', `/commandes/${commandeManuelle.id}/statut`, { statut: 'nimportequoi' });
      check('statut invalide -> 400', r.status === 400, `reçu ${r.status}`);

      r = await req('PATCH', `/commandes/${commandeManuelle.id}/statut`, { statut: 'expediee' });
      check('statut valide -> 200', r.status === 200, `reçu ${r.status}`);
      check('commande.statut mis à jour', r.body && r.body.commande && r.body.commande.statut === 'expediee');
    }

    // ============ 4. GET /commandes (liste paginée) ============
    console.log('\n[4] GET /commandes — liste paginée');
    {
      let r = await req('GET', '/commandes?page=1&limit=10');
      check('liste -> 200', r.status === 200, `reçu ${r.status}`);
      check('pagination { commandes, total, page, pages }',
        r.body && Array.isArray(r.body.commandes) && typeof r.body.total === 'number' && 'pages' in r.body);
    }

    // ============ 5. GET /commandes/stats ============
    console.log('\n[5] GET /commandes/stats');
    {
      let r = await req('GET', '/commandes/stats');
      check('stats -> 200', r.status === 200, `reçu ${r.status}`);
      check('structure stats (total, par_statut, ca_total)',
        r.body && typeof r.body.total === 'number' && r.body.par_statut && 'ca_total' in r.body);
    }

    // ============ 6. GET /commandes/client/:clientId ============
    console.log('\n[6] GET /commandes/client/:clientId');
    {
      let r = await req('GET', `/commandes/client/${clientNormal.id}`);
      check('commandes du client -> 200', r.status === 200, `reçu ${r.status}`);
      check('renvoie un tableau', Array.isArray(r.body));
      check('contient la commande créée', Array.isArray(r.body) && r.body.some((c) => c.id === commandeManuelle.id));
    }

    // ============ 7. GET /commandes/statut/:statut ============
    console.log('\n[7] GET /commandes/statut/:statut');
    {
      let r = await req('GET', '/commandes/statut/expediee');
      check('par statut -> 200', r.status === 200, `reçu ${r.status}`);
      check('renvoie un tableau', Array.isArray(r.body));
    }

    // ============ 8. Pipeline anti-fraude (processNewOrder) ============
    console.log('\n[8] processNewOrder — pipeline anti-fraude');
    {
      const tel = (n) => '077' + String(n).padStart(7, '0');

      // 8a. Validation : données invalides
      try {
        await commandeService.processNewOrder({ telephone: 'xxx', email: 'bad', montant: 1000, shopifyOrderId: 'T-INV-' + Date.now() });
        check('données invalides -> exception', false, 'aucune exception');
      } catch (e) {
        check('données invalides -> exception', /invalides/i.test(e.message), e.message);
      }

      // 8b. ALLOW — petit montant, email normal, nouveau client
      {
        const sid = 'T-ALLOW-' + Math.floor(Math.random() * 1e9);
        const phone = tel(Math.floor(Math.random() * 9999999));
        const res = await commandeService.processNewOrder({
          telephone: phone, email: `a_${Date.now()}@gmail.com`, montant: 3000,
          shopifyOrderId: sid, ip: '127.0.0.1', deviceFingerprint: 'fp-allow'
        });
        check('ALLOW -> décision ALLOW', res.decision === 'ALLOW', `decision=${res.decision} score=${res.score}`);
        check('ALLOW -> statut confirmee', res.statut === 'confirmee', res.statut);
        await trackCreatedByShopifyId(sid, phone);
      }

      // 8c. OTP_REQUIRED — email jetable (25) + montant élevé (15) + nouveau client montant élevé (10) = 50
      {
        const sid = 'T-OTP-' + Math.floor(Math.random() * 1e9);
        const phone = tel(Math.floor(Math.random() * 9999999));
        const res = await commandeService.processNewOrder({
          telephone: phone, email: `x_${Date.now()}@mailinator.com`, montant: 25000,
          shopifyOrderId: sid, ip: '127.0.0.1', deviceFingerprint: 'fp-otp'
        });
        check('OTP -> décision OTP_REQUIRED', res.decision === 'OTP_REQUIRED', `decision=${res.decision} score=${res.score}`);
        check('OTP -> statut en_attente_otp', res.statut === 'en_attente_otp', res.statut);
        check('OTP -> fraud_reasons non vide', Array.isArray(res.reasons) && res.reasons.length > 0);
        await trackCreatedByShopifyId(sid, phone);
      }

      // 8d. BLOCK — client à score_risque élevé (existant) + email jetable + montant élevé
      {
        const sid = 'T-BLOCK-' + Math.floor(Math.random() * 1e9);
        const res = await commandeService.processNewOrder({
          telephone: clientRisque.telephone, email: `b_${Date.now()}@mailinator.com`, montant: 25000,
          shopifyOrderId: sid, ip: '127.0.0.1', deviceFingerprint: 'fp-block'
        });
        check('BLOCK -> décision BLOCK', res.decision === 'BLOCK', `decision=${res.decision} score=${res.score}`);
        check('BLOCK -> is_fake / statut rejetee', /rejetee/.test(res.statut), res.statut);
        await trackCreatedByShopifyId(sid, clientRisque.telephone);
      }

      // 8e. Blacklist — client blacklisté existant
      {
        const sid = 'T-BL-' + Math.floor(Math.random() * 1e9);
        const res = await commandeService.processNewOrder({
          telephone: clientBl.telephone, email: `bl_${Date.now()}@gmail.com`, montant: 3000,
          shopifyOrderId: sid, ip: '127.0.0.1', deviceFingerprint: 'fp-bl'
        });
        check('blacklist -> statut rejetee_blacklist', res.statut === 'rejetee_blacklist', res.statut);
        await trackCreatedByShopifyId(sid, clientBl.telephone);
      }

      // 8f. Idempotence — même shopifyOrderId traité 2 fois
      {
        const sid = 'T-IDEM-' + Math.floor(Math.random() * 1e9);
        const phone = tel(Math.floor(Math.random() * 9999999));
        const first = await commandeService.processNewOrder({
          telephone: phone, email: `i_${Date.now()}@gmail.com`, montant: 3000,
          shopifyOrderId: sid, ip: '127.0.0.1', deviceFingerprint: 'fp-idem'
        });
        await trackCreatedByShopifyId(sid, phone);
        const second = await commandeService.processNewOrder({
          telephone: phone, email: `i_${Date.now()}@gmail.com`, montant: 3000,
          shopifyOrderId: sid, ip: '127.0.0.1', deviceFingerprint: 'fp-idem'
        });
        check('idempotence -> 2e traitement ignoré', second.statut === 'ignoree', JSON.stringify(second));
      }
    }
  } catch (e) {
    console.error('\n💥 ERREUR FATALE PENDANT LES TESTS :', e.message);
    fail++;
    failures.push('ERREUR FATALE: ' + e.message);
  } finally {
    await nettoyer();
    server.close();
  }

  // ---- Bilan ----
  console.log('\n=== BILAN ===');
  console.log(`✅ Réussis : ${pass}`);
  console.log(`❌ Échoués : ${fail}`);
  if (failures.length) {
    console.log('\nÉchecs :');
    failures.forEach((f) => console.log('  - ' + f));
  }
  process.exit(fail === 0 ? 0 : 1);
}

// Retrouve la commande + client créés par processNewOrder pour le nettoyage
async function trackCreatedByShopifyId(shopifyOrderId, telephone) {
  const { data: cmd } = await supabase.from('commande').select('id, client_id').eq('shopify_order_id', shopifyOrderId).single();
  if (cmd) {
    created.commandes.add(cmd.id);
    if (cmd.client_id) created.clients.add(cmd.client_id);
  }
  if (telephone) {
    const { data: cli } = await supabase.from('client').select('id').eq('telephone', telephone).single();
    if (cli) created.clients.add(cli.id);
  }
}

async function nettoyer() {
  console.log('\n🧹 Nettoyage des données de test...');
  const cmdIds = [...created.commandes];
  const cliIds = [...created.clients];
  if (cmdIds.length) {
    await supabase.from('verif_otp').delete().in('commande_id', cmdIds);
    await supabase.from('commande').delete().in('id', cmdIds);
  }
  if (cliIds.length) {
    await supabase.from('client').delete().in('id', cliIds);
  }
  console.log(`   ${cmdIds.length} commande(s) et ${cliIds.length} client(s) supprimé(s).`);
}

main();

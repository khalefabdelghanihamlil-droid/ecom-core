/**
 * Tests d'intégration — SÉCURITÉ OTP (expiration & réutilisation)
 *
 * Vérifie le correctif du bug de sécurité : sans colonne verif_otp.created_at,
 * les OTP n'expiraient jamais. Couvre :
 *   - OTP valide avant expiration        -> commande confirmée
 *   - OTP expiré (créé il y a > 5 min)    -> refus 400
 *   - OTP déjà utilisé (valide = true)    -> refus 409
 *   - OTP avec trop de tentatives (>= 3)  -> refus 403 + commande rejetée
 *   - Code incorrect                      -> refus 400 + incrément tentatives
 *   - Endpoint statut (fenêtre restante / expiration)
 *
 * L'app Express est démarrée en mémoire ; les OTP sont semés directement en base
 * avec un created_at contrôlé pour tester l'expiration sans attendre 5 minutes.
 * Nettoyage automatique en fin d'exécution.
 */
require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const supabase = require('./src/config/supabase');

const PORT = 3198;
const created = { clients: new Set(), commandes: new Set() };

let pass = 0, fail = 0;
const failures = [];
function check(nom, condition, detail) {
  if (condition) { pass++; console.log(`  ✅ ${nom}`); }
  else { fail++; failures.push(nom + (detail ? ` — ${detail}` : '')); console.log(`  ❌ ${nom}${detail ? ' — ' + detail : ''}`); }
}

function req(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = { hostname: 'localhost', port: PORT, path, method, headers: { 'Content-Type': 'application/json' } };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => { let p; try { p = JSON.parse(buf); } catch { p = buf; } resolve({ status: res.statusCode, body: p }); });
    });
    r.on('error', (e) => resolve({ status: 0, body: { message: e.message } }));
    if (data) r.write(data);
    r.end();
  });
}

async function colonneCreatedAtExiste() {
  const { error } = await supabase.from('verif_otp').select('created_at').limit(1);
  return !error;
}

async function creerClientTest() {
  const suffix = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  const { data, error } = await supabase.from('client').insert([{
    telephone: '07' + suffix, email: `otp_${suffix}@gmail.com`, nom: '__TEST_OTP__', prenom: 'Integration', blackliste: false, score_risque: 0
  }]).select().single();
  if (error) throw new Error('Création client: ' + error.message);
  created.clients.add(data.id);
  return data;
}

async function creerCommandeTest(clientId) {
  const { data, error } = await supabase.from('commande').insert([{
    client_id: clientId, montant: 15000, statut: 'en_attente_otp', is_fake: false, score_risque_calcule: 40
  }]).select().single();
  if (error) throw new Error('Création commande: ' + error.message);
  created.commandes.add(data.id);
  return data;
}

// Sème un OTP avec un created_at contrôlé (minutesDansLePasse : ancienneté simulée)
async function seedOtp(commande_id, { code, valide = false, tentatives = 0, minutesDansLePasse = 0 }) {
  const createdAt = new Date(Date.now() - minutesDansLePasse * 60 * 1000).toISOString();
  // upsert car verif_otp.commande_id est unique
  const { error } = await supabase.from('verif_otp').upsert(
    { commande_id, code, valide, tentatives, created_at: createdAt },
    { onConflict: 'commande_id' }
  );
  if (error) throw new Error('Seed OTP: ' + error.message);
}

async function statutCommande(id) {
  const { data } = await supabase.from('commande').select('statut, is_fake').eq('id', id).single();
  return data;
}

async function main() {
  console.log('\n=== TESTS D\'INTÉGRATION — SÉCURITÉ OTP ===\n');

  if (!(await colonneCreatedAtExiste())) {
    console.log('❌ PRÉREQUIS MANQUANT : la colonne verif_otp.created_at n\'existe pas encore.');
    console.log('   Appliquez d\'abord la migration dans l\'éditeur SQL Supabase :');
    console.log('   -> migrations/002_verif_otp_created_at.sql\n');
    console.log('   ALTER TABLE verif_otp ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();\n');
    process.exit(2);
  }
  console.log('✅ Prérequis : colonne verif_otp.created_at présente.\n');

  const server = app.listen(PORT);
  await new Promise((r) => server.on('listening', r));

  try {
    const client = await creerClientTest();
    const CODE = '654321';

    // ---- 1. OTP valide avant expiration ----
    console.log('[1] OTP valide avant expiration');
    {
      const cmd = await creerCommandeTest(client.id);
      await seedOtp(cmd.id, { code: CODE, minutesDansLePasse: 1 }); // 1 min < 5 min
      const r = await req('POST', '/otp/verifier', { commande_id: cmd.id, code_saisi: CODE });
      check('vérification -> 200', r.status === 200, `reçu ${r.status} ${JSON.stringify(r.body)}`);
      check('message succès', r.body && /confirm/i.test(r.body.message || ''));
      const c = await statutCommande(cmd.id);
      check('commande -> confirmee', c && c.statut === 'confirmee', c && c.statut);
    }

    // ---- 2. OTP expiré ----
    console.log('\n[2] OTP expiré (créé il y a 6 min)');
    {
      const cmd = await creerCommandeTest(client.id);
      await seedOtp(cmd.id, { code: CODE, minutesDansLePasse: 6 }); // > 5 min
      const r = await req('POST', '/otp/verifier', { commande_id: cmd.id, code_saisi: CODE });
      check('vérification -> 400', r.status === 400, `reçu ${r.status}`);
      check('message expiration', r.body && /expir/i.test(r.body.message || ''), r.body && r.body.message);
      const c = await statutCommande(cmd.id);
      check('commande NON confirmée', c && c.statut === 'en_attente_otp', c && c.statut);
    }

    // ---- 3. OTP déjà utilisé ----
    console.log('\n[3] OTP déjà utilisé (valide = true)');
    {
      const cmd = await creerCommandeTest(client.id);
      await seedOtp(cmd.id, { code: CODE, valide: true, minutesDansLePasse: 1 });
      const r = await req('POST', '/otp/verifier', { commande_id: cmd.id, code_saisi: CODE });
      check('vérification -> 409', r.status === 409, `reçu ${r.status}`);
      check('message déjà utilisé', r.body && /déjà utilisé/i.test(r.body.message || ''), r.body && r.body.message);
    }

    // ---- 4. OTP avec trop de tentatives ----
    console.log('\n[4] OTP avec trop de tentatives (>= 3)');
    {
      const cmd = await creerCommandeTest(client.id);
      await seedOtp(cmd.id, { code: CODE, tentatives: 3, minutesDansLePasse: 1 });
      const r = await req('POST', '/otp/verifier', { commande_id: cmd.id, code_saisi: CODE });
      check('vérification -> 403', r.status === 403, `reçu ${r.status}`);
      check('message rejet', r.body && /rejet/i.test(r.body.message || ''), r.body && r.body.message);
      const c = await statutCommande(cmd.id);
      check('commande -> rejetee_otp_echec', c && c.statut === 'rejetee_otp_echec', c && c.statut);
      check('commande marquée is_fake', c && c.is_fake === true);
    }

    // ---- 5. Code incorrect ----
    console.log('\n[5] Code incorrect (avant expiration)');
    {
      const cmd = await creerCommandeTest(client.id);
      await seedOtp(cmd.id, { code: CODE, tentatives: 0, minutesDansLePasse: 1 });
      const r = await req('POST', '/otp/verifier', { commande_id: cmd.id, code_saisi: '000000' });
      check('vérification -> 400', r.status === 400, `reçu ${r.status}`);
      check('message incorrect', r.body && /incorrect/i.test(r.body.message || ''), r.body && r.body.message);
      const { data: otp } = await supabase.from('verif_otp').select('tentatives').eq('commande_id', cmd.id).single();
      check('tentatives incrémentées (1)', otp && otp.tentatives === 1, otp && String(otp.tentatives));
    }

    // ---- 6. Endpoint statut : fenêtre restante & expiration ----
    console.log('\n[6] GET /otp/statut/:commande_id');
    {
      const cmdFrais = await creerCommandeTest(client.id);
      await seedOtp(cmdFrais.id, { code: CODE, minutesDansLePasse: 1 });
      let r = await req('GET', `/otp/statut/${cmdFrais.id}`);
      check('statut frais -> 200', r.status === 200, `reçu ${r.status}`);
      check('non expiré', r.body && r.body.expire === false, JSON.stringify(r.body));
      check('minutes_restantes > 0', r.body && r.body.minutes_restantes > 0, r.body && String(r.body.minutes_restantes));

      const cmdVieux = await creerCommandeTest(client.id);
      await seedOtp(cmdVieux.id, { code: CODE, minutesDansLePasse: 10 });
      r = await req('GET', `/otp/statut/${cmdVieux.id}`);
      check('statut ancien -> expire = true', r.body && r.body.expire === true, JSON.stringify(r.body));
      check('minutes_restantes = 0', r.body && r.body.minutes_restantes === 0, r.body && String(r.body.minutes_restantes));
    }
  } catch (e) {
    console.error('\n💥 ERREUR FATALE :', e.message);
    fail++; failures.push('ERREUR FATALE: ' + e.message);
  } finally {
    await nettoyer();
    server.close();
  }

  console.log('\n=== BILAN OTP ===');
  console.log(`✅ Réussis : ${pass}`);
  console.log(`❌ Échoués : ${fail}`);
  if (failures.length) { console.log('\nÉchecs :'); failures.forEach((f) => console.log('  - ' + f)); }
  process.exit(fail === 0 ? 0 : 1);
}

async function nettoyer() {
  console.log('\n🧹 Nettoyage...');
  const cmdIds = [...created.commandes];
  const cliIds = [...created.clients];
  if (cmdIds.length) {
    await supabase.from('verif_otp').delete().in('commande_id', cmdIds);
    await supabase.from('commande').delete().in('id', cmdIds);
  }
  if (cliIds.length) await supabase.from('client').delete().in('id', cliIds);
  console.log(`   ${cmdIds.length} commande(s) et ${cliIds.length} client(s) supprimé(s).`);
}

main();

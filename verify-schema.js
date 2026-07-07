require('dotenv').config();
const supabase = require('./src/config/supabase');

// Colonnes attendues par le Module Commandes (service + jointures)
const ATTENDU = {
  client: ['id', 'telephone', 'email', 'nom', 'prenom', 'blackliste', 'score_risque'],
  commande: [
    'id', 'client_id', 'shopify_order_id', 'montant', 'ip_address', 'email',
    'product_id', 'score_risque_calcule', 'statut', 'is_fake', 'fraud_reasons',
    'date_commande'
  ],
  verif_otp: ['commande_id', 'code', 'valide', 'tentatives', 'created_at'],
  livraison: ['commande_id'],
  finance: ['commande_id']
};

async function colonnesDe(table) {
  // Lit une ligne pour découvrir les colonnes réelles renvoyées par l'API
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) return { error: error.message, cols: null };
  if (data && data.length > 0) return { error: null, cols: Object.keys(data[0]) };
  return { error: null, cols: [] }; // table vide : on ne peut pas déduire les colonnes
}

async function verifierColonne(table, colonne) {
  // Sélection ciblée d'une colonne : marche même si la table est vide
  const { error } = await supabase.from(table).select(colonne).limit(1);
  return !error;
}

(async () => {
  console.log('=== VÉRIFICATION DU SCHÉMA (Module Commandes) ===\n');
  let toutOK = true;

  for (const [table, colonnes] of Object.entries(ATTENDU)) {
    const { error, cols } = await colonnesDe(table);
    if (error) {
      console.log(`❌ Table "${table}" : ${error}`);
      toutOK = false;
      continue;
    }
    console.log(`📋 Table "${table}" (${cols === null ? '?' : cols.length} colonnes détectées${cols && cols.length === 0 ? ' — table vide' : ''})`);
    for (const c of colonnes) {
      const ok = await verifierColonne(table, c);
      console.log(`   ${ok ? '✅' : '❌'} ${c}`);
      if (!ok) toutOK = false;
    }
    console.log('');
  }

  console.log(toutOK
    ? '✅ SCHÉMA CONFORME — toutes les colonnes requises existent.'
    : '❌ SCHÉMA INCOMPLET — voir les ❌ ci-dessus.');
  process.exit(toutOK ? 0 : 1);
})();

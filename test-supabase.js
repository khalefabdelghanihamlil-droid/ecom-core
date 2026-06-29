require('dotenv').config();
const supabase = require('./src/config/supabase');

async function testerSupabase() {
  console.log('Test connexion Supabase...');

  const { data, error } = await supabase
    .from('client')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Erreur: ' + error.message);
  } else {
    console.log('Connexion OK !');
    console.log('Donnees: ' + JSON.stringify(data));
  }
}

testerSupabase();

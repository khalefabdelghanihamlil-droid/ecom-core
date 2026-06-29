require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function test() {
  const { data, error } = await supabase
    .from('product')
    .insert([
      {
        nom: 'Product test',
        prix_achat: 500,
        prix_vente: 1500,
        status: 'en_test'
      }
    ])
    .select();

  if (error) {
    console.error(error);
  } else {
    console.log(data);
  }
}

test();
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '..', '.env')
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    realtime: {
      transport: WebSocket
    }
  }
);

module.exports = supabase;
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dhhbdgzutlltiojbsboi.supabase.co';
const supabaseAnonKey = 'sb_publishable_IFlO7s4-sA5PUAbJsRPqFQ_ih43_o_N';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  const { error: e1 } = await supabase.from('clients').select('id').limit(1);
  console.log('Clients table:', e1 ? 'FAIL (' + e1.message + ')' : 'OK');

  const { error: e2 } = await supabase.from('hubs').select('id').limit(1);
  console.log('Hubs table:', e2 ? 'FAIL (' + e2.message + ')' : 'OK');
}

checkTables();

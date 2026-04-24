const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dhhbdgzutlltiojbsboi.supabase.co';
const supabaseAnonKey = 'sb_publishable_IFlO7s4-sA5PUAbJsRPqFQ_ih43_o_N';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSimpleQuery() {
  console.log('Testing clients relation...');
  const { error: e1 } = await supabase.from('tasks').select('id, clients(id, name)').limit(1);
  if (e1) console.error('Clients Error:', e1.message); else console.log('Clients OK');

  console.log('Testing assignees relation...');
  const { error: e2 } = await supabase.from('tasks').select('id, assignees(id, full_name)').limit(1);
  if (e2) console.error('Assignees Error:', e2.message); else console.log('Assignees OK');

  console.log('Testing hubs relation...');
  const { error: e3 } = await supabase.from('tasks').select('id, hubs(id, name)').limit(1);
  if (e3) console.error('Hubs Error:', e3.message); else console.log('Hubs OK');
}

testSimpleQuery();

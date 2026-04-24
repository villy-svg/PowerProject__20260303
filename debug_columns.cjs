const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dhhbdgzutlltiojbsboi.supabase.co';
const supabaseAnonKey = 'sb_publishable_IFlO7s4-sA5PUAbJsRPqFQ_ih43_o_N';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectTasks() {
  const { data, error } = await supabase.from('tasks').select('*').limit(1);
  if (error) {
    console.error('Error:', error.message);
  } else if (data.length > 0) {
    console.log('Columns:', Object.keys(data[0]).join(', '));
  } else {
    console.log('No tasks found to inspect columns.');
  }
}

inspectTasks();

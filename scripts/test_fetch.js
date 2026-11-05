import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dhhbdgzutlltiojbsboi.supabase.co';
const supabaseKey = 'sb_publishable_IFlO7s4-sA5PUAbJsRPqFQ_ih43_o_N';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('employees')
    .select('id, full_name, emp_code, status, department_id, hub_id')
    .or('full_name.ilike.%Uchirappa%,full_name.ilike.%Vikas%,full_name.ilike.%Srinivas%');

  if (error) {
    console.error('Error fetching employees:', error);
    return;
  }
  console.log('Found employees:', JSON.stringify(data, null, 2));
}

main();

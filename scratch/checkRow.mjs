import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dhhbdgzutlltiojbsboi.supabase.co',
  'sb_publishable_IFlO7s4-sA5PUAbJsRPqFQ_ih43_o_N'
);

async function checkRow() {
  const { data, error } = await supabase
    .from('daily_attendances')
    .select(`
      id,
      employee_id,
      shift_date,
      session_logs_data,
      employees (
        id,
        full_name,
        emp_code,
        hub_id,
        hubs ( id, name, hub_code )
      )
    `)
    .eq('id', 'e1a93504-2eed-4c6c-8d39-a916ddc6de61');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

checkRow();

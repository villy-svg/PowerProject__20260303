import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dhhbdgzutlltiojbsboi.supabase.co',
  'sb_publishable_IFlO7s4-sA5PUAbJsRPqFQ_ih43_o_N'
);

async function checkAll() {
  const { data, error } = await supabase
    .from('daily_attendances')
    .select(`
      id,
      employee_id,
      shift_date,
      shift_type,
      first_login_time,
      session_logs_data,
      employees (
        id,
        full_name,
        emp_code,
        hub_id,
        hubs ( id, name, hub_code )
      )
    `)
    .order('shift_date', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

checkAll();

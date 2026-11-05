import { createClient } from '@supabase/supabase-js';

const devUrl = 'https://dhhbdgzutlltiojbsboi.supabase.co';
const devKey = 'sb_publishable_IFlO7s4-sA5PUAbJsRPqFQ_ih43_o_N';

const stagingUrl = 'https://eeoibqxhfkrgbylnluvk.supabase.co';
const stagingKey = 'sb_publishable_S47E-Gu9ok6GAarN-b-Qlg_AvHG1bHu';

async function check(name, url, key) {
  console.log(`\n--- Checking ${name} ---`);
  const supabase = createClient(url, key);
  
  // Check employees
  const { data: emps, error: empErr } = await supabase
    .from('employees')
    .select('id, full_name, emp_code')
    .or('full_name.ilike.%Uchirappa%,full_name.ilike.%Vikas%,full_name.ilike.%Srinivas%');
    
  console.log(`Employees in ${name}:`, emps?.length, empErr || '');
  if (emps) {
    emps.forEach(e => console.log(`  ${e.full_name} (${e.emp_code}): ${e.id}`));
  }

  // Check total attendance rows
  const { data: att, error: attErr, count } = await supabase
    .from('daily_attendances')
    .select('*', { count: 'exact', head: true });
    
  console.log(`Total daily_attendances rows in ${name}: count=${count}`, attErr || '');
}

async function run() {
  await check('DEV', devUrl, devKey);
  await check('STAGING', stagingUrl, stagingKey);
}

run();

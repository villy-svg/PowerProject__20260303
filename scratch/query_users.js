import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dhhbdgzutlltiojbsboi.supabase.co';
const supabaseKey = 'sb_publishable_IFlO7s4-sA5PUAbJsRPqFQ_ih43_o_N';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  console.log("Fetching users from Supabase...");
  const { data, error } = await supabase
    .from('user_profiles')
    .select(`
      id,
      name,
      email,
      role_id,
      is_active,
      linkedEmployee:employees (
        id,
        full_name,
        emp_code,
        email,
        status,
        role_id,
        employee_roles (
          seniority_level
        )
      )
    `)
    .order('name', { ascending: true });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Fetched ${data.length} users:`);
  data.forEach((u, i) => {
    console.log(`\n[${i+1}] Name: ${u.name}`);
    console.log(`    Email: ${u.email}`);
    console.log(`    Is Active: ${u.is_active}`);
    if (u.linkedEmployee) {
      console.log(`    Linked Employee: ${u.linkedEmployee.full_name}`);
      console.log(`    Employee Status: ${u.linkedEmployee.status}`);
      console.log(`    Employee Role ID: ${u.linkedEmployee.role_id}`);
      console.log(`    Seniority Level: ${u.linkedEmployee.employee_roles?.seniority_level}`);
    } else {
      console.log(`    Linked Employee: None`);
    }
  });
}

checkUsers();

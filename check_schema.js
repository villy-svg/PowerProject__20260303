import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase.from('employee_roles').select('*').limit(1);
  console.log("Roles:", data);
  
  const { data: emp, error: e2 } = await supabase.from('employees').select('*').limit(1);
  console.log("Employees:", emp);
}

checkSchema();

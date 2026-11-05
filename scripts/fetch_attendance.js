import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dhhbdgzutlltiojbsboi.supabase.co';
const supabaseKey = 'sb_publishable_IFlO7s4-sA5PUAbJsRPqFQ_ih43_o_N';

const supabase = createClient(supabaseUrl, supabaseKey);

const EMPLOYEES = [
  { id: '5c40dfb5-8c8c-4e0b-a0d2-dc4206ebe08f', name: 'Pothappagari Uchirappa', code: '7SYRCD' },
  { id: '422bd304-56f3-4ee5-95dd-387728e6b77e', name: 'Vikash Vishwakarma', code: '7OEO8Y' },
  { id: '54415066-85f1-48c9-b271-576141973082', name: 'Srinivasa S K', code: '89FXYE' }
];

async function main() {
  const empIds = EMPLOYEES.map(e => e.id);
  
  const { data, error } = await supabase
    .from('daily_attendances')
    .select('*')
    .in('employee_id', empIds)
    .order('shift_date', { ascending: true });

  if (error) {
    console.error('Error fetching attendance:', error);
    return;
  }

  console.log(`Total attendance rows found: ${data.length}`);
  for (const emp of EMPLOYEES) {
    const empRecords = data.filter(d => d.employee_id === emp.id);
    console.log(`\nEmployee: ${emp.name} (${emp.code}) - Records: ${empRecords.length}`);
    if (empRecords.length > 0) {
      console.log(`  Date range: ${empRecords[0].shift_date} to ${empRecords[empRecords.length - 1].shift_date}`);
      console.log(`  Sample record:`, JSON.stringify(empRecords[0], null, 2));
      console.log(`  Last record:`, JSON.stringify(empRecords[empRecords.length - 1], null, 2));
    }
  }
}

main();

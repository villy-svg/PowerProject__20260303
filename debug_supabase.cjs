const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dhhbdgzutlltiojbsboi.supabase.co';
const supabaseAnonKey = 'sb_publishable_IFlO7s4-sA5PUAbJsRPqFQ_ih43_o_N';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TASK_SELECT = `
  *,
  assignees(id, full_name, badge_id, employee_roles(seniority_level)),
  hubs(id, name, hub_code, city),
  clients(id, name),
  employees(id, full_name),
  submissions(id, status, rejection_reason, submission_number, created_at, submitted_by),
  children:tasks!parent_task_id(id)
`;

async function testQuery() {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT);

  if (error) {
    console.error('Error Details:', JSON.stringify(error, null, 2));
  } else {
    console.log('Success! Fetched', data.length, 'tasks.');
  }
}

testQuery();

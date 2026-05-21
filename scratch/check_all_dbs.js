import { createClient } from '@supabase/supabase-js';

const stagingUrl = 'https://eeoibqxhfkrgbylnluvk.supabase.co';
const stagingAnonKey = 'sb_publishable_S47E-Gu9ok6GAarN-b-Qlg_AvHG1bHu';

const devUrl = 'https://dhhbdgzutlltiojbsboi.supabase.co';
const devAnonKey = 'sb_publishable_IFlO7s4-sA5PUAbJsRPqFQ_ih43_o_N';

async function checkDb(name, url, key) {
  console.log(`\n==================================================`);
  console.log(`Connecting to ${name} DB: ${url}`);
  console.log(`==================================================`);
  
  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('tasks')
      .select('id, text, stage_id, task_board, created_at, updated_at');

    if (error) {
      console.error(`Error fetching tasks from ${name}:`, error);
      return;
    }

    console.log(`Total tasks found in ${name} DB: ${data.length}`);

    // Look at distinct task boards
    const boards = new Set();
    data.forEach(t => {
      if (Array.isArray(t.task_board)) {
        t.task_board.forEach(b => boards.add(b));
      } else if (t.task_board) {
        boards.add(t.task_board);
      }
    });

    console.log(`Distinct task boards found:`, Array.from(boards));

    // Let's filter for escalation tasks
    const escalationTasks = data.filter(t => {
      return Array.isArray(t.task_board) && t.task_board.includes('Escalations');
    });

    console.log(`\n--- ESCALATION TASKS IN ${name.toUpperCase()} (${escalationTasks.length}) ---`);
    if (escalationTasks.length === 0) {
      console.log(`No escalation tasks found.`);
    } else {
      // Group by stage_id
      const stages = {};
      escalationTasks.forEach(t => {
        stages[t.stage_id] = (stages[t.stage_id] || 0) + 1;
      });
      console.log('By Stage:', stages);
      
      escalationTasks.forEach((t, idx) => {
        console.log(`${idx + 1}. [${t.stage_id}] ${t.text} (ID: ${t.id})`);
      });
    }

    // Find any task with 'escalat' in its title
    const matchingText = data.filter(t => t.text && t.text.toLowerCase().includes('escalat'));
    console.log(`\nTasks containing 'escalat' in title: ${matchingText.length}`);
    matchingText.forEach((t, idx) => {
      console.log(`${idx + 1}. [${t.stage_id}] [Board: ${JSON.stringify(t.task_board)}] ${t.text}`);
    });
  } catch (err) {
    console.error(`Exception during checking ${name}:`, err);
  }
}

async function main() {
  await checkDb('Staging', stagingUrl, stagingAnonKey);
  await checkDb('Development', devUrl, devAnonKey);
}

main().catch(console.error);

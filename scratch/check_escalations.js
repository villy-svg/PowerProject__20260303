import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Staging environment variables
const supabaseUrl = 'https://eeoibqxhfkrgbylnluvk.supabase.co';
const supabaseAnonKey = 'sb_publishable_S47E-Gu9ok6GAarN-b-Qlg_AvHG1bHu';

console.log('Connecting to staging DB:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, text, stage_id, task_board, created_at, updated_at');

  if (error) {
    console.error('Error fetching tasks from staging:', error);
    return;
  }

  console.log(`Total tasks found in staging DB: ${data.length}`);

  // Look at distinct task boards
  const boards = new Set();
  data.forEach(t => {
    if (Array.isArray(t.task_board)) {
      t.task_board.forEach(b => boards.add(b));
    } else if (t.task_board) {
      boards.add(t.task_board);
    }
  });

  console.log('Distinct task boards found in staging DB:', Array.from(boards));

  // Let's filter for escalation tasks
  const escalationTasks = data.filter(t => {
    return Array.isArray(t.task_board) && t.task_board.includes('Escalations');
  });

  console.log(`\n--- ESCALATION TASKS IN STAGING (${escalationTasks.length}) ---`);
  if (escalationTasks.length === 0) {
    console.log('No escalation tasks found in staging.');
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

  // Find any task with 'escalat' in its title in staging
  const matchingText = data.filter(t => t.text && t.text.toLowerCase().includes('escalat'));
  console.log(`\nTasks in staging containing 'escalat' in title: ${matchingText.length}`);
  matchingText.forEach((t, idx) => {
    console.log(`${idx + 1}. [${t.stage_id}] [Board: ${JSON.stringify(t.task_board)}] ${t.text}`);
  });
}

main().catch(console.error);

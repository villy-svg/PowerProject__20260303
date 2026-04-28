const { createClient } = require('@supabase/supabase-js');

const projects = [
  {
    name: 'Prod',
    url: 'https://dhhbdgzutlltiojbsboi.supabase.co',
    key: 'sb_publishable_IFlO7s4-sA5PUAbJsRPqFQ_ih43_o_N'
  },
  {
    name: 'Staging',
    url: 'https://eeoibqxhfkrgbylnluvk.supabase.co',
    key: 'sb_publishable_S47E-Gu9ok6GAarN-b-Qlg_AvHG1bHu'
  }
];

const taskId = 'b8ca8b96-1877-4d75-8841-9a261acaf153';

async function fixTask() {
  for (const proj of projects) {
    console.log(`Checking ${proj.name} project...`);
    const supabase = createClient(proj.url, proj.key);

    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('id, text, hub_id, city, vertical_id')
      .eq('id', taskId)
      .single();

    if (fetchError) {
      console.log(`  - Task not found or error: ${fetchError.message}`);
      continue;
    }

    console.log(`  - Found Task: "${task.text}"`);
    console.log(`  - Current vertical_id: "${task.vertical_id}", city: "${task.city}"`);

    // Fetch hub to resolve city
    let correctCity = task.city;
    if (!correctCity && task.hub_id) {
      const { data: hub } = await supabase
        .from('hubs')
        .select('city')
        .eq('id', task.hub_id)
        .single();
      if (hub) correctCity = hub.city;
    }

    console.log(`  - Updating vertical_id to "CHARGING_HUBS" and city to "${correctCity}"`);

    const { error: updateError } = await supabase
      .from('tasks')
      .update({ 
        vertical_id: 'CHARGING_HUBS',
        city: correctCity
      })
      .eq('id', taskId);

    if (updateError) {
      console.error(`  - Error updating task:`, updateError);
    } else {
      console.log(`  - Success!`);
    }
    
    // Also check for other tasks with 'hub_tasks'
    const { data: otherTasks } = await supabase
      .from('tasks')
      .select('id, text, hub_id, city')
      .eq('vertical_id', 'hub_tasks');
      
    if (otherTasks && otherTasks.length > 0) {
      console.log(`  - Found ${otherTasks.length} other tasks with vertical_id="hub_tasks". Fixing them...`);
      for (const t of otherTasks) {
        let cCity = t.city;
        if (!cCity && t.hub_id) {
          const { data: hub } = await supabase
            .from('hubs')
            .select('city')
            .eq('id', t.hub_id)
            .single();
          if (hub) cCity = hub.city;
        }
        await supabase
          .from('tasks')
          .update({ vertical_id: 'CHARGING_HUBS', city: cCity })
          .eq('id', t.id);
      }
      console.log(`  - Fixed all other tasks.`);
    }
  }
}

fixTask();

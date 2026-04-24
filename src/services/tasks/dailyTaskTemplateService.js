/**
 * Daily Task Template Service
 * Specialized service for managing the `daily_task_templates` table.
 */
import { supabase } from '../core/supabaseClient';
import { VERTICALS } from '../../constants/verticals';
import { dailyTaskService } from './dailyTaskService';

const normalizeTemplate = (row) => {
  if (!row) return null;

  // PostgREST returns an array for the computed 'hubs' relationship
  const rawHubs = Array.isArray(row.hubs) ? row.hubs : (row.hubs ? [row.hubs] : []);
  const hubData = rawHubs.filter(Boolean);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    verticalId: row.vertical_id,
    
    // --- MULTI-HUB SUPPORT ---
    hub_id: row.hub_id,                           // Scalar primary (legacy)
    hub_ids: hubData.map(h => h?.id).filter(Boolean),              // Array of UUIDs for multi-select
    hubNames: hubData.map(h => h?.name).filter(Boolean),           // Array of Names for display
    hubData: hubData,                             // Full objects for detailed views
    
    // --- BACKWARD COMPATIBILITY ---
    client_id: row.client_id,
    employee_id: row.employee_id,
    subjectId: row.hub_id || row.client_id || row.employee_id || row.partner_id || row.vendor_id,
    
    city: row.city,
    functionName: row.function_name,
    frequency: row.frequency,
    frequencyDetails: row.frequency_details,
    timeOfDay: row.time_of_day,
    
    // --- ASSIGNEES & GOVERNANCE ---
    assignedTo: row.assigned_to || [],            // Scalar primary / Senior Manager
    assigneeName: row.senior_manager?.full_name || null,
    seniorManagerId: row.assigned_to,             // The "Umbrella" owner is the assigned_to column
    seniorManagerName: row.senior_manager?.full_name || null,
    
    // --- LOGIC FLAGS ---
    isActive: row.is_active,
    priority: row.priority || 'Medium',
    hasSubAssignees: row.metadata?.fan_out?.has_sub_assignees || false, // Mode 2 from metadata
    
    // --- AUDIT ---
    uploadLink: row.upload_link,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    lastUpdatedBy: row.last_updated_by,
  };
};

const mapTemplateToRow = (template) => {
  const vid = (template.verticalId || '').toUpperCase();
  const subjectId = template.subjectId === '' ? null : (template.subjectId || null);

  const row = {
    title: template.title || 'Untitled Template',
    description: template.description || null,
    vertical_id: template.verticalId || VERTICALS.CHARGING_HUBS.id,
    frequency: template.frequency || 'DAILY',
    frequency_details: template.frequencyDetails || null,
    time_of_day: template.timeOfDay || '08:00:00',
    assigned_to: template.seniorManagerId || (Array.isArray(template.assignedTo) ? template.assignedTo[0] : (template.assignedTo || null)),
    is_active: template.isActive !== undefined ? template.isActive : true,
    
    // METADATA WRAPPING
    priority: template.priority || 'Medium',
    metadata: {
      ...template.metadata,
      fan_out: {
        ...(template.metadata?.fan_out || {}),
        has_sub_assignees: !!template.hasSubAssignees
      }
    },

    upload_link: template.uploadLink || null,
    city: template.city || null,
    function_name: template.functionName || null,
  };

  // Intelligent Subject Mapping based on vertical
  if (vid.includes('CLIENT')) row.client_id = subjectId ? [subjectId] : [];
  else if (vid.includes('EMPLOYEE')) row.employee_id = subjectId ? [subjectId] : [];
  else if (vid.includes('PARTNER')) row.partner_id = subjectId ? [subjectId] : [];
  else if (vid.includes('VENDOR')) row.vendor_id = subjectId ? [subjectId] : [];
  else row.hub_id = subjectId; // hub_id is still a scalar UUID (location)

  return row;
};

/**
 * Synchronizes multi-hub links with per-hub assignee metadata.
 * @param {string} templateId 
 * @param {Array} hubConfigs - [{ hubId: string, assigneeIds: string[] }]
 */
const syncTemplateHubs = async (templateId, hubConfigs) => {
  if (!templateId) return;

  // 1. Purge existing Hub links for this template
  const { error: delError } = await supabase
    .from('task_context_links')
    .delete()
    .match({ source_id: templateId, source_type: 'template', entity_type: 'hub' });

  if (delError) throw delError;

  // 2. Insert new configurations with metadata
  if (hubConfigs && hubConfigs.length > 0) {
    const rows = hubConfigs.map(hc => ({
      source_id: templateId,
      source_type: 'template',
      entity_type: 'hub',
      entity_id: hc.hubId,
      is_active: true,
      metadata: { 
        assignee_ids: hc.assigneeIds || [] // CRITICAL: This is used by the PL/pgSQL generator
      }
    }));

    const { error: insError } = await supabase
      .from('task_context_links')
      .insert(rows);
    if (insError) throw insError;
  }
};

/**
 * Synchronizes template-level assignee links.
 * @param {string} templateId 
 * @param {string[]} assigneeIds 
 */
const syncTemplateAssignees = async (templateId, assigneeIds) => {
  if (!templateId) return;

  await supabase
    .from('task_context_links')
    .delete()
    .match({ source_id: templateId, source_type: 'template', entity_type: 'assignee' });

  if (assigneeIds && assigneeIds.length > 0) {
    const rows = assigneeIds.map(aid => ({
      source_id: templateId,
      source_type: 'template',
      entity_type: 'assignee',
      entity_id: aid,
      is_active: true
    }));
    const { error } = await supabase.from('task_context_links').insert(rows);
    if (error) throw error;
  }
};

/**
 * Standard select string for templates.
 * - hubs: Uses the computed PostgREST relationship.
 * - senior_manager: Join to user_profiles for governance visibility.
 */
const TEMPLATE_SELECT = `
  *,
  hubs(id, name, hub_code, city),
  senior_manager:employees!assigned_to (id, full_name)
`;

export const dailyTaskTemplateService = {
  async getTemplates() {
    const { data, error } = await supabase
      .from('daily_task_templates')
      .select(TEMPLATE_SELECT)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(normalizeTemplate);
  },

  /**
   * Fetches the hub-assignee configuration matrix for a template.
   * Returns: [{ hubId, assigneeIds }]
   */
  async getTemplateHubConfigs(templateId) {
    const { data, error } = await supabase
      .from('task_context_links')
      .select('entity_id, metadata')
      .eq('source_id', templateId)
      .eq('source_type', 'template')
      .eq('entity_type', 'hub');

    if (error) throw error;
    return (data || []).map(d => ({
      hubId: d.entity_id,
      assigneeIds: d.metadata?.assignee_ids || []
    }));
  },

  async addTemplate(templateData, userId) {
    // 1. Insert base template
    const row = {
      ...mapTemplateToRow(templateData),
      created_by: userId,
      last_updated_by: userId,
    };

    const { data, error } = await supabase
      .from('daily_task_templates')
      .insert([row])
      .select(TEMPLATE_SELECT);

    if (error) throw error;
    const saved = normalizeTemplate(data[0]);

    // 2. Sync Hub Links (Mode 3)
    if (templateData.hubConfigs) {
      await syncTemplateHubs(saved.id, templateData.hubConfigs);
    }
    // 3. Sync Template Assignees (Mode 2)
    if (templateData.assigneeIds) {
      await syncTemplateAssignees(saved.id, templateData.assigneeIds);
    }

    return saved;
  },

  async updateTemplate(templateData, userId) {
    // 1. Update base template
    const row = {
      ...mapTemplateToRow(templateData),
      last_updated_by: userId,
    };

    const { data, error } = await supabase
      .from('daily_task_templates')
      .update(row)
      .eq('id', templateData.id)
      .select(TEMPLATE_SELECT);

    if (error) throw error;
    const saved = normalizeTemplate(data[0]);

    // 2. Sync Hub Links
    if (templateData.hubConfigs) {
      await syncTemplateHubs(saved.id, templateData.hubConfigs);
    }
    // 3. Sync Template Assignees
    if (templateData.assigneeIds) {
      await syncTemplateAssignees(saved.id, templateData.assigneeIds);
    }

    return saved;
  },

  async toggleStatus(templateId, isActive, userId) {
    const { data, error } = await supabase
      .from('daily_task_templates')
      .update({ is_active: isActive, last_updated_by: userId })
      .eq('id', templateId)
      .select(TEMPLATE_SELECT);

    if (error) throw error;
    return normalizeTemplate(data[0]);
  },

  async deleteTemplate(templateId) {
    const { error } = await supabase
      .from('daily_task_templates')
      .delete()
      .eq('id', templateId);

    if (error) throw error;
  },
  
  async generateSampleTask(template, userId) {
    const taskData = {
      text: `[SAMPLE] ${template.title}`,
      description: template.description,
      priority: 'Medium',
      stageId: 'BACKLOG',
      verticalId: template.verticalId,
      hub_id: template.subjectId, // dailyTaskService.addTask handles the mapping to hub_id/client_id etc
      assigned_to: template.assignedTo,
      is_recurring: true,
      scheduled_date: new Date().toISOString().split('T')[0],
      is_sample: true // Adding a flag for UI identification if needed
    };
    return dailyTaskService.addTask(taskData, userId);
  }
};

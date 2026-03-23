/**
 * Daily Task Template Service
 * Specialized service for managing the `daily_task_templates` table.
 */
import { supabase } from '../core/supabaseClient';
import { dailyTaskService } from './dailyTaskService';

const normalizeTemplate = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  verticalId: row.vertical_id,
  hub_id: row.hub_id,
  client_id: row.client_id,
  employee_id: row.employee_id,
  // Unified subject reading for UI simplicity (assuming mostly Hubs for now)
  subjectId: row.hub_id || row.client_id || row.employee_id || row.partner_id || row.vendor_id,
  city: row.city,
  functionName: row.function_name,
  frequency: row.frequency,
  frequencyDetails: row.frequency_details,
  timeOfDay: row.time_of_day,
  assignedTo: row.assigned_to,
  assigneeName: row.employees?.full_name,
  isActive: row.is_active,
  uploadLink: row.upload_link,
  lastRunAt: row.last_run_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by,
  lastUpdatedBy: row.last_updated_by,
});

const mapTemplateToRow = (template) => {
  const vid = (template.verticalId || '').toUpperCase();
  const subjectId = template.subjectId === '' ? null : (template.subjectId || null);

  const row = {
    title: template.title || 'Untitled Template',
    description: template.description || null,
    vertical_id: template.verticalId || 'CHARGING_HUBS',
    frequency: template.frequency || 'DAILY',
    frequency_details: template.frequencyDetails || null,
    time_of_day: template.timeOfDay || '08:00:00',
    assigned_to: template.assignedTo || null,
    is_active: template.isActive !== undefined ? template.isActive : true,
    upload_link: template.uploadLink || null,
    city: template.city || null,
    function_name: template.functionName || null,
  };

  // Intelligent Subject Mapping based on vertical
  if (vid.includes('CLIENT')) row.client_id = subjectId;
  else if (vid.includes('EMPLOYEE')) row.employee_id = subjectId;
  else if (vid.includes('PARTNER')) row.partner_id = subjectId;
  else if (vid.includes('VENDOR')) row.vendor_id = subjectId;
  else row.hub_id = subjectId; // Fallback to Hubs

  return row;
};

const TEMPLATE_SELECT = '*, employees:assigned_to (full_name)';

export const dailyTaskTemplateService = {
  async getTemplates() {
    const { data, error } = await supabase
      .from('daily_task_templates')
      .select(TEMPLATE_SELECT)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(normalizeTemplate);
  },

  async addTemplate(templateData, userId) {
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
    return normalizeTemplate(data[0]);
  },

  async updateTemplate(templateData, userId) {
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
    return normalizeTemplate(data[0]);
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
      stageId: 'TODO',
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

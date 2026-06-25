/**
 * submissionService.js
 * Service layer for Proof of Work submissions.
 * Handles file compression, Supabase Storage uploads, and DB inserts.
 */
import { supabase } from '../core/supabaseClient';
import imageCompression from 'browser-image-compression';
import { taskService } from './taskService';
import { createEntity } from '../storage/entityService';

const BUCKET_NAME = 'field-submissions';

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.3, // Target ~300KB per image
  useWebWorker: true,
};

/**
 * Compresses an image file if it's an image type.
 * Non-image files are returned as-is.
 */
export const compressFile = async (file) => {
  if (!file.type.startsWith('image/')) return file;
  try {
    const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
    return compressed;
  } catch (err) {
    console.warn('Image compression failed, uploading original:', err);
    return file;
  }
};

/**
 * Uploads a file to Supabase Storage under the field-submissions bucket.
 * Path: {parentType}/{parentId}/{submissionId}/{fileName}
 * @returns {{ url: string, fileName: string, mimeType: string }} | throws
 */
export const uploadSubmissionFile = async (parentId, submissionId, file, parentType = 'tasks') => {
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${sanitizedName}`;
  const storagePath = parentType === 'employees'
    ? `employees/${parentId}/${submissionId}/${uniqueName}`
    : `${parentId}/${submissionId}/${uniqueName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return {
    file_name: file.name,
    url: urlData.publicUrl,
    provider: 'supabase',
    tier: 'hot',
    mime_type: file.type || 'application/octet-stream',
  };
};

/**
 * Updates the links array for an existing submission.
 */
export const updateSubmissionLinks = async (submissionId, links) => {
  const { data, error } = await supabase
    .from('submissions')
    .update({ links })
    .eq('id', submissionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update submission links: ${error.message}`);
  return data;
};

/**
 * Creates a submission record.
 * @param {Object} submission
 * @param {string} [submission.taskId]
 * @param {string} [submission.employeeId]
 * @param {string} submission.submittedBy
 * @param {string} submission.comment
 * @param {Array} submission.links - Array of link objects matching the JSONB schema
 */
export const createSubmission = async ({ taskId, employeeId, submittedBy, comment, links = [] }) => {
  try {
    const result = await createEntity({
      entityType: 'proof_of_work',
      domainData: {
        task_id: taskId || null,
        employee_id: employeeId || null,
        submitted_by: submittedBy,
        comment,
        links,
      }
    });
    
    // We return the 'domain' part of the atomic response, which represents the submission record itself
    return result.domain;
  } catch (err) {
    throw new Error(`Submission failed: ${err.message}`);
  }
};

/**
 * Fetches all submissions for a given task.
 */
export const getSubmissionsForTask = async (taskId) => {
  const { data, error } = await supabase
    .from('submissions')
    .select('*, submitted_by_profile:user_profiles!submissions_submitted_by_fkey(name, email)')
    .eq('task_id', taskId)
    .order('submission_number', { ascending: false });

  if (error) throw new Error(`Failed to fetch submissions: ${error.message}`);
  return data || [];
};

/**
 * Fetches all submissions (documents) for a given employee.
 */
export const getEmployeeSubmissions = async (employeeId) => {
  const { data, error } = await supabase
    .from('submissions')
    .select('*, submitted_by_profile:user_profiles!submissions_submitted_by_fkey(name, email)')
    .eq('employee_id', employeeId)
    .order('submission_number', { ascending: false });

  if (error) throw new Error(`Failed to fetch employee submissions: ${error.message}`);
  return data || [];
};

/**
 * Full submission flow: compress → upload files → single atomic DB insert.
 *
 * ROOT CAUSE FIX: The DB record is created ONLY after all file uploads succeed.
 * A client-generated UUID (uploadBatchId) is used to name the storage folder,
 * so no DB record is needed upfront. This eliminates orphan `submissions` rows
 * (empty links: []) that were previously left behind on any upload failure.
 *
 * Old (broken) flow:  CREATE DB record → upload → PATCH links (3 round-trips, orphan risk)
 * New (fixed) flow:   upload files → CREATE DB record with links (1 round-trip, atomic)
 *
 * @param {Object} params
 * @param {string} [params.taskId]
 * @param {string} [params.employeeId]
 * @param {string} params.userId
 * @param {string} params.comment
 * @param {File[]} params.files
 * @param {boolean} params.moveToReview - If true, auto-transitions task to REVIEW stage
 * @param {Function} [params.onProgress]
 * @returns {Object} The created submission record
 */
export const submitProofOfWork = async ({ taskId, employeeId, userId, comment, files = [], moveToReview = false, onProgress }) => {
  const totalSteps = files.length + 1; // uploads + DB insert

  // Step 1: Generate a client-side UUID as the storage folder name.
  // This is ONLY for folder organisation in storage — it does NOT need to match the DB record ID.
  // Using crypto.randomUUID() ensures each submission attempt gets a fresh, collision-free folder,
  // so retrying after a failure will never hit a "resource already exists" storage error.
  const uploadBatchId = crypto.randomUUID();

  // Step 2: Compress all files concurrently (web workers, non-blocking)
  if (onProgress) onProgress({ current: 0, total: totalSteps, label: `Compressing ${files.length} file(s)...` });
  const compressedFiles = await Promise.all(files.map(file => compressFile(file)));

  // Step 3: Upload files sequentially (ordered, stable on slow connections)
  // If ANY upload fails here, NO DB record has been created yet — zero orphan risk.
  const links = [];
  let uploadedCount = 0;
  const parentId = taskId || employeeId;
  const parentType = employeeId ? 'employees' : 'tasks';

  for (const file of compressedFiles) {
    if (onProgress) onProgress({
      current: uploadedCount,
      total: totalSteps,
      label: `Uploading ${uploadedCount + 1} of ${compressedFiles.length}...`,
    });
    const linkObj = await uploadSubmissionFile(parentId, uploadBatchId, file, parentType);
    links.push(linkObj);
    uploadedCount++;
  }

  if (onProgress) onProgress({ current: uploadedCount, total: totalSteps, label: 'Saving record...' });

  // Step 4: All uploads succeeded — now create the single, complete DB record.
  // links[] is already fully populated, so this is ONE atomic write with no follow-up patch.
  const submission = await createSubmission({
    taskId,
    employeeId,
    submittedBy: userId,
    comment,
    links,
  });

  if (onProgress) onProgress({ current: totalSteps, total: totalSteps, label: 'Done!' });

  // Step 5: Optionally move task to REVIEW stage (best-effort, non-blocking on failure)
  if (moveToReview && taskId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await taskService.updateTaskStage(taskId, 'REVIEW', user?.id);
    } catch (err) {
      console.error('Failed to move task to REVIEW:', err.message);
    }
  }

  return submission;
};

/**
 * Updates the status of a submission (approve/reject).
 * Only accessible by editor+ via RLS.
 * @param {string} submissionId
 * @param {string} newStatus - 'approved' | 'rejected'
 */
export const updateSubmissionStatus = async (submissionId, newStatus, rejectionReason = null) => {
  const updatePayload = { status: newStatus };
  if (newStatus === 'rejected') {
    updatePayload.rejection_reason = rejectionReason;
  }

  const { data, error } = await supabase
    .from('submissions')
    .update(updatePayload)
    .eq('id', submissionId)
    .select()
    .single();

  if (error) throw new Error(`Status update failed: ${error.message}`);
  return data;
};

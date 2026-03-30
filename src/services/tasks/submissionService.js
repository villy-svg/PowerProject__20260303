/**
 * submissionService.js
 * Service layer for Proof of Work submissions.
 * Handles file compression, Supabase Storage uploads, and DB inserts.
 */
import { supabase } from '../core/supabaseClient';
import imageCompression from 'browser-image-compression';

const BUCKET_NAME = 'field-submissions';

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  fileType: 'image/jpeg',
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
 * Path: {taskId}/{submissionNumber}_{fileName}
 * @returns {{ url: string, fileName: string, mimeType: string }} | throws
 */
export const uploadSubmissionFile = async (taskId, submissionNumber, file) => {
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${taskId}/${submissionNumber}_${sanitizedName}`;

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
 * Gets the next submission number for a task.
 * The DB trigger handles this, but we need it client-side for file naming.
 */
export const getNextSubmissionNumber = async (taskId) => {
  const { data, error } = await supabase
    .from('submissions')
    .select('submission_number')
    .eq('task_id', taskId)
    .order('submission_number', { ascending: false })
    .limit(1);

  if (error) throw new Error(`Failed to get submission number: ${error.message}`);
  return (data?.[0]?.submission_number ?? 0) + 1;
};

/**
 * Creates a submission record.
 * @param {Object} submission
 * @param {string} submission.taskId
 * @param {string} submission.submittedBy
 * @param {string} submission.comment
 * @param {Array} submission.links - Array of link objects matching the JSONB schema
 */
export const createSubmission = async ({ taskId, submittedBy, comment, links = [] }) => {
  const { data, error } = await supabase
    .from('submissions')
    .insert({
      task_id: taskId,
      submitted_by: submittedBy,
      comment,
      links,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(`Submission failed: ${error.message}`);
  return data;
};

/**
 * Fetches all submissions for a given task.
 */
export const getSubmissionsForTask = async (taskId) => {
  const { data, error } = await supabase
    .from('submissions')
    .select('*, submitted_by_profile:user_profiles!submissions_submitted_by_fkey(name, email)')
    .eq('task_id', taskId)
    .order('submission_number', { ascending: true });

  if (error) throw new Error(`Failed to fetch submissions: ${error.message}`);
  return data || [];
};

/**
 * Full submission flow: compress files → upload → insert record.
 * @param {Object} params
 * @param {string} params.taskId
 * @param {string} params.userId
 * @param {string} params.comment
 * @param {File[]} params.files
 * @param {boolean} params.moveToReview - If true, auto-transitions task to REVIEW stage
 * @returns {Object} The created submission record
 */
export const submitProofOfWork = async ({ taskId, userId, comment, files = [], moveToReview = false }) => {
  // 1. Get next submission number for file naming
  const submissionNumber = await getNextSubmissionNumber(taskId);

  // 2. Compress and upload all files
  const links = [];
  for (const file of files) {
    const compressed = await compressFile(file);
    const linkObj = await uploadSubmissionFile(taskId, submissionNumber, compressed);
    links.push(linkObj);
  }

  // 3. Create submission record (trigger auto-sets submission_number)
  const submission = await createSubmission({
    taskId,
    submittedBy: userId,
    comment,
    links,
  });

  // 4. Optionally move task to REVIEW stage
  if (moveToReview) {
    const { error } = await supabase
      .from('tasks')
      .update({ stageid: 'REVIEW' })
      .eq('id', taskId);
    if (error) console.error('Failed to move task to REVIEW:', error.message);
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

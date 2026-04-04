/**
 * submissionService.js
 * Service layer for Proof of Work submissions.
 * Handles file compression, Supabase Storage uploads, and DB inserts.
 */
import { supabase } from '../core/supabaseClient';
import imageCompression from 'browser-image-compression';
import { taskService } from './taskService';

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
export const uploadSubmissionFile = async (taskId, submissionId, file) => {
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${taskId}/${submissionId}/${sanitizedName}`;

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
    .order('submission_number', { ascending: false });

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
  // 1. Create submission record first (Trigger handles submission_number)
  // We insert with empty links to get the UUID for storage folder naming
  const submission = await createSubmission({
    taskId,
    submittedBy: userId,
    comment,
    links: [], // Start empty
  });

  const submissionId = submission.id;

  try {
    // 2. Compress and upload all files into the submission's UUID folder
    const links = [];
    for (const file of files) {
      const compressed = await compressFile(file);
      const linkObj = await uploadSubmissionFile(taskId, submissionId, compressed);
      links.push(linkObj);
    }

    // 3. Update the record with the final links
    const updatedSubmission = await updateSubmissionLinks(submissionId, links);

    // 4. Optionally move task to REVIEW stage
    if (moveToReview) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await taskService.updateTaskStage(taskId, 'REVIEW', user?.id);
      } catch (err) {
        console.error('Failed to move task to REVIEW:', err.message);
      }
    }

    return updatedSubmission;
  } catch (err) {
    // Cleanup: If file upload or link update fails, we should ideally mark the submission
    // as 'error' or 'abandoned', but for now we just throw so the UI handles the error.
    console.error('Core submission flow failed:', err.message);
    throw err;
  }
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

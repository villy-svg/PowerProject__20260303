-- Migration: Atomic Task Stage Update on Submission Status Change
-- Description: Automatically updates parent task stage when a submission is approved or rejected, eliminating frontend race conditions.

CREATE OR REPLACE FUNCTION trg_update_task_stage_on_submission_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if status changed to APPROVED
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM 'approved') THEN
    IF NEW.task_id IS NOT NULL THEN
      UPDATE tasks 
      SET stage_id = 'COMPLETED', updated_at = NOW()
      WHERE id = NEW.task_id;
    END IF;
  -- Check if status changed to REJECTED
  ELSIF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM 'rejected') THEN
    IF NEW.task_id IS NOT NULL THEN
      UPDATE tasks 
      SET stage_id = 'IN_PROGRESS', updated_at = NOW()
      WHERE id = NEW.task_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to submissions table
DROP TRIGGER IF EXISTS trigger_task_stage_on_approval ON submissions;

CREATE TRIGGER trigger_task_stage_on_approval
AFTER UPDATE ON submissions
FOR EACH ROW
EXECUTE FUNCTION trg_update_task_stage_on_submission_approval();

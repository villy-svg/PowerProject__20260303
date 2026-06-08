/**
 * remarkRules.js
 * 
 * Rules to determine if an employee matches the "High Remarks" filter.
 * Customize the logic here to define what constitutes "High Remarks".
 */

/**
 * Determines if an employee satisfies the "High Remarks" condition.
 * 
 * @param {Object} employee - The employee record object.
 * @param {Array} remarks - All tasks/remarks assigned to this employee.
 * @returns {boolean} True if the employee should be filtered under "High Remarks".
 */
export const hasHighRemarks = (employee, remarks = []) => {
  // Default Rule:
  // 1. Employee has 3 or more remarks total, OR
  // 2. Employee has at least 1 remark with Priority/Grade as 'High' or 'Urgent' (or Priority levels 3/4)
  if (remarks.length >= 3) {
    return true;
  }

  const hasUrgentOrHighRemark = remarks.some(remark => {
    const priority = String(remark.priority || '').toLowerCase();
    return priority === 'high' || priority === 'urgent' || priority === '3' || priority === '4';
  });

  return hasUrgentOrHighRemark;
};

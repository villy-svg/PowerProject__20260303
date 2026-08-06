# Conscious Technical Debt Log

This document tracks known bugs, architectural compromises, or product limitations that the team has consciously chosen to ignore or defer. 

The purpose of this log is to maintain a clear record of *why* something is broken or sub-optimal, preventing future developers (or AI agents) from wasting time re-auditing or accidentally "fixing" functionality that is intentionally deferred.

## Rules of Engagement
- **Do not fix these items** without explicit product approval.
- **Periodically revisit** this list during sprint planning to evaluate if the risk/cost calculus has changed.

---

## Logged Items

### 1. Inability to Delete Employee Bank Details
- **Location**: `EmployeeManagement.jsx` (`handleSave`)
- **Issue**: Submitting an empty string for the bank account number automatically falls back to the existing value in the database, making it impossible to delete bank details once they are added.
- **Reason for Deferral**: Deemed low priority. Bank details are rarely, if ever, deleted entirely (usually just updated). Forcing a fallback prevents accidental erasure during bulk edits.
- **Date Logged**: August 2026

### 2. Schedule Planner Draft Overwrite Vulnerability
- **Location**: `schedulePlannerService.js` (`saveDraft` - CASE 2)
- **Issue**: Updating an existing draft plan checks the `plan_id` but does not verify that the requester is the original `submitted_by` owner. A malicious authenticated user could theoretically overwrite another manager's draft.
- **Reason for Deferral**: High effort to exploit, low impact. Drafts are temporary, and managers generally only see their own hubs. The risk of intentional sabotage is negligible in the current organizational trust model.
- **Date Logged**: August 2026

### 3. Silent Task Insertion Failures on Forced Checkout
- **Location**: `attendanceService.js` (`adminForceCheckout`)
- **Issue**: When forcing a checkout, a disciplinary task is inserted into the database. The code does not handle or log errors if this insert fails.
- **Reason for Deferral**: The primary action (closing the session) is what matters most. If the task insert fails due to an edge case in RLS or a transient error, the system degraded gracefully rather than blocking the checkout entirely. 
- **Date Logged**: August 2026

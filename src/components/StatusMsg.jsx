/**
 * StatusMsg.jsx
 *
 * Shared inline status/feedback message component used across all
 * management form modals (Rule, Category, SubCategory, etc.).
 *
 * Requires: .status-message, .status-message.success, .status-message.error
 * from ManagementForms.css (globally imported).
 */
import React from 'react';

const StatusMsg = ({ msg }) => {
  if (!msg?.text) return null;
  return (
    <div className={`status-message ${msg.type}`} style={{ marginTop: '0.75rem' }}>
      {msg.text}
    </div>
  );
};

export default StatusMsg;

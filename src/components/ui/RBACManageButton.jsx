// @prod-critical
import React, { useState } from 'react';
import BoardRBACModal from '../modals/BoardRBACModal';
import { IconShield } from './Icons';
import './RBACManageButton.css';

/**
 * RBACManageButton
 *
 * Master-admin-only RBAC shortcut button for management boards.
 * Renders null for any non-master-admin user — fully silent guard.
 * Opens an in-place modal to manage access for the specific board/feature.
 *
 * Props:
 *   user       {object} - Current user object (needs roleId).
 *   verticalId {string} - Target vertical ID.
 *   featureId  {string} - Optional target feature ID.
 *   label      {string} - Display label (e.g., "Employees List", "Attendance Board").
 *
 * Security: Guard is `user?.roleId === 'master_admin'` (frontend layer).
 */
const RBACManageButton = ({ user, verticalId, featureId, label = 'Access' }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Hard guard: invisible to everyone except master_admin
  if (user?.roleId !== 'master_admin') return null;

  return (
    <>
      {/* Icon-only neutral trigger so RBAC never outweights primary board CTAs */}
      <button
        type="button"
        className="halo-button rbac-manage-btn"
        onClick={() => setIsModalOpen(true)}
        title={`Manage RBAC access for: ${label}`}
        aria-label={`Manage RBAC access for ${label}`}
      >
        <IconShield size={16} strokeWidth={1.8} />
      </button>

      <BoardRBACModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        verticalId={verticalId}
        featureId={featureId}
        titleLabel={label}
      />
    </>
  );
};

export default RBACManageButton;

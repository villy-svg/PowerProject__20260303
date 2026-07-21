import React from 'react';
import { VERTICAL_LIST } from '../../constants/verticals';
import { IconEdit, IconLock, IconZap } from '../ui/Icons';

/**
 * UserList Component
 * Renders the collection of users in either a standard list (table) or responsive grid.
 * Displays each user's active/inactive status and provides Deactivate/Reactivate actions.
 */
const UserList = ({ users = [], viewMode, onEdit, onDeactivate, onReactivate }) => {

  // Reusable status badge element (glowing dot)
  const StatusBadge = ({ isActive }) =>
    isActive !== false ? (
      <span className="user-status-dot user-status-dot--active" title="Active"></span>
    ) : (
      <span className="user-status-dot user-status-dot--inactive" title="Inactive"></span>
    );

  // Reusable toggle action button
  const ToggleStatusBtn = ({ user }) =>
    user.is_active !== false ? (
      <button
        className="icon-btn deactivate-btn"
        onClick={() => onDeactivate && onDeactivate(user.id)}
        title="Deactivate this user — removes all access"
      >
        <IconLock size={18} />
      </button>
    ) : (
      <button
        className="icon-btn reactivate-btn"
        onClick={() => onReactivate && onReactivate(user.id)}
        title="Reactivate this user — restores base access only"
      >
        <IconZap size={18} />
      </button>
    );

  const mapVerticalLabel = (label) => {
    if (!label) return '';
    const clean = label.trim().toLowerCase();
    if (clean === 'hub manager' || clean === 'hub' || clean === 'charging_hubs' || clean === 'hubs') return 'Hubs';
    if (clean === 'client manager' || clean === 'client' || clean === 'clients') return 'Clients';
    if (clean === 'employee manager' || clean === 'employee' || clean === 'employees') return 'Employees';
    if (clean === 'partner manager' || clean === 'partner' || clean === 'partners') return 'Partners';
    if (clean === 'vendor manager' || clean === 'vendor' || clean === 'vendors') return 'Vendors';
    if (clean === 'data manager' || clean === 'data' || clean === 'data_manager') return 'Data';
    return label;
  };

  if (viewMode === 'list') {
    return (
      <div className="user-list-wrapper responsive-table-wrapper">
        <table className="user-table">
          <thead>
            <tr>
              <th>Name / Email</th>
              <th>Role</th>
              <th>Vertical Access</th>
              <th>Employee Link</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={u.is_active === false ? 'user-row--inactive' : ''}>
                <td>
                  <div className="u-flex-center-gap-12">
                    <StatusBadge isActive={u.is_active} />
                    <div className="user-identity">
                      <span className="user-name-cell">{u.name}</span>
                      <span className="user-email-cell">{u.email}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`role-badge ${u.role_id}`}>
                    {typeof u.role_id === 'string' ? u.role_id.replace('_', ' ') : u.role_id}
                  </span>
                </td>
                <td>
                  <div className="vertical-tags">
                    {u.role_id?.startsWith('master') ? (
                       <span className="v-tag master">All Verticals</span>
                    ) : (
                      (() => {
                        const vPerms = u.verticalPermissions || {}; 
                        const activeVIds = Array.from(new Set(Object.entries(vPerms)
                          .filter(([_, data]) => data?.level && data.level !== 'none')
                          .map(([vId]) => {
                            const vInfo = VERTICAL_LIST.find(v => v.id === vId);
                            const label = vInfo ? vInfo.label : vId;
                            return mapVerticalLabel(label);
                          })));
                        
                        if (activeVIds.length > 0) {
                          const initials = activeVIds.map(v => v.charAt(0).toUpperCase()).join('');
                          return <span className="v-tag simple" title={activeVIds.join(', ')}>{initials}</span>;
                        } else {
                          return <span className="v-tag locked">No Access</span>;
                        }
                      })()
                    )}
                  </div>
                </td>
                <td>
                  {/* Employee link badge — inactive renders faded red, active renders green */}
                  {u.linkedEmployee ? (
                    <div className="employee-link-badge">
                      {u.linkedEmployee.status === 'Inactive' ? (
                        <span className="v-tag simple linked-inactive">
                          ⚠ Linked: {u.linkedEmployee.full_name} ({u.linkedEmployee.emp_code})
                        </span>
                      ) : (
                        <span className="v-tag simple linked-active">
                          ✓ Linked: {u.linkedEmployee.full_name} ({u.linkedEmployee.emp_code})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="v-tag locked">Not an Employee</span>
                  )}
                </td>
                <td>
                  <div className="user-row-actions">
                    <button className="icon-btn edit-user-btn" onClick={() => onEdit(u)} title="Edit User Permissions">
                      <IconEdit size={18} />
                    </button>
                    <ToggleStatusBtn user={u} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="user-grid">
      {users.map(u => (
        <div key={u.id} className={`user-card ${u.is_active === false ? 'user-card--inactive' : ''}`}>
          <div className="user-card-header">
            <div className="user-list__item-content">
              <div className="u-mt-8">
                <StatusBadge isActive={u.is_active} />
              </div>
              <div className="user-card-id">
                <span className="user-name">{u.name}</span>
                <span className="user-email">{u.email}</span>
              </div>
            </div>
            {/* Badges moved to bottom actions */}
          </div>
          <div className="user-card-body">
            <div className="user-card-body-row">
              <div className="user-card-body-col">
                <label>Verticals</label>
                <div className="vertical-tags">
                  {u.role_id?.startsWith('master') ? (
                    <span className="v-tag master">All Verticals</span>
                  ) : (
                    (() => {
                      const vPerms = u.verticalPermissions || {};
                      const activeVIds = Array.from(new Set(Object.entries(vPerms)
                        .filter(([_, data]) => data?.level && data.level !== 'none')
                        .map(([vId]) => {
                          const vInfo = VERTICAL_LIST.find(v => v.id === vId);
                          const label = vInfo ? vInfo.label : vId;
                          return mapVerticalLabel(label);
                        })));
                      if (activeVIds.length > 0) {
                        const initials = activeVIds.map(v => v.charAt(0).toUpperCase()).join('');
                        return <span className="v-tag simple" title={activeVIds.join(', ')}>{initials}</span>;
                      } else {
                        return <span className="v-tag locked">No Access</span>;
                      }
                    })()
                  )}
                </div>
              </div>
              
              <div className="user-card-body-col">
                <label>Profile</label>
                {/* Employee link status — inactive renders faded red, active renders green */}
                <div className="employee-link-status u-mt-4">
                  {u.linkedEmployee ? (
                    u.linkedEmployee.status === 'Inactive' ? (
                      <span className="v-tag simple linked-inactive">
                        ⚠ Linked: {u.linkedEmployee.full_name} ({u.linkedEmployee.emp_code})
                      </span>
                    ) : (
                      <span className="v-tag simple linked-active">
                        ✓ {u.linkedEmployee.full_name} ({u.linkedEmployee.emp_code})
                      </span>
                    )
                  ) : (
                    <span className="v-tag locked">Not an Employee</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="user-card-actions">
            <div className="user-card-status-tags">
              <span className={`role-badge ${u.role_id}`}>
                {typeof u.role_id === 'string' ? u.role_id.replace('_', ' ') : u.role_id}
              </span>
            </div>
            <div className="user-card-action-btns">
              <button className="icon-btn edit-user-btn" onClick={() => onEdit(u)} title="Edit User Permissions">
                <IconEdit size={18} />
              </button>
              <ToggleStatusBtn user={u} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UserList;

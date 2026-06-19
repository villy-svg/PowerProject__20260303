import React from 'react';
import { VERTICAL_LIST } from '../../constants/verticals';
import { IconEdit } from '../ui/Icons';

/**
 * UserList Component
 * Renders the collection of users in either a standard list (table) or responsive grid.
 * Displays each user's active/inactive status and provides Deactivate/Reactivate actions.
 */
const UserList = ({ users = [], viewMode, onEdit, onDeactivate, onReactivate }) => {

  // Reusable status badge element
  const StatusBadge = ({ isActive }) =>
    isActive !== false ? (
      <span className="user-status-badge user-status-badge--active">Active</span>
    ) : (
      <span className="user-status-badge user-status-badge--inactive">Inactive</span>
    );

  // Reusable toggle action button
  const ToggleStatusBtn = ({ user }) =>
    user.is_active !== false ? (
      <button
        className="halo-button deactivate-btn"
        onClick={() => onDeactivate && onDeactivate(user.id)}
        title="Deactivate this user — removes all access"
      >
        Deactivate
      </button>
    ) : (
      <button
        className="halo-button reactivate-btn"
        onClick={() => onReactivate && onReactivate(user.id)}
        title="Reactivate this user — restores base access only"
      >
        Reactivate
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
              <th>Status</th>
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
                  <div className="user-identity">
                    <span className="user-name-cell">{u.name}</span>
                    <span className="user-email-cell">{u.email}</span>
                  </div>
                </td>
                <td>
                  <StatusBadge isActive={u.is_active} />
                </td>
                <td>
                  <span className={`role-badge ${u.role_id}`}>
                    {u.role_id?.replace('_', ' ')}
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
                          .filter(([_, data]) => data.level !== 'none')
                          .map(([vId]) => {
                            const vInfo = VERTICAL_LIST.find(v => v.id === vId);
                            const label = vInfo ? vInfo.label : vId;
                            return mapVerticalLabel(label);
                          })));
                        
                        return activeVIds.length > 0 ? (
                          activeVIds.map(vLabel => (
                            <span key={vLabel} className="v-tag simple">
                              {vLabel}
                            </span>
                          ))
                        ) : (
                          <span className="v-tag locked">No Access</span>
                        );
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
                    <button className="halo-button edit-user-btn" onClick={() => onEdit(u)} title="Edit User Permissions">
                      <IconEdit size={16} />
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
            <div className="user-card-id">
              <span className="user-name">{u.name}</span>
              <span className="user-email">{u.email}</span>
            </div>
            <div className="user-card-header-right">
              <StatusBadge isActive={u.is_active} />
              <span className={`role-badge ${u.role_id}`}>
                {u.role_id?.replace('_', ' ')}
              </span>
            </div>
          </div>
          
          <div className="user-card-body">
            <label>Access Verticals</label>
            <div className="vertical-tags">
              {u.role_id?.startsWith('master') ? (
                <span className="v-tag master">All Verticals</span>
              ) : (
                (() => {
                  const vPerms = u.verticalPermissions || {};
                  const activeVIds = Array.from(new Set(Object.entries(vPerms)
                    .filter(([_, data]) => data.level !== 'none')
                    .map(([vId]) => {
                      const vInfo = VERTICAL_LIST.find(v => v.id === vId);
                      const label = vInfo ? vInfo.label : vId;
                      return mapVerticalLabel(label);
                    })));
                  return activeVIds.length > 0 ? (
                    activeVIds.map(vLabel => (
                      <span key={vLabel} className="v-tag simple">{vLabel}</span>
                    ))
                  ) : (
                    <span className="v-tag locked">No Access</span>
                  );
                })()
              )}
            </div>
            
            <label style={{marginTop: '12px'}}>Employee Profile</label>
            {/* Employee link status — inactive renders faded red, active renders green */}
            <div className="employee-link-status" style={{marginTop: '4px'}}>
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

          <div className="user-card-actions">
            <button className="halo-button edit-user-btn" onClick={() => onEdit(u)} title="Edit User Permissions">
              <IconEdit size={16} /> Edit Access
            </button>
            <ToggleStatusBtn user={u} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default UserList;

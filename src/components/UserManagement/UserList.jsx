import React from 'react';
import { VERTICAL_LIST } from '../../constants/verticals';
import { IconEdit } from '../Icons';

/**
 * UserList Component
 * Renders the collection of users in either a standard list (table) or responsive grid.
 */
const UserList = ({ users, viewMode, onEdit }) => {
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
              <tr key={u.id}>
                <td>
                  <div className="user-identity">
                    <span className="user-name-cell">{u.name}</span>
                    <span className="user-email-cell">{u.email}</span>
                  </div>
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
                        const activeVIds = Object.entries(vPerms)
                          .filter(([_, data]) => data.level !== 'none')
                          .map(([vId]) => {
                            const vInfo = VERTICAL_LIST.find(v => v.id === vId);
                            return vInfo ? vInfo.label : vId;
                          });
                        
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
                  {u.linkedEmployee ? (
                    <div className="employee-link-badge">
                      <span className="v-tag simple linked" style={{background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)'}}>
                        ✓ Linked: {u.linkedEmployee.full_name} ({u.linkedEmployee.emp_code})
                      </span>
                    </div>
                  ) : (
                    <span className="v-tag locked" style={{opacity: 0.6}}>Not an Employee</span>
                  )}
                </td>
                <td>
                  <button className="halo-button edit-user-btn" onClick={() => onEdit(u)} title="Edit User Permissions">
                    <IconEdit size={16} />
                  </button>
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
        <div key={u.id} className="user-card">
          <div className="user-card-header">
            <div className="user-card-id">
              <span className="user-name">{u.name}</span>
              <span className="user-email">{u.email}</span>
            </div>
            <span className={`role-badge ${u.role_id}`}>
              {u.role_id?.replace('_', ' ')}
            </span>
          </div>
          
          <div className="user-card-body">
            <label>Access Verticals</label>
            <div className="vertical-tags">
              {u.role_id?.startsWith('master') ? (
                <span className="v-tag master">All Verticals</span>
              ) : (
                (() => {
                  const vPerms = u.verticalPermissions || {};
                  const activeVIds = Object.entries(vPerms)
                    .filter(([_, data]) => data.level !== 'none')
                    .map(([vId]) => {
                      const vInfo = VERTICAL_LIST.find(v => v.id === vId);
                      return vInfo ? vInfo.label : vId;
                    });
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
            <div className="employee-link-status" style={{marginTop: '4px'}}>
              {u.linkedEmployee ? (
                <span className="v-tag simple linked" style={{background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)'}}>
                  ✓ {u.linkedEmployee.full_name} ({u.linkedEmployee.emp_code})
                </span>
              ) : (
                <span className="v-tag locked" style={{opacity: 0.6}}>Not an Employee</span>
              )}
            </div>
          </div>

          <div className="user-card-actions">
            <button className="halo-button edit-user-btn" onClick={() => onEdit(u)} title="Edit User Permissions">
              <IconEdit size={16} /> Edit Access
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UserList;
